from fastapi import APIRouter

from ..auth import auth_is_enabled
from ..database import db_status

router = APIRouter(tags=["health"])



@router.get("/api/health")
async def health():
    status = await db_status()
    return {
        "status": "ok" if status.get("ok") else "degraded",
        "version": "1.0.0",
        "database": status,
        "auth_enabled": auth_is_enabled(),
    }


@router.get("/api/auth/status")
async def auth_status():
    """Lets the frontend know which auth mode is active."""
    legacy = auth_is_enabled()
    return {
        "required": legacy,
        "user_accounts_enabled": True,
        "legacy_auth": legacy,
    }
