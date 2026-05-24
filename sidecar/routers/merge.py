import io
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from pypdf import PdfReader, PdfWriter

router = APIRouter(prefix="/api/merge", tags=["merge"])

@router.post("")
async def merge_pdfs_endpoint(
    files: list[UploadFile] = File(...)
):
    """
    Combines up to 5 uploaded PDF documents in the order they are received.
    """
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 PDFs allowed.")
    
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least 2 PDFs are required to merge.")

    writer = PdfWriter()
    
    for upload_file in files:
        if not upload_file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail=f"File {upload_file.filename} is not a valid PDF."
            )
        try:
            content = await upload_file.read()
            reader = PdfReader(io.BytesIO(content))
            for page in reader.pages:
                writer.add_page(page)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to read or parse {upload_file.filename}: {str(e)}"
            )

    output = io.BytesIO()
    try:
        writer.write(output)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compile merged PDF: {str(e)}"
        )
        
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=merged.pdf"}
    )
