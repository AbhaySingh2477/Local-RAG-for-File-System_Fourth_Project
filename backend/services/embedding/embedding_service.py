"""
Embedding Service — Generate text embeddings using Sentence Transformers.
Wraps the model with batch encoding, lazy loading, and device selection.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class SentenceEmbeddingService:
    """
    Embedding service using Sentence Transformers.
    Implements the EmbeddingService interface from domain/interfaces.py.
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-small-en-v1.5",
        device: str = "cpu",
        batch_size: int = 32,
    ):
        self._model_name = model_name
        self._device = device
        self._batch_size = batch_size
        self._model = None
        self._dimension: int | None = None

    def _ensure_model(self):
        """Lazy-load the embedding model."""
        if self._model is not None:
            return

        logger.info(f"Loading embedding model: {self._model_name} on {self._device}")

        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(self._model_name, device=self._device)
        self._dimension = self._model.get_sentence_embedding_dimension()

        logger.info(
            f"Embedding model loaded ✓ (dim={self._dimension}, device={self._device})"
        )

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a list of texts.

        Args:
            texts: List of text strings to embed.

        Returns:
            List of embedding vectors (each a list of floats).
        """
        if not texts:
            return []

        self._ensure_model()

        # BGE models benefit from a query prefix for retrieval
        # But for document embedding, no prefix is needed
        embeddings = self._model.encode(
            texts,
            batch_size=self._batch_size,
            show_progress_bar=len(texts) > 100,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        return embeddings.tolist()

    def embed_query(self, query: str) -> list[float]:
        """
        Generate embedding for a search query.
        Adds instruction prefix for BGE models.

        Args:
            query: Search query string.

        Returns:
            Embedding vector as list of floats.
        """
        self._ensure_model()

        # BGE models use "Represent this sentence:" prefix for queries
        prefixed = query
        if "bge" in self._model_name.lower():
            prefixed = f"Represent this sentence: {query}"

        embedding = self._model.encode(
            [prefixed],
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        return embedding[0].tolist()

    def get_dimension(self) -> int:
        """Get the embedding dimension."""
        self._ensure_model()
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def is_loaded(self) -> bool:
        return self._model is not None


# Singleton
_embedding_service: SentenceEmbeddingService | None = None


def get_embedding_service() -> SentenceEmbeddingService:
    """Get the embedding service singleton (configured from settings)."""
    global _embedding_service
    if _embedding_service is None:
        from config.settings import get_settings
        settings = get_settings()
        _embedding_service = SentenceEmbeddingService(
            model_name=settings.embedding_model,
            device=settings.embedding_device,
            batch_size=settings.embedding_batch_size,
        )
    return _embedding_service
