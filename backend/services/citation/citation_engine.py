"""
Citation Engine — Extracts and formats citations from LLM responses.

Responsibilities:
  - Parse citation markers [1], [2], etc. from response text
  - Map markers back to source chunks
  - Generate Citation domain entities
  - Handle edge cases (missing citations, duplicate markers)
"""

from __future__ import annotations

import logging
import re
from typing import Any

from domain.entities import Citation

logger = logging.getLogger(__name__)

# Regex to find citation markers like [1], [2], [1, 2], [1][2]
CITATION_PATTERN = re.compile(r'\[(\d+)\]')


class CitationEngine:
    """
    Extracts citations from LLM output and maps them to source chunks.

    The LLM is instructed to use [1], [2], etc. markers in its response.
    This engine parses those markers and creates structured Citation entities.
    """

    def extract_citations(
        self,
        response_text: str,
        source_chunks: list[dict[str, Any]],
        message_id: str = "",
    ) -> list[Citation]:
        """
        Extract citations from an LLM response.

        Args:
            response_text: The full LLM response text.
            source_chunks: List of source chunk dicts with 'citation_index' keys.
            message_id: The message ID to associate citations with.

        Returns:
            List of Citation entities, one per unique citation reference.
        """
        if not response_text or not source_chunks:
            return []

        # Build index → chunk mapping
        chunk_map = {}
        for chunk in source_chunks:
            idx = chunk.get("citation_index", 0)
            if idx > 0:
                chunk_map[idx] = chunk

        # Find all citation markers in the response
        found_indices = set()
        for match in CITATION_PATTERN.finditer(response_text):
            try:
                idx = int(match.group(1))
                if idx in chunk_map:
                    found_indices.add(idx)
            except (ValueError, IndexError):
                continue

        if not found_indices:
            logger.debug("No citation markers found in response")
            # If no explicit citations, create citations for the top sources
            # that were provided (the LLM used the info but didn't cite)
            return self._create_implicit_citations(
                source_chunks, message_id, max_citations=3
            )

        # Create Citation entities for each found marker
        citations = []
        for idx in sorted(found_indices):
            chunk = chunk_map[idx]
            excerpt = self._extract_excerpt(chunk.get("content", ""), max_len=200)

            citation = Citation(
                message_id=message_id,
                chunk_id=chunk.get("id", ""),
                document_id=chunk.get("document_id", ""),
                document_name=chunk.get("document_name", ""),
                page_number=chunk.get("page_number"),
                excerpt=excerpt,
                relevance_score=float(chunk.get("score", 0.0)),
                citation_index=idx,
            )
            citations.append(citation)

        logger.debug(
            f"Extracted {len(citations)} citations from response "
            f"({len(found_indices)} unique markers)"
        )

        return citations

    def _create_implicit_citations(
        self,
        source_chunks: list[dict[str, Any]],
        message_id: str,
        max_citations: int = 3,
    ) -> list[Citation]:
        """
        Create implicit citations when the LLM doesn't use explicit markers.
        Uses the top-scored source chunks as implicit references.
        """
        citations = []
        for i, chunk in enumerate(source_chunks[:max_citations]):
            idx = chunk.get("citation_index", i + 1)
            excerpt = self._extract_excerpt(chunk.get("content", ""), max_len=200)

            citation = Citation(
                message_id=message_id,
                chunk_id=chunk.get("id", ""),
                document_id=chunk.get("document_id", ""),
                document_name=chunk.get("document_name", ""),
                page_number=chunk.get("page_number"),
                excerpt=excerpt,
                relevance_score=float(chunk.get("score", 0.0)),
                citation_index=idx,
            )
            citations.append(citation)

        return citations

    def _extract_excerpt(self, content: str, max_len: int = 200) -> str:
        """Extract a meaningful excerpt from chunk content."""
        if not content:
            return ""

        # Take the first `max_len` characters, breaking at a word boundary
        if len(content) <= max_len:
            return content.strip()

        excerpt = content[:max_len]
        # Try to break at a sentence boundary
        for sep in (". ", "! ", "? ", "\n"):
            last = excerpt.rfind(sep)
            if last > max_len * 0.5:
                return excerpt[: last + 1].strip()

        # Fall back to word boundary
        last_space = excerpt.rfind(" ")
        if last_space > max_len * 0.5:
            return excerpt[:last_space].strip() + "…"

        return excerpt.strip() + "…"

    def format_citation_for_display(self, citation: Citation) -> dict[str, Any]:
        """
        Format a Citation entity for API response / frontend display.
        """
        return {
            "id": citation.id,
            "index": citation.citation_index,
            "document_id": citation.document_id,
            "document_name": citation.document_name,
            "page_number": citation.page_number,
            "excerpt": citation.excerpt,
            "relevance_score": citation.relevance_score,
        }


# ── Singleton ─────────────────────────────────────────────────

_citation_engine: CitationEngine | None = None


def get_citation_engine() -> CitationEngine:
    """Get the citation engine singleton."""
    global _citation_engine
    if _citation_engine is None:
        _citation_engine = CitationEngine()
    return _citation_engine
