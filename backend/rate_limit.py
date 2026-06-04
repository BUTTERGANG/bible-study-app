"""Tiny in-memory token-bucket rate limiter, keyed by client IP.

Designed for one purpose: keep `/api/ai/*` from burning the Anthropic budget
to zero if the deploy is public. Not a distributed limiter — Cloud Run with
a single instance is the assumed deployment. If you scale out, swap this for
Redis or a managed limiter.
"""

import os
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request, status


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


# Defaults aim for "comfortable for one user, painful for an attacker."
AI_RATE_LIMIT_PER_MIN = _int_env("AI_RATE_LIMIT_PER_MIN", 15)
AI_RATE_LIMIT_PER_HOUR = _int_env("AI_RATE_LIMIT_PER_HOUR", 120)

# Auth endpoints — stricter to prevent brute-force.
AUTH_RATE_LIMIT_PER_MIN = _int_env("AUTH_RATE_LIMIT_PER_MIN", 5)
AUTH_RATE_LIMIT_PER_HOUR = _int_env("AUTH_RATE_LIMIT_PER_HOUR", 30)


class _IPBucket:
    def __init__(self) -> None:
        self.minute: Deque[float] = deque()
        self.hour: Deque[float] = deque()


_ai_buckets: Dict[str, _IPBucket] = defaultdict(_IPBucket)
_auth_buckets: Dict[str, _IPBucket] = defaultdict(_IPBucket)


def _trim(d: Deque[float], cutoff: float) -> None:
    while d and d[0] < cutoff:
        d.popleft()


def _client_ip(request: Request) -> str:
    # Use the rightmost X-Forwarded-For hop — added by the trusted proxy, not
    # spoofable by the client. Falls back to direct peer address.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        hops = [h.strip() for h in fwd.split(",")]
        return hops[-1]
    return request.client.host if request.client else "unknown"


async def ai_rate_limit(request: Request) -> None:
    now = time.time()
    bucket = _ai_buckets[_client_ip(request)]
    _trim(bucket.minute, now - 60)
    _trim(bucket.hour, now - 3600)

    if len(bucket.minute) >= AI_RATE_LIMIT_PER_MIN:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"AI rate limit: max {AI_RATE_LIMIT_PER_MIN} requests/minute. Try again shortly.",
        )
    if len(bucket.hour) >= AI_RATE_LIMIT_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"AI rate limit: max {AI_RATE_LIMIT_PER_HOUR} requests/hour reached.",
        )

    bucket.minute.append(now)
    bucket.hour.append(now)


async def auth_rate_limit(request: Request) -> None:
    """Stricter rate limiter for login/register endpoints to prevent brute-force."""
    now = time.time()
    bucket = _auth_buckets[_client_ip(request)]
    _trim(bucket.minute, now - 60)
    _trim(bucket.hour, now - 3600)

    if len(bucket.minute) >= AUTH_RATE_LIMIT_PER_MIN:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many auth attempts. Max {AUTH_RATE_LIMIT_PER_MIN}/minute. Try again shortly.",
        )
    if len(bucket.hour) >= AUTH_RATE_LIMIT_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many auth attempts. Max {AUTH_RATE_LIMIT_PER_HOUR}/hour reached.",
        )

    bucket.minute.append(now)
    bucket.hour.append(now)
