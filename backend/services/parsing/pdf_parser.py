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
    """Extract text using PyMuPDF (fitz)."""
    import fitz

    doc = fitz.open(file_path)
    pages = []
    scanned_pages = []
    full_text_parts = []

    for i, page in enumerate(doc):
        text = page.get_text("text").strip()
        page_num = i + 1

        pages.append({"page": page_num, "text": text})
        full_text_parts.append(text)

        if len(text) < _SCANNED_THRESHOLD:
            scanned_pages.append(page_num)

    metadata = {
        "format": "pdf",
        "page_count": len(doc),
        "title": doc.metadata.get("title", ""),
        "author": doc.metadata.get("author", ""),
        "subject": doc.metadata.get("subject", ""),
        "creator": doc.metadata.get("creator", ""),
        "producer": doc.metadata.get("producer", ""),
        "scanned_pages": scanned_pages,
        "needs_ocr": len(scanned_pages) > len(doc) * 0.5,  # >50% scanned
    }

    doc.close()

    return {
        "text": "\n\n".join(full_text_parts),
        "metadata": metadata,
        "pages": pages,
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
