"""
Search API Routes — Hybrid semantic search endpoints.

POST /api/search        — Execute a search query
GET  /api/search/stats  — Get search index statistics
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.deps import get_store
from infrastructure.vector.lancedb_store import LanceDBStore
from services.retrieval.retrieval_engine import get_retrieval_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/search", tags=["search"])


# ── Request / Response Models ──────────────────────────────────

class SearchRequest(BaseModel):
    """Search query request body."""
    query: str = Field(..., min_length=1, max_length=2000, description="Search query text")
    notebook_id: str | None = Field(default=None, description="Scope to a specific notebook")
    mode: str = Field(default="hybrid", description="Search mode: vector, keyword, or hybrid")
    limit: int = Field(default=10, ge=1, le=50, description="Max results to return")
    rerank: bool = Field(default=True, description="Apply cross-encoder reranking")
    filters: dict[str, Any] | None = Field(default=None, description="Optional filters")


class SearchResultItem(BaseModel):
    """A single search result."""
    chunk_id: str
    document_id: str
    document_name: str
    content: str
    score: float
    page_number: int | None
    section_title: str
    highlights: list[str]


class SearchResponse(BaseModel):
    """Search response."""
    results: list[SearchResultItem]
    total: int
    query: str
    mode: str
    latency_ms: float
    error: str | None = None


class SearchStatsResponse(BaseModel):
    """Search index statistics."""
    total_vectors: int
    unique_documents: int
    table_name: str


# ── Endpoints ──────────────────────────────────────────────────

@router.post("", response_model=SearchResponse)
async def search_documents(request: SearchRequest):
    """
    Execute a hybrid search query across indexed documents.

    Supports three search modes:
    - **vector**: Pure semantic similarity search using embeddings
    - **keyword**: Pure full-text BM25 keyword search
    - **hybrid**: Combined vector + keyword with Reciprocal Rank Fusion (default)

    When `rerank` is enabled (default), results are re-scored using a
    cross-encoder model for higher relevance accuracy.
    """
    try:
        engine = get_retrieval_engine()

        result = await engine.search(
            query=request.query,
            notebook_id=request.notebook_id,
            mode=request.mode,
            top_k=request.limit,
            rerank=request.rerank,
            filters=request.filters,
        )

        # Convert SearchResult dataclasses to response format
        items = []
        for sr in result["results"]:
            items.append(SearchResultItem(
                chunk_id=sr.chunk_id,
                document_id=sr.document_id,
                document_name=sr.document_name,
                content=sr.content,
                score=round(sr.score, 4),
                page_number=sr.page_number,
                section_title=sr.section_title,
                highlights=sr.highlights,
            ))

        return SearchResponse(
            results=items,
            total=result["total"],
            query=result["query"],
            mode=result["mode"],
            latency_ms=round(result["latency_ms"], 1),
            error=result.get("error"),
        )

    except Exception as e:
        logger.error(f"Search failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}",
        )


@router.get("/stats", response_model=SearchStatsResponse)
async def search_stats(
    notebook_id: str | None = None,
    store: LanceDBStore = Depends(get_store),
):
    """Get statistics about the search index for a notebook."""
    from services.retrieval.retrieval_engine import _make_table_name

    table_name = _make_table_name(notebook_id)

    try:
        stats = await store.get_stats(table_name)
        return SearchStatsResponse(
            total_vectors=stats.get("total_vectors", 0),
            unique_documents=stats.get("unique_documents", 0),
            table_name=table_name,
        )
    except Exception as e:
        logger.error(f"Stats retrieval failed: {e}")
        return SearchStatsResponse(
            total_vectors=0,
            unique_documents=0,
            table_name=table_name,
        )
