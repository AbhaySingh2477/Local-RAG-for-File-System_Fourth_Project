"""
Parser Factory — Routes file types to the correct parser module.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from services.parsing import (
    text_parser,
    markdown_parser,
    pdf_parser,
    docx_parser,
    excel_parser,
    html_parser,
    csv_parser,
    json_parser,
    code_parser,
)

logger = logging.getLogger(__name__)

# Ordered list of parsers — checked in sequence
_PARSERS = [
    pdf_parser,
    docx_parser,
    excel_parser,
    html_parser,
    markdown_parser,
    csv_parser,
    json_parser,
    code_parser,
    text_parser,  # Fallback — must be last
]


def get_parser(file_type: str):
    """
    Get the appropriate parser module for a file type.

    Args:
        file_type: File extension (e.g., 'pdf', '.pdf', 'docx')

    Returns:
        Parser module with can_parse() and parse() functions, or None.
    """
    normalized = file_type.lower().lstrip(".")

    for parser in _PARSERS:
        if parser.can_parse(normalized):
            return parser

    return None


async def parse_document(file_path: str, file_type: str | None = None) -> dict[str, Any]:
    """
    Parse a document file and return extracted text + metadata.

    Args:
        file_path: Absolute path to the file.
        file_type: Optional file type override. If None, detected from extension.

    Returns:
        dict with keys:
            - text: Full extracted text
            - metadata: Parser-specific metadata
            - pages: List of {page, text} dicts
            - sections: (optional) List of {title, level, text} dicts

    Raises:
        ValueError: If no parser available or parsing fails.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ft = file_type or path.suffix.lstrip(".")
    if not ft:
        raise ValueError(f"Cannot determine file type for: {file_path}")

    parser = get_parser(ft)
    if parser is None:
        raise ValueError(f"No parser available for file type: {ft}")

    logger.info(f"Parsing '{path.name}' with {parser.__name__}")
    result = await parser.parse(file_path)

    # Ensure required fields
    if "text" not in result:
        result["text"] = ""
    if "metadata" not in result:
        result["metadata"] = {}
    if "pages" not in result:
        result["pages"] = [{"page": 1, "text": result["text"]}]

    # Add common metadata
    result["metadata"]["filename"] = path.name
    result["metadata"]["file_size"] = path.stat().st_size

    return result
