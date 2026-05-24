import os
import json
import traceback
from langdetect import detect
from services.llm_engine import stream_completion_with_fallback

PROMPT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", "parse_position.txt")

def detect_language(text: str) -> str:
    """
    Detects language of the input text, defaulting to 'en'.
    Supports 'de' and 'en'.
    """
    try:
        lang = detect(text)
        return "de" if lang == "de" else "en"
    except Exception:
        return "en"

async def parse_position(
    text: str,
    preferred_model: str,
    fallback_chain_json: str,
    openrouter_key: str | None = None,
    groq_key: str | None = None
) -> dict:
    """
    Parses a job description text using the LLM and returns a structured dictionary.
    """
    # Load prompt template
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        prompt_template = f.read()

    # Format prompt with capped text input
    prompt = prompt_template.replace("{position_text}", text[:8000])

    system_prompt = "You extract structured data from job postings. Return only valid JSON."

    # Use stream_completion_with_fallback to run LLM
    full_response = ""
    async for event_str in stream_completion_with_fallback(
        prompt=prompt,
        system_prompt=system_prompt,
        preferred_model=preferred_model,
        fallback_chain_json=fallback_chain_json,
        openrouter_key=openrouter_key,
        groq_key=groq_key,
        temperature=0.1  # lower temperature for extraction precision
    ):
        event = json.loads(event_str)
        if event["type"] == "content":
            full_response += event["text"]
        elif event["type"] == "done":
            # If the last chunk is successful, get full accumulated text from event
            if "full_text" in event and event["full_text"]:
                full_response = event["full_text"]
            break
        elif event["type"] == "error":
            raise RuntimeError(event.get("message", "LLM parsing failed"))

    # Clean response
    clean = full_response.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    if clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    clean = clean.strip()

    try:
        data = json.loads(clean)
    except Exception as e:
        print(f"[error] Failed to parse JSON from LLM: {clean}. Error: {e}")
        # Very robust fallback extraction if LLM didn't return perfect JSON
        data = {
            "position_title": "Position",
            "company_name": None,
            "contact_person": None,
            "contact_email": None,
            "key_skills": [],
            "required_experience": None,
            "industry": None,
            "position_summary": text[:200] + "..."
        }

    # Ensure all required fields exist
    schema_keys = [
        "position_title", "company_name", "contact_person", "contact_email",
        "key_skills", "required_experience", "industry", "position_summary"
    ]
    for key in schema_keys:
        if key not in data:
            data[key] = [] if key == "key_skills" else None

    return data
