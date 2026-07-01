"""
Health Check Route — Reports backend status, Ollama connectivity, system info.
"""

from __future__ import annotations

import platform
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from config.settings import Settings
from api.deps import get_app_settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str
    version: str
    uptime_seconds: float
    timestamp: str
    ollama_status: str
    ollama_models: list[str]
    system: dict


# Track startup time
_start_time = time.time()


@router.get("/health", response_model=HealthResponse)
async def health_check(settings: Settings = Depends(get_app_settings)):
    """
    Check backend health, Ollama connectivity, and system info.
    Called periodically by the frontend to verify backend is running.
    """
    # Check Ollama status
    ollama_status = "unknown"
    ollama_models: list[str] = []

    try:
        import ollama
        models_response = ollama.list()
        ollama_models = [
            m.model for m in getattr(models_response, 'models', [])
        ]
        ollama_status = "running"
    except Exception:
        ollama_status = "stopped"

    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        uptime_seconds=round(time.time() - _start_time, 1),
        timestamp=datetime.now(timezone.utc).isoformat(),
        ollama_status=ollama_status,
        ollama_models=ollama_models,
        system={
            "platform": platform.system(),
            "python": platform.python_version(),
            "machine": platform.machine(),
        },
    )


@router.get("/stats")
async def get_stats():
    """
    Get application statistics — document counts, storage usage, etc.
    """
    from infrastructure.vector.lancedb_store import get_vector_store

    vector_store = get_vector_store()
    vector_stats = await vector_store.get_stats("chunks")

    return {
        "notebooks": 0,   # Will be populated from DB in Phase 5
        "documents": 0,
        "chunks": vector_stats.get("total_vectors", 0),
        "models": 0,
    }
