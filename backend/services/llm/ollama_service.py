"""
Ollama Service — Async client for local LLM inference via Ollama.

Wraps the `ollama` Python SDK with:
  - Lazy connection (connects on first use)
  - Streaming and non-streaming chat
  - Model listing, health check
  - Graceful fallback when Ollama is unavailable
"""

from __future__ import annotations

import logging
from typing import Any, AsyncGenerator

from config.settings import get_settings

logger = logging.getLogger(__name__)


class OllamaService:
    """
    Async wrapper around the Ollama Python SDK.

    Usage:
        service = OllamaService()
        async for token in service.chat_stream(messages):
            print(token, end="")
    """

    def __init__(
        self,
        base_url: str | None = None,
        default_model: str | None = None,
        timeout: int | None = None,
    ):
        settings = get_settings()
        self._base_url = base_url or settings.ollama_base_url
        self._default_model = default_model or settings.ollama_default_model
        self._timeout = timeout or settings.ollama_timeout
        self._client = None

    def _ensure_client(self):
        """Lazy-initialize the Ollama async client."""
        if self._client is not None:
            return

        try:
            import ollama as ollama_sdk

            self._client = ollama_sdk.AsyncClient(
                host=self._base_url,
            )
            logger.info(f"Ollama client initialized → {self._base_url}")
        except ImportError:
            logger.error(
                "ollama package not installed. "
                "Install with: pip install ollama"
            )
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Ollama client: {e}")
            raise

    async def is_available(self) -> bool:
        """Check if Ollama server is running and reachable."""
        try:
            self._ensure_client()
            # List models as a health check
            await self._client.list()
            return True
        except Exception as e:
            logger.debug(f"Ollama not available: {e}")
            return False

    async def list_models(self) -> list[dict[str, Any]]:
        """
        List all locally installed Ollama models.

        Returns:
            List of model dicts with keys: name, size, modified_at, etc.
        """
        try:
            self._ensure_client()
            response = await self._client.list()
            models = []
            for model in response.get("models", []):
                models.append({
                    "name": model.get("name", ""),
                    "model": model.get("model", ""),
                    "size": model.get("size", 0),
                    "modified_at": str(model.get("modified_at", "")),
                    "digest": model.get("digest", ""),
                    "details": model.get("details", {}),
                })
            return models
        except Exception as e:
            logger.error(f"Failed to list Ollama models: {e}")
            return []

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        **kwargs,
    ) -> str:
        """
        Non-streaming chat — returns the full response.

        Args:
            messages: List of {role, content} dicts.
            model: Model name (default from settings).
            **kwargs: Additional Ollama options (temperature, etc.).

        Returns:
            The assistant's response text.
        """
        self._ensure_client()
        model_name = model or self._default_model

        try:
            response = await self._client.chat(
                model=model_name,
                messages=messages,
                stream=False,
                options=kwargs.get("options", {}),
            )
            content = response.get("message", {}).get("content", "")
            logger.debug(
                f"Ollama chat [{model_name}]: "
                f"{len(messages)} msgs → {len(content)} chars"
            )
            return content

        except Exception as e:
            logger.error(f"Ollama chat failed [{model_name}]: {e}")
            raise

    async def chat_stream(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """
        Streaming chat — yields tokens as they arrive.

        Args:
            messages: List of {role, content} dicts.
            model: Model name (default from settings).
            **kwargs: Additional Ollama options.

        Yields:
            Token strings as they are generated.
        """
        self._ensure_client()
        model_name = model or self._default_model

        try:
            stream = await self._client.chat(
                model=model_name,
                messages=messages,
                stream=True,
                options=kwargs.get("options", {}),
            )

            async for chunk in stream:
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield token

        except Exception as e:
            logger.error(f"Ollama stream failed [{model_name}]: {e}")
            raise

    @property
    def default_model(self) -> str:
        return self._default_model

    @default_model.setter
    def default_model(self, model: str):
        self._default_model = model


# ── Singleton ─────────────────────────────────────────────────

_ollama_service: OllamaService | None = None


def get_ollama_service() -> OllamaService:
    """Get the Ollama service singleton."""
    global _ollama_service
    if _ollama_service is None:
        _ollama_service = OllamaService()
    return _ollama_service
