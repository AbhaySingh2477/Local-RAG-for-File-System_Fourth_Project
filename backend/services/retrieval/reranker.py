"""
Reranker Service — Cross-Encoder reranking for search results.

Uses BAAI/bge-reranker-v2-m3 to rescore query-document pairs
and return the top-K most relevant results.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class Reranker:
    """
    Cross-Encoder based reranker.

    Lazy-loads the model on first call. Scores each (query, document)
    pair independently, then re-sorts by score.
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-reranker-v2-m3",
        device: str = "cpu",
    ):
        self._model_name = model_name
        self._device = device
        self._model = None

    def _ensure_model(self):
        """Lazy-load the cross-encoder model."""
        if self._model is not None:
            return

        logger.info(f"Loading reranker model: {self._model_name} on {self._device}")

        try:
            from sentence_transformers import CrossEncoder

            self._model = CrossEncoder(
                self._model_name,
                device=self._device,
            )

            logger.info(f"Reranker model loaded ✓ ({self._model_name})")
        except ImportError:
            logger.warning(
                "sentence-transformers not available for CrossEncoder. "
                "Reranking will be skipped."
            )
        except Exception as e:
            logger.error(f"Failed to load reranker model: {e}")

    def rerank(
        self,
        query: str,
        documents: list[dict[str, Any]],
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Rerank a list of search results using the cross-encoder.

        Args:
            query: The search query string.
            documents: List of result dicts, each must have a 'content' key.
            top_k: Number of top results to return after reranking.

        Returns:
            Reranked and truncated list of result dicts, with updated
            'score' and 'rerank_score' fields.
        """
        if not documents:
            return []

        if top_k <= 0:
            return []

        self._ensure_model()

        if self._model is None:
            # Model failed to load — return original results truncated
            logger.debug("Reranker not available, returning original ranking")
            return documents[:top_k]

        # Build query-document pairs for scoring
        pairs = [(query, doc["content"]) for doc in documents]

        try:
            # Score all pairs in batch
            scores = self._model.predict(
                pairs,
                batch_size=32,
                show_progress_bar=len(pairs) > 100,
            )

            # Attach scores to documents
            scored_docs = []
            for doc, score in zip(documents, scores):
                doc_copy = doc.copy()
                doc_copy["rerank_score"] = float(score)
                doc_copy["score"] = float(score)
                scored_docs.append(doc_copy)

            # Sort by rerank score (descending) and truncate
            scored_docs.sort(key=lambda x: x["rerank_score"], reverse=True)
            reranked = scored_docs[:top_k]

            logger.debug(
                f"Reranked {len(documents)} → {len(reranked)} results "
                f"(top score: {reranked[0]['rerank_score']:.4f})"
            )

            return reranked

        except Exception as e:
            logger.error(f"Reranking failed: {e}. Returning original ranking.")
            return documents[:top_k]

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def model_name(self) -> str:
        return self._model_name


# ── Singleton ─────────────────────────────────────────────────

_reranker: Reranker | None = None


def get_reranker() -> Reranker:
    """Get the reranker singleton (configured from settings)."""
    global _reranker
    if _reranker is None:
        from config.settings import get_settings
        settings = get_settings()
        _reranker = Reranker(
            model_name=settings.reranker_model,
            device=settings.reranker_device,
        )
    return _reranker
