"""AI conversation CRUD — persist/restore conversation history to the backend.

Conversations are keyed by reference (e.g. "KJV/John/3") and scoped to the
current user. The messages column stores a JSON array so we preserve the full
message structure (role, content, metadata) without schema churn.
"""

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import AiConversation

router = APIRouter(prefix="/api/ai/conversations", tags=["ai_conversations"])


class ConversationSave(BaseModel):
    reference: str          # e.g. "KJV/John/3"
    translation: str = "KJV"
    book: str
    chapter: int
    messages: list[dict]
    title: Optional[str] = None


class ConversationUpdate(BaseModel):
    messages: list[dict]
    title: Optional[str] = None


def _conv_dict(c: AiConversation) -> dict:
    return {
        "id": c.id,
        "reference": c.reference,
        "translation": c.translation,
        "book": c.book,
        "chapter": c.chapter,
        "messages": json.loads(c.messages) if c.messages else [],
        "message_count": c.message_count,
        "title": c.title,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("")
async def list_conversations(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """List all persisted conversations for the current user, newest first."""
    query = (
        select(AiConversation)
        .where(AiConversation.user_id == user.id)
        .order_by(AiConversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    items = [_conv_dict(c) for c in result.scalars().all()]
    return {"conversations": items, "offset": offset, "limit": limit}


@router.get("/{reference:path}")
async def get_conversation(
    reference: str,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Get a single conversation by its reference key."""
    result = await db.execute(
        select(AiConversation).where(
            AiConversation.user_id == user.id,
            AiConversation.reference == reference,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _conv_dict(conv)


@router.put("/{reference:path}")
async def save_conversation(
    reference: str,
    body: ConversationSave,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Create or replace a conversation for the given reference."""
    result = await db.execute(
        select(AiConversation).where(
            AiConversation.user_id == user.id,
            AiConversation.reference == reference,
        )
    )
    conv = result.scalar_one_or_none()

    messages_json = json.dumps(body.messages)
    if conv:
        conv.messages = messages_json
        conv.message_count = len(body.messages)
        conv.book = body.book
        conv.chapter = body.chapter
        conv.translation = body.translation
        if body.title:
            conv.title = body.title
        conv.updated_at = datetime.utcnow()
    else:
        conv = AiConversation(
            user_id=user.id,
            reference=reference,
            translation=body.translation,
            book=body.book,
            chapter=body.chapter,
            messages=messages_json,
            message_count=len(body.messages),
            title=body.title,
        )
        db.add(conv)

    await db.commit()
    await db.refresh(conv)
    return _conv_dict(conv)


@router.patch("/{reference:path}")
async def update_conversation(
    reference: str,
    body: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Update messages and/or title for an existing conversation."""
    result = await db.execute(
        select(AiConversation).where(
            AiConversation.user_id == user.id,
            AiConversation.reference == reference,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv.messages = json.dumps(body.messages)
    conv.message_count = len(body.messages)
    if body.title is not None:
        conv.title = body.title
    conv.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(conv)
    return _conv_dict(conv)


@router.delete("/{reference:path}")
async def delete_conversation(
    reference: str,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a conversation by reference."""
    result = await db.execute(
        delete(AiConversation).where(
            AiConversation.user_id == user.id,
            AiConversation.reference == reference,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ok": True}