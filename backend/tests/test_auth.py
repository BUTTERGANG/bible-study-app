"""Auth behavior depends on APP_PASSWORD being set in env at app-import time.

The shared conftest disables auth (empty APP_PASSWORD) for the rest of the
suite. These tests reach into the auth module directly so they don't have to
re-import the FastAPI app.
"""

import pytest
from fastapi import HTTPException

from backend.auth import auth_is_enabled, get_current_user


def test_auth_disabled_when_unset(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "")
    assert auth_is_enabled() is False


def test_auth_enabled_when_set(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "letmein")
    assert auth_is_enabled() is True


@pytest.mark.asyncio
async def test_missing_password_raises(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "letmein")
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization=None, x_app_password=None, db=None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_bearer_password_accepted(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "letmein")
    user = await get_current_user(authorization="Bearer letmein", x_app_password=None, db=None)
    assert user.id == 0
    assert user.is_legacy is True


@pytest.mark.asyncio
async def test_header_password_accepted(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "letmein")
    user = await get_current_user(authorization=None, x_app_password="letmein", db=None)
    assert user.id == 0
    assert user.is_legacy is True


@pytest.mark.asyncio
async def test_wrong_password_rejected(monkeypatch):
    monkeypatch.setenv("APP_PASSWORD", "letmein")
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Bearer nope", x_app_password=None, db=None)
    assert exc.value.status_code == 401
