from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

# ==================== User Profile ====================
class UserProfileBase(BaseModel):
    full_name: str = Field(..., max_length=100)
    email: str = Field(..., max_length=100)
    phone: Optional[str] = Field(None, max_length=30)
    address: Optional[str] = None
    linkedin: Optional[str] = Field(None, max_length=200)
    github: Optional[str] = Field(None, max_length=200)
    portfolio: Optional[str] = Field(None, max_length=200)

class UserProfileCreate(UserProfileBase):
    pass

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=30)
    address: Optional[str] = None
    linkedin: Optional[str] = Field(None, max_length=200)
    github: Optional[str] = Field(None, max_length=200)
    portfolio: Optional[str] = Field(None, max_length=200)

class UserProfileRead(UserProfileBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ==================== Resumes ====================
class ResumeBase(BaseModel):
    name: str = Field(..., max_length=100)
    file_name: str = Field(..., max_length=200)
    file_path: str = Field(..., max_length=500)
    file_type: str = Field(..., max_length=10)
    parsed_text: Optional[str] = None
    tags: Optional[str] = None

class ResumeCreate(ResumeBase):
    pass

class ResumeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    parsed_text: Optional[str] = None
    tags: Optional[str] = None

class ResumeRead(ResumeBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ==================== Templates ====================
class TemplateBase(BaseModel):
    name: str = Field(..., max_length=100)
    file_name: str = Field(..., max_length=200)
    file_path: str = Field(..., max_length=500)
    spec_path: Optional[str] = Field(None, max_length=500)
    thumbnail_path: Optional[str] = Field(None, max_length=500)

class TemplateCreate(TemplateBase):
    pass

class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    spec_path: Optional[str] = Field(None, max_length=500)
    thumbnail_path: Optional[str] = Field(None, max_length=500)

class TemplateRead(TemplateBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ==================== Cover Letters ====================
class CoverLetterBase(BaseModel):
    session_id: str
    position_title: Optional[str] = Field(None, max_length=100)
    company_name: Optional[str] = Field(None, max_length=100)
    contact_person: Optional[str] = Field(None, max_length=100)
    language: str = "en"
    style_type: Optional[str] = Field(None, max_length=50)
    resume_id: Optional[str] = None
    template_id: Optional[str] = None
    raw_letter_text: Optional[str] = None
    qa_letter_text: Optional[str] = None
    final_letter_text: Optional[str] = None
    pdf_path: Optional[str] = Field(None, max_length=500)
    status: str = "draft"

class CoverLetterCreate(CoverLetterBase):
    pass

class CoverLetterUpdate(BaseModel):
    position_title: Optional[str] = Field(None, max_length=100)
    company_name: Optional[str] = Field(None, max_length=100)
    contact_person: Optional[str] = Field(None, max_length=100)
    language: Optional[str] = "en"
    style_type: Optional[str] = Field(None, max_length=50)
    resume_id: Optional[str] = None
    template_id: Optional[str] = None
    raw_letter_text: Optional[str] = None
    qa_letter_text: Optional[str] = None
    final_letter_text: Optional[str] = None
    pdf_path: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = "draft"

class CoverLetterRead(CoverLetterBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ==================== LLM Configuration ====================
class LLMConfigBase(BaseModel):
    openrouter_key: Optional[str] = None
    groq_key: Optional[str] = None
    together_key: Optional[str] = None
    preferred_model: str = "google/gemini-2.0-flash-exp:free"
    fallback_chain: str = '["google/gemini-2.0-flash-exp:free","meta-llama/llama-3.3-70b-instruct:free","deepseek/deepseek-chat-v3-0324:free","groq/llama-3.3-70b-versatile","mistralai/mistral-7b-instruct:free"]'

class LLMConfigCreate(LLMConfigBase):
    pass

class LLMConfigUpdate(BaseModel):
    openrouter_key: Optional[str] = None
    groq_key: Optional[str] = None
    together_key: Optional[str] = None
    preferred_model: Optional[str] = None
    fallback_chain: Optional[str] = None

class LLMConfigRead(LLMConfigBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# ==================== Generation Session ====================
class GenerationSessionBase(BaseModel):
    status: str = "pending"
    current_model: Optional[str] = Field(None, max_length=100)
    tokens_used: int = 0
    progress_pct: int = 0
    error_message: Optional[str] = None
    cover_letter_id: Optional[str] = None

class GenerationSessionCreate(GenerationSessionBase):
    id: str

class GenerationSessionUpdate(BaseModel):
    status: Optional[str] = None
    current_model: Optional[str] = Field(None, max_length=100)
    tokens_used: Optional[int] = None
    progress_pct: Optional[int] = None
    error_message: Optional[str] = None
    cover_letter_id: Optional[str] = None

class GenerationSessionRead(GenerationSessionBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Cover Letter Composer schemas ─────────────────────────────────────────────

class ComposeRequest(BaseModel):
    """
    Sent by the frontend when the user clicks 'Compose PDF'.
    All fields except body_paragraphs are optional — the LLM will extract
    missing values from the body text if they are empty strings.
    """
    company_name:    str       = ""
    contact_person:  str       = ""
    company_address: str       = ""
    position:        str       = ""
    salutation:      str       = ""
    body_paragraphs: list[str] = []   # one string per paragraph
    sign_off:        str       = "Mit freundlichen Grüßen,"
    template_version: str      = "v1"  # "v1" or "v2"
    # letter_date is always auto-generated server-side (today) — not sent by client


class ComposeResponse(BaseModel):
    cover_letter_id: str
    letter_date:     str
    company_name:    str
    position:        str
    preview_url:     str    # GET this URL to stream the PDF bytes for preview
    export_url:      str    # GET this URL to download the final PDF


class ExtractFieldsRequest(BaseModel):
    """
    Sent when the user pastes body text but hasn't filled in the fields.
    The LLM reads the text and returns what it can find.
    This call is optional — the user can always fill fields manually.
    """
    text: str


class ExtractFieldsResponse(BaseModel):
    company_name:    str | None = None
    contact_person:  str | None = None
    company_address: str | None = None
    position:        str | None = None
    salutation:      str | None = None


class CoverLetterHistoryItem(BaseModel):
    id:              str
    company_name:    str
    position:        str
    letter_date:     str
    status:          str
    created_at:      str
