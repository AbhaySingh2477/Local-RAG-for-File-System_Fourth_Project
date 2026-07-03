"""
OCR Service — Extract text from images and scanned PDFs.
Primary: PaddleOCR. Fallback: pytesseract.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class OCRService:
    """Unified OCR interface with engine fallback."""

    def __init__(self, engine: str = "paddleocr", language: str = "en"):
        self._engine_name = engine
        self._language = language
        self._engine = None

    def _init_paddle(self):
        """Initialize PaddleOCR engine."""
        try:
            from paddleocr import PaddleOCR
            self._engine = PaddleOCR(
                use_angle_cls=True,
                lang=self._language,
                show_log=False,
            )
            self._engine_name = "paddleocr"
            logger.info("PaddleOCR initialized ✓")
            return True
        except ImportError:
            logger.warning("PaddleOCR not installed — will try Tesseract fallback")
            return False
        except Exception as e:
            logger.warning(f"PaddleOCR init failed: {e} — will try Tesseract fallback")
            return False

    def _init_tesseract(self):
        """Initialize Tesseract OCR engine."""
        try:
            import pytesseract
            # Quick check that tesseract binary exists
            pytesseract.get_tesseract_version()
            self._engine_name = "tesseract"
            logger.info("Tesseract OCR initialized ✓")
            return True
        except ImportError:
            logger.warning("pytesseract not installed")
            return False
        except Exception as e:
            logger.warning(f"Tesseract not available: {e}")
            return False

    def _ensure_engine(self):
        """Lazy-initialize the OCR engine."""
        if self._engine is not None or self._engine_name == "tesseract":
            return

        if self._engine_name == "paddleocr":
            if not self._init_paddle():
                if not self._init_tesseract():
                    logger.error("No OCR engine available")
                    raise RuntimeError(
                        "No OCR engine available. Install paddleocr or pytesseract+tesseract."
                    )
        elif self._engine_name == "tesseract":
            if not self._init_tesseract():
                if not self._init_paddle():
                    raise RuntimeError("No OCR engine available.")

    def extract_text(self, image_path: str) -> dict[str, Any]:
        """
        Extract text from a single image.

        Args:
            image_path: Path to image file (PNG, JPG, etc.)

        Returns:
            dict with keys: text, confidence, engine
        """
        self._ensure_engine()

        if self._engine_name == "paddleocr":
            return self._extract_paddle(image_path)
        else:
            return self._extract_tesseract(image_path)

    def _extract_paddle(self, image_path: str) -> dict[str, Any]:
        """Extract text with PaddleOCR."""
        result = self._engine.ocr(image_path, cls=True)

        text_parts = []
        confidences = []

        if result and result[0]:
            for line in result[0]:
                text = line[1][0]
                confidence = line[1][1]
                text_parts.append(text)
                confidences.append(confidence)

        full_text = "\n".join(text_parts)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return {
            "text": full_text,
            "confidence": avg_confidence,
            "engine": "paddleocr",
            "line_count": len(text_parts),
        }

    def _extract_tesseract(self, image_path: str) -> dict[str, Any]:
        """Extract text with Tesseract."""
        import pytesseract
        from PIL import Image

        image = Image.open(image_path)
        text = pytesseract.image_to_string(image, lang=self._language)

        # Get confidence data
        try:
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            confs = [int(c) for c in data.get("conf", []) if c != "-1" and str(c).isdigit()]
            avg_confidence = sum(confs) / len(confs) / 100 if confs else 0.0
        except Exception:
            avg_confidence = 0.0

        return {
            "text": text.strip(),
            "confidence": avg_confidence,
            "engine": "tesseract",
            "line_count": len(text.strip().splitlines()),
        }

    def extract_from_pdf_page(self, pdf_path: str, page_number: int) -> dict[str, Any]:
        """
        OCR a single page of a PDF file.

        Args:
            pdf_path: Path to PDF file
            page_number: 0-indexed page number

        Returns:
            dict with keys: text, confidence, engine
        """
        try:
            import fitz

            doc = fitz.open(pdf_path)
            page = doc[page_number]

            # Render page as image (300 DPI)
            mat = fitz.Matrix(300 / 72, 300 / 72)
            pix = page.get_pixmap(matrix=mat)

            # Save to temp file
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                pix.save(tmp.name)
                result = self.extract_text(tmp.name)

            doc.close()

            # Clean up temp file
            Path(tmp.name).unlink(missing_ok=True)

            return result

        except ImportError:
            raise ValueError("PyMuPDF required for PDF page OCR")
        except Exception as e:
            logger.error(f"PDF page OCR failed: {e}")
            return {"text": "", "confidence": 0.0, "engine": self._engine_name, "line_count": 0}

    @property
    def is_available(self) -> bool:
        """Check if any OCR engine is available."""
        try:
            self._ensure_engine()
            return True
        except RuntimeError:
            return False


# Singleton
_ocr_service: OCRService | None = None


def get_ocr_service() -> OCRService:
    """Get the OCR service singleton."""
    global _ocr_service
    if _ocr_service is None:
        from config.settings import get_settings
        settings = get_settings()
        _ocr_service = OCRService(engine=settings.ocr_engine, language=settings.ocr_language)
    return _ocr_service
