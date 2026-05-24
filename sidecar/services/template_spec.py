import json
import os
from pathlib import Path
import pdfplumber
from PIL import Image

try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False

def generate_thumbnail(pdf_path: str, output_path: str, size=(300, 424)) -> bool:
    """
    Converts first page of PDF template to a PNG thumbnail.
    Gracefully degrades if pdf2image/poppler is not available or errors out.
    """
    if not PDF2IMAGE_AVAILABLE:
        print("[warning] pdf2image is not imported. Skipping thumbnail generation.")
        return False
        
    try:
        images = convert_from_path(pdf_path, first_page=1, last_page=1, dpi=72)
        if images:
            img = images[0].resize(size, Image.Resampling.LANCZOS)
            img.save(output_path, "PNG")
            return True
    except Exception as e:
        print(f"[warning] Thumbnail generation failed gracefully: {str(e)}")
        
    return False

def extract_template_spec(pdf_path: str) -> dict:
    """
    Extract page dimensions and estimate bounding boxes for header and body.
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[0]
            width = float(page.width)
            height = float(page.height)
            
            # Heuristics based on page size (defaults are for A4)
            body_top = height * 0.30
            body_bottom = height * 0.85
            body_left = width * 0.08
            body_right = width * 0.92
            
            # Try to refine body area based on existing text blocks if available
            words = page.extract_words()
            if words:
                # Find the largest block or center area
                y_positions = [w["top"] for w in words]
                x_positions = [w["x0"] for w in words]
                
                if y_positions:
                    # Let's say body typically starts after some header text
                    # We can use the mean or just stick to safe heuristics if empty
                    pass

            return {
                "page_width_pt": width,
                "page_height_pt": height,
                "body_top_pt": body_top,
                "body_bottom_pt": body_bottom,
                "body_left_pt": body_left,
                "body_right_pt": body_right,
                "font_name": "Helvetica",  # default standard PDF font
                "font_size_body": 10.5,
                "line_spacing": 14.0,
            }
    except Exception as e:
        print(f"[warning] Spec extraction failed, falling back to standard A4 spec: {e}")
        # Standard A4 is 595.27 x 841.89 pt
        return {
            "page_width_pt": 595.27,
            "page_height_pt": 841.89,
            "body_top_pt": 841.89 * 0.30,
            "body_bottom_pt": 841.89 * 0.85,
            "body_left_pt": 595.27 * 0.08,
            "body_right_pt": 595.27 * 0.92,
            "font_name": "Helvetica",
            "font_size_body": 10.5,
            "line_spacing": 14.0,
        }
