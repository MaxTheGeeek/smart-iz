import datetime
import uuid
from typing import List, Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func, Column
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class UserProfile(Base):
    __tablename__ = "user_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linkedin: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    github: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    portfolio: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    file_name: Mapped[str] = mapped_column(String(200), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'pdf', 'docx', 'txt'
    parsed_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON-serialized array
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())



class Template(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    file_name: Mapped[str] = mapped_column(String(200), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    spec_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())

    cover_letters: Mapped[List["CoverLetter"]] = relationship("CoverLetter", back_populates="template")

class CoverLetter(Base):
    __tablename__ = "cover_letters"

    id               = Column(String,   primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id      = Column(String,   ForeignKey("templates.id"), nullable=True)
    company_name     = Column(String,   nullable=False, default="")
    contact_person   = Column(String,   nullable=True)
    company_address  = Column(String,   nullable=True)
    position         = Column(String,   nullable=False, default="")
    salutation       = Column(String,   nullable=True)
    body_paragraphs  = Column(Text,     nullable=False, default="[]")  # JSON array of strings
    sign_off         = Column(String,   nullable=True)
    letter_date      = Column(String,   nullable=False, default="")
    composed_pdf_path = Column(String,  nullable=True)
    status           = Column(String,   default="draft")   # 'draft' | 'composed' | 'exported'
    created_at       = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    template = relationship("Template", back_populates="cover_letters")

class LLMConfig(Base):
    __tablename__ = "llm_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    openrouter_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    groq_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    together_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    preferred_model: Mapped[str] = mapped_column(String(100), default="google/gemini-2.0-flash-exp:free")
    fallback_chain: Mapped[str] = mapped_column(
        Text, 
        default='["google/gemini-2.0-flash-exp:free","meta-llama/llama-3.3-70b-instruct:free","deepseek/deepseek-chat-v3-0324:free","groq/llama-3.3-70b-versatile","mistralai/mistral-7b-instruct:free"]'
    )

class GenerationSession(Base):
    __tablename__ = "generation_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # 'pending', 'parsing', 'generating', 'qa', 'rendering', 'done', 'error'
    current_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cover_letter_id: Mapped[Optional[str]] = mapped_column(ForeignKey("cover_letters.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    cover_letter: Mapped[Optional["CoverLetter"]] = relationship("CoverLetter")

class TranslatorDocument(Base):
    __tablename__ = "translator_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_name: Mapped[str] = mapped_column(String(200), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    target_language: Mapped[str] = mapped_column(String(10), nullable=False)
    is_rtl: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_pages: Mapped[int] = mapped_column(Integer, nullable=True)
    toc_raw: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())

    chapters: Mapped[List["TranslatorChapter"]] = relationship(
        "TranslatorChapter",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="TranslatorChapter.chapter_index"
    )

class TranslatorChapter(Base):
    __tablename__ = "translator_chapters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(ForeignKey("translator_documents.id", ondelete="CASCADE"), nullable=False)
    chapter_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    page_start: Mapped[int] = mapped_column(Integer, nullable=False)   # 0-based
    page_end: Mapped[int] = mapped_column(Integer, nullable=False)     # 0-based inclusive
    page_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())

    document: Mapped["TranslatorDocument"] = relationship("TranslatorDocument", back_populates="chapters")

class TranslatorExport(Base):
    __tablename__ = "translator_exports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(ForeignKey("translator_documents.id", ondelete="CASCADE"), nullable=False)
    chapter_id: Mapped[Optional[str]] = mapped_column(ForeignKey("translator_chapters.id", ondelete="SET NULL"), nullable=True)
    export_type: Mapped[str] = mapped_column(String(20), default="chapter")  # 'chapter'
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())

