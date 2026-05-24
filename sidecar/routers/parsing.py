import os
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.orm import CoverLetter, GenerationSession
import services.crud as crud
from services.resume_parser import parse_resume
from services.position_parser import parse_position, detect_language

router = APIRouter(prefix="/api/position", tags=["parsing"])

STORAGE_ROOT = Path.home() / ".covercraft"
TMP_DIR = STORAGE_ROOT / "tmp"
TMP_DIR.mkdir(parents=True, exist_ok=True)

class PositionParseRequest(BaseModel):
    text: str
    language: str | None = None  # User overridden language ('en' | 'de')

class PositionParseResult(BaseModel):
    position_title: str
    company_name: str | None
    contact_person: str | None
    contact_email: str | None
    key_skills: list[str]
    required_experience: str | None
    industry: str | None
    position_summary: str
    language_detected: str
    session_id: str

@router.post("/parse", response_model=PositionParseResult)
async def parse_position_endpoint(
    payload: PositionParseRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    POST endpoint to parse pasted job description text.
    """
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Job description text cannot be empty.")

    # 1. Detect language
    lang = payload.language or detect_language(text)

    # 2. Fetch live LLM configuration
    llm_config = await crud.get_llm_config(db)
    if not llm_config:
        pref_model = "google/gemini-2.0-flash-exp:free"
        fallbacks = '["google/gemini-2.0-flash-exp:free","meta-llama/llama-3.3-70b-instruct:free","deepseek/deepseek-chat-v3-0324:free"]'
        openrouter_key = None
        groq_key = None
    else:
        pref_model = llm_config.preferred_model
        fallbacks = llm_config.fallback_chain
        openrouter_key = llm_config.openrouter_key
        groq_key = llm_config.groq_key

    # 3. Call parser service
    try:
        parsed_data = await parse_position(
            text=text,
            preferred_model=pref_model,
            fallback_chain_json=fallbacks,
            openrouter_key=openrouter_key,
            groq_key=groq_key
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse job description: {str(e)}")

    # 4. Generate persistent sessions
    session_id = str(uuid.uuid4())
    cover_letter = CoverLetter(
        id=str(uuid.uuid4()),
        session_id=session_id,
        position_title=parsed_data.get("position_title"),
        company_name=parsed_data.get("company_name"),
        contact_person=parsed_data.get("contact_person"),
        language=lang,
        status="draft"
    )
    db.add(cover_letter)

    gen_session = GenerationSession(
        id=session_id,
        status="parsing",
        current_model=pref_model,
        cover_letter_id=cover_letter.id
    )
    db.add(gen_session)

    await db.commit()

    return PositionParseResult(
        position_title=parsed_data.get("position_title") or "Position",
        company_name=parsed_data.get("company_name"),
        contact_person=parsed_data.get("contact_person"),
        contact_email=parsed_data.get("contact_email"),
        key_skills=parsed_data.get("key_skills") or [],
        required_experience=parsed_data.get("required_experience"),
        industry=parsed_data.get("industry"),
        position_summary=parsed_data.get("position_summary") or "",
        language_detected=lang,
        session_id=session_id
    )

@router.post("/upload")
async def upload_position_document(
    file: UploadFile = File(...)
):
    """
    POST endpoint that extracts raw text from PDF, DOCX, or TXT position postings.
    Returns the raw extracted text so the user can verify it before triggering LLM parsing.
    """
    orig_filename = file.filename or "posting.pdf"
    ext = os.path.splitext(orig_filename)[1].lower().strip('.')
    
    if ext not in ("pdf", "docx", "txt"):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and TXT job postings are supported.")

    uid = str(uuid.uuid4())
    stored_filename = f"{uid}_{orig_filename}"
    file_path = TMP_DIR / stored_filename

    # Save to temp directory
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file to disk: {str(e)}")

    # Extract text content
    try:
        extracted_text = parse_resume(str(file_path), ext)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract document text: {str(e)}")
    finally:
        # Clean up temp file immediately
        if file_path.exists():
            try:
                file_path.unlink()
            except Exception:
                pass

    lang = detect_language(extracted_text)

    return {
        "text": extracted_text,
        "language_detected": lang
    }
