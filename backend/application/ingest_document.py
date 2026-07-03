"""
Ingest Document — Full document ingestion pipeline use case.
Pipeline: validate → save → create record → parse → detect language →
          chunk → embed → store vectors → update record → report progress.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Callable

from services.parsing.parser_factory import parse_document
from services.chunking.chunker import get_chunker
from services.chunking.token_counter import count_tokens
from services.embedding.embedding_service import get_embedding_service
from infrastructure.vector.lancedb_store import get_vector_store

logger = logging.getLogger(__name__)


class DocumentIngestionPipeline:
    """
    Orchestrates the full document ingestion pipeline.
    Designed to be called from the background worker.
    """

    def __init__(self):
        self._chunker = get_chunker()
        self._embedding_service = get_embedding_service()
        self._vector_store = get_vector_store()

    async def ingest(
        self,
        document_id: str,
        file_path: str,
        file_type: str,
        notebook_id: str,
        on_progress: Callable[[str, float], Any] | None = None,
    ) -> dict[str, Any]:
        """
        Run the full ingestion pipeline for a document.

        Args:
            document_id: UUID of the document record
            file_path: Path to the uploaded file
            file_type: File extension (e.g., 'pdf', 'docx')
            notebook_id: Parent notebook ID
            on_progress: Optional callback (stage: str, progress: float) → Any

        Returns:
            dict with summary: chunk_count, token_count, language, etc.

        Raises:
            Exception on any pipeline failure
        """
        async def report(stage: str, progress: float):
            if on_progress:
                await on_progress(stage, progress)

        try:
            # ── Step 1: Parse document ──────────────────────────
            await report("parsing", 0.1)
            logger.info(f"[{document_id}] Step 1: Parsing document...")

            parse_result = await parse_document(file_path, file_type)
            raw_text = parse_result.get("text", "")
            metadata = parse_result.get("metadata", {})
            pages = parse_result.get("pages", [])
            sections = parse_result.get("sections", [])

            if not raw_text.strip():
                raise ValueError("Document parsing produced no text content")

            await report("parsing", 0.25)

            # ── Step 2: Detect language ─────────────────────────
            logger.info(f"[{document_id}] Step 2: Detecting language...")
            language = "en"
            try:
                from langdetect import detect
                # Use first 1000 chars for language detection
                sample = raw_text[:1000]
                language = detect(sample)
            except Exception:
                language = "en"

            await report("analyzing", 0.3)

            # ── Step 3: Count total tokens ──────────────────────
            total_tokens = count_tokens(raw_text)
            logger.info(f"[{document_id}] Total tokens: {total_tokens}")

            await report("chunking", 0.35)

            # ── Step 4: Chunk text ──────────────────────────────
            logger.info(f"[{document_id}] Step 4: Chunking text...")

            chunk_results = self._chunker.chunk_text(
                text=raw_text,
                document_id=document_id,
                pages=pages,
                sections=sections,
            )

            chunk_count = len(chunk_results)
            logger.info(f"[{document_id}] Created {chunk_count} chunks")

            await report("chunking", 0.5)

            # ── Step 5: Generate embeddings ─────────────────────
            logger.info(f"[{document_id}] Step 5: Generating embeddings...")

            chunk_texts = [c.content for c in chunk_results]

            # Process in batches for progress reporting
            batch_size = 32
            all_embeddings = []
            for i in range(0, len(chunk_texts), batch_size):
                batch = chunk_texts[i: i + batch_size]
                batch_embeddings = self._embedding_service.embed_texts(batch)
                all_embeddings.extend(batch_embeddings)

                progress = 0.5 + (0.3 * (i + len(batch)) / len(chunk_texts))
                await report("embedding", progress)

            logger.info(f"[{document_id}] Generated {len(all_embeddings)} embeddings")

            # ── Step 6: Store vectors in LanceDB ────────────────
            logger.info(f"[{document_id}] Step 6: Storing vectors...")
            await report("indexing", 0.85)

            # Prepare records for LanceDB
            vector_records = []
            for chunk, embedding in zip(chunk_results, all_embeddings):
                vector_records.append({
                    "id": chunk.id,
                    "document_id": document_id,
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "token_count": chunk.token_count,
                    "page_number": chunk.page_number or 0,
                    "section_title": chunk.section_title,
                    "vector": embedding,
                })

            # Use notebook_id as the table name for isolation
            table_name = f"nb_{notebook_id.replace('-', '_')}"
            await self._vector_store.add_vectors(table_name, vector_records)

            await report("indexing", 0.95)

            # ── Step 7: Prepare chunk dicts for SQLite ──────────
            chunk_dicts = [
                {
                    "id": c.id,
                    "document_id": document_id,
                    "chunk_index": c.chunk_index,
                    "content": c.content,
                    "token_count": c.token_count,
                    "start_char": c.start_char,
                    "end_char": c.end_char,
                    "page_number": c.page_number,
                    "section_title": c.section_title,
                    "metadata": c.metadata,
                }
                for c in chunk_results
            ]

            await report("complete", 1.0)
            logger.info(f"[{document_id}] Ingestion complete ✓")

            return {
                "document_id": document_id,
                "chunk_count": chunk_count,
                "token_count": total_tokens,
                "language": language,
                "metadata": metadata,
                "chunks": chunk_dicts,
            }

        except Exception as e:
            logger.error(f"[{document_id}] Ingestion failed: {e}")
            await report("failed", 0.0)
            raise


# Singleton
_pipeline: DocumentIngestionPipeline | None = None


def get_ingestion_pipeline() -> DocumentIngestionPipeline:
    """Get the document ingestion pipeline singleton."""
    global _pipeline
    if _pipeline is None:
        _pipeline = DocumentIngestionPipeline()
    return _pipeline
