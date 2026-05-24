import json
import os
import shutil
import uuid
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.schemas import TemplateRead, TemplateCreate
import services.crud as crud
from services.template_spec import generate_thumbnail, extract_template_spec

router = APIRouter(prefix="/api/templates", tags=["templates"])

STORAGE_ROOT = Path.home() / ".covercraft"
TEMPLATES_DIR = STORAGE_ROOT / "templates"
THUMBNAILS_DIR = STORAGE_ROOT / "thumbnails"

TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

@router.get("", response_model=List[TemplateRead])
async def list_templates(db: AsyncSession = Depends(get_db)):
    return await crud.get_templates(db)

@router.post("", response_model=TemplateRead)
async def upload_template(
    name: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    orig_filename = file.filename or "template.pdf"
    ext = os.path.splitext(orig_filename)[1].lower().strip('.')
    
    if ext != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported as cover letter templates.")
        
    uid = str(uuid.uuid4())
    stored_filename = f"{uid}_{orig_filename}"
    pdf_path = TEMPLATES_DIR / stored_filename
    
    # Save PDF file
    try:
        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write template PDF to disk: {str(e)}")
        
    # Extract template layout specifications
    spec = extract_template_spec(str(pdf_path))
    spec_filename = f"{uid}_spec.json"
    spec_path = TEMPLATES_DIR / spec_filename
    try:
        with open(spec_path, "w", encoding="utf-8") as f:
            json.dump(spec, f, indent=2)
    except Exception as e:
        if pdf_path.exists():
            pdf_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to write template spec: {str(e)}")
        
    # Generate thumbnail image
    thumbnail_filename = f"{uid}_thumbnail.png"
    thumbnail_path = THUMBNAILS_DIR / thumbnail_filename
    has_thumbnail = generate_thumbnail(str(pdf_path), str(thumbnail_path))
    
    db_thumbnail_path = str(thumbnail_path) if has_thumbnail else None
    
    # Create record
    template_create = TemplateCreate(
        name=name,
        file_name=orig_filename,
        file_path=str(pdf_path),
        spec_path=str(spec_path),
        thumbnail_path=db_thumbnail_path
    )
    
    db_template = await crud.create_template(db, template_create)
    return db_template

@router.delete("/{template_id}")
async def delete_template(template_id: str, db: AsyncSession = Depends(get_db)):
    db_template = await crud.get_template(db, template_id)
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found.")
        
    # Remove PDF file
    pdf_path = Path(db_template.file_path)
    if pdf_path.exists():
        pdf_path.unlink()
        
    # Remove spec file
    if db_template.spec_path:
        spec_path = Path(db_template.spec_path)
        if spec_path.exists():
            spec_path.unlink()
            
    # Remove thumbnail file
    if db_template.thumbnail_path:
        thumb_path = Path(db_template.thumbnail_path)
        if thumb_path.exists():
            thumb_path.unlink()

    # Remove from DB
    deleted = await crud.delete_template(db, template_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete template record.")
        
    return {"status": "success", "message": "Template deleted successfully."}

@router.get("/{template_id}/thumbnail")
async def get_template_thumbnail(template_id: str, db: AsyncSession = Depends(get_db)):
    db_template = await crud.get_template(db, template_id)
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found.")
        
    if db_template.thumbnail_path and os.path.exists(db_template.thumbnail_path):
        return FileResponse(db_template.thumbnail_path, media_type="image/png")
        
    # Serve fallback static svg or pixel placeholder if thumbnail is missing
    # Let's generate a basic gray placeholder dynamically
    fallback_thumb_path = Path(__file__).parent.parent / "static" / "placeholder.png"
    if fallback_thumb_path.exists():
        return FileResponse(str(fallback_thumb_path), media_type="image/png")
        
    # Standard transparent/gray pixel fallback
    raise HTTPException(status_code=404, detail="Thumbnail not available.")
