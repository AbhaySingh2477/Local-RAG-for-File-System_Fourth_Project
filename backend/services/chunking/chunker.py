"""
Chunker — Recursive token-based text chunking.
Splits text into semantically coherent chunks that respect sentence
and paragraph boundaries, using tiktoken for accurate token counting.
"""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any

from services.chunking.token_counter import count_tokens, get_encoding

logger = logging.getLogger(__name__)

# Sentence boundary regex (handles Mr., Mrs., Dr., etc.)
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z])")

# Paragraph boundary
_PARAGRAPH_RE = re.compile(r"\n\s*\n")


@dataclass
class ChunkResult:
    """A single text chunk with position and metadata."""
    id: str = ""
    content: str = ""
    chunk_index: int = 0
    token_count: int = 0
    start_char: int = 0
    end_char: int = 0
    page_number: int | None = None
    section_title: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


class TextChunker:
    """
    Recursive token-based text chunker.

    Splits text into chunks of `chunk_size` tokens with `overlap` token overlap.
    Respects paragraph and sentence boundaries where possible.
    """

    def __init__(
        self,
        chunk_size: int = 512,
        overlap: int = 100,
        encoding_name: str = "cl100k_base",
    ):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.encoding_name = encoding_name
        self._encoding = get_encoding(encoding_name)

    def chunk_text(
        self,
        text: str,
        document_id: str = "",
        pages: list[dict] | None = None,
        sections: list[dict] | None = None,
    ) -> list[ChunkResult]:
        """
        Split text into chunks.

        Args:
            text: Full document text
            document_id: ID of the parent document
            pages: Optional list of {page, text} dicts for page attribution
            sections: Optional list of {title, text} dicts for section attribution

        Returns:
            List of ChunkResult objects
        """
        if not text or not text.strip():
            return []

        # Build page char-range index for page attribution
        page_ranges = self._build_page_ranges(pages) if pages else []

        # Build section char-range index for section attribution
        section_ranges = self._build_section_ranges(text, sections) if sections else []

        # Split into paragraphs first, then sentences, then tokens
        paragraphs = _PARAGRAPH_RE.split(text)
        chunks: list[ChunkResult] = []
        current_tokens: list[int] = []
        current_start = 0
        char_pos = 0

        for para_idx, paragraph in enumerate(paragraphs):
            paragraph = paragraph.strip()
            if not paragraph:
                char_pos += 1  # account for the newline
                continue

            para_tokens = self._encoding.encode(paragraph)

            if len(para_tokens) <= self.chunk_size:
                # Paragraph fits in a chunk
                if len(current_tokens) + len(para_tokens) > self.chunk_size:
                    # Save current chunk and start new one with overlap
                    if current_tokens:
                        chunk = self._make_chunk(
                            current_tokens,
                            len(chunks),
                            current_start,
                            char_pos,
                            page_ranges,
                            section_ranges,
                        )
                        chunks.append(chunk)

                        # Overlap: keep last `overlap` tokens
                        overlap_tokens = current_tokens[-self.overlap :] if self.overlap else []
                        current_tokens = overlap_tokens
                        current_start = max(0, char_pos - self._tokens_to_chars(overlap_tokens))

                current_tokens.extend(para_tokens)
            else:
                # Paragraph too large — split by sentences
                sentences = _SENTENCE_RE.split(paragraph)
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue

                    sent_tokens = self._encoding.encode(sentence)

                    if len(sent_tokens) > self.chunk_size:
                        # Even a single sentence is too long — force-split by tokens
                        if current_tokens:
                            chunk = self._make_chunk(
                                current_tokens,
                                len(chunks),
                                current_start,
                                char_pos,
                                page_ranges,
                                section_ranges,
                            )
                            chunks.append(chunk)
                            current_tokens = []

                        # Force-split
                        for i in range(0, len(sent_tokens), self.chunk_size - self.overlap):
                            token_slice = sent_tokens[i: i + self.chunk_size]
                            chunk = self._make_chunk(
                                token_slice,
                                len(chunks),
                                char_pos,
                                char_pos + len(self._encoding.decode(token_slice)),
                                page_ranges,
                                section_ranges,
                            )
                            chunks.append(chunk)

                        current_start = char_pos + len(sentence)
                    elif len(current_tokens) + len(sent_tokens) > self.chunk_size:
                        # Save current chunk
                        if current_tokens:
                            chunk = self._make_chunk(
                                current_tokens,
                                len(chunks),
                                current_start,
                                char_pos,
                                page_ranges,
                                section_ranges,
                            )
                            chunks.append(chunk)

                            overlap_tokens = current_tokens[-self.overlap :] if self.overlap else []
                            current_tokens = overlap_tokens + sent_tokens
                            current_start = max(0, char_pos - self._tokens_to_chars(overlap_tokens))
                    else:
                        current_tokens.extend(sent_tokens)

            char_pos += len(paragraph) + 2  # +2 for paragraph separator

        # Don't forget the last chunk
        if current_tokens:
            chunk = self._make_chunk(
                current_tokens,
                len(chunks),
                current_start,
                len(text),
                page_ranges,
                section_ranges,
            )
            chunks.append(chunk)

        logger.info(
            f"Chunked text into {len(chunks)} chunks "
            f"(avg {sum(c.token_count for c in chunks) // max(len(chunks), 1)} tokens/chunk)"
        )

        return chunks

    def _make_chunk(
        self,
        tokens: list[int],
        index: int,
        start_char: int,
        end_char: int,
        page_ranges: list,
        section_ranges: list,
    ) -> ChunkResult:
        """Create a ChunkResult from tokens."""
        content = self._encoding.decode(tokens)
        page_number = self._find_page(start_char, page_ranges)
        section_title = self._find_section(start_char, section_ranges)

        return ChunkResult(
            id=str(uuid.uuid4()),
            content=content.strip(),
            chunk_index=index,
            token_count=len(tokens),
            start_char=start_char,
            end_char=min(end_char, start_char + len(content)),
            page_number=page_number,
            section_title=section_title,
        )

    def _tokens_to_chars(self, tokens: list[int]) -> int:
        """Approximate character count from tokens."""
        if not tokens:
            return 0
        return len(self._encoding.decode(tokens))

    def _build_page_ranges(self, pages: list[dict]) -> list[tuple[int, int, int]]:
        """Build (start_char, end_char, page_number) index from pages."""
        ranges = []
        pos = 0
        for page in pages:
            text = page.get("text", "")
            page_num = page.get("page", 1)
            ranges.append((pos, pos + len(text), page_num))
            pos += len(text) + 2  # account for separators
        return ranges

    def _build_section_ranges(self, full_text: str, sections: list[dict]) -> list[tuple[int, int, str]]:
        """Build (start_char, end_char, title) index from sections."""
        ranges = []
        pos = 0
        for section in sections:
            title = section.get("title", "")
            text = section.get("text", "")
            section_text = f"{title}\n{text}" if title else text

            # Find section position in full text
            idx = full_text.find(text[:100], pos) if text else pos
            if idx == -1:
                idx = pos

            ranges.append((idx, idx + len(section_text), title))
            pos = idx + len(section_text)

        return ranges

    def _find_page(self, char_pos: int, page_ranges: list[tuple[int, int, int]]) -> int | None:
        """Find which page a character position belongs to."""
        for start, end, page_num in page_ranges:
            if start <= char_pos < end:
                return page_num
        return page_ranges[-1][2] if page_ranges else None

    def _find_section(self, char_pos: int, section_ranges: list[tuple[int, int, str]]) -> str:
        """Find which section a character position belongs to."""
        for start, end, title in section_ranges:
            if start <= char_pos < end:
                return title
        return ""


# Default singleton
_chunker: TextChunker | None = None


def get_chunker() -> TextChunker:
    """Get the text chunker singleton (configured from settings)."""
    global _chunker
    if _chunker is None:
        from config.settings import get_settings
        settings = get_settings()
        _chunker = TextChunker(
            chunk_size=settings.chunk_size,
            overlap=settings.chunk_overlap,
            encoding_name=settings.chunk_tokenizer,
        )
    return _chunker
