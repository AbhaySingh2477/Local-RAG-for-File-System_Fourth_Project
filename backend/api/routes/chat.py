"""
Chat API Routes — REST + SSE endpoints for chat-with-documents.

Endpoints:
  POST   /api/chat/sessions                     — Create new session
  GET    /api/chat/sessions                      — List sessions
  GET    /api/chat/sessions/{session_id}         — Get session + history
  DELETE /api/chat/sessions/{session_id}         — Delete session
  POST   /api/chat/sessions/{session_id}/messages — Send message (SSE stream)
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from domain.entities import ChatSession
from api.deps import get_db_session
from infrastructure.repositories.sqlite_chat_repo import SQLiteChatRepository
from application.chat_with_documents import ChatWithDocuments

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])


# ── Request / Response Models ─────────────────────────────────

class CreateSessionRequest(BaseModel):
    notebook_id: str
    model_id: str = ""
    title: str = "New Chat"


class CreateSessionResponse(BaseModel):
    id: str
    notebook_id: str
    title: str
    model_id: str
    message_count: int
    created_at: str


class SessionResponse(BaseModel):
    id: str
    notebook_id: str
    title: str
    model_id: str
    message_count: int
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    token_count: int
    latency_ms: float
    created_at: str
    citations: list[dict[str, Any]] = Field(default_factory=list)


class SessionDetailResponse(BaseModel):
    session: SessionResponse
    messages: list[MessageResponse]


class SendMessageRequest(BaseModel):
    content: str
    model: str | None = None
    pinned_chunk_ids: list[str] = []


# ── Helpers ───────────────────────────────────────────────────

def _session_to_response(session: ChatSession) -> dict:
    return {
        "id": session.id,
        "notebook_id": session.notebook_id,
        "title": session.title,
        "model_id": session.model_id,
        "message_count": session.message_count,
        "created_at": session.created_at.isoformat() if session.created_at else "",
        "updated_at": session.updated_at.isoformat() if session.updated_at else "",
    }


# ── Routes ────────────────────────────────────────────────────

@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session(
    body: CreateSessionRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Create a new chat session for a notebook."""
    repo = SQLiteChatRepository(db)

    session = ChatSession(
        notebook_id=body.notebook_id,
        title=body.title,
        model_id=body.model_id,
    )

    created = await repo.create_session(session)
    logger.info(f"Chat session created: {created.id} for notebook {body.notebook_id}")

    return _session_to_response(created)


@router.get("/sessions")
async def list_sessions(
    notebook_id: str | None = None,
    db: AsyncSession = Depends(get_db_session),
):
    """List chat sessions, optionally filtered by notebook."""
    repo = SQLiteChatRepository(db)
    sessions = await repo.list_sessions(notebook_id=notebook_id)

    return {
        "sessions": [_session_to_response(s) for s in sessions],
        "total": len(sessions),
    }


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Get a chat session with its message history."""
    repo = SQLiteChatRepository(db)

    session = await repo.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = await repo.get_messages(session_id, limit=100)

    # Get citations for each assistant message
    message_list = []
    for msg in messages:
        msg_dict = {
            "id": msg.id,
            "session_id": msg.session_id,
            "role": msg.role.value if hasattr(msg.role, 'value') else msg.role,
            "content": msg.content,
            "token_count": msg.token_count,
            "latency_ms": msg.latency_ms,
            "created_at": msg.created_at.isoformat() if msg.created_at else "",
            "citations": [],
        }

        # Load citations for assistant messages
        if msg.role.value == "assistant" if hasattr(msg.role, 'value') else msg.role == "assistant":
            citations = await repo.get_citations(msg.id)
            msg_dict["citations"] = [
                {
                    "id": c.id,
                    "index": c.citation_index,
                    "document_id": c.document_id,
                    "document_name": c.document_name,
                    "page_number": c.page_number,
                    "excerpt": c.excerpt,
                    "relevance_score": c.relevance_score,
                }
                for c in citations
            ]

        message_list.append(msg_dict)

    return {
        "session": _session_to_response(session),
        "messages": message_list,
    }


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Delete a chat session and all its messages."""
    repo = SQLiteChatRepository(db)
    deleted = await repo.delete_session(session_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Chat session not found")

    logger.info(f"Chat session deleted: {session_id}")
    return {"status": "deleted", "session_id": session_id}


@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: str,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Send a message and get a streaming SSE response.

    The response is a Server-Sent Events stream with events:
      data: {"type": "status", "message": "..."}
      data: {"type": "retrieval", "chunks": [...]}
      data: {"type": "token", "content": "..."}
      data: {"type": "citations", "data": [...]}
      data: {"type": "done", "message_id": "..."}
      data: [DONE]
    """
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=400, detail="Message content is required")

    repo = SQLiteChatRepository(db)

    # Verify session exists
    session = await repo.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # Create the chat use case
    chat_uc = ChatWithDocuments(chat_repo=repo)

    async def event_stream():
        """Generate SSE events from the chat pipeline."""
        try:
            async for event in chat_uc.send_message(
                session_id=session_id,
                content=body.content.strip(),
                model=body.model,
                pinned_chunk_ids=body.pinned_chunk_ids or [],
            ):
                yield f"data: {json.dumps(event)}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.error(f"SSE stream error: {e}", exc_info=True)
            error_event = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
