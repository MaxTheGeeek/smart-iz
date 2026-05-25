import os
import re
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.enums import TA_RIGHT, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from services.translation_cache import get_cached_page
from services.translator_service import fix_rtl_text

FONT_DIR = Path(__file__).parent.parent / "assets" / "fonts"
pdfmetrics.registerFont(TTFont("Vazirmatn", str(FONT_DIR / "Vazirmatn-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Vazirmatn-Bold", str(FONT_DIR / "Vazirmatn-Bold.ttf")))

RTL_LANGS = {"fa", "ar"}
EXPORTS_DIR = Path.home() / ".covercraft" / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

def format_reportlab_inline(text: str) -> str:
    """
    Safely converts inline Markdown (like `code` or **bold**) into standard ReportLab HTML-like tags,
    escaping standard XML characters first to prevent parsing exceptions.
    """
    if not text:
        return ""
    # Escape XML entities to protect ReportLab parser
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    
    # Render bi-directional terms cleanly
    text = text.replace("\u2066", "").replace("\u2069", "")
    text = text.replace("\\u2066", "").replace("\\u2069", "")
    text = text.replace("u2066", "").replace("u2069", "")

    # **bold** -> <b>bold</b>
    text = re.sub(r"\*\*([^\*]+)\*\*", r"<b>\1</b>", text)
    
    # `code` -> <font face="Courier">code</font>
    text = re.sub(r"`([^`]+)`", r'<font face="Courier" size="10" color="#8B2635"><b>\1</b></font>', text)
    
    return text

async def export_chapter_pdf(doc, chapter, export_id: str) -> str:
    """
    Compiles all pages of a chapter into a clean PDF using highly professional layout rules:
    - Renders Markdown headings
    - Formats LTR Courier code blocks
    - Injects styled callout boxes
    - Supports list hierarchies
    """
    is_rtl = doc.target_language in RTL_LANGS
    font_name = "Vazirmatn" if is_rtl else "Helvetica"
    alignment = TA_RIGHT if is_rtl else TA_LEFT

    output_path = str(EXPORTS_DIR / f"export_{export_id}.pdf")

    # Core Styles
    style = ParagraphStyle(
        "body",
        fontName=font_name,
        fontSize=11,
        leading=20,
        alignment=alignment,
        wordWrap="RTL" if is_rtl else "LTR",
        spaceAfter=6,
    )
    
    title_style = ParagraphStyle(
        "title",
        fontName=font_name + "-Bold" if is_rtl else "Helvetica-Bold",
        fontSize=18,
        leading=26,
        alignment=alignment,
        spaceAfter=25,
    )

    h2_style = ParagraphStyle(
        "heading2",
        fontName=font_name + "-Bold" if is_rtl else "Helvetica-Bold",
        fontSize=14,
        leading=22,
        alignment=alignment,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True,
    )

    h3_style = ParagraphStyle(
        "heading3",
        fontName=font_name + "-Bold" if is_rtl else "Helvetica-Bold",
        fontSize=12,
        leading=18,
        alignment=alignment,
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True,
    )

    code_style = ParagraphStyle(
        "codeblock",
        fontName="Courier",
        fontSize=9,
        leading=12,
        alignment=TA_LEFT, # Code must always be left-aligned!
        leftIndent=15,
        rightIndent=15,
        spaceAfter=3,
    )

    blockquote_style = ParagraphStyle(
        "blockquote",
        fontName=font_name,
        fontSize=10,
        leading=16,
        alignment=alignment,
        leftIndent=20,
        rightIndent=20,
        textColor="#4A5568",
        spaceBefore=6,
        spaceAfter=8,
    )

    list_style = ParagraphStyle(
        "listitem",
        fontName=font_name,
        fontSize=11,
        leading=18,
        alignment=alignment,
        leftIndent=15 if not is_rtl else 0,
        rightIndent=15 if is_rtl else 0,
        spaceAfter=4,
    )

    story = [Paragraph(chapter.title, title_style), Spacer(1, 12)]

    for page_idx in range(chapter.page_count):
        raw_text = await get_cached_page(doc.id, chapter.chapter_index, page_idx, doc.target_language)
        if not raw_text:
            raw_text = f"[Page {page_idx + 1} not yet translated]"

        lines = raw_text.split("\n")
        in_code_block = False

        for line in lines:
            trimmed = line.strip()
            
            # Empty Lines
            if not trimmed:
                if in_code_block:
                    story.append(Spacer(1, 4))
                else:
                    story.append(Spacer(1, 6))
                continue

            # Code Block Boundaries
            if trimmed.startswith("```"):
                in_code_block = not in_code_block
                story.append(Spacer(1, 6))
                continue

            # Inside Code Block
            if in_code_block:
                # Raw code escaping (avoid shaping)
                safe_code = trimmed.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                story.append(Paragraph(safe_code, code_style))
                continue

            # Markdown Headings
            if trimmed.startswith("#"):
                match = re.match(r"^(#{1,6})\s+(.*)$", trimmed)
                if match:
                    level = len(match.group(1))
                    header_text = match.group(2)
                    if is_rtl:
                        header_text = fix_rtl_text(header_text, doc.target_language)
                    header_text = format_reportlab_inline(header_text)
                    
                    if level <= 2:
                        story.append(Paragraph(header_text, h2_style))
                    else:
                        story.append(Paragraph(header_text, h3_style))
                    continue

            # Markdown Blockquotes / Callouts
            if trimmed.startswith(">"):
                quote_content = trimmed.lstrip(">").strip()
                # Remove Markdown categories
                quote_content = quote_content.replace("[!NOTE]", "").replace("[!TIP]", "").replace("[!WARNING]", "").replace("[!CAUTION]", "").strip()
                if is_rtl:
                    quote_content = fix_rtl_text(quote_content, doc.target_language)
                quote_content = format_reportlab_inline(quote_content)
                story.append(Paragraph(quote_content, blockquote_style))
                continue

            # Markdown Lists
            list_match = re.match(r"^([\-\*]|\d+\.)\s+(.*)$", trimmed)
            if list_match:
                bullet = list_match.group(1)
                item_text = list_match.group(2)
                if is_rtl:
                    item_text = fix_rtl_text(item_text, doc.target_language)
                item_text = format_reportlab_inline(item_text)
                bullet_symbol = "•  " if bullet in {"-", "*"} else f"{bullet}  "
                
                story.append(Paragraph(bullet_symbol + item_text, list_style))
                continue

            # Standard Paragraphs
            para_text = trimmed
            if is_rtl:
                para_text = fix_rtl_text(para_text, doc.target_language)
            para_text = format_reportlab_inline(para_text)
            story.append(Paragraph(para_text, style))

        story.append(PageBreak())

    # Build the document
    doc_obj = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=50,
        leftMargin=50,
        topMargin=60,
        bottomMargin=60
    )
    doc_obj.build(story)
    return output_path
