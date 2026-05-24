import io
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Frame
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from pypdf import PdfReader, PdfWriter

def render_cover_letter_pdf(
    template_path: str,
    spec: dict,
    letter_text: str,
    user_profile: dict,
    output_path: str
):
    """
    Renders the cover letter text onto a template PDF using ReportLab and pypdf.
    """
    overlay_buffer = io.BytesIO()
    
    # Page size from spec
    w = spec.get("page_width_pt", 595.27)
    h = spec.get("page_height_pt", 841.89)
    
    c = canvas.Canvas(overlay_buffer, pagesize=(w, h))
    
    # Retrieve margin metrics
    body_left = spec.get("body_left_pt", w * 0.08)
    body_right = spec.get("body_right_pt", w * 0.92)
    body_top = spec.get("body_top_pt", h * 0.30)
    body_bottom = spec.get("body_bottom_pt", h * 0.85)
    
    body_width = body_right - body_left
    body_height = body_bottom - body_top
    
    # Configure text style
    style = ParagraphStyle(
        "body",
        fontName=spec.get("font_name", "Helvetica"),
        fontSize=spec.get("font_size_body", 10.5),
        leading=spec.get("line_spacing", 14.0),
        textColor=HexColor("#1A1814")  # Rich warm dark text color matching our ink
    )
    
    # ReportLab Frame y-coordinates start from the bottom!
    # spec['body_top_pt'] is from top of the page.
    # Frame bottom is: height - body_bottom
    frame_bottom = h - body_bottom
    
    frame = Frame(
        body_left,
        frame_bottom,
        body_width,
        body_height,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomMargin=0,
        id="body_frame"
    )
    
    # Structure text into flowable Paragraph elements
    story = []
    paragraphs = letter_text.split("\n")
    for para in paragraphs:
        para_clean = para.strip()
        if para_clean:
            # Simple conversion of newlines to HTML breaks inside ReportLab paragraph
            story.append(Paragraph(para_clean.replace("\n", "<br/>"), style))
    
    # Add flowables into the overlay canvas
    frame.addFromList(story, c)
    c.save()
    
    # Merge overlay with original template background
    overlay_buffer.seek(0)
    template_reader = PdfReader(template_path)
    overlay_reader = PdfReader(overlay_buffer)
    
    writer = PdfWriter()
    template_page = template_reader.pages[0]
    overlay_page = overlay_reader.pages[0]
    
    # Merge overlay onto the template
    template_page.merge_page(overlay_page)
    writer.add_page(template_page)
    
    # Save final assembled file
    with open(output_path, "wb") as f:
        writer.write(f)
