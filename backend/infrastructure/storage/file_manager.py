"""
File Manager — Handles file validation, upload storage, hash computation.
"""

from __future__ import annotations

import hashlib
import logging
import shutil
from pathlib import Path
from typing import Any

from config.settings import get_settings

logger = logging.getLogger(__name__)


class FileManager:
    """Manages uploaded file storage and validation."""

    def __init__(self, uploads_dir: Path | None = None):
        settings = get_settings()
        self._uploads_dir = uploads_dir or settings.uploads_dir
        self._max_size = settings.max_upload_size_mb * 1024 * 1024  # Convert to bytes
        self._allowed_types = set(settings.allowed_file_types)
        self._uploads_dir.mkdir(parents=True, exist_ok=True)

    def validate_file(self, filename: str, file_size: int) -> dict[str, Any]:
        """
        Validate a file before accepting upload.

        Args:
            filename: Original filename
            file_size: Size in bytes

        Returns:
            dict with keys: valid, error, file_type

        """
        ext = Path(filename).suffix.lower().lstrip(".")

        if not ext:
            return {"valid": False, "error": "File has no extension", "file_type": ""}

        if ext not in self._allowed_types:
            return {
                "valid": False,
                "error": f"File type '.{ext}' not supported. Allowed: {', '.join(sorted(self._allowed_types))}",
                "file_type": ext,
            }

        if file_size > self._max_size:
            max_mb = self._max_size / (1024 * 1024)
            return {
                "valid": False,
                "error": f"File too large ({file_size / (1024*1024):.1f}MB). Maximum: {max_mb:.0f}MB",
                "file_type": ext,
            }

        return {"valid": True, "error": None, "file_type": ext}

    async def save_upload(self, filename: str, content: bytes, notebook_id: str = "") -> dict[str, Any]:
        """
        Save an uploaded file to the uploads directory.

        Args:
            filename: Original filename
            content: File content as bytes
            notebook_id: Optional notebook ID for directory organization

        Returns:
            dict with keys: path, content_hash, file_size, file_type
        """
        # Create notebook subdirectory if specified
        if notebook_id:
            dest_dir = self._uploads_dir / notebook_id
        else:
            dest_dir = self._uploads_dir
        dest_dir.mkdir(parents=True, exist_ok=True)

        # Compute content hash
        content_hash = hashlib.sha256(content).hexdigest()

        # Use hash prefix in filename to avoid collisions
        stem = Path(filename).stem
        ext = Path(filename).suffix
        safe_name = f"{stem}_{content_hash[:8]}{ext}"
        dest_path = dest_dir / safe_name

        # Write file
        dest_path.write_bytes(content)

        logger.info(f"Saved upload: {safe_name} ({len(content)} bytes)")

        return {
            "path": str(dest_path),
            "content_hash": content_hash,
            "file_size": len(content),
            "file_type": ext.lstrip(".").lower(),
        }

    async def delete_file(self, file_path: str) -> bool:
        """Delete an uploaded file."""
        path = Path(file_path)
        if path.exists():
            path.unlink()
            logger.info(f"Deleted file: {path.name}")
            return True
        return False

    def get_file_path(self, filename: str, notebook_id: str = "") -> Path | None:
        """Get the full path for an uploaded file."""
        if notebook_id:
            path = self._uploads_dir / notebook_id / filename
        else:
            path = self._uploads_dir / filename

        return path if path.exists() else None


# Singleton
_file_manager: FileManager | None = None


def get_file_manager() -> FileManager:
    """Get the file manager singleton."""
    global _file_manager
    if _file_manager is None:
        _file_manager = FileManager()
    return _file_manager
