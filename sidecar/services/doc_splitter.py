import os
import json
import pdfplumber
from services.llm_engine import stream_completion_with_fallback

PROMPT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", "extract_toc.txt")

async def extract_toc(
    pdf_path: str,
    preferred_model: str,
    fallback_chain_json: str,
    openrouter_key: str | None = None,
    groq_key: str | None = None
) -> list[dict]:
    """
    Returns a list of chapter dicts:
    [{"chapter_index": 0, "title": "Introduction", "page_start": 2, "page_end": 9}, ...]
    """
    # 1. Read prompt template
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        toc_prompt_template = f.read()

    # 2. Extract first 15 pages
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        sample_pages = min(15, total_pages)
        toc_text = ""
        for i in range(sample_pages):
            toc_text += f"\n--- PAGE {i+1} ---\n"
            page_text = pdf.pages[i].extract_text()
            if page_text:
                toc_text += page_text

    # 3. Compile prompt
    prompt = (
        toc_prompt_template
        .replace("{total_pages}", str(total_pages))
        .replace("{toc_text}", toc_text[:6000])
    )

    system_prompt = "You extract table of contents from books. Return only valid JSON."

    # 4. Stream completion and collect
    full_response = ""
    async for event_str in stream_completion_with_fallback(
        prompt=prompt,
        system_prompt=system_prompt,
        preferred_model=preferred_model,
        fallback_chain_json=fallback_chain_json,
        openrouter_key=openrouter_key,
        groq_key=groq_key,
        temperature=0.1
    ):
        event = json.loads(event_str)
        if event["type"] == "content":
            full_response += event["text"]
        elif event["type"] == "done":
            if "full_text" in event and event["full_text"]:
                full_response = event["full_text"]
            break
        elif event["type"] == "error":
            raise RuntimeError(event.get("message", "TOC extraction failed"))

    # 5. Clean JSON wrapping
    clean = full_response.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    if clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    clean = clean.strip()

    try:
        chapters = json.loads(clean)
        if not isinstance(chapters, list):
            raise ValueError("LLM response is not a JSON list")
    except Exception as e:
        print(f"[warning] Failed to parse TOC JSON: {clean}. Error: {e}")
        # Default fallback: split the book every 20 pages
        chapters = []
        page_size = 20
        idx = 0
        for start in range(0, total_pages, page_size):
            end = min(start + page_size - 1, total_pages - 1)
            chapters.append({
                "chapter_index": idx,
                "title": f"Part {idx + 1}",
                "page_start": start,
                "page_end": end
            })
            idx += 1

    # 6. Fill gaps and validate
    chapters = _fill_page_gaps(chapters, total_pages)
    return chapters

def _fill_page_gaps(chapters: list[dict], total_pages: int) -> list[dict]:
    """
    Ensures every page of the document is covered by exactly one chapter.
    """
    if not chapters:
        return []
        
    chapters = sorted(chapters, key=lambda c: c["page_start"])
    for i, ch in enumerate(chapters):
        if i < len(chapters) - 1:
            ch["page_end"] = chapters[i + 1]["page_start"] - 1
        else:
            ch["page_end"] = total_pages - 1
        ch["page_count"] = max(1, ch["page_end"] - ch["page_start"] + 1)
        ch["chapter_index"] = i
    return chapters
