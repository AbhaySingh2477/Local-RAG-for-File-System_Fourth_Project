"""
OCR Factory — Creates OCR engine (deferred to a later phase).
The OCR service handles graceful degradation if PaddleOCR/Tesseract
are not installed, so this factory just delegates to ocr_service.
"""

from __future__ import annotations

from services.ocr.ocr_service import OCRService, get_ocr_service

__all__ = ["OCRService", "get_ocr_service"]
