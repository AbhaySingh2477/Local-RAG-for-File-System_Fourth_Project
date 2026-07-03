"""
Token Counter — Thin wrapper around tiktoken.
Used by the chunker, context builder, and prompt builder.
"""

from __future__ import annotations

import logging

import tiktoken

logger = logging.getLogger(__name__)

# Cache encodings
_encodings: dict[str, tiktoken.Encoding] = {}


def get_encoding(encoding_name: str = "cl100k_base") -> tiktoken.Encoding:
    """Get or create a tiktoken encoding."""
    if encoding_name not in _encodings:
        _encodings[encoding_name] = tiktoken.get_encoding(encoding_name)
    return _encodings[encoding_name]


def count_tokens(text: str, encoding_name: str = "cl100k_base") -> int:
    """
    Count the number of tokens in a text string.

    Args:
        text: Input text
        encoding_name: Tiktoken encoding name

    Returns:
        Token count
    """
    enc = get_encoding(encoding_name)
    return len(enc.encode(text))


def truncate_to_tokens(text: str, max_tokens: int, encoding_name: str = "cl100k_base") -> str:
    """
    Truncate text to a maximum number of tokens.

    Args:
        text: Input text
        max_tokens: Maximum token count
        encoding_name: Tiktoken encoding name

    Returns:
        Truncated text
    """
    enc = get_encoding(encoding_name)
    tokens = enc.encode(text)
    if len(tokens) <= max_tokens:
        return text
    return enc.decode(tokens[:max_tokens])
