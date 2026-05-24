import os
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

async def export_chapter_pdf(doc, chapter, export_id: str) -> str:
    """
    Compiles all pages of a chapter into a clean PDF using the right language styles.
    """
    is_rtl = doc.target_language in RTL_LANGS
    font_name = "Vazirmatn" if is_rtl else "Helvetica"
    alignment = TA_RIGHT if is_rtl else TA_LEFT

    output_path = str(EXPORTS_DIR / f"export_{export_id}.pdf")

    # Set up paragraph spacing and wordWrap for RTL
    style = ParagraphStyle(
        "body",
        fontName=font_name,
        fontSize=12,
        leading=20,
        alignment=alignment,
        wordWrap="RTL" if is_rtl else "LTR",
    )
    
    title_style = ParagraphStyle(
        "title",
        fontName=font_name + "-Bold" if is_rtl else "Helvetica-Bold",
        fontSize=16,
        leading=24,
        alignment=alignment,
        spaceAfter=20,
    )

    story = [Paragraph(chapter.title, title_style), Spacer(1, 12)]

    for page_idx in range(chapter.page_count):
        raw_text = await get_cached_page(doc.id, chapter.chapter_index, page_idx, doc.target_language)
        if not raw_text:
            raw_text = f"[Page {page_idx + 1} not yet translated]"

        # Apply glyph shaping for PDF rendering
        if is_rtl:
            raw_text = fix_rtl_text(raw_text, doc.target_language)

        for para in raw_text.split("\n"):
            if para.strip():
                story.append(Paragraph(para.strip(), style))
                story.append(Spacer(1, 6))

        story.append(PageBreak())

    # Compile the story pages
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
