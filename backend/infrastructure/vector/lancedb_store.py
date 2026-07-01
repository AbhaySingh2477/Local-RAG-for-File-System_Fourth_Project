"""
LanceDB Vector Store — Embedded vector database with hybrid search support.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import lancedb
import pyarrow as pa
import numpy as np

from config.settings import get_settings

logger = logging.getLogger(__name__)


class LanceDBStore:
    """
    Wrapper around LanceDB for vector storage and search.
    Supports vector search, full-text search, and hybrid search.
    """

    def __init__(self, db_path: Path | None = None):
        settings = get_settings()
        self._db_path = str(db_path or settings.lancedb_path)
        self._db: lancedb.DBConnection | None = None
        self._dimension = settings.embedding_dimension

    @property
    def db(self) -> lancedb.DBConnection:
        """Lazy-connect to LanceDB."""
        if self._db is None:
            self._db = lancedb.connect(self._db_path)
            logger.info(f"Connected to LanceDB at {self._db_path}")
        return self._db

    def _ensure_table(self, table_name: str) -> lancedb.table.Table:
        """Get or create a table with the standard schema."""
        try:
            return self.db.open_table(table_name)
        except Exception:
            # Create table with schema
            schema = pa.schema([
                pa.field("id", pa.string()),
                pa.field("document_id", pa.string()),
                pa.field("chunk_index", pa.int32()),
                pa.field("content", pa.string()),
                pa.field("token_count", pa.int32()),
                pa.field("page_number", pa.int32()),
                pa.field("section_title", pa.string()),
                pa.field("vector", pa.list_(pa.float32(), self._dimension)),
            ])
            table = self.db.create_table(table_name, schema=schema)
            logger.info(f"Created LanceDB table: {table_name}")
            return table

    async def add_vectors(
        self,
        table_name: str,
        records: list[dict[str, Any]],
    ) -> None:
        """
        Add vector records to a table.

        Each record should contain:
            id, document_id, chunk_index, content, token_count,
            page_number, section_title, vector
        """
        if not records:
            return

        table = self._ensure_table(table_name)

        # Convert to proper format
        data = []
        for r in records:
            data.append({
                "id": r["id"],
                "document_id": r["document_id"],
                "chunk_index": r.get("chunk_index", 0),
                "content": r["content"],
                "token_count": r.get("token_count", 0),
                "page_number": r.get("page_number", 0),
                "section_title": r.get("section_title", ""),
                "vector": r["vector"],
            })

        table.add(data)
        logger.info(f"Added {len(data)} vectors to table '{table_name}'")

    async def search_vectors(
        self,
        table_name: str,
        query_vector: list[float],
        top_k: int = 10,
        filters: dict | None = None,
    ) -> list[dict[str, Any]]:
        """Perform vector (semantic) search."""
        try:
            table = self._ensure_table(table_name)
            query = table.search(query_vector).limit(top_k)

            if filters and "document_id" in filters:
                query = query.where(f"document_id = '{filters['document_id']}'")

            results = query.to_pandas()

            return [
                {
                    "id": row["id"],
                    "document_id": row["document_id"],
                    "content": row["content"],
                    "chunk_index": int(row.get("chunk_index", 0)),
                    "page_number": int(row.get("page_number", 0)),
                    "section_title": row.get("section_title", ""),
                    "score": float(1 / (1 + row.get("_distance", 0))),  # Convert distance to similarity
                }
                for _, row in results.iterrows()
            ]
        except Exception as e:
            logger.error(f"Vector search error: {e}")
            return []

    async def search_fts(
        self,
        table_name: str,
        query_text: str,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        """Perform full-text (keyword / BM25) search."""
        try:
            table = self._ensure_table(table_name)

            # Ensure FTS index exists
            try:
                table.create_fts_index("content", replace=False)
            except Exception:
                pass  # Index already exists

            results = table.search(query_text, query_type="fts").limit(top_k).to_pandas()

            return [
                {
                    "id": row["id"],
                    "document_id": row["document_id"],
                    "content": row["content"],
                    "chunk_index": int(row.get("chunk_index", 0)),
                    "page_number": int(row.get("page_number", 0)),
                    "section_title": row.get("section_title", ""),
                    "score": float(row.get("score", row.get("_score", 0.5))),
                }
                for _, row in results.iterrows()
            ]
        except Exception as e:
            logger.error(f"FTS search error: {e}")
            return []

    async def hybrid_search(
        self,
        table_name: str,
        query_vector: list[float],
        query_text: str,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Perform hybrid search (vector + FTS) with RRF reranking.
        """
        try:
            table = self._ensure_table(table_name)

            # Ensure FTS index
            try:
                table.create_fts_index("content", replace=False)
            except Exception:
                pass

            results = (
                table.search(query_text, query_type="hybrid")
                .vector(query_vector)
                .limit(top_k)
                .to_pandas()
            )

            return [
                {
                    "id": row["id"],
                    "document_id": row["document_id"],
                    "content": row["content"],
                    "chunk_index": int(row.get("chunk_index", 0)),
                    "page_number": int(row.get("page_number", 0)),
                    "section_title": row.get("section_title", ""),
                    "score": float(row.get("_relevance_score", row.get("score", 0.5))),
                }
                for _, row in results.iterrows()
            ]
        except Exception as e:
            logger.warning(f"Hybrid search fallback to vector: {e}")
            return await self.search_vectors(table_name, query_vector, top_k)

    async def delete_by_document(
        self,
        table_name: str,
        document_id: str,
    ) -> None:
        """Delete all vectors for a specific document."""
        try:
            table = self._ensure_table(table_name)
            table.delete(f"document_id = '{document_id}'")
            logger.info(f"Deleted vectors for document {document_id} from '{table_name}'")
        except Exception as e:
            logger.error(f"Delete error: {e}")

    async def get_stats(self, table_name: str) -> dict[str, Any]:
        """Get statistics for a table."""
        try:
            table = self._ensure_table(table_name)
            df = table.to_pandas()
            return {
                "total_vectors": len(df),
                "unique_documents": df["document_id"].nunique() if len(df) > 0 else 0,
            }
        except Exception:
            return {"total_vectors": 0, "unique_documents": 0}


# Singleton
_store: LanceDBStore | None = None


def get_vector_store() -> LanceDBStore:
    """Get the LanceDB store singleton."""
    global _store
    if _store is None:
        _store = LanceDBStore()
    return _store
