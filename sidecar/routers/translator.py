import os
import json
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import pdfplumber

from models.database import get_db
from models.orm import TranslatorDocument, TranslatorChapter, TranslatorExport
from services.doc_splitter import extract_toc
from services.translator_service import translate_page
from services.translation_exporter import export_chapter_pdf
from services.translation_cache import get_chapter_cache_status
import services.crud as crud

router = APIRouter(prefix="/api/translator", tags=["translator"])

STORAGE_ROOT = Path.home() / ".covercraft"
TRANSLATOR_DIR = STORAGE_ROOT / "translator"
TRANSLATOR_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    target_language: str = "fa",
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads a multi-chapter PDF and registers it.
    Returns doc_id immediately so TOC extraction can run as a separate streaming process.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported.")
        
    doc_id = str(uuid.uuid4())
    doc_dir = TRANSLATOR_DIR / doc_id
    doc_dir.mkdir(parents=True, exist_ok=True)
    
    dest = doc_dir / "original.pdf"
    
    # Save the PDF document to disk
    try:
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file to disk: {str(e)}")

    # Count total pages immediately
    try:
        with pdfplumber.open(dest) as pdf:
            total_pages = len(pdf.pages)
    except Exception as e:
        if dest.exists():
            dest.unlink()
        raise HTTPException(status_code=400, detail=f"Uploaded file is not a valid PDF: {str(e)}")

    is_rtl = 1 if target_language in {"fa", "ar", "he", "ur"} else 0
    doc = TranslatorDocument(
        id=doc_id,
        file_name=file.filename,
        file_path=str(dest),
        target_language=target_language,
        is_rtl=is_rtl,
        total_pages=total_pages,
        status="pending"
    )
    db.add(doc)
    await db.commit()

    return {
        "doc_id": doc_id,
        "total_pages": total_pages,
        "status": "pending"
    }

@router.get("/{doc_id}/extract-toc/stream")
async def stream_toc_extraction(
    doc_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    SSE stream endpoint to extract table of contents, create chapters, and track progress.
    """
    async def generate():
        doc = await db.get(TranslatorDocument, doc_id)
        if not doc:
            err_data = json.dumps({"type": "error", "message": "Document not found"})
            yield f"data: {err_data}\n\n"
            return

        yield f"data: {json.dumps({'type': 'progress', 'message': 'Analyzing PDF structural layouts…'})}\n\n"

        # Fetch live LLM configuration
        llm_config = await crud.get_llm_config(db)
        if not llm_config:
            pref_model = "google/gemini-2.0-flash-exp:free"
            fallbacks = '["google/gemini-2.0-flash-exp:free","meta-llama/llama-3.3-70b-instruct:free"]'
            openrouter_key = None
            groq_key = None
        else:
            pref_model = llm_config.preferred_model
            fallbacks = llm_config.fallback_chain
            openrouter_key = llm_config.openrouter_key
            groq_key = llm_config.groq_key

        try:
            chapters_raw = await extract_toc(
                pdf_path=doc.file_path,
                preferred_model=pref_model,
                fallback_chain_json=fallbacks,
                openrouter_key=openrouter_key,
                groq_key=groq_key
            )
        except Exception as e:
            err_data = json.dumps({"type": "error", "message": f"TOC extraction failed: {str(e)}"})
            yield f"data: {err_data}\n\n"
            return

        yield f"data: {json.dumps({'type': 'progress', 'message': f'Found {len(chapters_raw)} chapters. Storing references…'})}\n\n"

        # Delete any existing chapters to support re-runs
        existing = await db.execute(select(TranslatorChapter).where(TranslatorChapter.document_id == doc_id))
        for old in existing.scalars().all():
            await db.delete(old)

        # Create chapter ORM entries
        for ch_data in chapters_raw:
            ch = TranslatorChapter(
                id=str(uuid.uuid4()),
                document_id=doc_id,
                chapter_index=ch_data["chapter_index"],
                title=ch_data["title"],
                page_start=ch_data["page_start"],
                page_end=ch_data["page_end"],
                page_count=ch_data["page_count"]
            )
            db.add(ch)

        doc.toc_raw = json.dumps(chapters_raw)
        doc.status = "ready"
        await db.commit()

        yield f"data: {json.dumps({'type': 'done', 'chapter_count': len(chapters_raw)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

@router.get("/{doc_id}/chapters")
async def get_chapters(
    doc_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the list of chapters associated with this document.
    """
    res = await db.execute(
        select(TranslatorChapter)
        .where(TranslatorChapter.document_id == doc_id)
        .order_by(TranslatorChapter.chapter_index)
    )
    return res.scalars().all()

@router.get("/{doc_id}/chapters/{ch_idx}/cache-status")
async def chapter_cache_status(
    doc_id: str,
    ch_idx: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns an array of booleans indicating whether each page in the chapter is cached in Redis.
    """
    doc = await db.get(TranslatorDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    res = await db.execute(
        select(TranslatorChapter)
        .where(TranslatorChapter.document_id == doc_id, TranslatorChapter.chapter_index == ch_idx)
    )
    ch = res.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found.")

    status = await get_chapter_cache_status(doc_id, ch_idx, ch.page_count, doc.target_language)
    return {
        "chapter_index": ch_idx,
        "pages": status
    }

@router.get("/{doc_id}/page/{absolute_page}")
async def get_original_page_text(
    doc_id: str,
    absolute_page: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Extracts and returns raw text of a specific page from the original PDF document.
    """
    doc = await db.get(TranslatorDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        with pdfplumber.open(doc.file_path) as pdf:
            if absolute_page < 0 or absolute_page >= len(pdf.pages):
                raise HTTPException(status_code=400, detail="Page index out of bounds.")
            page_text = pdf.pages[absolute_page].extract_text() or ""
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read page text: {str(e)}")

    return {"text": page_text}

@router.get("/{doc_id}/translate/stream")
async def stream_translation_endpoint(
    doc_id: str,
    chapter_idx: int,
    page_in_chapter: int,
    db: AsyncSession = Depends(get_db)
):
    """
    SSE stream to translate one page within a chapter.
    """
    doc = await db.get(TranslatorDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    res = await db.execute(
        select(TranslatorChapter)
        .where(TranslatorChapter.document_id == doc_id, TranslatorChapter.chapter_index == chapter_idx)
    )
    ch = res.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found.")

    absolute_page = ch.page_start + page_in_chapter

    # Fetch live LLM configuration
    llm_config = await crud.get_llm_config(db)
    if not llm_config:
        pref_model = "google/gemini-2.0-flash-exp:free"
        fallbacks = '["google/gemini-2.0-flash-exp:free","meta-llama/llama-3.3-70b-instruct:free"]'
        openrouter_key = None
        groq_key = None
    else:
        pref_model = llm_config.preferred_model
        fallbacks = llm_config.fallback_chain
        openrouter_key = llm_config.openrouter_key
        groq_key = llm_config.groq_key

    async def generate():
        try:
            generator = translate_page(
                doc_id=doc_id,
                pdf_path=doc.file_path,
                chapter_index=chapter_idx,
                page_index_in_chapter=page_in_chapter,
                absolute_page_index=absolute_page,
                target_lang=doc.target_language,
                preferred_model=pref_model,
                fallback_chain_json=fallbacks,
                openrouter_key=openrouter_key,
                groq_key=groq_key
            )
            async for sse_chunk in generator:
                yield f"data: {json.dumps(sse_chunk)}\n\n"
        except Exception as e:
            err_data = json.dumps({"type": "error", "message": f"Translation failed: {str(e)}"})
            yield f"data: {err_data}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

@router.post("/{doc_id}/export/chapter/{ch_idx}")
async def export_chapter_endpoint(
    doc_id: str,
    ch_idx: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Assembles cached page translations of a chapter and exports them into a shaped PDF.
    """
    doc = await db.get(TranslatorDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    res = await db.execute(
        select(TranslatorChapter)
        .where(TranslatorChapter.document_id == doc_id, TranslatorChapter.chapter_index == ch_idx)
    )
    ch = res.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found.")

    # Create export record
    export_record = TranslatorExport(
        id=str(uuid.uuid4()),
        document_id=doc_id,
        chapter_id=ch.id,
        export_type="chapter",
        status="rendering"
    )
    db.add(export_record)
    await db.commit()

    try:
        pdf_path = await export_chapter_pdf(doc, ch, export_record.id)
    except Exception as e:
        export_record.status = "error"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"PDF rendering failed: {str(e)}")

    export_record.pdf_path = pdf_path
    export_record.status = "done"
    await db.commit()

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{ch.title.replace(' ', '_')}_translated.pdf"
    )
