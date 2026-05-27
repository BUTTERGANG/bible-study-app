"""JWT + legacy APP_PASSWORD authentication.

Priority order in get_current_user:
  1. Bearer token == APP_PASSWORD → legacy mode (user_id=0)
  2. Bearer token is a valid JWT → real user account
  3. No APP_PASSWORD set → open mode (user_id=0)
  4. Auth required but no valid creds → HTTP 401
"""

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")


def _require_secret() -> str:
    if not SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY environment variable must be set")
    return SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass
class CurrentUser:
    id: int              # 0 = legacy/open mode sentinel
    email: Optional[str]
    is_legacy: bool


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "type": "access", "exp": expire},
        _require_secret(),
        algorithm=ALGORITHM,
    )


def create_refresh_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": str(user_id), "type": "refresh", "exp": expire},
        _require_secret(),
        algorithm=ALGORITHM,
    )


def decode_token(token: str, expected_type: str) -> int:
    try:
        payload = jwt.decode(token, _require_secret(), algorithms=[ALGORITHM])
    except (JWTError, RuntimeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong token type",
        )
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    return int(sub)


def _expected_secret() -> Optional[str]:
    secret = os.getenv("APP_PASSWORD", "").strip()
    return secret or None


def auth_is_enabled() -> bool:
    return _expected_secret() is not None


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_app_password: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    from sqlalchemy import select
    from .models import User

    token: Optional[str] = x_app_password
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()

    app_password = _expected_secret()

    # 1. Exact match with APP_PASSWORD → legacy mode
    import hmac
    if token and app_password and hmac.compare_digest(token, app_password):
        return CurrentUser(id=0, email=None, is_legacy=True)

    # 2. Try JWT decode (only if token doesn't look like the app password)
    if token:
        try:
            user_id = decode_token(token, "access")
            result = await db.execute(
                select(User).where(User.id == user_id, User.is_active == True)
            )
            user = result.scalar_one_or_none()
            if user:
                return CurrentUser(id=user.id, email=user.email, is_legacy=False)
        except HTTPException:
            pass

    # 3. No auth enforced → open mode
    if not app_password:
        return CurrentUser(id=0, email=None, is_legacy=True)

    # 4. Auth required, no valid creds → 401
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": 'Bearer realm="bible-study"'},
    )


