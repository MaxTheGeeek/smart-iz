import os
import json
import pdfplumber
import re
from bidi.algorithm import get_display
import arabic_reshaper

from services.translation_cache import get_cached_page, set_cached_page
from services.llm_engine import stream_completion_with_fallback

PROMPT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", "translate_page.txt")

RTL_LANGUAGES = {"fa", "ar", "he", "ur"}

LANGUAGE_NAMES = {
    "fa": "Persian (Farsi) — فارسی",
    "de": "German",
    "ar": "Arabic — العربية",
    "fr": "French",
    "es": "Spanish",
    "zh": "Chinese (Simplified)",
    "ja": "Japanese",
    "tr": "Turkish",
}

def fix_rtl_text(text: str, lang: str) -> str:
    """
    Connects Arabic/Persian letter glyphs and visual ordering of mixed English words
    for ReportLab PDF export. Keep isolate markers for browser, resolve visually for PDF.
    """
    if lang not in {"fa", "ar"}:
        return text

    # Remove standard Unicode isolate markers as we do visual ordering manually now for PDF
    text_clean = text.replace("\u2066", "").replace("\u2069", "")
    text_clean = text_clean.replace("\\u2066", "").replace("\\u2069", "")
    text_clean = text_clean.replace("u2066", "").replace("u2069", "")

    paragraphs = text_clean.split("\n")
    fixed = []
    for para in paragraphs:
        if not para.strip():
            fixed.append("")
            continue
        try:
            reshaped = arabic_reshaper.reshape(para)
            bidi_text = get_display(reshaped)
            fixed.append(bidi_text)
        except Exception as e:
            print(f"[warning] RTL text shaping failed for paragraph: {e}")
            fixed.append(para)
    return "\n".join(fixed)

async def translate_page(
    doc_id: str,
    pdf_path: str,
    chapter_index: int,
    page_index_in_chapter: int,
    absolute_page_index: int,
    target_lang: str,
    preferred_model: str,
    fallback_chain_json: str,
    openrouter_key: str | None = None,
    groq_key: str | None = None
):
    """
    Translates exactly one page on demand, streaming events back.
    Yields SSE-style dicts: {"type": "cache_hit"|"token"|"model_switch"|"done"|"error", "text": ...}
    """
    # 1. Check Redis cache first
    cached = await get_cached_page(doc_id, chapter_index, page_index_in_chapter, target_lang)
    if cached:
        yield {"type": "cache_hit", "text": cached}
        return

    # 2. Extract page text from PDF
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if absolute_page_index >= len(pdf.pages):
                yield {"type": "error", "message": "Page index out of bounds"}
                return
            page_text = pdf.pages[absolute_page_index].extract_text() or ""
    except Exception as e:
        yield {"type": "error", "message": f"Failed to extract PDF text: {str(e)}"}
        return

    if not page_text.strip():
        yield {"type": "done", "text": ""}
        return

    # 3. Read prompt template
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        prompt_template = f.read()

    is_rtl = target_lang in RTL_LANGUAGES
    lang_name = LANGUAGE_NAMES.get(target_lang, target_lang)
    
    prompt = (
        prompt_template
        .replace("{target_language}", lang_name)
        .replace("{is_rtl}", "YES — this is a right-to-left language" if is_rtl else "NO")
        .replace("{page_text}", page_text[:4000])
    )

    system_prompt = (
        f"You are a professional literary translator specializing in {lang_name}. "
        "You translate technical and non-fiction books with precision. "
        "You preserve paragraph structure exactly. "
        "Return ONLY the translated text with no commentary."
    )

    # 4. Stream translation through LLM
    full_translation = ""
    try:
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
                full_translation += event["text"]
                yield {"type": "token", "text": event["text"]}
            elif event["type"] == "fallback":
                yield {"type": "model_switch", "model": event["to_model"]}
            elif event["type"] == "done":
                if "full_text" in event and event["full_text"]:
                    full_translation = event["full_text"]
                break
            elif event["type"] == "error":
                yield {"type": "error", "message": event.get("message", "Translation generation failed")}
                return
    except Exception as e:
        yield {"type": "error", "message": f"Translation pipeline error: {str(e)}"}
        return

    # 5. Normalize literal escape sequences into actual Unicode isolate characters
    clean_translation = full_translation.replace("\\u2066", chr(0x2066)).replace("\\u2069", chr(0x2069))
    clean_translation = clean_translation.replace("u2066", chr(0x2066)).replace("u2069", chr(0x2069))

    # 6. Cache the raw translation (browser uses this with native CSS)
    await set_cached_page(doc_id, chapter_index, page_index_in_chapter, target_lang, clean_translation)

    yield {"type": "done", "text": clean_translation}
