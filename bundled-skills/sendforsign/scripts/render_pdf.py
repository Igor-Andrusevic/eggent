#!/usr/bin/env python3
"""
Render PDF pages to PNG images AND extract exact text positions for SendForSign.

Usage:
    python render_pdf.py <pdf_path> [output_dir]

Output: JSON with per-page image paths + text elements with pre-calculated API coordinates.

Coordinate system:
    SendForSign API uses a 1000px-wide coordinate system for ALL PDFs.

    Text positions come from pdftohtml -xml (PDF points, page width ~595pt for A4).
    They are scaled to 1000px space using: api_coord = round(pdf_pt * 1000 / page_width_pts)

    Images are rendered at exactly 1000px wide for visual reference.
    Pixel coordinate in the image = API coordinate directly.

Workflow:
    1. Read image_path to visually identify which fields need placeholders.
    2. Search text_elements for the exact text string to get precise api_x/api_y/api_w/api_h.
    3. Use those api_* values directly in the placeholder placement API call.
    4. For non-text areas (images, empty boxes), estimate from the 1000px image visually.
"""

import subprocess
import json
import sys
import re
import struct
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path


def get_png_dimensions(png_path: str) -> tuple[int, int]:
    """Read width and height from PNG header (bytes 16-24)."""
    try:
        with open(png_path, "rb") as f:
            f.seek(16)
            w = struct.unpack(">I", f.read(4))[0]
            h = struct.unpack(">I", f.read(4))[0]
            return w, h
    except Exception:
        return 0, 0


def extract_text_positions(pdf_path: str, output_dir: Path) -> dict:
    """
    Run pdftohtml -xml to get per-page text elements with exact PDF-point coordinates.
    Returns dict: {page_number (1-indexed): {"width_pts": W, "height_pts": H, "texts": [...]}}
    Each text: {"text": str, "left": int, "top": int, "width": int, "height": int}
    """
    xml_base = str(output_dir / "pdftext")
    result = subprocess.run(
        ["pdftohtml", "-xml", "-noframes", "-zoom", "1", str(pdf_path), xml_base],
        capture_output=True, text=True
    )
    xml_path = Path(xml_base + ".xml")
    if not xml_path.exists():
        return {}

    try:
        tree = ET.parse(str(xml_path))
        root = tree.getroot()
    except ET.ParseError:
        return {}

    pages = {}
    for page_el in root.findall("page"):
        page_num = int(page_el.get("number", 1))
        page_w = float(page_el.get("width", 595))
        page_h = float(page_el.get("height", 841))
        scale = 1000.0 / page_w

        texts = []
        for text_el in page_el.findall("text"):
            raw = "".join(text_el.itertext()).strip()
            if not raw:
                continue
            left = int(text_el.get("left", 0))
            top = int(text_el.get("top", 0))
            w = int(text_el.get("width", 0))
            h = int(text_el.get("height", 0))
            texts.append({
                "text": raw,
                "pdf_left": left, "pdf_top": top, "pdf_width": w, "pdf_height": h,
                "api_x": round(left * scale),
                "api_y": round(top * scale),
                "api_w": round(w * scale),
                "api_h": round(h * scale),
            })

        pages[page_num] = {
            "width_pts": page_w,
            "height_pts": page_h,
            "scale_to_api": round(scale, 6),
            "texts": texts,
        }
    return pages


def render_pdf(pdf_path: str, output_dir: str = None) -> dict:
    pdf_path = Path(pdf_path).resolve()

    if not pdf_path.exists():
        return {"error": f"File not found: {pdf_path}"}

    if output_dir is None:
        output_dir = Path(tempfile.mkdtemp(prefix="sfs_pdf_"))
    else:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

    # Render images at exactly 1000px wide
    prefix = str(output_dir / "page")
    render_result = subprocess.run(
        ["pdftoppm", "-scale-to-x", "1000", "-scale-to-y", "-1", "-png",
         str(pdf_path), prefix],
        capture_output=True, text=True
    )
    if render_result.returncode != 0:
        return {"error": f"pdftoppm failed: {render_result.stderr}"}

    image_files = sorted(output_dir.glob("page-*.png"))
    if not image_files:
        image_files = sorted(output_dir.glob("page.png"))

    # Extract exact text positions from PDF
    text_data = extract_text_positions(str(pdf_path), output_dir)

    pages = []
    for i, img_file in enumerate(image_files):
        w_px, h_px = get_png_dimensions(str(img_file))
        page_num = i + 1  # pdftohtml uses 1-indexed pages
        page_texts = text_data.get(page_num, {})

        scale_to_api = round(1000.0 / w_px, 6) if w_px > 0 else 1.0

        pages.append({
            "page_id": i,
            "image_path": str(img_file),
            "width_px": w_px,
            "height_px": h_px,
            "scale_to_api": scale_to_api,
            "text_elements": page_texts.get("texts", []),
            "coordinate_hint": (
                "Image is 1000px wide — pixel = API coord for visual estimates. "
                "For text fields: use api_x/api_y/api_w/api_h from text_elements directly."
            ),
        })

    return {
        "pdf_path": str(pdf_path),
        "page_count": len(pages),
        "pages": pages,
        "instructions": (
            "To place a placeholder over existing text: "
            "1) Search text_elements for the text string. "
            "2) Use its api_x/api_y/api_w/api_h directly as positionX/positionY/width/height. "
            "3) Add 2-3px padding if needed (increase width/height slightly). "
            "For non-text areas: read image_path visually and estimate pixel coords (= API coords at 1000px width). "
            "Use page_id as pageId in the API (0-indexed)."
        )
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python render_pdf.py <pdf_path> [output_dir]", file=sys.stderr)
        sys.exit(1)

    pdf = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else None

    result = render_pdf(pdf, out)
    print(json.dumps(result, indent=2, ensure_ascii=False))
