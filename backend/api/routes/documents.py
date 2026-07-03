"""
Document API Routes — Upload, list, get, delete, and reprocess documents.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_db_session
from infrastructure.repositories.sqlite_document_repo import (
    SQLiteDocumentRepository,
    SQLiteChunkRepository,
)
from infrastructure.storage.file_manager import get_file_manager
from infrastructure.vector.lancedb_store import get_vector_store
from workers.task_queue import get_task_queue
from workers.document_worker import get_document_worker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


# ── Response Models ─────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: str
    notebook_id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    processing_progress: float
    chunk_count: int
    token_count: int
    language: str
    error_message: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class UploadResponse(BaseModel):
    message: str
    documents: list[DocumentResponse]


# ── Endpoints ───────────────────────────────────────────────


@router.post("", response_model=UploadResponse, status_code=202)
async def upload_documents(
    notebook_id: str = Form(...),
    files: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Upload one or more documents for processing.
    Files are validated, saved, and queued for background ingestion.
    """
    file_manager = get_file_manager()
    doc_repo = SQLiteDocumentRepository(session)
    task_queue = get_task_queue()

    # Ensure the notebook exists (auto-create if not)
    from sqlalchemy import select
    from infrastructure.database.models import NotebookModel
    existing = await session.execute(
        select(NotebookModel).where(NotebookModel.id == notebook_id)
    )
    if not existing.scalar_one_or_none():
        notebook = NotebookModel(
            id=notebook_id,
            name="Untitled notebook",
        )
        session.add(notebook)
        await session.commit()

    uploaded = []

    for upload_file in files:
        filename = upload_file.filename or "unknown"
        content = await upload_file.read()
        file_size = len(content)

        # Validate file
        validation = file_manager.validate_file(filename, file_size)
        if not validation["valid"]:
            logger.warning(f"Rejected upload: {filename} — {validation['error']}")
            continue  # Skip invalid files, don't fail the whole batch

        # Save file to disk
        save_result = await file_manager.save_upload(content=content, filename=filename, notebook_id=notebook_id)

        # Create document record
        document_id = str(uuid.uuid4())
        doc = await doc_repo.create({
            "id": document_id,
            "notebook_id": notebook_id,
            "filename": filename,
            "file_type": validation["file_type"],
            "file_size": file_size,
            "content_hash": save_result["content_hash"],
        })

        # Queue for background processing
        task_queue.enqueue(document_id)

        uploaded.append(DocumentResponse(
            id=doc["id"],
            notebook_id=doc["notebook_id"],
            filename=doc["filename"],
            file_type=doc["file_type"],
            file_size=doc["file_size"],
            status=doc["status"],
            processing_progress=doc["processing_progress"],
            chunk_count=doc.get("chunk_count", 0),
            token_count=doc.get("token_count", 0),
            language=doc.get("language", "en"),
            error_message=doc.get("error_message"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        ))

    if not uploaded:
        raise HTTPException(
            status_code=400,
            detail="No valid files were uploaded. Check file types and sizes.",
        )

    return UploadResponse(
        message=f"{len(uploaded)} document(s) queued for processing",
        documents=uploaded,
    )


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    notebook_id: str | None = None,
    session: AsyncSession = Depends(get_db_session),
):
    """List all documents, optionally filtered by notebook."""
    doc_repo = SQLiteDocumentRepository(session)

    if notebook_id:
        docs = await doc_repo.list_by_notebook(notebook_id)
    else:
        docs = await doc_repo.list_all()

    return [
        DocumentResponse(
            id=d["id"],
            notebook_id=d["notebook_id"],
            filename=d["filename"],
            file_type=d["file_type"],
            file_size=d["file_size"],
            status=d["status"],
            processing_progress=d["processing_progress"],
            chunk_count=d.get("chunk_count", 0),
            token_count=d.get("token_count", 0),
            language=d.get("language", "en"),
            error_message=d.get("error_message"),
            created_at=d.get("created_at"),
            updated_at=d.get("updated_at"),
        )
        for d in docs
    ]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    """Get details for a specific document."""
    doc_repo = SQLiteDocumentRepository(session)
    doc = await doc_repo.get_by_id(document_id)

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentResponse(
        id=doc["id"],
        notebook_id=doc["notebook_id"],
        filename=doc["filename"],
        file_type=doc["file_type"],
        file_size=doc["file_size"],
        status=doc["status"],
        processing_progress=doc["processing_progress"],
        chunk_count=doc.get("chunk_count", 0),
        token_count=doc.get("token_count", 0),
        language=doc.get("language", "en"),
        error_message=doc.get("error_message"),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    """Delete a document, its chunks, and vectors."""
    doc_repo = SQLiteDocumentRepository(session)
    chunk_repo = SQLiteChunkRepository(session)

    # Get document info first
    doc = await doc_repo.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete vectors from LanceDB
    vector_store = get_vector_store()
    table_name = f"nb_{doc['notebook_id'].replace('-', '_')}"
    try:
        await vector_store.delete_by_document(table_name, document_id)
    except Exception as e:
        logger.warning(f"Failed to delete vectors for {document_id}: {e}")

    # Delete chunks
    await chunk_repo.delete_by_document(document_id)

    # Delete document record
    await doc_repo.delete(document_id)

    # Delete uploaded file
    file_manager = get_file_manager()
    from config.settings import get_settings
    settings = get_settings()
    # Try to find and delete the file
    import glob
    pattern = str(settings.uploads_dir / "**" / f"*{doc['content_hash'][:8]}*")
    for f in glob.glob(pattern, recursive=True):
        await file_manager.delete_file(f)

    return {"message": f"Document '{doc['filename']}' deleted", "id": document_id}


@router.post("/{document_id}/reprocess")
async def reprocess_document(
    document_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    """Re-trigger ingestion for a document."""
    doc_repo = SQLiteDocumentRepository(session)
    doc = await doc_repo.get_by_id(document_id)

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete existing chunks and vectors
    chunk_repo = SQLiteChunkRepository(session)
    await chunk_repo.delete_by_document(document_id)

    vector_store = get_vector_store()
    table_name = f"nb_{doc['notebook_id'].replace('-', '_')}"
    try:
        await vector_store.delete_by_document(table_name, document_id)
    except Exception:
        pass

    # Reset status
    await doc_repo.update_status(document_id, "pending", 0.0)

    # Re-queue
    task_queue = get_task_queue()
    task_queue.enqueue(document_id)

    return {"message": "Document re-queued for processing", "id": document_id}
