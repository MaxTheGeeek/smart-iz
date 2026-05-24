import os
import uuid
import shutil
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.schemas import ResumeRead, ResumeCreate
import services.crud as crud
from services.resume_parser import parse_resume

router = APIRouter(prefix="/api/resumes", tags=["resumes"])

STORAGE_ROOT = Path.home() / ".covercraft"
RESUMES_DIR = STORAGE_ROOT / "resumes"
RESUMES_DIR.mkdir(parents=True, exist_ok=True)

@router.get("", response_model=List[ResumeRead])
async def list_resumes(db: AsyncSession = Depends(get_db)):
    return await crud.get_resumes(db)

@router.post("", response_model=ResumeRead)
async def upload_resume(
    name: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    # Determine extension
    orig_filename = file.filename or "resume.pdf"
    ext = os.path.splitext(orig_filename)[1].lower().strip('.')
    
    if ext not in ("pdf", "docx", "txt"):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and TXT resumes are supported.")
        
    # Generate unique path
    uid = str(uuid.uuid4())
    stored_filename = f"{uid}_{orig_filename}"
    file_path = RESUMES_DIR / stored_filename

    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file to disk: {str(e)}")
        
    # Parse text content
    try:
        parsed_text = parse_resume(str(file_path), ext)
    except Exception as e:
        # Clean up file on failure
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to parse resume text: {str(e)}")

    # Create record
    resume_create = ResumeCreate(
        name=name,
        file_name=orig_filename,
        file_path=str(file_path),
        file_type=ext,
        parsed_text=parsed_text,
        tags="[]" # Empty array of tags by default
    )
    
    db_resume = await crud.create_resume(db, resume_create)
    return db_resume

@router.delete("/{resume_id}")
async def delete_resume(resume_id: str, db: AsyncSession = Depends(get_db)):
    db_resume = await crud.get_resume(db, resume_id)
    if not db_resume:
        raise HTTPException(status_code=404, detail="Resume not found.")
        
    # Remove file from disk
    file_path = Path(db_resume.file_path)
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception as e:
            print(f"[warning] Failed to delete file {file_path}: {e}")

    # Remove from DB
    deleted = await crud.delete_resume(db, resume_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete resume record.")
        
    return {"status": "success", "message": "Resume deleted successfully."}
