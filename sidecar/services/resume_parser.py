import pdfplumber
from docx import Document

def parse_resume(file_path: str, file_type: str) -> str:
    """
    Extracts text from PDF, DOCX, or TXT resumes.
    """
    file_type = file_type.lower().strip('.')
    
    if file_type == "pdf":
        text_content = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text_content.append(extracted)
        return "\n".join(text_content)
        
    elif file_type == "docx":
        doc = Document(file_path)
        return "\n".join(para.text for para in doc.paragraphs)
        
    elif file_type in ("txt", "text"):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
            
    else:
        raise ValueError(f"Unsupported file type for parsing: {file_type}")
