"""
Domain Interfaces — Abstract Base Classes for repositories and services.
Infrastructure layer implements these. Application layer depends on these.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class NotebookRepository(ABC):
    """Interface for notebook persistence."""

    @abstractmethod
    async def create(self, notebook: Any) -> Any: ...

    @abstractmethod
    async def get_by_id(self, notebook_id: str) -> Any | None: ...

    @abstractmethod
    async def list_all(self) -> list[Any]: ...

    @abstractmethod
    async def update(self, notebook: Any) -> Any: ...

    @abstractmethod
    async def delete(self, notebook_id: str) -> bool: ...


class DocumentRepository(ABC):
    """Interface for document persistence."""

    @abstractmethod
    async def create(self, document: Any) -> Any: ...

    @abstractmethod
    async def get_by_id(self, document_id: str) -> Any | None: ...

    @abstractmethod
    async def list_by_notebook(self, notebook_id: str) -> list[Any]: ...

    @abstractmethod
    async def update(self, document: Any) -> Any: ...

    @abstractmethod
    async def update_status(self, document_id: str, status: str, progress: float = 0.0, error: str = "") -> None: ...

    @abstractmethod
    async def delete(self, document_id: str) -> bool: ...


class ChunkRepository(ABC):
    """Interface for chunk persistence."""

    @abstractmethod
    async def create_many(self, chunks: list[Any]) -> None: ...

    @abstractmethod
    async def get_by_document(self, document_id: str) -> list[Any]: ...

    @abstractmethod
    async def delete_by_document(self, document_id: str) -> None: ...


class ChatRepository(ABC):
    """Interface for chat session and message persistence."""

    @abstractmethod
    async def create_session(self, session: Any) -> Any: ...

    @abstractmethod
    async def get_session(self, session_id: str) -> Any | None: ...

    @abstractmethod
    async def list_sessions(self, notebook_id: str | None = None) -> list[Any]: ...

    @abstractmethod
    async def delete_session(self, session_id: str) -> bool: ...

    @abstractmethod
    async def add_message(self, message: Any) -> Any: ...

    @abstractmethod
    async def get_messages(self, session_id: str, limit: int = 50) -> list[Any]: ...


class VectorStore(ABC):
    """Interface for vector storage and search."""

    @abstractmethod
    async def add_vectors(self, table_name: str, records: list[dict[str, Any]]) -> None: ...

    @abstractmethod
    async def search_vectors(self, table_name: str, query_vector: list[float], top_k: int = 10, filters: dict | None = None) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def search_fts(self, table_name: str, query_text: str, top_k: int = 10) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def hybrid_search(self, table_name: str, query_vector: list[float], query_text: str, top_k: int = 10) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def delete_by_document(self, table_name: str, document_id: str) -> None: ...


class EmbeddingService(ABC):
    """Interface for text embedding generation."""

    @abstractmethod
    def embed_texts(self, texts: list[str]) -> list[list[float]]: ...

    @abstractmethod
    def embed_query(self, query: str) -> list[float]: ...

    @abstractmethod
    def get_dimension(self) -> int: ...


class LLMService(ABC):
    """Interface for LLM inference."""

    @abstractmethod
    async def chat(self, messages: list[dict], model: str | None = None, **kwargs) -> str: ...

    @abstractmethod
    async def chat_stream(self, messages: list[dict], model: str | None = None, **kwargs) -> Any: ...

    @abstractmethod
    async def list_models(self) -> list[dict]: ...

    @abstractmethod
    async def is_available(self) -> bool: ...


class ParserService(ABC):
    """Interface for document text extraction."""

    @abstractmethod
    def can_parse(self, file_type: str) -> bool: ...

    @abstractmethod
    async def parse(self, file_path: str) -> dict[str, Any]: ...
