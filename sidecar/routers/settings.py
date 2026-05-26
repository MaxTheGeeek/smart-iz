import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.schemas import UserProfileRead, UserProfileUpdate, LLMConfigRead, LLMConfigUpdate, SystemLogRead
import services.crud as crud

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("/profile", response_model=UserProfileRead)
async def get_profile(db: AsyncSession = Depends(get_db)):
    prof = await crud.get_user_profile(db)
    if not prof:
        raise HTTPException(status_code=404, detail="User profile not initialized.")
    return prof

@router.post("/profile", response_model=UserProfileRead)
async def update_profile(profile: UserProfileUpdate, db: AsyncSession = Depends(get_db)):
    return await crud.update_user_profile(db, profile)

@router.get("/llm-config", response_model=LLMConfigRead)
async def get_llm_config(db: AsyncSession = Depends(get_db)):
    cfg = await crud.get_llm_config(db)
    if not cfg:
        raise HTTPException(status_code=404, detail="LLM configuration not found.")
    return cfg

@router.post("/llm-config", response_model=LLMConfigRead)
async def update_llm_config(config: LLMConfigUpdate, db: AsyncSession = Depends(get_db)):
    return await crud.update_llm_config(db, config)

@router.post("/test-connection")
async def test_api_connection(payload: dict):
    provider = payload.get("provider")
    api_key = payload.get("key")
    
    if not provider or not api_key:
        raise HTTPException(status_code=400, detail="Missing provider or API key.")
        
    if provider == "openrouter":
        url = "https://openrouter.ai/api/v1/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers, timeout=5.0)
                if res.status_code == 200:
                    return {"status": "success", "message": "Successfully connected to OpenRouter!"}
                else:
                    return {"status": "error", "message": f"OpenRouter rejected key: {res.text}"}
        except Exception as e:
            return {"status": "error", "message": f"Connection failed: {str(e)}"}
            
    elif provider == "groq":
        # Check by hitting their models list
        url = "https://api.groq.com/openai/v1/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers, timeout=5.0)
                if res.status_code == 200:
                    return {"status": "success", "message": "Successfully connected to Groq!"}
                else:
                    return {"status": "error", "message": f"Groq rejected key: {res.text}"}
        except Exception as e:
            return {"status": "error", "message": f"Connection failed: {str(e)}"}
            
    raise HTTPException(status_code=400, detail="Unsupported provider.")


@router.get("/logs", response_model=list[SystemLogRead])
async def get_system_logs(db: AsyncSession = Depends(get_db)):
    return await crud.get_logs(db)


@router.post("/logs")
async def add_system_log(payload: dict, db: AsyncSession = Depends(get_db)):
    level = payload.get("level", "INFO")
    message = payload.get("message")
    if not message:
        raise HTTPException(status_code=400, detail="Missing message.")
    log_item = await crud.add_log(db, level, message)
    return {"status": "success", "log_id": log_item.id}

