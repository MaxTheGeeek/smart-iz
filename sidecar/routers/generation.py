import json
import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.database import get_db
from models.orm import CoverLetter, GenerationSession, Resume, Template
import services.crud as crud
from services.llm_engine import stream_completion_with_fallback
from services.letter_generator import extract_relevant_resume, humanize_letter, STYLE_INSTRUCTIONS
from services.qa_checker import run_qa_check

router = APIRouter(prefix="/api/generate", tags=["generation"])

GENERATE_PROMPT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", "generate_letter.txt")

@router.get("/stream")
async def stream_generation_endpoint(
    session_id: str = Query(...),
    resume_id: str = Query(...),
    template_id: str = Query(...),
    style_type: str = Query("standard"),
    language: str = Query("en"),
    db: AsyncSession = Depends(get_db)
):
    """
    SSE stream endpoint coordinating the full cover letter generation pipeline.
    Streams execution progress, models switch notices, letter tokens, QA checks, and finishes.
    """
    async def sse_generator():
        # 1. Fetch the cover letter record and database session
        res = await db.execute(select(CoverLetter).where(CoverLetter.session_id == session_id))
        cover_letter = res.scalar_one_or_none()
        if not cover_letter:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Cover letter session not found'})}\n\n"
            return

        # Create or update generation session status
        session_res = await db.execute(select(GenerationSession).where(GenerationSession.id == session_id))
        gen_session = session_res.scalar_one_or_none()
        if not gen_session:
            gen_session = GenerationSession(id=session_id, cover_letter_id=cover_letter.id, status="generating")
            db.add(gen_session)
        else:
            gen_session.status = "generating"
            gen_session.error_message = None
        await db.commit()

        # Update cover letter selections
        cover_letter.resume_id = resume_id
        cover_letter.template_id = template_id
        cover_letter.style_type = style_type
        cover_letter.language = language
        await db.commit()

        # 2. Fetch live settings
        llm_config = await crud.get_llm_config(db)
        if not llm_config:
            pref_model = "google/gemini-2.0-flash-exp:free"
            fallbacks = '["google/gemini-2.0-flash-exp:free","meta-llama/llama-3.3-70b-instruct:free"]'
            openrouter_key = None
            groq_key = None
        else:
            pref_model = llm_config.preferred_model
            fallbacks = llm_config.fallback_chain
            openrouter_key = llm_config.openrouter_key
            groq_key = llm_config.groq_key

        user_profile = await crud.get_user_profile(db)
        user_name = user_profile.full_name if user_profile else "Max Mustermann"
        user_email = user_profile.email if user_profile else "max@example.com"
        user_phone = user_profile.phone if user_profile else ""

        # Fetch resume text
        resume = await db.get(Resume, resume_id)
        resume_text = resume.parsed_text if resume else ""

        # 3. STEP 1: Extract relevant resume points
        yield f"data: {json.dumps({'type': 'progress', 'step': 'Extracting relevant achievements...', 'pct': 15})}\n\n"
        
        position_title = cover_letter.position_title or "Position"
        company_name = cover_letter.company_name or "the Company"
        
        # Build key skills list from parsed summary or default
        key_skills = []
        if cover_letter.qa_letter_text:  # Temporarily using this to store skills if needed, or default to generic
            try:
                key_skills = json.loads(cover_letter.qa_letter_text)
            except:
                pass
        if not key_skills:
            key_skills = ["Engineering", "Communication", "Problem Solving"]

        try:
            relevant_resume = await extract_relevant_resume(
                resume_text=resume_text,
                position_title=position_title,
                company_name=company_name,
                key_skills=key_skills,
                preferred_model=pref_model,
                fallback_chain_json=fallbacks,
                openrouter_key=openrouter_key,
                groq_key=groq_key
            )
        except Exception as e:
            relevant_resume = resume_text[:1500]  # Fallback

        # 4. STEP 2: Main Generation
        yield f"data: {json.dumps({'type': 'progress', 'step': 'Drafting cover letter body...', 'pct': 45})}\n\n"
        
        # Read generate prompt template
        with open(GENERATE_PROMPT_PATH, "r", encoding="utf-8") as f:
            gen_template = f.read()

        lang_name = "German" if language == "de" else "English"
        style_instruction = STYLE_INSTRUCTIONS.get(style_type, STYLE_INSTRUCTIONS["standard"])
        contact_salutation = f"Dear {cover_letter.contact_person}" if cover_letter.contact_person else "Dear Hiring Manager"

        prompt = (
            gen_template
            .replace("{language_name}", lang_name)
            .replace("{contact_salutation}", contact_salutation)
            .replace("{style_instruction}", style_instruction)
            .replace("{full_name}", user_name)
            .replace("{email}", user_email)
            .replace("{phone}", user_phone)
            .replace("{position_title}", position_title)
            .replace("{company_name}", company_name)
            .replace("{contact_person}", cover_letter.contact_person or "Hiring Team")
            .replace("{key_skills}", ", ".join(key_skills))
            .replace("{position_summary}", cover_letter.position_title or "")
            .replace("{relevant_resume_extract}", relevant_resume)
        )

        system_prompt = "You are a world-class professional cover letter writer. Return only the letter."

        # Stream letter tokens
        full_letter_text = ""
        current_active_model = pref_model
        
        try:
            async for event_str in stream_completion_with_fallback(
                prompt=prompt,
                system_prompt=system_prompt,
                preferred_model=pref_model,
                fallback_chain_json=fallbacks,
                openrouter_key=openrouter_key,
                groq_key=groq_key,
                temperature=0.7
            ):
                event = json.loads(event_str)
                if event["type"] == "content":
                    full_letter_text += event["text"]
                    yield f"data: {json.dumps({'type': 'token', 'text': event['text']})}\n\n"
                elif event["type"] == "fallback":
                    current_active_model = event["to_model"]
                    yield f"data: {json.dumps({'type': 'model_switch', 'model': event['to_model']})}\n\n"
                elif event["type"] == "done":
                    if "full_text" in event and event["full_text"]:
                        full_letter_text = event["full_text"]
                    break
                elif event["type"] == "error":
                    raise RuntimeError(event.get("message", "Drafting generation failed"))
        except Exception as e:
            err_msg = f"Generation aborted: {str(e)}"
            gen_session.status = "error"
            gen_session.error_message = err_msg
            await db.commit()
            yield f"data: {json.dumps({'type': 'error', 'message': err_msg})}\n\n"
            return

        # Update cover letter raw text
        cover_letter.raw_letter_text = full_letter_text
        await db.commit()

        # 5. STEP 3: Quality Check
        yield f"data: {json.dumps({'type': 'progress', 'step': 'Scanning for AI indicators and proofreading...', 'pct': 75})}\n\n"
        
        pos_data_dict = {
            "position_title": position_title,
            "company_name": company_name,
            "key_skills": key_skills,
            "position_summary": cover_letter.position_title or ""
        }

        try:
            qa_res = await run_qa_check(
                letter_text=full_letter_text,
                language=language,
                position_data=pos_data_dict,
                full_name=user_name,
                email=user_email,
                style_type=style_type,
                preferred_model=pref_model,
                fallback_chain_json=fallbacks,
                openrouter_key=openrouter_key,
                groq_key=groq_key
            )
            # Temporarily save QA details as JSON in qa_letter_text
            cover_letter.qa_letter_text = json.dumps(qa_res)
            qa_text_to_humanize = qa_res.get("corrected_text", full_letter_text)
            yield f"data: {json.dumps({'type': 'qa_done', 'qa_score': qa_res.get('qa_score', 90), 'issues': qa_res.get('issues_found', [])})}\n\n"
        except Exception as e:
            print(f"[warning] QA check failed: {e}")
            qa_text_to_humanize = full_letter_text

        # 6. STEP 4: Humanization pass
        yield f"data: {json.dumps({'type': 'progress', 'step': 'Authenticating candidate voice (humanization pass)...', 'pct': 90})}\n\n"
        
        try:
            final_letter = await humanize_letter(
                generated_text=qa_text_to_humanize,
                preferred_model=pref_model,
                fallback_chain_json=fallbacks,
                openrouter_key=openrouter_key,
                groq_key=groq_key
            )
        except Exception as e:
            print(f"[warning] Humanizer failed: {e}")
            final_letter = qa_text_to_humanize

        # Save finalized text to DB
        cover_letter.final_letter_text = final_letter
        cover_letter.status = "ready"
        
        gen_session.status = "done"
        gen_session.progress_pct = 100
        await db.commit()

        yield f"data: {json.dumps({'type': 'done', 'final_text': final_letter})}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

class ChatRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = "You are a helpful, extremely capable AI assistant."

@router.post("/chat")
async def chat_endpoint(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    SSE stream endpoint for general AI chat assistant.
    """
    async def sse_generator():
        llm_config = await crud.get_llm_config(db)
        if not llm_config:
            pref_model = "google/gemini-2.0-flash-exp:free"
            fallbacks = '["google/gemini-2.0-flash-exp:free","meta-llama/llama-3.3-70b-instruct:free"]'
            openrouter_key = None
            groq_key = None
        else:
            pref_model = llm_config.preferred_model
            fallbacks = llm_config.fallback_chain
            openrouter_key = llm_config.openrouter_key
            groq_key = llm_config.groq_key

        try:
            async for event_str in stream_completion_with_fallback(
                prompt=payload.prompt,
                system_prompt=payload.system_prompt,
                preferred_model=pref_model,
                fallback_chain_json=fallbacks,
                openrouter_key=openrouter_key,
                groq_key=groq_key,
                temperature=0.7
            ):
                yield f"data: {event_str}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

class RenderRequest(BaseModel):
    session_id: str
    letter_text: str

@router.post("/render")
async def render_pdf_endpoint(
    payload: RenderRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Renders cover letter text into a styled PDF based on selected template.
    Returns the generated PDF as a file download / stream.
    """
    res = await db.execute(select(CoverLetter).where(CoverLetter.session_id == payload.session_id))
    cover_letter = res.scalar_one_or_none()
    if not cover_letter:
        raise HTTPException(status_code=404, detail="Cover letter session not found")

    # Fetch template
    db_template = None
    if cover_letter.template_id:
        db_template = await db.get(Template, cover_letter.template_id)
    if not db_template:
        # Fallback to first available template
        templates_res = await db.execute(select(Template))
        db_template = templates_res.scalars().first()

    if not db_template:
        raise HTTPException(status_code=400, detail="No visual templates available in database.")

    # Fetch user profile
    user_profile = await crud.get_user_profile(db)
    user_profile_dict = {
        "full_name": user_profile.full_name if user_profile else "Max Mustermann",
        "email": user_profile.email if user_profile else "max@example.com"
    }

    # Load layout spec
    spec = {}
    if db_template.spec_path and os.path.exists(db_template.spec_path):
        try:
            with open(db_template.spec_path, "r", encoding="utf-8") as f:
                spec = json.load(f)
        except Exception as e:
            print(f"[warning] Failed to load template spec: {e}")

    # Set paths
    output_filename = f"{cover_letter.id}_rendered.pdf"
    output_path = Path.home() / ".covercraft" / "tmp" / output_filename
    output_path.parent.mkdir(parents=True, exist_ok=True)

    from services.pdf_renderer import render_cover_letter_pdf
    
    try:
        render_cover_letter_pdf(
            template_path=db_template.file_path,
            spec=spec,
            letter_text=payload.letter_text,
            user_profile=user_profile_dict,
            output_path=str(output_path)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF compiler error: {str(e)}")

    # Update database record path
    cover_letter.pdf_path = str(output_path)
    await db.commit()

    return FileResponse(
        path=str(output_path),
        media_type="application/pdf",
        filename=f"{cover_letter.company_name or 'Smartiz'}_CoverLetter.pdf"
    )

