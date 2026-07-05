"""
SQLite Document Repository — CRUD for documents and chunks via SQLAlchemy.
Implements DocumentRepository and ChunkRepository ABCs.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.database.models import DocumentModel, ChunkModel, NotebookModel

logger = logging.getLogger(__name__)


class SQLiteDocumentRepository:
    """Document persistence via SQLAlchemy async sessions."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, document: dict[str, Any]) -> dict[str, Any]:
        """Create a new document record."""
        doc = DocumentModel(
            id=document["id"],
            notebook_id=document["notebook_id"],
            filename=document["filename"],
            file_type=document["file_type"],
            document_category=document.get("document_category", "general"),
            file_size=document.get("file_size", 0),
            content_hash=document.get("content_hash", ""),
            status="pending",
            processing_progress=0.0,
        )
        self._session.add(doc)
        await self._session.commit()
        await self._session.refresh(doc)
        logger.info(f"Created document: {doc.id} ({doc.filename})")
        return self._doc_to_dict(doc)

    async def get_by_id(self, document_id: str) -> dict[str, Any] | None:
        """Get a document by ID."""
        result = await self._session.execute(
            select(DocumentModel).where(DocumentModel.id == document_id)
        )
        doc = result.scalar_one_or_none()
        return self._doc_to_dict(doc) if doc else None

    async def list_by_notebook(self, notebook_id: str) -> list[dict[str, Any]]:
        """List all documents in a notebook."""
        result = await self._session.execute(
            select(DocumentModel)
            .where(DocumentModel.notebook_id == notebook_id)
            .order_by(DocumentModel.created_at.desc())
        )
        docs = result.scalars().all()
        return [self._doc_to_dict(d) for d in docs]

    async def list_all(self) -> list[dict[str, Any]]:
        """List all documents."""
        result = await self._session.execute(
            select(DocumentModel).order_by(DocumentModel.created_at.desc())
        )
        docs = result.scalars().all()
        return [self._doc_to_dict(d) for d in docs]

    async def update_status(
        self,
        document_id: str,
        status: str,
        progress: float = 0.0,
        error: str = "",
    ) -> None:
        """Update document processing status."""
        values = {
            "status": status,
            "processing_progress": progress,
            "updated_at": datetime.now(timezone.utc),
        }
        if error:
            values["error_message"] = error

        await self._session.execute(
            update(DocumentModel)
            .where(DocumentModel.id == document_id)
            .values(**values)
        )
        await self._session.commit()

    async def update_content(
        self,
        document_id: str,
        raw_text: str,
        language: str,
        chunk_count: int,
        token_count: int,
        metadata: dict | None = None,
    ) -> None:
        """Update document with parsed content."""
        values: dict[str, Any] = {
            "raw_text": raw_text,
            "language": language,
            "chunk_count": chunk_count,
            "token_count": token_count,
            "updated_at": datetime.now(timezone.utc),
        }
        if metadata is not None:
            values["metadata_json"] = metadata

        await self._session.execute(
            update(DocumentModel)
            .where(DocumentModel.id == document_id)
            .values(**values)
        )
        await self._session.commit()

    async def delete(self, document_id: str) -> bool:
        """Delete a document and its chunks."""
        # Delete chunks first (cascade should handle this, but be explicit)
        await self._session.execute(
            delete(ChunkModel).where(ChunkModel.document_id == document_id)
        )

        result = await self._session.execute(
            delete(DocumentModel).where(DocumentModel.id == document_id)
        )
        await self._session.commit()

        deleted = result.rowcount > 0
        if deleted:
            logger.info(f"Deleted document: {document_id}")

            # Update notebook document count
            doc = await self.get_by_id(document_id)
            if doc:
                await self._update_notebook_count(doc["notebook_id"])

        return deleted

    async def _update_notebook_count(self, notebook_id: str) -> None:
        """Recalculate and update notebook document count."""
        result = await self._session.execute(
            select(func.count()).where(DocumentModel.notebook_id == notebook_id)
        )
        count = result.scalar() or 0
        await self._session.execute(
            update(NotebookModel)
            .where(NotebookModel.id == notebook_id)
            .values(document_count=count)
        )
        await self._session.commit()

    @staticmethod
    def _doc_to_dict(doc: DocumentModel) -> dict[str, Any]:
        """Convert ORM model to dict."""
        return {
            "id": doc.id,
            "notebook_id": doc.notebook_id,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "document_category": doc.document_category,
            "file_size": doc.file_size,
            "content_hash": doc.content_hash,
            "language": doc.language,
            "chunk_count": doc.chunk_count,
            "token_count": doc.token_count,
            "status": doc.status,
            "processing_progress": doc.processing_progress,
            "error_message": doc.error_message,
            "metadata": doc.metadata_json,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        }


class SQLiteChunkRepository:
    """Chunk persistence via SQLAlchemy async sessions."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def create_many(self, chunks: list[dict[str, Any]]) -> None:
        """Bulk-insert chunks."""
        if not chunks:
            return

        models = [
            ChunkModel(
                id=c["id"],
                document_id=c["document_id"],
                chunk_index=c["chunk_index"],
                content=c["content"],
                token_count=c.get("token_count", 0),
                start_char=c.get("start_char", 0),
                end_char=c.get("end_char", 0),
                page_number=c.get("page_number"),
                section_title=c.get("section_title", ""),
                level=c.get("level", "paragraph"),
                indexing_xml=c.get("indexing_xml", ""),
                metadata_json=c.get("metadata"),
            )
            for c in chunks
        ]

        self._session.add_all(models)
        await self._session.commit()
        logger.info(f"Stored {len(models)} chunks for document {chunks[0]['document_id']}")

    async def get_by_document(self, document_id: str) -> list[dict[str, Any]]:
        """Get all chunks for a document."""
        result = await self._session.execute(
            select(ChunkModel)
            .where(ChunkModel.document_id == document_id)
            .order_by(ChunkModel.chunk_index)
        )
        chunks = result.scalars().all()
        return [self._chunk_to_dict(c) for c in chunks]

    async def delete_by_document(self, document_id: str) -> None:
        """Delete all chunks for a document."""
        await self._session.execute(
            delete(ChunkModel).where(ChunkModel.document_id == document_id)
        )
        await self._session.commit()
        logger.info(f"Deleted chunks for document: {document_id}")

    @staticmethod
    def _chunk_to_dict(chunk: ChunkModel) -> dict[str, Any]:
        """Convert ORM model to dict."""
        return {
            "id": chunk.id,
            "document_id": chunk.document_id,
            "chunk_index": chunk.chunk_index,
            "content": chunk.content,
            "token_count": chunk.token_count,
            "start_char": chunk.start_char,
            "end_char": chunk.end_char,
            "page_number": chunk.page_number,
            "section_title": chunk.section_title,
            "level": chunk.level,
            "indexing_xml": chunk.indexing_xml,
            "metadata": chunk.metadata_json,
        }
