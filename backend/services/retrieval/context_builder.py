"""
Context Builder — Assembles optimized LLM context from ranked search results.

Responsibilities:
  - Deduplicate overlapping chunks (same document, adjacent indices)
  - Manage token budget — greedily fill up to max_context_tokens
  - Track source metadata for citation mapping
  - Return structured context with source references
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from config.settings import get_settings

logger = logging.getLogger(__name__)


@dataclass
class ContextSource:
    """A source document reference for citation tracking."""
    index: int
    chunk_id: str
    document_id: str
    document_name: str
    content: str
    page_number: int | None = None
    section_title: str = ""
    score: float = 0.0
    token_count: int = 0


@dataclass
class BuiltContext:
    """The assembled context ready for prompt building."""
    sources: list[ContextSource] = field(default_factory=list)
    total_tokens: int = 0
    chunks_used: int = 0
    chunks_available: int = 0

    def to_chunk_dicts(self) -> list[dict[str, Any]]:
        """Convert sources to chunk dicts for prompt building."""
        return [
            {
                "id": src.chunk_id,
                "document_id": src.document_id,
                "document_name": src.document_name,
                "content": src.content,
                "page_number": src.page_number,
                "section_title": src.section_title,
                "score": src.score,
                "citation_index": src.index,
            }
            for src in self.sources
        ]


def _approx_tokens(text: str) -> int:
    """Approximate token count (~4 chars per token for English)."""
    return max(1, len(text) // 4)


class ContextBuilder:
    """
    Builds optimized context from search results for the LLM.

    Handles:
      - Deduplication of overlapping chunks
      - Greedy token-budget filling
      - Source metadata tracking for citations
    """

    def __init__(self, max_context_tokens: int | None = None):
        settings = get_settings()
        self._max_tokens = max_context_tokens or settings.max_context_tokens

    def build(
        self,
        search_results: list[Any],
        max_sources: int = 10,
        pinned_results: list[dict] | None = None,
    ) -> BuiltContext:
        """
        Build context from search results.

        Args:
            search_results: List of SearchResult entities or dicts from retrieval.
            max_sources: Maximum number of sources to include.
            pinned_results: User-pinned chunks that are always included first,
                            bypassing deduplication (user explicitly selected them).

        Returns:
            BuiltContext with deduplicated, budget-fitted sources.
        """
        pinned = self._normalize_results(pinned_results or [])
        regular = self._normalize_results(search_results)

        # Tag pinned results so they skip dedup check
        for p in pinned:
            p["_pinned"] = True

        # Deduplicate only the regular results (against each other + pinned)
        pinned_contents = [p["content"] for p in pinned]
        deduped_regular = self._deduplicate_against(regular, pinned_contents)

        # Merge: pinned first, then regular
        merged = pinned + deduped_regular

        # Greedily fill token budget
        context = self._fill_budget(merged, max_sources)

        logger.info(
            f"Context built: {context.chunks_used}/{context.chunks_available} chunks, "
            f"~{context.total_tokens} tokens "
            f"({len(pinned)} pinned)"
        )

        return context

    def _normalize_results(self, results: list[Any]) -> list[dict[str, Any]]:
        """Normalize SearchResult entities or raw dicts to a consistent format."""
        normalized = []
        for r in results:
            if hasattr(r, "chunk_id"):
                # It's a SearchResult dataclass
                normalized.append({
                    "id": r.chunk_id,
                    "document_id": r.document_id,
                    "document_name": r.document_name,
                    "content": r.content,
                    "score": r.score,
                    "page_number": r.page_number,
                    "section_title": r.section_title,
                })
            elif isinstance(r, dict):
                normalized.append({
                    "id": r.get("chunk_id", r.get("id", "")),
                    "document_id": r.get("document_id", ""),
                    "document_name": r.get("document_name", ""),
                    "content": r.get("content", ""),
                    "score": float(r.get("score", 0.0)),
                    "page_number": r.get("page_number"),
                    "section_title": r.get("section_title", ""),
                })
        return normalized

    def _deduplicate(self, results: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Remove duplicate or heavily overlapping chunks.

        Two chunks are considered duplicates if:
          - Same document_id AND content overlap > 70%
        """
        seen = []
        deduped = []

        for result in results:
            content = result.get("content", "")
            doc_id = result.get("document_id", "")
            is_dup = False

            for seen_item in seen:
                if seen_item["document_id"] != doc_id:
                    continue

                # Check content overlap
                overlap = self._content_overlap(content, seen_item["content"])
                if overlap > 0.7:
                    is_dup = True
                    break

            if not is_dup:
                deduped.append(result)
                seen.append(result)

        if len(deduped) < len(results):
            logger.debug(
                f"Deduplicated: {len(results)} → {len(deduped)} chunks"
            )

        return deduped

    def _deduplicate_against(
        self,
        results: list[dict[str, Any]],
        already_included_contents: list[str],
    ) -> list[dict[str, Any]]:
        """
        Deduplicate results against a list of content strings that are
        already included (e.g., pinned chunks), then dedup within results.
        """
        filtered = []
        for result in results:
            content = result.get("content", "")
            # Check against pinned content
            already_dup = any(
                self._content_overlap(content, existing) > 0.7
                for existing in already_included_contents
            )
            if not already_dup:
                filtered.append(result)

        # Now dedup within filtered
        return self._deduplicate(filtered)

    def _content_overlap(self, text_a: str, text_b: str) -> float:
        """Calculate approximate content overlap ratio using word sets."""
        if not text_a or not text_b:
            return 0.0

        words_a = set(text_a.lower().split())
        words_b = set(text_b.lower().split())

        if not words_a or not words_b:
            return 0.0

        intersection = words_a & words_b
        smaller = min(len(words_a), len(words_b))

        return len(intersection) / smaller if smaller > 0 else 0.0

    def _fill_budget(
        self,
        results: list[dict[str, Any]],
        max_sources: int,
    ) -> BuiltContext:
        """Greedily fill the token budget with the highest-scored chunks."""
        sources = []
        total_tokens = 0
        index = 1

        for result in results:
            if len(sources) >= max_sources:
                break

            content = result.get("content", "")
            chunk_tokens = _approx_tokens(content)

            # Check if adding this chunk exceeds budget
            if total_tokens + chunk_tokens > self._max_tokens:
                # Try to fit a truncated version
                remaining = self._max_tokens - total_tokens
                if remaining > 100:  # Only include if we can fit meaningful content
                    # Truncate to fit
                    char_limit = remaining * 4
                    truncated = content[:char_limit].rsplit(" ", 1)[0] + "…"
                    chunk_tokens = _approx_tokens(truncated)
                    content = truncated
                else:
                    continue

            source = ContextSource(
                index=index,
                chunk_id=result.get("id", ""),
                document_id=result.get("document_id", ""),
                document_name=result.get("document_name", ""),
                content=content,
                page_number=result.get("page_number"),
                section_title=result.get("section_title", ""),
                score=float(result.get("score", 0.0)),
                token_count=chunk_tokens,
            )

            sources.append(source)
            total_tokens += chunk_tokens
            index += 1

        return BuiltContext(
            sources=sources,
            total_tokens=total_tokens,
            chunks_used=len(sources),
            chunks_available=len(results),
        )


# ── Singleton ─────────────────────────────────────────────────

_context_builder: ContextBuilder | None = None


def get_context_builder() -> ContextBuilder:
    """Get the context builder singleton."""
    global _context_builder
    if _context_builder is None:
        _context_builder = ContextBuilder()
    return _context_builder
