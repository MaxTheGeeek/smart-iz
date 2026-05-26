"""
sidecar/routers/composer.py
============================
Handles the PDF Composer feature.
- POST /api/composer/compose       → render cover letter PDF from user inputs
- POST /api/composer/extract-fields → LLM extracts fields from pasted body text (optional)
- GET  /api/composer/{id}/preview  → serve PDF inline for browser preview
- GET  /api/composer/{id}/export   → download PDF with descriptive filename
- GET  /api/composer/history       → list past composed cover letters
"""

import json
from uuid import uuid4
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select

from models.database import get_db
from models.orm import CoverLetter
from models.schemas import (
    ComposeRequest, ComposeResponse,
    ExtractFieldsRequest, ExtractFieldsResponse,
    CoverLetterHistoryItem,
)
from services.pdf_composer import compose_cover_letter_pdf
from services.crud import get_llm_config, add_log
from services.llm_engine import stream_completion_with_fallback

router = APIRouter(prefix="/api/composer")

EXPORTS_DIR = Path.home() / ".covercraft" / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# ── User profile defaults — loaded from DB settings in production ─────────────
DEFAULT_PROFILE = {
    "full_name":  "MAJID BEHZADI",
    "job_title":  "Full-Stack Developer",
    "address":    "Wehlistraße 334, 1020 Wien",
    "phone":      "+43 676 970 1820",
    "email":      "maxbehzadi82@gmail.com",
    "website":    "www.maxbehzadi.online",
    "city":       "Wien",
}


@router.post("/compose", response_model=ComposeResponse)
async def compose(request: ComposeRequest, db=Depends(get_db)):
    """
    Main endpoint. Takes the user's inputs and renders a PDF.
    No LLM is called here — rendering is pure ReportLab.
    """
    # Determine the location address based on selected template version
    profile = dict(DEFAULT_PROFILE)
    if request.template_version == "v2":
        profile["address"] = "Wiener Straße 20/1, 2442 Unterwaltersdorf"
        profile["city"] = "Unterwaltersdorf"
    else:
        profile["address"] = "Wehlistraße 334, 1020 Wien"
        profile["city"] = "Wien"

    # Generate today's date in German format
    today = date.today()
    months_de = [
        "Januar", "Februar", "März", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember"
    ]
    letter_date = (
        f"{profile['city']}, "
        f"{today.day}. {months_de[today.month - 1]} {today.year}"
    )

    # Create DB record
    cover_letter_id = str(uuid4())
    record = CoverLetter(
        id=cover_letter_id,
        company_name=request.company_name,
        contact_person=request.contact_person,
        company_address=request.company_address,
        position=request.position,
        salutation=request.salutation,
        body_paragraphs=json.dumps(request.body_paragraphs),
        sign_off=request.sign_off,
        letter_date=letter_date,
        status="draft",
    )
    db.add(record)
    await db.commit()

    await add_log(db, "INFO", f"Composing cover letter draft (ID: {cover_letter_id}) for {request.company_name} (Position: {request.position or 'N/A'}) using template version {request.template_version}")

    # Render PDF
    output_path = str(EXPORTS_DIR / f"cover_{cover_letter_id[:8]}.pdf")
    try:
        compose_cover_letter_pdf(
            output_path=output_path,
            **profile,
            letter_date=letter_date,
            company_name=request.company_name,
            contact_person=request.contact_person,
            company_address=request.company_address,
            position=request.position,
            salutation=request.salutation,
            body_paragraphs=request.body_paragraphs,
            sign_off=request.sign_off,
        )
    except Exception as e:
        await add_log(db, "ERROR", f"PDF render failed for draft {cover_letter_id}: {str(e)}")
        raise HTTPException(500, f"PDF render failed: {e}")

    # Update record with PDF path
    record.composed_pdf_path = output_path
    record.status = "composed"
    await db.commit()

    await add_log(db, "INFO", f"Successfully generated cover letter PDF (ID: {cover_letter_id}) at path: {output_path}")


    return ComposeResponse(
        cover_letter_id=cover_letter_id,
        letter_date=letter_date,
        company_name=request.company_name,
        position=request.position,
        preview_url=f"/api/composer/{cover_letter_id}/preview",
        export_url=f"/api/composer/{cover_letter_id}/export",
    )


@router.post("/extract-fields", response_model=ExtractFieldsResponse)
async def extract_fields(request: ExtractFieldsRequest, db=Depends(get_db)):
    """
    Optional helper. User pastes their cover letter body text.
    LLM reads it and returns company name, position, contact person,
    company address, and salutation — pre-filling the form fields.
    
    If the LLM fails for any reason, returns empty strings.
    The user can always fill the fields manually.
    """
    if not request.text or len(request.text.strip()) < 20:
        return ExtractFieldsResponse()

    EXTRACT_PROMPT = """
Read the following cover letter text carefully.
Extract these five fields and return ONLY a valid JSON object.
If a field is not clearly present in the text, use null for that field.

Fields to extract:
- company_name: The name of the company being applied to
- contact_person: The salutation line (e.g. "z. Hd. Frau Regina Danninger")
- company_address: The city and country of the company (e.g. "Gross Siegharts, Österreich")
- position: The job title being applied for (e.g. "Software EntwicklerIn C# .NET (m/w/d)")
- salutation: The opening greeting line (e.g. "Sehr geehrte Frau Danninger,")

Return ONLY this JSON structure, no markdown, no explanation:
{
  "company_name": "...",
  "contact_person": "...",
  "company_address": "...",
  "position": "...",
  "salutation": "..."
}

COVER LETTER TEXT:
""" + request.text[:4000]

    try:
        # Load LLM config
        config = await get_llm_config(db)
        pref_model = config.preferred_model if config else "google/gemini-2.0-flash-exp:free"
        fb_chain = config.fallback_chain if config else "[]"
        or_key = config.openrouter_key if config else None
        g_key = config.groq_key if config else None

        full_response = ""
        async for chunk_str in stream_completion_with_fallback(
            prompt=EXTRACT_PROMPT,
            system_prompt="You extract structured fields from cover letter text. Return only valid JSON.",
            preferred_model=pref_model,
            fallback_chain_json=fb_chain,
            openrouter_key=or_key,
            groq_key=g_key,
            temperature=0.1
        ):
            chunk = json.loads(chunk_str)
            if chunk.get("type") == "content":
                full_response += chunk.get("text", "")
            elif chunk.get("type") == "done":
                if "full_text" in chunk:
                    full_response = chunk["full_text"]

        clean = (full_response.strip()
                 .removeprefix("```json")
                 .removeprefix("```")
                 .removesuffix("```")
                 .strip())
        data = json.loads(clean)
        await add_log(db, "INFO", f"Successfully extracted fields using LLM: {json.dumps(data)}")
        return ExtractFieldsResponse(**{
            k: v for k, v in data.items() if v  # drop null/empty values
        })
    except Exception as e:
        import traceback
        await add_log(db, "ERROR", f"LLM Field extraction failed: {str(e)}\n{traceback.format_exc()}")
        return ExtractFieldsResponse()   # always degrade gracefully


@router.get("/{cover_letter_id}/preview")
async def preview(cover_letter_id: str, db=Depends(get_db)):
    """Serve the PDF inline for the iframe preview panel."""
    record = await db.get(CoverLetter, cover_letter_id)
    if not record or not record.composed_pdf_path:
        raise HTTPException(404, "Cover letter not found or not yet composed")
    return FileResponse(
        record.composed_pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline"},
    )


@router.get("/{cover_letter_id}/export")
async def export_pdf(cover_letter_id: str, db=Depends(get_db)):
    """Download the PDF with a descriptive filename."""
    record = await db.get(CoverLetter, cover_letter_id)
    if not record or not record.composed_pdf_path:
        raise HTTPException(404, "Cover letter not found or not yet composed")

    safe_position = record.position.replace("/", "-").replace("\\", "-")
    safe_company  = record.company_name.replace("/", "-").replace("\\", "-")
    filename = f"Bewerbung {safe_position} - {safe_company}.pdf"

    record.status = "exported"
    await db.commit()

    return FileResponse(
        record.composed_pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/history", response_model=list[CoverLetterHistoryItem])
async def history(db=Depends(get_db)):
    """Return the last 50 composed cover letters, newest first."""
    result = await db.execute(
        select(CoverLetter)
        .order_by(CoverLetter.created_at.desc())
        .limit(50)
    )
    records = result.scalars().all()
    return [
        CoverLetterHistoryItem(
            id=r.id,
            company_name=r.company_name,
            position=r.position,
            letter_date=r.letter_date,
            status=r.status,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in records
    ]
