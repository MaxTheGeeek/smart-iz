import asyncio
from models.database import engine, AsyncSessionLocal
from models.orm import Base
from services.crud import (
    get_user_profile, update_user_profile,
    create_resume, get_resumes, delete_resume,
    get_llm_config, update_llm_config
)
from models.schemas import UserProfileUpdate, ResumeCreate, LLMConfigUpdate

async def main():
    print("[test] Starting database layer diagnostics...")
    
    # 1. Initialize tables (Base.metadata.create_all)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("[test] Database tables drop & recreate complete.")

    async with AsyncSessionLocal() as session:
        # 2. Test LLM Configuration Config Seeding/CRUD
        print("[test] Testing LLM Config CRUD...")
        config = await get_llm_config(session)
        assert config is None, "Config should be empty on clean DB"
        
        await update_llm_config(session, LLMConfigUpdate(openrouter_key="test-key"))
        config = await get_llm_config(session)
        assert config is not None
        assert config.openrouter_key == "test-key", f"Expected 'test-key', got {config.openrouter_key}"
        print("[test] LLM Config verified.")

        # 3. Test User Profile Seeding/CRUD
        print("[test] Testing User Profile CRUD...")
        profile = await get_user_profile(session)
        assert profile is None, "Profile should be empty on clean DB"

        await update_user_profile(session, UserProfileUpdate(
            full_name="Alex Smith",
            email="alex@example.com",
            phone="123456"
        ))
        profile = await get_user_profile(session)
        assert profile is not None
        assert profile.full_name == "Alex Smith"
        assert profile.email == "alex@example.com"
        assert profile.phone == "123456"
        print("[test] User Profile verified.")

        # 4. Test Resume CRUD
        print("[test] Testing Resume CRUD...")
        resumes = await get_resumes(session)
        assert len(resumes) == 0, f"Expected 0 resumes, got {len(resumes)}"

        resume_data = ResumeCreate(
            name="General CV",
            file_name="cv.pdf",
            file_path="/path/to/cv.pdf",
            file_type="pdf",
            parsed_text="Fullstack Web Developer with 5 years experience.",
            tags='["react", "node", "typescript"]'
        )
        created_res = await create_resume(session, resume_data)
        assert created_res.id is not None
        assert created_res.name == "General CV"

        resumes = await get_resumes(session)
        assert len(resumes) == 1
        assert resumes[0].name == "General CV"
        
        deleted = await delete_resume(session, created_res.id)
        assert deleted is True
        
        resumes = await get_resumes(session)
        assert len(resumes) == 0
        print("[test] Resume CRUD verified.")

    print("\n[test] All database layer tests PASSED successfully! 🎉")

if __name__ == "__main__":
    asyncio.run(main())
