"""
Model Registry — Available embedding models and their specifications.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class EmbeddingModelSpec:
    """Specification for an embedding model."""
    name: str
    dimension: int
    max_tokens: int
    description: str
    size_mb: int  # Approximate download size


# Available embedding models
MODELS: dict[str, EmbeddingModelSpec] = {
    "BAAI/bge-small-en-v1.5": EmbeddingModelSpec(
        name="BAAI/bge-small-en-v1.5",
        dimension=384,
        max_tokens=512,
        description="Fast, compact English embedding model (33M params)",
        size_mb=130,
    ),
    "BAAI/bge-base-en-v1.5": EmbeddingModelSpec(
        name="BAAI/bge-base-en-v1.5",
        dimension=768,
        max_tokens=512,
        description="Balanced English embedding model (110M params)",
        size_mb=440,
    ),
    "BAAI/bge-large-en-v1.5": EmbeddingModelSpec(
        name="BAAI/bge-large-en-v1.5",
        dimension=1024,
        max_tokens=512,
        description="High-quality English embedding model (335M params)",
        size_mb=1340,
    ),
    "sentence-transformers/all-MiniLM-L6-v2": EmbeddingModelSpec(
        name="sentence-transformers/all-MiniLM-L6-v2",
        dimension=384,
        max_tokens=256,
        description="Lightweight general-purpose embedding model (22M params)",
        size_mb=90,
    ),
}

DEFAULT_MODEL = "BAAI/bge-small-en-v1.5"


def get_model_spec(model_name: str) -> EmbeddingModelSpec | None:
    """Get the specification for an embedding model."""
    return MODELS.get(model_name)


def list_models() -> list[EmbeddingModelSpec]:
    """List all available embedding models."""
    return list(MODELS.values())
