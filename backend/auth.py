"""Optional shared-secret authentication.

If `APP_PASSWORD` is unset, the dependency is a no-op (dev mode). When set,
requests to protected endpoints must include
`Authorization: Bearer <APP_PASSWORD>` or the equivalent `X-App-Password`
header. The frontend stores the secret in localStorage after the user enters
it once.

This is intentionally simple — single-user / family-share use case. Replace
with proper user auth if multi-tenancy becomes a requirement.
"""

import os
from typing import Optional

from fastapi import Header, HTTPException, status


def _expected_secret() -> Optional[str]:
    secret = os.getenv("APP_PASSWORD", "").strip()
    return secret or None


async def require_app_password(
    authorization: Optional[str] = Header(default=None),
    x_app_password: Optional[str] = Header(default=None),
) -> None:
    expected = _expected_secret()
    if not expected:
        return  # auth disabled — open dev mode

    provided = x_app_password
    if authorization and authorization.lower().startswith("bearer "):
        provided = authorization.split(" ", 1)[1].strip()

    if not provided or provided != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid app password",
            headers={"WWW-Authenticate": 'Bearer realm="bible-study"'},
        )


def auth_is_enabled() -> bool:
    return _expected_secret() is not None
