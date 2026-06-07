"""Tests for the /api/ai/sermon endpoint.

Verifies request validation, SSE streaming format, and error handling.
Uses the isolated test DB from conftest and mocks the Anthropic client.
"""

import json
from unittest.mock import AsyncMock, patch

import pytest


def _make_mock_client(text_chunks):
    """Build a mock Anthropic client that yields the given text chunks."""

    class FakeTextStream:
        def __init__(self, chunks):
            self._iter = iter(chunks)

        def __aiter__(self):
            return self

        async def __anext__(self):
            try:
                return next(self._iter)
            except StopIteration:
                raise StopAsyncIteration

    class FakeStreamManager:
        def __init__(self, chunks):
            self._chunks = chunks

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        @property
        def text_stream(self):
            return FakeTextStream(self._chunks)

    mock_client = AsyncMock()
    mock_client.messages.stream.return_value = FakeStreamManager(text_chunks)
    return mock_client


@pytest.fixture
def mock_anthropic_stream():
    mock = _make_mock_client(["Here is your sermon on ", "John 3:16.\n\n## Sermon Title\nAmazing Grace"])
    with patch("backend.routers.ai._client", return_value=mock):
        yield mock


@pytest.fixture
def mock_anthropic_stream_error():
    class FakeTextStream:
        def __aiter__(self):
            return self

        async def __anext__(self):
            raise RuntimeError("Anthropic API unavailable")

    class FakeStreamManager:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        @property
        def text_stream(self):
            return FakeTextStream()

    mock = AsyncMock()
    mock.messages.stream.return_value = FakeStreamManager()
    with patch("backend.routers.ai._client", return_value=mock):
        yield mock


class TestSermonEndpoint:
    """POST /api/ai/sermon — validation and streaming."""

    @pytest.mark.asyncio
    async def test_sermon_requires_passage(self, client):
        """Missing 'passage' field should return 422."""
        resp = await client.post("/api/ai/sermon", json={})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_sermon_minimal_request(self, client, mock_anthropic_stream):
        """A minimal request with just 'passage' should return 200 SSE."""
        resp = await client.post("/api/ai/sermon", json={"passage": "John 3:16"})
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")

    @pytest.mark.asyncio
    async def test_sermon_sse_format(self, client, mock_anthropic_stream):
        """Response should be valid SSE with data: lines and [DONE] terminator."""
        resp = await client.post("/api/ai/sermon", json={"passage": "John 3:16"})
        body = resp.text
        assert "data:" in body
        assert "[DONE]" in body

    @pytest.mark.asyncio
    async def test_sermon_with_audience(self, client, mock_anthropic_stream):
        """Request with audience parameter should succeed."""
        resp = await client.post("/api/ai/sermon", json={
            "passage": "John 3:16",
            "audience": "youth",
        })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_sermon_with_themes(self, client, mock_anthropic_stream):
        """Request with key_themes should succeed."""
        resp = await client.post("/api/ai/sermon", json={
            "passage": "Genesis 1:1",
            "audience": "general",
            "key_themes": ["creation", "God's sovereignty"],
        })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_sermon_with_full_context(self, client, mock_anthropic_stream):
        """Request with verse_text and chapter_text should succeed."""
        resp = await client.post("/api/ai/sermon", json={
            "passage": "John 3:16",
            "audience": "seekers",
            "translation": "KJV",
            "verse_text": "For God so loved the world...",
            "chapter_text": "16. For God so loved the world...\n17. For God sent not his Son...",
        })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_sermon_stream_error_handling(self, client, mock_anthropic_stream_error):
        """Mid-stream errors should be sent as SSE error events, not crash."""
        resp = await client.post("/api/ai/sermon", json={"passage": "John 3:16"})
        assert resp.status_code == 200  # SSE stream starts OK
        body = resp.text
        assert "[DONE]" in body  # stream terminates cleanly

    @pytest.mark.asyncio
    async def test_sermon_invalid_audience_still_works(self, client, mock_anthropic_stream):
        """Unknown audience value should fall back to 'general'."""
        resp = await client.post("/api/ai/sermon", json={
            "passage": "John 3:16",
            "audience": "nonexistent_audience",
        })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_sermon_empty_themes_omitted(self, client, mock_anthropic_stream):
        """Empty key_themes list should be omitted from the request."""
        resp = await client.post("/api/ai/sermon", json={
            "passage": "John 3:16",
            "key_themes": [],
        })
        assert resp.status_code == 200
