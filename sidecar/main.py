import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from models.database import engine, AsyncSessionLocal
from models.orm import Base
from services.crud import get_llm_config, update_llm_config, get_user_profile, update_user_profile
from models.schemas import LLMConfigUpdate, UserProfileUpdate
from routers import resumes, templates, settings, composer, merge, translator




from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Programmatic database initialization (ideal for local desktop deployment)
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS generation_sessions"))
        await conn.execute(text("DROP TABLE IF EXISTS cover_letters"))
        await conn.run_sync(Base.metadata.create_all)
    
    # Seeding initial configurations
    async with AsyncSessionLocal() as session:
        # Seed default LLM config
        llm_conf = await get_llm_config(session)
        if not llm_conf:
            await update_llm_config(session, LLMConfigUpdate())
            print("[sidecar] Seeded default LLM Configuration.")
        
        # Seed default user profile
        usr_prof = await get_user_profile(session)
        if not usr_prof:
            await update_user_profile(session, UserProfileUpdate(
                full_name="Max Mustermann",
                email="max.mustermann@example.com",
            ))
            print("[sidecar] Seeded default User Profile.")

    yield

app = FastAPI(title="Smartiz Sidecar", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse
import traceback
from services.crud import add_log

@app.middleware("http")
async def log_requests(request: Request, call_next):
    is_health = request.url.path == "/health"
    try:
        response = await call_next(request)
        if not is_health and response.status_code >= 400:
            async with AsyncSessionLocal() as session:
                await add_log(session, "WARNING", f"Request {request.method} {request.url.path} returned {response.status_code}")
        return response
    except Exception as e:
        error_msg = f"Unhandled exception during {request.method} {request.url.path}: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_msg}")
        async with AsyncSessionLocal() as session:
            await add_log(session, "ERROR", error_msg)
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal Server Error: {str(e)}"}
        )


app.include_router(resumes.router)
app.include_router(templates.router)
app.include_router(settings.router)
app.include_router(composer.router)
app.include_router(merge.router)
app.include_router(translator.router)




@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")
