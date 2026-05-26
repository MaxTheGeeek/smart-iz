"""
sidecar/services/pdf_composer.py
=================================
Renders a cover letter PDF with the exact layout of the Majid Behzadi template.

All measurements are hardcoded from pdfplumber extraction of:
  - Cover_Letter_Template_Majid_Behzadi.pdf
  - Real_Cover_Letter.pdf

These values are ground truth. Do not change them without re-measuring.

COLOR PALETTE (RGB 0.0–1.0):
  BLUE  = (0.0, 0.423529, 0.647059)   ← #006CA5  — name, subject line, HR lines
  GRAY  = (0.533333, 0.533333, 0.533333) ← #888888 — subtitle, contact rows, address
  DARK  = (0.101961, 0.101961, 0.101961) ← #1A1A1A — body text, date, recipient block

FONT:  LiberationSans Regular + Bold  (TTF, must be present on the system)
  macOS/Linux: /usr/share/fonts/truetype/liberation/
  Windows:     C:/Windows/Fonts/  or bundled in app assets

PAGE:  A4 = 595.28 x 841.89 pt

LAYOUT (all y values measured from PAGE TOP, converted to ReportLab via PH - y):
  Name                  y=39   size=15  Bold  BLUE   centered
  Title                 y=60   size=11  Reg   GRAY   centered
  Contact row (header)  y=72   size=9   Reg   GRAY   centered
  Address               y=85   size=9   Reg   GRAY   centered
  HR line top           y=107  x0=62.4  x1=532.9  linewidth=0.8  BLUE
  Date                  y=121  right-aligned at x=532.9  size=10  Reg  DARK
  Company name          y=145  x=62.4   size=10  Bold  DARK
  Contact person        y=158  x=62.4   size=10  Reg   DARK
  Company address       y=171  x=62.4   size=10  Reg   DARK
  Subject line          y=196  x=62.4   size=10.5  Bold  BLUE
  Body frame top        y=231  (salutation starts here)
  Body frame bottom     y=772  (footer HR line)
  Body width            470.5 pt  (62.4 to 532.9)
  Body font             size=10.5  leading=15.5  Reg  DARK
  Sign-off              spaceBefore=20  same style as body
  Signer name           bold  same size
  HR line footer        y=772  x0=62.4  x1=532.9  linewidth=0.5  BLUE
  Contact row (footer)  y=780  size=8.5  Reg  GRAY  centered
"""

import io
import os
import json
from datetime import date as date_type
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Frame
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import Color


# ── Font registration ─────────────────────────────────────────────────────────
# Try system path first, then fall back to bundled assets
_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/liberation",
    "/usr/share/fonts/liberation",
    str(Path(__file__).parent.parent / "assets" / "fonts"),
]

def _find_font_dir() -> str:
    for d in _FONT_CANDIDATES:
        if os.path.isdir(d):
            if os.path.isfile(os.path.join(d, "LiberationSans-Regular.ttf")):
                return d
    # If font is not installed globally, try basic system font paths or fall back to Helvetica
    # Let's see if we can locate a Liberation font or use a standard fall back.
    # In some standard ReportLab environments, standard fonts are registered automatically.
    # Let's create the folder and we will download/copy them in Step 11.
    return "/usr/share/fonts/truetype/liberation"

# We will handle font loading gracefully.
try:
    _FONT_DIR = _find_font_dir()
    pdfmetrics.registerFont(TTFont("LiberationSans",
        os.path.join(_FONT_DIR, "LiberationSans-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("LiberationSans-Bold",
        os.path.join(_FONT_DIR, "LiberationSans-Bold.ttf")))
    pdfmetrics.registerFont(TTFont("LiberationSans-Italic",
        os.path.join(_FONT_DIR, "LiberationSans-Italic.ttf")))
    pdfmetrics.registerFontFamily(
        "LiberationSans",
        normal="LiberationSans",
        bold="LiberationSans-Bold",
        italic="LiberationSans-Italic",
    )
except Exception:
    # If LiberationSans isn't on system, fall back to standard Helvetica in ReportLab
    pass


# ── Colors ────────────────────────────────────────────────────────────────────
BLUE = Color(0.0,        0.423529, 0.647059)
GRAY = Color(0.533333,   0.533333, 0.533333)
DARK = Color(0.101961,   0.101961, 0.101961)

# ── Page geometry ─────────────────────────────────────────────────────────────
PW, PH       = A4
MARGIN_LEFT  = 62.4
MARGIN_RIGHT = 532.9
BODY_WIDTH   = MARGIN_RIGHT - MARGIN_LEFT   # 470.5 pt

EXPORTS_DIR = Path.home() / ".covercraft" / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


def _y(y_from_top: float) -> float:
    """Convert y measured from page top to ReportLab y from page bottom."""
    return PH - y_from_top


def compose_cover_letter_pdf(
    output_path: str,
    # ── User profile — loaded from DB / settings, never changes per application ──
    full_name:   str = "MAJID BEHZADI",
    job_title:   str = "Full-Stack Developer",
    address:     str = "Wehlistraße 334, 1020 Wien",
    phone:       str = "+43 676 970 1820",
    email:       str = "maxbehzadi82@gmail.com",
    website:     str = "www.maxbehzadi.online",
    city:        str = "Wien",
    # ── Dynamic fields — provided by user per application ────────────────────
    letter_date:     str  = None,   # auto-generated if None
    company_name:    str  = "",
    contact_person:  str  = "",     # optional — omit line if empty
    company_address: str  = "",     # optional — omit line if empty
    position:        str  = "",
    salutation:      str  = "",
    body_paragraphs: list = None,   # list[str], one string per paragraph
    sign_off:        str  = "Mit freundlichen Grüßen,",
) -> str:
    """
    Render the cover letter and write it to output_path.
    Returns output_path on success.
    Raises on font-not-found or write error.
    """
    if body_paragraphs is None:
        body_paragraphs = []

    # Auto-generate date in German format
    if letter_date is None:
        today = date_type.today()
        months_de = [
            "Januar", "Februar", "März", "April", "Mai", "Juni",
            "Juli", "August", "September", "Oktober", "November", "Dezember"
        ]
        letter_date = f"{city}, {today.day}. {months_de[today.month - 1]} {today.year}"

    contact_row = f"{phone}  |  {email}  |  {website}"

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setAuthor(full_name)
    c.setTitle(f"Bewerbung — {position}")

    # Determine which font family to use
    font_reg = "LiberationSans"
    font_bold = "LiberationSans-Bold"
    try:
        pdfmetrics.getFont(font_reg)
    except Exception:
        font_reg = "Helvetica"
        font_bold = "Helvetica-Bold"

    # ── HEADER ────────────────────────────────────────────────────────────────
    c.setFont(font_bold, 15)
    c.setFillColor(BLUE)
    c.drawCentredString(PW / 2, _y(39), full_name)

    c.setFont(font_reg, 11)
    c.setFillColor(GRAY)
    c.drawCentredString(PW / 2, _y(60), job_title)

    c.setFont(font_reg, 9)
    c.setFillColor(GRAY)
    c.drawCentredString(PW / 2, _y(72), contact_row)
    c.drawCentredString(PW / 2, _y(85), address)

    c.setStrokeColor(BLUE)
    c.setLineWidth(0.8)
    c.line(MARGIN_LEFT, _y(107), MARGIN_RIGHT, _y(107))

    # ── DATE ──────────────────────────────────────────────────────────────────
    c.setFont(font_reg, 10)
    c.setFillColor(DARK)
    c.drawRightString(MARGIN_RIGHT, _y(121), letter_date)

    # ── RECIPIENT BLOCK ───────────────────────────────────────────────────────
    c.setFont(font_bold, 10)
    c.setFillColor(DARK)
    c.drawString(MARGIN_LEFT, _y(145), company_name)

    c.setFont(font_reg, 10)
    if contact_person:
        c.drawString(MARGIN_LEFT, _y(158), contact_person)
    if company_address:
        c.drawString(MARGIN_LEFT, _y(171), company_address)

    # ── SUBJECT LINE ──────────────────────────────────────────────────────────
    c.setFont(font_bold, 10.5)
    c.setFillColor(BLUE)
    if position:
        c.drawString(MARGIN_LEFT, _y(196), f"Bewerbung als {position}")

    # ── BODY (flowing text via Platypus Frame) ────────────────────────────────
    body_style = ParagraphStyle(
        "body",
        fontName=font_reg,
        fontSize=10.5,
        leading=15.5,
        textColor=DARK,
        spaceAfter=10,
        allowWidows=0,
        allowOrphans=0,
    )
    signoff_style = ParagraphStyle(
        "signoff",
        fontName=font_reg,
        fontSize=10.5,
        leading=15.5,
        textColor=DARK,
        spaceBefore=20,
        spaceAfter=0,
    )
    name_style = ParagraphStyle(
        "name_bold",
        fontName=font_bold,
        fontSize=10.5,
        leading=15.5,
        textColor=DARK,
        spaceBefore=0,
        spaceAfter=0,
    )

    story = []
    if salutation:
        story.append(Paragraph(salutation, body_style))
    for para in body_paragraphs:
        if para.strip():
            safe = (para
                    .replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;"))
            story.append(Paragraph(safe, body_style))
    story.append(Paragraph(sign_off, signoff_style))
    story.append(Paragraph(full_name.title(), name_style))

    frame = Frame(
        x1=MARGIN_LEFT,
        y1=_y(772),          # bottom of frame = top of footer line
        width=BODY_WIDTH,
        height=772 - 231,    # 541 pt
        leftPadding=0, rightPadding=0,
        topPadding=0, bottomPadding=0,
        showBoundary=0,
    )
    frame.addFromList(story, c)

    # ── FOOTER ────────────────────────────────────────────────────────────────
    c.setStrokeColor(BLUE)
    c.setLineWidth(0.5)
    c.line(MARGIN_LEFT, _y(772), MARGIN_RIGHT, _y(772))

    c.setFont(font_reg, 8.5)
    c.setFillColor(GRAY)
    c.drawCentredString(PW / 2, _y(780), contact_row)

    c.save()

    with open(output_path, "wb") as f:
        f.write(buf.getvalue())

    return output_path
