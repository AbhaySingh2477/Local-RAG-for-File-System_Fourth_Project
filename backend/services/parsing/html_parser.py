"""
HTML Parser — Extract readable text from HTML files.
Uses BeautifulSoup4 to strip scripts, styles, and extract content.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".html", ".htm"}


def can_parse(file_type: str) -> bool:
    return file_type.lower().lstrip(".") in {ext.lstrip(".") for ext in SUPPORTED_EXTENSIONS}


async def parse(file_path: str) -> dict[str, Any]:
    """
    Parse an HTML file — extract readable text, strip scripts/styles.

    Returns:
        dict with keys: text, metadata, pages
    """
    from bs4 import BeautifulSoup

    path = Path(file_path)
    logger.info(f"Parsing HTML: {path.name}")

    try:
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = path.read_text(encoding="latin-1")

        soup = BeautifulSoup(content, "lxml")

        # Remove unwanted elements
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "meta", "link"]):
            tag.decompose()

        # Extract title
        title = ""
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text(strip=True)

        # Extract headings for structure
        headings = []
        for level in range(1, 7):
            for h in soup.find_all(f"h{level}"):
                headings.append({
                    "level": level,
                    "text": h.get_text(strip=True),
                })

        # Get readable text
        text = soup.get_text(separator="\n", strip=True)
        # Clean up excessive whitespace
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        clean_text = "\n".join(lines)

        return {
            "text": clean_text,
            "metadata": {
                "format": "html",
                "title": title,
                "headings": [h["text"] for h in headings],
                "char_count": len(clean_text),
            },
            "pages": [{"page": 1, "text": clean_text}],
        }

    except ImportError:
        raise ValueError("BeautifulSoup4 and lxml required. Run: pip install beautifulsoup4 lxml")
    except Exception as e:
        logger.error(f"HTML parsing failed for {path.name}: {e}")
        raise ValueError(f"Failed to parse HTML: {e}") from e
