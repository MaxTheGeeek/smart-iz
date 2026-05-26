import os
import json
import re
from pypdf import PdfReader
from services.llm_engine import stream_completion_with_fallback

PROMPT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", "extract_toc.txt")

def is_toc_page(text: str) -> bool:
    if not text:
        return False
    
    text_lower = text.lower()
    
    # 1. Look for core index keywords
    toc_keywords = ["table of contents", "contents", "index", "فهرست", "فهرست مطالب"]
    has_keyword = any(kw in text_lower for kw in toc_keywords)
    
    # 2. Look for dotted alignment structures
    dot_count = text.count("...") + text.count(" . .") + text.count("....")
    has_dotted_lines = dot_count >= 3
    
    # 3. Look for page number density at line ends
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if not lines:
        return False
        
    lines_ending_in_number = sum(1 for line in lines if line[-1:].isdigit())
    number_line_ratio = lines_ending_in_number / len(lines)
    
    # Combine signals to form a resilient heuristic
    if has_keyword and (has_dotted_lines or number_line_ratio > 0.2):
        return True
    if has_dotted_lines and number_line_ratio > 0.3:
        return True
        
    return False

def _clean_title(title: str) -> str:
    # Remove common prefixes like "Chapter 1:", "Kapitel 2.", "Part I.", "1.", etc.
    t = re.sub(r'^(chapter|kapitel|part|teil)\s*\d+[:\.]?\s*', '', title, flags=re.IGNORECASE)
    t = re.sub(r'^\d+[\s\.:]+', '', t)
    t = t.strip("\"' \t\r\n")
    return t

def _find_chapter_page_after_toc(reader: PdfReader, title: str, start_page: int) -> int:
    cleaned = _clean_title(title)
    cleaned_lower = cleaned.lower()
    words = [w for w in re.split(r'\W+', cleaned_lower) if w]
    if not words:
        return -1
        
    total_pages = len(reader.pages)
    
    # First pass: look for exact heading line in the first 8 lines
    for idx in range(start_page, total_pages):
        text = reader.pages[idx].extract_text() or ""
        lines = [l.strip().lower() for l in text.split("\n") if l.strip()]
        
        # Check first 8 lines
        for line in lines[:8]:
            if cleaned_lower in line:
                return idx
                
    # Second pass: check if all words appear in the text (fallback)
    for idx in range(start_page, total_pages):
        text = reader.pages[idx].extract_text() or ""
        text_lower = text.lower()
        if all(w in text_lower for w in words):
            return idx
            
    return -1

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

    # 2. Extract first 15 pages and find if any are Table of Contents sheets
    toc_pages = set()
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    sample_pages = min(15, total_pages)
    toc_text = ""
    for i in range(sample_pages):
        toc_text += f"\n--- PAGE {i+1} ---\n"
        page_text = reader.pages[i].extract_text()
        if page_text:
            toc_text += page_text
            if is_toc_page(page_text):
                toc_pages.add(i)

    # 3. Determine first actual reading page (skipping any TOC sheets)
    first_reading_page = 0
    if toc_pages:
        first_reading_page = max(toc_pages) + 1

    # 4. Compile prompt
    prompt = (
        toc_prompt_template
        .replace("{total_pages}", str(total_pages))
        .replace("{toc_text}", toc_text[:6000])
    )

    system_prompt = "You extract table of contents from books. Return only valid JSON."

    # 5. Stream completion and collect
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

    # 6. Clean JSON wrapping
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

    # 7. Map chapter printed page numbers to real 0-based PDF page indexes
    current_search_page = first_reading_page
    for ch in chapters:
        title = ch.get("title", "")
        page = _find_chapter_page_after_toc(reader, title, current_search_page)
        if page != -1:
            ch["page_start"] = page
            current_search_page = page + 1
        else:
            # Fallback estimation if title search misses
            if "page_start" not in ch or ch["page_start"] < first_reading_page:
                ch["page_start"] = current_search_page
                current_search_page = current_search_page + 20
            else:
                ch["page_start"] = max(ch["page_start"], current_search_page)
                current_search_page = ch["page_start"] + 1

    # 8. Fill gaps and validate (excluding TOC pages)
    chapters = _fill_page_gaps(chapters, total_pages, first_reading_page)
    return chapters

def _fill_page_gaps(chapters: list[dict], total_pages: int, first_reading_page: int = 0) -> list[dict]:
    """
    Ensures every page of the document is covered by exactly one chapter, starting from first_reading_page.
    """
    if not chapters:
        return []
        
    chapters = sorted(chapters, key=lambda c: c["page_start"])
    
    # Exclude Table of Contents pages from the active chapters list
    if chapters:
        chapters[0]["page_start"] = max(chapters[0]["page_start"], first_reading_page)
        
    for i, ch in enumerate(chapters):
        if i < len(chapters) - 1:
            ch["page_end"] = chapters[i + 1]["page_start"] - 1
        else:
            ch["page_end"] = total_pages - 1
            
        if ch["page_end"] < ch["page_start"]:
            ch["page_end"] = ch["page_start"]
            
        ch["page_count"] = max(1, ch["page_end"] - ch["page_start"] + 1)
        ch["chapter_index"] = i
    return chapters
