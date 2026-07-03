"""
JSON Parser — Extract text from JSON files.
Pretty-prints JSON structures as readable text.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".json", ".jsonl"}


def can_parse(file_type: str) -> bool:
    return file_type.lower().lstrip(".") in {ext.lstrip(".") for ext in SUPPORTED_EXTENSIONS}


def _flatten_json(obj: Any, prefix: str = "") -> list[str]:
    """Recursively flatten a JSON object into readable key-value lines."""
    lines = []

    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if isinstance(value, (dict, list)):
                lines.extend(_flatten_json(value, full_key))
            else:
                lines.append(f"{full_key}: {value}")
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            full_key = f"{prefix}[{i}]"
            if isinstance(item, (dict, list)):
                lines.extend(_flatten_json(item, full_key))
            else:
                lines.append(f"{full_key}: {item}")
    else:
        lines.append(f"{prefix}: {obj}" if prefix else str(obj))

    return lines


async def parse(file_path: str) -> dict[str, Any]:
    """
    Parse a JSON/JSONL file.

    Returns:
        dict with keys: text, metadata, pages
    """
    path = Path(file_path)
    logger.info(f"Parsing JSON: {path.name}")

    try:
        content = path.read_text(encoding="utf-8")

        if path.suffix.lower() == ".jsonl":
            # JSONL: one JSON object per line
            entries = []
            for line_num, line in enumerate(content.splitlines(), 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    lines = _flatten_json(obj, f"entry_{line_num}")
                    entries.append("\n".join(lines))
                except json.JSONDecodeError:
                    entries.append(f"entry_{line_num}: {line}")

            full_text = "\n\n".join(entries)
            record_count = len(entries)
        else:
            # Standard JSON
            data = json.loads(content)
            lines = _flatten_json(data)
            full_text = "\n".join(lines)
            record_count = len(data) if isinstance(data, list) else 1

        return {
            "text": full_text,
            "metadata": {
                "format": "jsonl" if path.suffix.lower() == ".jsonl" else "json",
                "record_count": record_count,
                "char_count": len(full_text),
            },
            "pages": [{"page": 1, "text": full_text}],
        }

    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing failed for {path.name}: {e}")
        raise ValueError(f"Invalid JSON: {e}") from e
    except Exception as e:
        logger.error(f"JSON parsing failed for {path.name}: {e}")
        raise ValueError(f"Failed to parse JSON: {e}") from e
