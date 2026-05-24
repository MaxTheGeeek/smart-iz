from typing import List, Optional
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from models.orm import UserProfile, Resume, Template, CoverLetter, LLMConfig, GenerationSession
from models.schemas import (
    UserProfileCreate, UserProfileUpdate,
    ResumeCreate, ResumeUpdate,
    TemplateCreate, TemplateUpdate,
    CoverLetterCreate, CoverLetterUpdate,
    LLMConfigCreate, LLMConfigUpdate,
    GenerationSessionCreate, GenerationSessionUpdate
)

# ==================== User Profile CRUD ====================
async def get_user_profile(db: AsyncSession) -> Optional[UserProfile]:
    result = await db.execute(select(UserProfile).where(UserProfile.id == 1))
    return result.scalar_one_or_none()

async def create_user_profile(db: AsyncSession, profile: UserProfileCreate) -> UserProfile:
    db_profile = UserProfile(
        id=1,
        full_name=profile.full_name,
        email=profile.email,
        phone=profile.phone,
        address=profile.address,
        linkedin=profile.linkedin,
        github=profile.github,
        portfolio=profile.portfolio
    )
    db.add(db_profile)
    await db.commit()
    await db.refresh(db_profile)
    return db_profile

async def update_user_profile(db: AsyncSession, profile: UserProfileUpdate) -> Optional[UserProfile]:
    db_profile = await get_user_profile(db)
    if not db_profile:
        # Create singleton with default/passed values
        db_profile = UserProfile(
            id=1,
            full_name=profile.full_name or "Your Name",
            email=profile.email or "your.email@example.com",
            phone=profile.phone,
            address=profile.address,
            linkedin=profile.linkedin,
            github=profile.github,
            portfolio=profile.portfolio
        )
        db.add(db_profile)
    else:
        for key, value in profile.model_dump(exclude_unset=True).items():
            setattr(db_profile, key, value)
    
    await db.commit()
    await db.refresh(db_profile)
    return db_profile

# ==================== Resume CRUD ====================
async def get_resumes(db: AsyncSession) -> List[Resume]:
    result = await db.execute(select(Resume))
    return list(result.scalars().all())

async def get_resume(db: AsyncSession, resume_id: str) -> Optional[Resume]:
    result = await db.execute(select(Resume).where(Resume.id == resume_id))
    return result.scalar_one_or_none()

async def create_resume(db: AsyncSession, resume: ResumeCreate) -> Resume:
    db_resume = Resume(**resume.model_dump())
    db.add(db_resume)
    await db.commit()
    await db.refresh(db_resume)
    return db_resume

async def delete_resume(db: AsyncSession, resume_id: str) -> bool:
    result = await db.execute(delete(Resume).where(Resume.id == resume_id))
    await db.commit()
    return result.rowcount > 0

# ==================== Template CRUD ====================
async def get_templates(db: AsyncSession) -> List[Template]:
    result = await db.execute(select(Template))
    return list(result.scalars().all())

async def get_template(db: AsyncSession, template_id: str) -> Optional[Template]:
    result = await db.execute(select(Template).where(Template.id == template_id))
    return result.scalar_one_or_none()

async def create_template(db: AsyncSession, template: TemplateCreate) -> Template:
    db_template = Template(**template.model_dump())
    db.add(db_template)
    await db.commit()
    await db.refresh(db_template)
    return db_template

async def delete_template(db: AsyncSession, template_id: str) -> bool:
    result = await db.execute(delete(Template).where(Template.id == template_id))
    await db.commit()
    return result.rowcount > 0

# ==================== Cover Letter CRUD ====================
async def get_cover_letters(db: AsyncSession) -> List[CoverLetter]:
    result = await db.execute(select(CoverLetter).order_by(CoverLetter.created_at.desc()))
    return list(result.scalars().all())

async def get_cover_letter(db: AsyncSession, letter_id: str) -> Optional[CoverLetter]:
    result = await db.execute(select(CoverLetter).where(CoverLetter.id == letter_id))
    return result.scalar_one_or_none()

async def create_cover_letter(db: AsyncSession, letter: CoverLetterCreate) -> CoverLetter:
    db_letter = CoverLetter(**letter.model_dump())
    db.add(db_letter)
    await db.commit()
    await db.refresh(db_letter)
    return db_letter

async def update_cover_letter(db: AsyncSession, letter_id: str, letter: CoverLetterUpdate) -> Optional[CoverLetter]:
    db_letter = await get_cover_letter(db, letter_id)
    if not db_letter:
        return None
    for key, value in letter.model_dump(exclude_unset=True).items():
        setattr(db_letter, key, value)
    await db.commit()
    await db.refresh(db_letter)
    return db_letter

# ==================== LLM Config CRUD ====================
async def get_llm_config(db: AsyncSession) -> Optional[LLMConfig]:
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == 1))
    return result.scalar_one_or_none()

async def create_llm_config(db: AsyncSession, config: LLMConfigCreate) -> LLMConfig:
    db_config = LLMConfig(
        id=1,
        openrouter_key=config.openrouter_key,
        groq_key=config.groq_key,
        together_key=config.together_key,
        preferred_model=config.preferred_model,
        fallback_chain=config.fallback_chain
    )
    db.add(db_config)
    await db.commit()
    await db.refresh(db_config)
    return db_config

async def update_llm_config(db: AsyncSession, config: LLMConfigUpdate) -> Optional[LLMConfig]:
    db_config = await get_llm_config(db)
    if not db_config:
        db_config = LLMConfig(
            id=1,
            openrouter_key=config.openrouter_key,
            groq_key=config.groq_key,
            together_key=config.together_key,
            preferred_model=config.preferred_model or "google/gemini-2.0-flash-exp:free",
            fallback_chain=config.fallback_chain or '["google/gemini-2.0-flash-exp:free","meta-llama/llama-3.3-70b-instruct:free","deepseek/deepseek-chat-v3-0324:free","groq/llama-3.3-70b-versatile","mistralai/mistral-7b-instruct:free"]'
        )
        db.add(db_config)
    else:
        for key, value in config.model_dump(exclude_unset=True).items():
            setattr(db_config, key, value)
    
    await db.commit()
    await db.refresh(db_config)
    return db_config

# ==================== Generation Session CRUD ====================
async def get_generation_session(db: AsyncSession, session_id: str) -> Optional[GenerationSession]:
    result = await db.execute(select(GenerationSession).where(GenerationSession.id == session_id))
    return result.scalar_one_or_none()

async def create_generation_session(db: AsyncSession, session: GenerationSessionCreate) -> GenerationSession:
    db_session = GenerationSession(**session.model_dump())
    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)
    return db_session

async def update_generation_session(db: AsyncSession, session_id: str, session: GenerationSessionUpdate) -> Optional[GenerationSession]:
    db_session = await get_generation_session(db, session_id)
    if not db_session:
        return None
    for key, value in session.model_dump(exclude_unset=True).items():
        setattr(db_session, key, value)
    await db.commit()
    await db.refresh(db_session)
    return db_session
