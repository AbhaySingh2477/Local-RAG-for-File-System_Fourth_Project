"""
Code Parser — Extract text from source code files.
Reads code with language-aware metadata for semantic search.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Extension → language mapping
_LANGUAGE_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".jsx": "javascript",
    ".tsx": "typescript",
    ".rs": "rust",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".go": "go",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".cs": "csharp",
    ".r": "r",
    ".R": "r",
    ".lua": "lua",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "zsh",
    ".fish": "fish",
    ".ps1": "powershell",
    ".sql": "sql",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".xml": "xml",
}

SUPPORTED_EXTENSIONS = set(_LANGUAGE_MAP.keys())


def can_parse(file_type: str) -> bool:
    ext = "." + file_type.lower().lstrip(".")
    return ext in SUPPORTED_EXTENSIONS


async def parse(file_path: str) -> dict[str, Any]:
    """
    Parse a source code file.

    Returns:
        dict with keys: text, metadata, pages
    """
    path = Path(file_path)
    logger.info(f"Parsing code file: {path.name}")

    try:
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = path.read_text(encoding="latin-1")

        ext = path.suffix.lower()
        language = _LANGUAGE_MAP.get(ext, "unknown")
        line_count = content.count("\n") + 1

        return {
            "text": content,
            "metadata": {
                "format": "code",
                "language": language,
                "extension": ext,
                "line_count": line_count,
                "char_count": len(content),
            },
            "pages": [{"page": 1, "text": content}],
        }

    except Exception as e:
        logger.error(f"Code parsing failed for {path.name}: {e}")
        raise ValueError(f"Failed to parse code file: {e}") from e
