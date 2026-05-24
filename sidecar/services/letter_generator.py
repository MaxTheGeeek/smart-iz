import os
import json
from services.llm_engine import stream_completion_with_fallback, count_tokens

GENERATE_PROMPT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", "generate_letter.txt")
HUMANIZE_PROMPT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", "humanize.txt")

STYLE_INSTRUCTIONS = {
    "motivational": "Write with genuine passion and enthusiasm. Show authentic excitement about the company mission and role.",
    "confident": "Write in a direct, assured tone. Lead with your strongest achievements. No hedging language.",
    "accomplishment": "Structure around 2-3 quantified achievements that directly match the role requirements.",
    "networking": "Reference the company's reputation and how your network within the industry connects you to their work.",
    "creative": "Open with a brief story or analogy that connects your background to the role. Be memorable.",
    "standard": "Use a professional, formal tone. Follow classic cover letter structure: opening, body, closing.",
    "analytical": "Use a structured, data-driven approach. Break down how your skills map to each key requirement.",
    "custom": "Write in a balanced, customizable style suited for generic job applications.",
}

RESUME_EXTRACT_PROMPT = """
Given the following resume and job requirements, extract only the most relevant information.

JOB KEY SKILLS: {key_skills}
JOB POSITION: {position_title} at {company_name}

RESUME:
{resume_text}

Return a concise summary (max 400 words) of the candidate's most relevant:
- Work experience matching this role
- Specific technologies/skills matching the job
- Achievements or projects most relevant to this position
Only include what is relevant. Be specific. No fluff.
"""

async def extract_relevant_resume(
    resume_text: str,
    position_title: str,
    company_name: str,
    key_skills: list[str],
    preferred_model: str,
    fallback_chain_json: str,
    openrouter_key: str | None = None,
    groq_key: str | None = None
) -> str:
    """
    Extracts relevant resume points based on position requirements.
    """
    prompt = (
        RESUME_EXTRACT_PROMPT
        .replace("{key_skills}", ", ".join(key_skills))
        .replace("{position_title}", position_title)
        .replace("{company_name}", company_name or "the Company")
        .replace("{resume_text}", resume_text[:12000]) # Capped to fit context limits
    )

    system_prompt = "You are a talent acquisition expert matching candidate profiles to job specifications."
    
    full_extract = ""
    async for event_str in stream_completion_with_fallback(
        prompt=prompt,
        system_prompt=system_prompt,
        preferred_model=preferred_model,
        fallback_chain_json=fallback_chain_json,
        openrouter_key=openrouter_key,
        groq_key=groq_key,
        temperature=0.2
    ):
        event = json.loads(event_str)
        if event["type"] == "content":
            full_extract += event["text"]
        elif event["type"] == "done":
            if "full_text" in event and event["full_text"]:
                full_extract = event["full_text"]
            break
        elif event["type"] == "error":
            # Degrade gracefully by using raw resume snippet
            return resume_text[:1000]

    return full_extract.strip()

async def humanize_letter(
    generated_text: str,
    preferred_model: str,
    fallback_chain_json: str,
    openrouter_key: str | None = None,
    groq_key: str | None = None
) -> str:
    """
    Performs second pass humanization of LLM output.
    """
    with open(HUMANIZE_PROMPT_PATH, "r", encoding="utf-8") as f:
        template = f.read()

    prompt = template.replace("{generated_text}", generated_text)
    system_prompt = "You polish cover letters to sound highly authentic, clean of clichés, and professional."

    full_human = ""
    async for event_str in stream_completion_with_fallback(
        prompt=prompt,
        system_prompt=system_prompt,
        preferred_model=preferred_model,
        fallback_chain_json=fallback_chain_json,
        openrouter_key=openrouter_key,
        groq_key=groq_key,
        temperature=0.3
    ):
        event = json.loads(event_str)
        if event["type"] == "content":
            full_human += event["text"]
        elif event["type"] == "done":
            if "full_text" in event and event["full_text"]:
                full_human = event["full_text"]
            break
        elif event["type"] == "error":
            return generated_text

    return full_human.strip()
