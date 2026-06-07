"""Shared Anthropic async client factory.

Centralizes the lazily-initialized client so every router uses identical
key-handling and error messaging. The key is re-read on each call so Replit's
integration can inject ANTHROPIC_API_KEY at runtime without a server restart;
the client is rebuilt only when the key actually changes.
"""

import os
from typing import Optional

import anthropic
from fastapi import HTTPException

_async_client: Optional[anthropic.AsyncAnthropic] = None
_cached_key: Optional[str] = None


def get_client() -> anthropic.AsyncAnthropic:
    """Return the shared async Anthropic client, raising 503 if no key is set."""
    global _async_client, _cached_key
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI features require ANTHROPIC_API_KEY. In Replit: Tools → Secrets → Add ANTHROPIC_API_KEY.",
        )
    if _async_client is None or api_key != _cached_key:
        _async_client = anthropic.AsyncAnthropic(api_key=api_key)
        _cached_key = api_key
    return _async_client
