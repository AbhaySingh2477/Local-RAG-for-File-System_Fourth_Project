"""
Hierarchical Chunker — Generates multi-level chunks based on document category.

Supports:
  - PDF sections detected by font-size analysis (primary)
  - Markdown header splitting (fallback for .md/.txt files)
  - Chunk size caps: sections > max_tokens get split into paragraph sub-chunks
  - Merge: tiny chunks (< min_tokens) get merged into their neighbor
"""

import logging
import re
import uuid
from typing import Any

from domain.entities import Chunk
from services.chunking.token_counter import count_tokens

logger = logging.getLogger(__name__)

# Defaults (overridable via constructor)
DEFAULT_MAX_SECTION_TOKENS = 1024
DEFAULT_MAX_PARAGRAPH_TOKENS = 512
DEFAULT_MIN_CHUNK_TOKENS = 50


class HierarchicalChunker:
    """
    Splits text hierarchically based on document category.
    Generates chunks for different structural levels (chapter, section, paragraph)
    and encodes the hierarchy into XML metadata.
    """

    def __init__(
        self,
        encoding_name: str = "cl100k_base",
        max_section_tokens: int = DEFAULT_MAX_SECTION_TOKENS,
        max_paragraph_tokens: int = DEFAULT_MAX_PARAGRAPH_TOKENS,
        min_chunk_tokens: int = DEFAULT_MIN_CHUNK_TOKENS,
    ):
        self.encoding_name = encoding_name
        self.max_section_tokens = max_section_tokens
        self.max_paragraph_tokens = max_paragraph_tokens
        self.min_chunk_tokens = min_chunk_tokens

    def chunk_document(
        self,
        text: str,
        document_id: str,
        document_category: str = "general",
        sections: list[dict] | None = None,
    ) -> list[Chunk]:
        """
        Chunk document based on its category.

        Args:
            text: Full document text
            document_id: UUID of the document
            document_category: 'book', 'research_paper', or 'general'
            sections: Parsed section dicts from PDF parser (title, text, level, page)
        """
        if sections and len(sections) > 0:
            # We have structural sections from the PDF parser — use them
            logger.info(
                f"Using {len(sections)} parsed sections for '{document_category}' chunking"
            )
            if document_category == "book":
                chunks = self._chunk_book_from_sections(text, document_id, sections)
            elif document_category == "research_paper":
                chunks = self._chunk_paper_from_sections(text, document_id, sections)
            else:
                chunks = self._chunk_general_from_sections(text, document_id, sections)
        else:
            # Fallback: split by markdown headers (for .md/.txt files)
            logger.info("No parsed sections; falling back to markdown header splitting")
            if document_category == "book":
                chunks = self._chunk_book_markdown(text, document_id)
            elif document_category == "research_paper":
                chunks = self._chunk_paper_markdown(text, document_id)
            else:
                chunks = self._chunk_general_markdown(text, document_id)

        # Merge tiny chunks
        chunks = self._merge_tiny_chunks(chunks)

        logger.info(
            f"Hierarchical chunking complete: {len(chunks)} chunks "
            f"(category={document_category})"
        )
        return chunks

    # ── Helper: create a Chunk entity ────────────────────────────

    def _create_chunk(
        self,
        document_id: str,
        content: str,
        level: str,
        xml: str,
        index: int,
        page_number: int | None = None,
        section_title: str = "",
    ) -> Chunk:
        token_count = count_tokens(content, self.encoding_name)
        return Chunk(
            id=str(uuid.uuid4()),
            document_id=document_id,
            chunk_index=index,
            content=content,
            token_count=token_count,
            page_number=page_number,
            section_title=section_title,
            level=level,
            indexing_xml=xml,
        )

    # ── Helper: split long text into paragraph-sized chunks ──────

    def _split_into_paragraphs(
        self, text: str, max_tokens: int | None = None
    ) -> list[str]:
        """Split text on double-newlines, then further split oversized paragraphs."""
        max_tokens = max_tokens or self.max_paragraph_tokens
        raw_paragraphs = re.split(r"\n\s*\n", text)
        result = []

        for para in raw_paragraphs:
            para = para.strip()
            if not para:
                continue
            tokens = count_tokens(para, self.encoding_name)
            if tokens <= max_tokens:
                result.append(para)
            else:
                # Split oversized paragraph by sentences
                sentences = re.split(r"(?<=[.!?])\s+", para)
                current_chunk = ""
                current_tokens = 0
                for sentence in sentences:
                    s_tokens = count_tokens(sentence, self.encoding_name)
                    if current_tokens + s_tokens > max_tokens and current_chunk:
                        result.append(current_chunk.strip())
                        current_chunk = sentence
                        current_tokens = s_tokens
                    else:
                        current_chunk += (" " if current_chunk else "") + sentence
                        current_tokens += s_tokens
                if current_chunk.strip():
                    result.append(current_chunk.strip())

        return result

    # ── Merge tiny chunks ────────────────────────────────────────

    def _merge_tiny_chunks(self, chunks: list[Chunk]) -> list[Chunk]:
        """Merge chunks smaller than min_chunk_tokens into their neighbor."""
        if not chunks or len(chunks) <= 1:
            return chunks

        merged: list[Chunk] = []
        for chunk in chunks:
            if (
                merged
                and chunk.token_count < self.min_chunk_tokens
                and merged[-1].level == chunk.level
            ):
                # Merge into previous chunk
                prev = merged[-1]
                prev.content += "\n\n" + chunk.content
                prev.token_count += chunk.token_count
            elif (
                merged
                and merged[-1].token_count < self.min_chunk_tokens
                and merged[-1].level == chunk.level
            ):
                # Previous was tiny — merge current into it
                prev = merged[-1]
                prev.content += "\n\n" + chunk.content
                prev.token_count += chunk.token_count
            else:
                merged.append(chunk)

        return merged

    # ══════════════════════════════════════════════════════════════
    #  Section-based chunking (from PDF parser output)
    # ══════════════════════════════════════════════════════════════

    def _chunk_book_from_sections(
        self, text: str, document_id: str, sections: list[dict]
    ) -> list[Chunk]:
        """Books: Chapter → Section → Paragraph hierarchy."""
        chunks: list[Chunk] = []
        idx = 0
        current_chapter = "(Untitled)"
        ch_num = 0

        for section in sections:
            title = section.get("title", "").strip()
            body = section.get("text", "").strip()
            level = section.get("level", "section")
            page = section.get("page")

            if level == "chapter":
                ch_num += 1
                current_chapter = title or f"Chapter {ch_num}"

            if not body:
                continue

            sec_tokens = count_tokens(body, self.encoding_name)

            if level == "chapter":
                # Emit a chapter-level summary chunk (first 1024 tokens)
                ch_xml = (
                    f'<hierarchy type="book">'
                    f'<chapter id="{ch_num}" title="{_xml_escape(current_chapter)}">'
                    f"</chapter></hierarchy>"
                )
                if sec_tokens <= self.max_section_tokens:
                    chunks.append(
                        self._create_chunk(
                            document_id, body, "chapter", ch_xml, idx,
                            page_number=page, section_title=current_chapter,
                        )
                    )
                    idx += 1
                else:
                    # Chapter too big — split into paragraph chunks
                    paragraphs = self._split_into_paragraphs(body)
                    for p_num, p_text in enumerate(paragraphs):
                        p_xml = (
                            f'<hierarchy type="book">'
                            f'<chapter id="{ch_num}" title="{_xml_escape(current_chapter)}">'
                            f'<paragraph id="{p_num}"></paragraph>'
                            f"</chapter></hierarchy>"
                        )
                        chunks.append(
                            self._create_chunk(
                                document_id, p_text, "paragraph", p_xml, idx,
                                page_number=page, section_title=current_chapter,
                            )
                        )
                        idx += 1
            else:
                # Section-level
                sec_title = title or "(Untitled section)"
                sec_xml = (
                    f'<hierarchy type="book">'
                    f'<chapter id="{ch_num}" title="{_xml_escape(current_chapter)}">'
                    f'<section title="{_xml_escape(sec_title)}">'
                    f"</section></chapter></hierarchy>"
                )

                if sec_tokens <= self.max_section_tokens:
                    chunks.append(
                        self._create_chunk(
                            document_id, body, "section", sec_xml, idx,
                            page_number=page, section_title=sec_title,
                        )
                    )
                    idx += 1
                else:
                    # Section too big — split into paragraph chunks
                    paragraphs = self._split_into_paragraphs(body)
                    for p_num, p_text in enumerate(paragraphs):
                        p_xml = (
                            f'<hierarchy type="book">'
                            f'<chapter id="{ch_num}" title="{_xml_escape(current_chapter)}">'
                            f'<section title="{_xml_escape(sec_title)}">'
                            f'<paragraph id="{p_num}"></paragraph>'
                            f"</section></chapter></hierarchy>"
                        )
                        chunks.append(
                            self._create_chunk(
                                document_id, p_text, "paragraph", p_xml, idx,
                                page_number=page, section_title=sec_title,
                            )
                        )
                        idx += 1

        return chunks

    def _chunk_paper_from_sections(
        self, text: str, document_id: str, sections: list[dict]
    ) -> list[Chunk]:
        """Research papers: Section → Paragraph hierarchy."""
        chunks: list[Chunk] = []
        idx = 0

        for sec_num, section in enumerate(sections):
            title = section.get("title", "").strip()
            body = section.get("text", "").strip()
            page = section.get("page")

            if not body:
                continue

            sec_title = title or f"Section {sec_num + 1}"
            sec_tokens = count_tokens(body, self.encoding_name)

            sec_xml = (
                f'<hierarchy type="research_paper">'
                f'<section id="{sec_num}" title="{_xml_escape(sec_title)}">'
                f"</section></hierarchy>"
            )

            if sec_tokens <= self.max_section_tokens:
                # Emit section as a single chunk
                chunks.append(
                    self._create_chunk(
                        document_id, body, "section", sec_xml, idx,
                        page_number=page, section_title=sec_title,
                    )
                )
                idx += 1
            else:
                # Split into paragraphs
                paragraphs = self._split_into_paragraphs(body)
                for p_num, p_text in enumerate(paragraphs):
                    p_xml = (
                        f'<hierarchy type="research_paper">'
                        f'<section id="{sec_num}" title="{_xml_escape(sec_title)}">'
                        f'<paragraph id="{p_num}"></paragraph>'
                        f"</section></hierarchy>"
                    )
                    chunks.append(
                        self._create_chunk(
                            document_id, p_text, "paragraph", p_xml, idx,
                            page_number=page, section_title=sec_title,
                        )
                    )
                    idx += 1

        return chunks

    def _chunk_general_from_sections(
        self, text: str, document_id: str, sections: list[dict]
    ) -> list[Chunk]:
        """General documents: same logic as research papers."""
        return self._chunk_paper_from_sections(text, document_id, sections)

    # ══════════════════════════════════════════════════════════════
    #  Markdown header fallback (for .md / .txt files)
    # ══════════════════════════════════════════════════════════════

    def _chunk_book_markdown(self, text: str, document_id: str) -> list[Chunk]:
        """Fallback: split by markdown # and ## headers."""
        chunks: list[Chunk] = []
        idx = 0

        chapter_splits = re.split(r"\n(?=# )", "\n" + text)
        for ch_num, chapter_text in enumerate(chapter_splits):
            chapter_text = chapter_text.strip()
            if not chapter_text:
                continue

            ch_lines = chapter_text.split("\n", 1)
            ch_title = ch_lines[0].lstrip("# ").strip()
            ch_content = ch_lines[1] if len(ch_lines) > 1 else ""

            ch_xml = (
                f'<hierarchy type="book">'
                f'<chapter id="{ch_num}" title="{_xml_escape(ch_title)}">'
                f"</chapter></hierarchy>"
            )

            # Split chapter into sections by ##
            section_splits = re.split(r"\n(?=## )", "\n" + ch_content)
            for sec_num, section_text in enumerate(section_splits):
                section_text = section_text.strip()
                if not section_text:
                    continue

                sec_lines = section_text.split("\n", 1)
                sec_title = sec_lines[0].lstrip("# ").strip()
                sec_content = sec_lines[1] if len(sec_lines) > 1 else section_text

                sec_xml = (
                    f'<hierarchy type="book">'
                    f'<chapter id="{ch_num}" title="{_xml_escape(ch_title)}">'
                    f'<section id="{sec_num}" title="{_xml_escape(sec_title)}">'
                    f"</section></chapter></hierarchy>"
                )

                sec_tokens = count_tokens(sec_content, self.encoding_name)
                if sec_tokens <= self.max_section_tokens:
                    chunks.append(
                        self._create_chunk(
                            document_id, sec_content, "section", sec_xml, idx,
                            section_title=sec_title,
                        )
                    )
                    idx += 1
                else:
                    paragraphs = self._split_into_paragraphs(sec_content)
                    for p_num, p_text in enumerate(paragraphs):
                        p_xml = (
                            f'<hierarchy type="book">'
                            f'<chapter id="{ch_num}" title="{_xml_escape(ch_title)}">'
                            f'<section id="{sec_num}" title="{_xml_escape(sec_title)}">'
                            f'<paragraph id="{p_num}"></paragraph>'
                            f"</section></chapter></hierarchy>"
                        )
                        chunks.append(
                            self._create_chunk(
                                document_id, p_text, "paragraph", p_xml, idx,
                                section_title=sec_title,
                            )
                        )
                        idx += 1

        return chunks

    def _chunk_paper_markdown(self, text: str, document_id: str) -> list[Chunk]:
        """Fallback: split by markdown # or ## headers."""
        chunks: list[Chunk] = []
        idx = 0

        section_splits = re.split(r"\n(?=#{1,2} )", "\n" + text)
        for sec_num, section_text in enumerate(section_splits):
            section_text = section_text.strip()
            if not section_text:
                continue

            sec_lines = section_text.split("\n", 1)
            sec_title = sec_lines[0].lstrip("# ").strip()
            sec_content = sec_lines[1] if len(sec_lines) > 1 else section_text

            sec_xml = (
                f'<hierarchy type="research_paper">'
                f'<section id="{sec_num}" title="{_xml_escape(sec_title)}">'
                f"</section></hierarchy>"
            )

            sec_tokens = count_tokens(sec_content, self.encoding_name)
            if sec_tokens <= self.max_section_tokens:
                chunks.append(
                    self._create_chunk(
                        document_id, sec_content, "section", sec_xml, idx,
                        section_title=sec_title,
                    )
                )
                idx += 1
            else:
                paragraphs = self._split_into_paragraphs(sec_content)
                for p_num, p_text in enumerate(paragraphs):
                    p_xml = (
                        f'<hierarchy type="research_paper">'
                        f'<section id="{sec_num}" title="{_xml_escape(sec_title)}">'
                        f'<paragraph id="{p_num}"></paragraph>'
                        f"</section></hierarchy>"
                    )
                    chunks.append(
                        self._create_chunk(
                            document_id, p_text, "paragraph", p_xml, idx,
                            section_title=sec_title,
                        )
                    )
                    idx += 1

        return chunks

    def _chunk_general_markdown(self, text: str, document_id: str) -> list[Chunk]:
        """General fallback: same as research paper markdown."""
        return self._chunk_paper_markdown(text, document_id)


def _xml_escape(s: str) -> str:
    """Escape XML special characters in attribute values."""
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
