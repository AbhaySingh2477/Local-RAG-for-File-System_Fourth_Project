"""
Hybrid Search — Orchestrates vector + BM25 + RRF merge for hybrid retrieval.

Sits on top of LanceDBStore and provides a clean search interface
that the RetrievalEngine calls into.
"""

from __future__ import annotations

import logging
from typing import Any

from infrastructure.vector.lancedb_store import LanceDBStore, get_vector_store
from config.settings import get_settings

logger = logging.getLogger(__name__)

# ── Reciprocal Rank Fusion constant ────────────────────────────
RRF_K = 60


def reciprocal_rank_fusion(
    *result_lists: list[dict[str, Any]],
    k: int = RRF_K,
) -> list[dict[str, Any]]:
    """
    Merge multiple ranked result lists using Reciprocal Rank Fusion.

    RRF score = Σ 1 / (k + rank_i) for each result list where the doc appears.
    This is robust to score scale differences between vector and BM25 search.

    Args:
        *result_lists: Variable number of ranked result lists.
        k: RRF constant (default 60, per the original paper).

    Returns:
        Merged and sorted list of results with RRF scores.
    """
    scores: dict[str, float] = {}
    docs: dict[str, dict[str, Any]] = {}

    for result_list in result_lists:
        for rank, doc in enumerate(result_list, start=1):
            doc_id = doc["id"]
            scores[doc_id] = scores.get(doc_id, 0.0) + (1.0 / (k + rank))
            # Keep the richest version of the doc metadata
            if doc_id not in docs or doc.get("score", 0) > docs[doc_id].get("score", 0):
                docs[doc_id] = doc

    # Sort by RRF score descending
    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)

    merged = []
    for doc_id in sorted_ids:
        doc = docs[doc_id].copy()
        doc["rrf_score"] = scores[doc_id]
        doc["score"] = scores[doc_id]  # Use RRF score as the primary score
        merged.append(doc)

    return merged


class HybridSearchEngine:
    """
    Orchestrates hybrid search across vector and full-text indexes.

    Supports three modes:
        - 'vector': Pure semantic vector search
        - 'keyword': Pure full-text BM25 search
        - 'hybrid': Vector + BM25 merged with RRF
    """

    def __init__(self, store: LanceDBStore | None = None):
        self._store = store or get_vector_store()
        self._settings = get_settings()

    async def search(
        self,
        query_text: str,
        query_vector: list[float],
        table_name: str,
        mode: str = "hybrid",
        top_k: int = 50,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Execute a search query in the specified mode.

        Args:
            query_text: Raw query string (for BM25 / highlights).
            query_vector: Pre-computed embedding vector for the query.
            table_name: LanceDB table to search (typically notebook_id).
            mode: One of 'vector', 'keyword', 'hybrid'.
            top_k: Number of results to retrieve per search method.
            filters: Optional filters (e.g. {'document_id': '...'}).

        Returns:
            Ranked list of result dicts with id, document_id, content,
            score, chunk_index, page_number, section_title.
        """
        mode = mode.lower()

        if mode == "vector":
            return await self._vector_search(query_vector, table_name, top_k, filters)
        elif mode == "keyword":
            return await self._keyword_search(query_text, table_name, top_k)
        elif mode == "hybrid":
            return await self._hybrid_search(query_text, query_vector, table_name, top_k, filters)
        else:
            logger.warning(f"Unknown search mode '{mode}', falling back to hybrid")
            return await self._hybrid_search(query_text, query_vector, table_name, top_k, filters)

    async def _vector_search(
        self,
        query_vector: list[float],
        table_name: str,
        top_k: int,
        filters: dict | None = None,
    ) -> list[dict[str, Any]]:
        """Pure semantic vector search."""
        results = await self._store.search_vectors(
            table_name=table_name,
            query_vector=query_vector,
            top_k=top_k,
            filters=filters,
        )
        logger.debug(f"Vector search returned {len(results)} results")
        return results

    async def _keyword_search(
        self,
        query_text: str,
        table_name: str,
        top_k: int,
    ) -> list[dict[str, Any]]:
        """Pure full-text BM25 search."""
        results = await self._store.search_fts(
            table_name=table_name,
            query_text=query_text,
            top_k=top_k,
        )
        logger.debug(f"Keyword search returned {len(results)} results")
        return results

    async def _hybrid_search(
        self,
        query_text: str,
        query_vector: list[float],
        table_name: str,
        top_k: int,
        filters: dict | None = None,
    ) -> list[dict[str, Any]]:
        """
        Hybrid search: vector + keyword merged with RRF.

        First tries LanceDB's native hybrid search. If that fails
        (e.g. no FTS index yet), falls back to manual RRF merge of
        separate vector and keyword searches.
        """
        # Try native hybrid first (faster, single pass)
        try:
            results = await self._store.hybrid_search(
                table_name=table_name,
                query_vector=query_vector,
                query_text=query_text,
                top_k=top_k,
            )
            if results:
                logger.debug(f"Native hybrid search returned {len(results)} results")
                return results
        except Exception as e:
            logger.debug(f"Native hybrid not available, using manual RRF: {e}")

        # Fallback: manual RRF merge
        vector_results = await self._vector_search(query_vector, table_name, top_k, filters)
        keyword_results = await self._keyword_search(query_text, table_name, top_k)

        merged = reciprocal_rank_fusion(vector_results, keyword_results)
        logger.debug(
            f"Manual hybrid: {len(vector_results)} vector + {len(keyword_results)} keyword "
            f"→ {len(merged)} merged"
        )

        return merged


# ── Singleton ─────────────────────────────────────────────────

_engine: HybridSearchEngine | None = None


def get_hybrid_search_engine() -> HybridSearchEngine:
    """Get the hybrid search engine singleton."""
    global _engine
    if _engine is None:
        _engine = HybridSearchEngine()
    return _engine
