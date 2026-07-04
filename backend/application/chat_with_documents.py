"""
Chat With Documents — RAG chat use case / orchestrator.

This is the main use case for Phase 4. It ties together:
  1. Conversation history loading
  2. Hybrid retrieval (from Phase 3's RetrievalEngine)
  3. Context building (dedup + budget)
  4. Prompt building (system + history + query)
  5. Streaming LLM response (Ollama)
  6. Citation extraction
  7. Persistence (messages + citations)

It yields SSE-formatted events throughout the pipeline.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from domain.entities import ChatSession, Message, MessageRole
from services.llm.ollama_service import OllamaService, get_ollama_service
from services.llm.prompt_builder import PromptBuilder, get_prompt_builder
from services.retrieval.retrieval_engine import RetrievalEngine, get_retrieval_engine
from services.retrieval.context_builder import ContextBuilder, get_context_builder
from services.citation.citation_engine import CitationEngine, get_citation_engine
from infrastructure.repositories.sqlite_chat_repo import SQLiteChatRepository

logger = logging.getLogger(__name__)


class ChatWithDocuments:
    """
    RAG Chat use case — orchestrates the full chat pipeline.

    Usage:
        chat_uc = ChatWithDocuments(chat_repo=repo)
        async for event in chat_uc.send_message(session_id, "What is X?"):
            # event is a dict: {"type": "token", "content": "..."} etc.
            yield event
    """

    def __init__(
        self,
        chat_repo: SQLiteChatRepository,
        retrieval_engine: RetrievalEngine | None = None,
        context_builder: ContextBuilder | None = None,
        prompt_builder: PromptBuilder | None = None,
        ollama_service: OllamaService | None = None,
        citation_engine: CitationEngine | None = None,
    ):
        self._chat_repo = chat_repo
        self._retrieval = retrieval_engine or get_retrieval_engine()
        self._context = context_builder or get_context_builder()
        self._prompt = prompt_builder or get_prompt_builder()
        self._ollama = ollama_service or get_ollama_service()
        self._citations = citation_engine or get_citation_engine()

    async def send_message(
        self,
        session_id: str,
        content: str,
        model: str | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Process a user message through the full RAG pipeline.

        Yields SSE events:
          {"type": "status", "message": "Retrieving..."}
          {"type": "retrieval", "chunks": [...], "count": N}
          {"type": "token", "content": "..."}
          {"type": "citations", "data": [...]}
          {"type": "done", "message_id": "...", "latency_ms": ...}
          {"type": "error", "message": "..."}
        """
        start_time = time.perf_counter()
        user_message_id = str(uuid.uuid4())
        assistant_message_id = str(uuid.uuid4())

        try:
            # ── Step 1: Load session ──────────────────────────
            session = await self._chat_repo.get_session(session_id)
            if session is None:
                yield {"type": "error", "message": "Chat session not found"}
                return

            yield {"type": "status", "message": "Loading conversation..."}

            # ── Step 2: Save user message ─────────────────────
            user_msg = Message(
                id=user_message_id,
                session_id=session_id,
                role=MessageRole.USER,
                content=content,
                created_at=datetime.now(timezone.utc),
            )
            await self._chat_repo.add_message(user_msg)

            # ── Step 3: Load conversation history ─────────────
            history_messages = await self._chat_repo.get_messages(
                session_id, limit=20
            )
            # Convert to simple dicts for prompt builder (exclude the just-added user msg)
            history = [
                {"role": m.role.value if isinstance(m.role, MessageRole) else m.role,
                 "content": m.content}
                for m in history_messages[:-1]  # Exclude the user msg we just added
            ]

            # ── Step 4: Retrieve relevant chunks ──────────────
            yield {"type": "status", "message": "Searching documents..."}

            search_result = await self._retrieval.search(
                query=content,
                notebook_id=session.notebook_id,
                mode="hybrid",
                top_k=10,
                rerank=True,
            )

            raw_results = search_result.get("results", [])

            # ── Step 5: Build context ─────────────────────────
            built_context = self._context.build(raw_results, max_sources=8)
            context_chunks = built_context.to_chunk_dicts()

            # Emit retrieval results to frontend
            yield {
                "type": "retrieval",
                "chunks": [
                    {
                        "document_name": c.get("document_name", ""),
                        "page_number": c.get("page_number"),
                        "section_title": c.get("section_title", ""),
                        "score": c.get("score", 0.0),
                        "citation_index": c.get("citation_index", 0),
                    }
                    for c in context_chunks
                ],
                "count": len(context_chunks),
            }

            # ── Step 6: Build prompt ──────────────────────────
            yield {"type": "status", "message": "Generating response..."}

            messages = self._prompt.build_messages(
                query=content,
                chunks=context_chunks,
                history=history,
            )

            # ── Step 7: Stream LLM response ───────────────────
            full_response = []

            async for token in self._ollama.chat_stream(
                messages=messages,
                model=model or session.model_id or None,
            ):
                full_response.append(token)
                yield {"type": "token", "content": token}

            response_text = "".join(full_response)

            # ── Step 8: Extract citations ─────────────────────
            citations = self._citations.extract_citations(
                response_text=response_text,
                source_chunks=context_chunks,
                message_id=assistant_message_id,
            )

            # Emit citations
            yield {
                "type": "citations",
                "data": [
                    self._citations.format_citation_for_display(c)
                    for c in citations
                ],
            }

            # ── Step 9: Save assistant message + citations ────
            latency_ms = (time.perf_counter() - start_time) * 1000

            assistant_msg = Message(
                id=assistant_message_id,
                session_id=session_id,
                role=MessageRole.ASSISTANT,
                content=response_text,
                token_count=len(response_text) // 4,  # Approximate
                retrieved_chunks=[
                    {"id": c.get("id"), "document_name": c.get("document_name"),
                     "score": c.get("score")}
                    for c in context_chunks
                ],
                latency_ms=latency_ms,
                created_at=datetime.now(timezone.utc),
            )
            await self._chat_repo.add_message(assistant_msg)

            if citations:
                await self._chat_repo.add_citations(citations)

            # ── Step 10: Auto-title (first message) ───────────
            if session.title == "New Chat" and content:
                auto_title = content[:60].strip()
                if len(content) > 60:
                    auto_title = auto_title.rsplit(" ", 1)[0] + "…"
                await self._chat_repo.update_session_title(
                    session_id, auto_title
                )

            # ── Done ──────────────────────────────────────────
            yield {
                "type": "done",
                "message_id": assistant_message_id,
                "latency_ms": round(latency_ms, 1),
                "session_title": auto_title if session.title == "New Chat" and content else session.title,
            }

        except Exception as e:
            logger.error(f"Chat pipeline error: {e}", exc_info=True)
            yield {
                "type": "error",
                "message": f"Chat failed: {str(e)}",
            }
