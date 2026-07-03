"""
Text Parser — Plain text file extraction (.txt, .log, .cfg, .ini).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".txt", ".log", ".cfg", ".ini", ".env", ".text"}


def can_parse(file_type: str) -> bool:
    return file_type.lower().lstrip(".") in {ext.lstrip(".") for ext in SUPPORTED_EXTENSIONS}


async def parse(file_path: str) -> dict[str, Any]:
    """
    Parse a plain text file.

    Returns:
        dict with keys: text, metadata, pages
    """
    path = Path(file_path)
    logger.info(f"Parsing text file: {path.name}")

    try:
        # Try UTF-8 first, then fall back to latin-1
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = path.read_text(encoding="latin-1")
            logger.warning(f"Fell back to latin-1 encoding for {path.name}")

        line_count = content.count("\n") + 1

        return {
            "text": content,
            "metadata": {
                "format": "text",
                "encoding": "utf-8",
                "line_count": line_count,
                "char_count": len(content),
            },
            "pages": [{"page": 1, "text": content}],
        }

    except Exception as e:
        logger.error(f"Text parsing failed for {path.name}: {e}")
        raise ValueError(f"Failed to parse text file: {e}") from e
