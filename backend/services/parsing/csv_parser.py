"""
CSV Parser — Extract text from CSV files.
Converts rows to structured text with column headers for semantic search.
"""

from __future__ import annotations

import csv
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".csv", ".tsv"}


def can_parse(file_type: str) -> bool:
    return file_type.lower().lstrip(".") in {ext.lstrip(".") for ext in SUPPORTED_EXTENSIONS}


async def parse(file_path: str) -> dict[str, Any]:
    """
    Parse a CSV/TSV file into structured text.

    Returns:
        dict with keys: text, metadata, pages
    """
    path = Path(file_path)
    logger.info(f"Parsing CSV: {path.name}")

    try:
        delimiter = "\t" if path.suffix.lower() == ".tsv" else ","

        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = path.read_text(encoding="latin-1")

        reader = csv.reader(content.splitlines(), delimiter=delimiter)
        rows = list(reader)

        if not rows:
            return {
                "text": "",
                "metadata": {"format": "csv", "row_count": 0, "col_count": 0},
                "pages": [],
            }

        headers = rows[0]
        text_parts = []
        text_parts.append("Columns: " + ", ".join(headers))
        text_parts.append("")

        for row in rows[1:]:
            # Create key-value pairs for better semantic search
            row_parts = []
            for h, v in zip(headers, row):
                if v.strip():
                    row_parts.append(f"{h}: {v.strip()}")
            if row_parts:
                text_parts.append("; ".join(row_parts))

        full_text = "\n".join(text_parts)

        return {
            "text": full_text,
            "metadata": {
                "format": "csv" if delimiter == "," else "tsv",
                "row_count": len(rows) - 1,
                "col_count": len(headers),
                "columns": headers,
                "char_count": len(full_text),
            },
            "pages": [{"page": 1, "text": full_text}],
        }

    except Exception as e:
        logger.error(f"CSV parsing failed for {path.name}: {e}")
        raise ValueError(f"Failed to parse CSV: {e}") from e
