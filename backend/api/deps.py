"""
API Dependencies — FastAPI dependency injection.
"""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.database.connection import get_session
from infrastructure.vector.lancedb_store import get_vector_store, LanceDBStore
from config.settings import get_settings, Settings


async def get_db_session() -> AsyncSession:
    """Dependency — yields an async database session."""
    async for session in get_session():
        yield session


def get_store() -> LanceDBStore:
    """Dependency — returns the LanceDB vector store singleton."""
    return get_vector_store()


def get_app_settings() -> Settings:
    """Dependency — returns the application settings."""
    return get_settings()


# ── Phase 2 Dependencies ──────────────────────────────────────

def get_doc_repo(session: AsyncSession = Depends(get_db_session)):
    """Dependency — returns a document repository."""
    from infrastructure.repositories.sqlite_document_repo import SQLiteDocumentRepository
    return SQLiteDocumentRepository(session)


def get_chunk_repo(session: AsyncSession = Depends(get_db_session)):
    """Dependency — returns a chunk repository."""
    from infrastructure.repositories.sqlite_document_repo import SQLiteChunkRepository
    return SQLiteChunkRepository(session)


def get_embedding():
    """Dependency — returns the embedding service singleton."""
    from services.embedding.embedding_service import get_embedding_service
    return get_embedding_service()


def get_files():
    """Dependency — returns the file manager singleton."""
    from infrastructure.storage.file_manager import get_file_manager
    return get_file_manager()


def get_worker():
    """Dependency — returns the document worker singleton."""
    from workers.document_worker import get_document_worker
    return get_document_worker()


# ── Phase 3 Dependencies ──────────────────────────────────────

def get_retrieval():
    """Dependency — returns the retrieval engine singleton."""
    from services.retrieval.retrieval_engine import get_retrieval_engine
    return get_retrieval_engine()


def get_reranker_service():
    """Dependency — returns the reranker singleton."""
    from services.retrieval.reranker import get_reranker
    return get_reranker()

