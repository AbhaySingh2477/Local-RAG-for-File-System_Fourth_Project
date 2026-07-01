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
