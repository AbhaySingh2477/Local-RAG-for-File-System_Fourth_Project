"""
Markdown Parser — Extract text from .md/.markdown files.
Preserves section headers as metadata for chunk attribution.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".md", ".markdown", ".mdown", ".mkd"}

# Regex to match markdown headings
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


def can_parse(file_type: str) -> bool:
    return file_type.lower().lstrip(".") in {ext.lstrip(".") for ext in SUPPORTED_EXTENSIONS}


def _extract_sections(text: str) -> list[dict[str, str]]:
    """Split markdown into sections by headings."""
    sections = []
    headings = list(_HEADING_RE.finditer(text))

    if not headings:
        return [{"title": "", "level": 0, "text": text.strip()}]

    # Text before first heading
    pre = text[: headings[0].start()].strip()
    if pre:
        sections.append({"title": "", "level": 0, "text": pre})

    for i, match in enumerate(headings):
        level = len(match.group(1))
        title = match.group(2).strip()
        start = match.end()
        end = headings[i + 1].start() if i + 1 < len(headings) else len(text)
        body = text[start:end].strip()
        sections.append({"title": title, "level": level, "text": body})

    return sections


async def parse(file_path: str) -> dict[str, Any]:
    """
    Parse a Markdown file.

    Returns:
        dict with keys: text, metadata, pages, sections
    """
    path = Path(file_path)
    logger.info(f"Parsing markdown file: {path.name}")

    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = path.read_text(encoding="latin-1")

    sections = _extract_sections(content)
    headings = [s["title"] for s in sections if s["title"]]

    return {
        "text": content,
        "metadata": {
            "format": "markdown",
            "headings": headings,
            "section_count": len(sections),
            "char_count": len(content),
        },
        "pages": [{"page": 1, "text": content}],
        "sections": sections,
    }
