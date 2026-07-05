"""
Document Worker — Background async worker for document processing.
Pulls tasks from the queue, runs the ingestion pipeline,
and broadcasts progress updates via WebSocket.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Set

from fastapi import WebSocket

from workers.task_queue import get_task_queue, TaskStatus
from application.ingest_document import get_ingestion_pipeline
from infrastructure.database.connection import get_session_factory
from infrastructure.repositories.sqlite_document_repo import (
    SQLiteDocumentRepository,
    SQLiteChunkRepository,
)

logger = logging.getLogger(__name__)


class DocumentWorker:
    """
    Background worker that processes document ingestion tasks.
    Sends real-time progress updates to connected WebSocket clients.
    """

    def __init__(self):
        self._running = False
        self._task: asyncio.Task | None = None
        self._connections: Set[WebSocket] = set()

    async def start(self) -> None:
        """Start the background worker loop."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._worker_loop())
        logger.info("Document worker started ✓")

    async def stop(self) -> None:
        """Stop the background worker."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Document worker stopped")

    def add_connection(self, ws: WebSocket) -> None:
        """Register a WebSocket connection for progress updates."""
        self._connections.add(ws)

    def remove_connection(self, ws: WebSocket) -> None:
        """Remove a WebSocket connection."""
        self._connections.discard(ws)

    async def _worker_loop(self) -> None:
        """Main worker loop — pulls and processes tasks."""
        task_queue = get_task_queue()
        pipeline = get_ingestion_pipeline()

        while self._running:
            try:
                # Wait for next task (blocks until available)
                task = await asyncio.wait_for(task_queue.dequeue(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Worker queue error: {e}")
                await asyncio.sleep(1)
                continue

            logger.info(f"Processing document: {task.document_id}")

            # Get a fresh DB session for this task
            session_factory = get_session_factory()
            async with session_factory() as session:
                doc_repo = SQLiteDocumentRepository(session)
                chunk_repo = SQLiteChunkRepository(session)

                try:
                    # Get document details
                    doc = await doc_repo.get_by_id(task.document_id)
                    if not doc:
                        logger.error(f"Document {task.document_id} not found")
                        task_queue.fail(task.id, "Document not found")
                        continue

                    # Update status to processing
                    await doc_repo.update_status(task.document_id, "processing", 0.0)
                    await self._broadcast_progress(task.document_id, "processing", 0.0)

                    # Define progress callback
                    async def on_progress(stage: str, progress: float):
                        task_queue.update_progress(task.id, stage, progress)
                        await doc_repo.update_status(
                            task.document_id, "processing", progress
                        )
                        await self._broadcast_progress(
                            task.document_id, stage, progress
                        )

                    # Determine file path from uploads
                    from config.settings import get_settings
                    settings = get_settings()
                    # Try notebook-specific path first, then generic
                    file_path = settings.uploads_dir / doc["notebook_id"] / f"{doc['filename'].rsplit('.', 1)[0]}_{doc['content_hash'][:8]}.{doc['file_type']}"
                    if not file_path.exists():
                        # Try finding by glob pattern
                        pattern = f"*{doc['content_hash'][:8]}*"
                        matches = list((settings.uploads_dir / doc["notebook_id"]).glob(pattern))
                        if not matches:
                            matches = list(settings.uploads_dir.glob(f"**/{pattern}"))
                        if matches:
                            file_path = matches[0]
                        else:
                            raise FileNotFoundError(
                                f"Upload file not found for document {task.document_id}"
                            )

                    result = await pipeline.ingest(
                        document_id=task.document_id,
                        file_path=str(file_path),
                        file_type=doc["file_type"],
                        document_category=doc.get("document_category", "general"),
                        notebook_id=doc["notebook_id"],
                        on_progress=on_progress,
                    )

                    # Store chunks in SQLite
                    await chunk_repo.create_many(result["chunks"])

                    # Update document with results
                    await doc_repo.update_content(
                        document_id=task.document_id,
                        raw_text="",  # Don't store full raw text to save space
                        language=result["language"],
                        chunk_count=result["chunk_count"],
                        token_count=result["token_count"],
                        metadata=result["metadata"],
                    )

                    # Mark as indexed
                    await doc_repo.update_status(task.document_id, "indexed", 1.0)
                    task_queue.complete(task.id)

                    await self._broadcast_progress(
                        task.document_id, "indexed", 1.0
                    )
                    logger.info(
                        f"Document {task.document_id} indexed ✓ "
                        f"({result['chunk_count']} chunks, {result['token_count']} tokens)"
                    )

                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Document {task.document_id} failed: {error_msg}")

                    await doc_repo.update_status(
                        task.document_id, "failed", 0.0, error_msg
                    )
                    task_queue.fail(task.id, error_msg)

                    await self._broadcast_progress(
                        task.document_id, "failed", 0.0, error=error_msg
                    )

    async def _broadcast_progress(
        self,
        document_id: str,
        stage: str,
        progress: float,
        error: str = "",
    ) -> None:
        """Send progress update to all connected WebSocket clients."""
        message = json.dumps({
            "type": "document_progress",
            "document_id": document_id,
            "stage": stage,
            "progress": progress,
            "error": error,
        })

        dead_connections = set()
        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead_connections.add(ws)

        # Clean up dead connections
        self._connections -= dead_connections


# Singleton
_worker: DocumentWorker | None = None


def get_document_worker() -> DocumentWorker:
    """Get the document worker singleton."""
    global _worker
    if _worker is None:
        _worker = DocumentWorker()
    return _worker
