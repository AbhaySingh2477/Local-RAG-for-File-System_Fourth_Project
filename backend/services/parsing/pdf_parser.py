"""
PDF Parser — Extract text from PDF files.
Primary: PyMuPDF (fitz) for fast extraction.
Fallback: pdfplumber for layout-heavy / table-dense PDFs.
Detects scanned PDFs and flags for OCR.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf"}

# If text per page is below this threshold, consider it a scanned page
_SCANNED_THRESHOLD = 50  # chars per page


def can_parse(file_type: str) -> bool:
    return file_type.lower().lstrip(".") in {ext.lstrip(".") for ext in SUPPORTED_EXTENSIONS}


def _parse_with_pymupdf(file_path: str) -> dict[str, Any]:
    """Extract text using PyMuPDF (fitz) with structural section detection."""
    import fitz
    from collections import Counter

    doc = fitz.open(file_path)
    pages = []
    scanned_pages = []
    full_text_parts = []

    # ── Pass 1: Collect all font sizes to determine the body size ──
    all_font_sizes: list[float] = []
    for page in doc:
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        for block in blocks:
            if block.get("type") != 0:  # text blocks only
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if text:
                        all_font_sizes.extend([span["size"]] * len(text))

    # Body font size = the most common size (by character count)
    if all_font_sizes:
        size_counter = Counter(round(s, 1) for s in all_font_sizes)
        body_size = size_counter.most_common(1)[0][0]
    else:
        body_size = 10.0  # reasonable default

    # Heading threshold: anything ≥ body_size + 1.5pt is likely a heading
    heading_threshold = body_size + 1.5
    # Chapter threshold: anything ≥ body_size + 4pt is likely a chapter title
    chapter_threshold = body_size + 4.0

    # ── Pass 2: Extract text and detect sections ──
    sections: list[dict[str, Any]] = []
    current_section: dict[str, Any] | None = None

    for i, page in enumerate(doc):
        page_num = i + 1
        page_text_parts: list[str] = []

        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        for block in blocks:
            if block.get("type") != 0:
                continue

            block_text_parts: list[str] = []
            block_max_size = 0.0
            block_is_bold = False

            for line in block.get("lines", []):
                line_text_parts: list[str] = []
                for span in line.get("spans", []):
                    text = span.get("text", "")
                    if text.strip():
                        block_max_size = max(block_max_size, span["size"])
                        flags = span.get("flags", 0)
                        if flags & 2 ** 4:  # bold flag
                            block_is_bold = True
                    line_text_parts.append(text)
                block_text_parts.append("".join(line_text_parts))

            block_text = "\n".join(block_text_parts).strip()
            if not block_text:
                continue

            page_text_parts.append(block_text)

            # Detect if this block is a heading
            rounded_size = round(block_max_size, 1)
            is_heading = (
                rounded_size >= heading_threshold
                and len(block_text) < 200  # headings are short
                and "\n" not in block_text.strip()  # single line
            )

            if is_heading:
                # Determine heading level
                if rounded_size >= chapter_threshold or block_text.lower().startswith("chapter"):
                    level = "chapter"
                else:
                    level = "section"

                # Save previous section
                if current_section and current_section["text"].strip():
                    sections.append(current_section)

                current_section = {
                    "title": block_text.strip(),
                    "level": level,
                    "page": page_num,
                    "text": "",
                }
            else:
                # Append body text to current section
                if current_section is None:
                    current_section = {
                        "title": "",
                        "level": "section",
                        "page": page_num,
                        "text": "",
                    }
                current_section["text"] += block_text + "\n\n"

        page_text = "\n".join(page_text_parts)
        pages.append({"page": page_num, "text": page_text})
        full_text_parts.append(page_text)

        if len(page_text) < _SCANNED_THRESHOLD:
            scanned_pages.append(page_num)

    # Don't forget the last section
    if current_section and current_section["text"].strip():
        sections.append(current_section)

    metadata = {
        "format": "pdf",
        "page_count": len(doc),
        "title": doc.metadata.get("title", ""),
        "author": doc.metadata.get("author", ""),
        "subject": doc.metadata.get("subject", ""),
        "creator": doc.metadata.get("creator", ""),
        "producer": doc.metadata.get("producer", ""),
        "scanned_pages": scanned_pages,
        "needs_ocr": len(scanned_pages) > len(doc) * 0.5,
        "body_font_size": body_size,
        "detected_sections": len(sections),
    }

    doc.close()

    logger.info(f"Detected {len(sections)} structural sections (body font={body_size}pt)")

    return {
        "text": "\n\n".join(full_text_parts),
        "metadata": metadata,
        "pages": pages,
        "sections": sections,
    }


def _parse_with_pdfplumber(file_path: str) -> dict[str, Any]:
    """Fallback: Extract text using pdfplumber (better for tables)."""
    import pdfplumber

    pages = []
    full_text_parts = []

    with pdfplumber.open(file_path) as pdf:
        page_count = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            pages.append({"page": i + 1, "text": text.strip()})
            full_text_parts.append(text.strip())

    return {
        "text": "\n\n".join(full_text_parts),
        "metadata": {
            "format": "pdf",
            "page_count": page_count,
            "parser": "pdfplumber",
        },
        "pages": pages,
    }


async def parse(file_path: str) -> dict[str, Any]:
    """
    Parse a PDF file. Tries PyMuPDF first, pdfplumber as fallback.

    Returns:
        dict with keys: text, metadata, pages
    """
    path = Path(file_path)
    logger.info(f"Parsing PDF: {path.name}")

    # Try PyMuPDF first
    try:
        result = _parse_with_pymupdf(file_path)
        if result["text"].strip():
            logger.info(f"PDF parsed with PyMuPDF: {result['metadata'].get('page_count', 0)} pages")
            return result
        logger.warning(f"PyMuPDF returned empty text for {path.name}, trying pdfplumber")
    except ImportError:
        logger.warning("PyMuPDF (fitz) not installed, trying pdfplumber")
    except Exception as e:
        logger.warning(f"PyMuPDF failed for {path.name}: {e}, trying pdfplumber")

    # Fallback to pdfplumber
    try:
        result = _parse_with_pdfplumber(file_path)
        logger.info(f"PDF parsed with pdfplumber: {result['metadata'].get('page_count', 0)} pages")
        return result
    except ImportError:
        raise ValueError("No PDF parser available. Install PyMuPDF or pdfplumber.")
    except Exception as e:
        logger.error(f"PDF parsing failed for {path.name}: {e}")
        raise ValueError(f"Failed to parse PDF: {e}") from e
