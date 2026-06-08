"""Share study session as link — generate read-only permalinks.

POST /api/shares  (protected) — create a share token for a study session.
GET  /api/shares/{token}  (public, NO auth) — resolve a share token and return
    the passage text, notes, and AI conversation summary.
"""

import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..bible_data import resolve_book_name
from ..database import get_db
from ..models import AiConversation, BibleVerse, Note, SharedSession

router = APIRouter(prefix="/api/shares", tags=["shares"])

_DEFAULT_EXPIRY_DAYS = 90


class ShareCreate(BaseModel):
    book: str
    chapter: int
    note_ids: list[int] = []
    ai_conversation_id: int | None = None
    translation: str = "KJV"


class ShareOut(BaseModel):
    share_token: str
    url: str
    expires_at: datetime
    created_at: datetime


class SharedSessionResolve(BaseModel):
    book: str
    chapter: int
    translation: str
    passage: list[dict]
    notes: list[dict]
    ai_conversation: dict | None
    expires_at: datetime
    view_count: int
    created_at: datetime


@router.post("", response_model=ShareOut)
async def create_share(
    body: ShareCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    canonical = resolve_book_name(body.book)
    if not canonical:
        raise HTTPException(status_code=400, detail=f"Unknown book: {body.book}")

    if body.ai_conversation_id is not None:
        conv = await db.execute(
            select(AiConversation).where(
                AiConversation.id == body.ai_conversation_id,
                AiConversation.user_id == user.id,
            )
        )
        if not conv.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="AI conversation not found")

    if body.note_ids:
        notes_q = await db.execute(
            select(Note.id).where(
                Note.id.in_(body.note_ids),
                Note.user_id == user.id,
            )
        )
        valid_ids = set(notes_q.scalars().all())
        invalid = set(body.note_ids) - valid_ids
        if invalid:
            raise HTTPException(status_code=400, detail=f"Note IDs not found or not owned: {sorted(invalid)}")

    expiry_days = int(os.getenv("SHARE_EXPIRY_DAYS", str(_DEFAULT_EXPIRY_DAYS)))
    token = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=expiry_days)

    shared = SharedSession(
        share_token=token, user_id=user.id, book=canonical, chapter=body.chapter,
        note_ids=json.dumps(body.note_ids), ai_conversation_id=body.ai_conversation_id,
        translation=body.translation, expires_at=expires_at,
    )
    db.add(shared)
    await db.commit()
    await db.refresh(shared)

    url = f"/share/{token}"
    return ShareOut(share_token=token, url=url, expires_at=shared.expires_at, created_at=shared.created_at)


@router.get("/{token}", response_model=SharedSessionResolve)
async def resolve_share(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SharedSession).where(SharedSession.share_token == token))
    shared = result.scalar_one_or_none()
    if not shared:
        raise HTTPException(status_code=404, detail="Shared session not found")

    if shared.expires_at and datetime.now(timezone.utc) > shared.expires_at.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=410, detail="This shared link has expired")

    await db.execute(update(SharedSession).where(SharedSession.id == shared.id).values(view_count=SharedSession.view_count + 1))
    await db.commit()

    passage_q = await db.execute(
        select(BibleVerse).where(
            BibleVerse.translation == shared.translation,
            BibleVerse.book == shared.book,
            BibleVerse.chapter == shared.chapter,
        ).order_by(BibleVerse.verse)
    )
    passage = [{"verse": v.verse, "text": v.text} for v in passage_q.scalars().all()]

    note_id_list: list[int] = json.loads(shared.note_ids or "[]")
    notes: list[dict] = []
    if note_id_list:
        notes_q = await db.execute(select(Note).where(Note.id.in_(note_id_list)))
        notes = [{"id": n.id, "book": n.book, "chapter": n.chapter, "verse": n.verse, "content": n.content, "tags": n.tags} for n in notes_q.scalars().all()]

    ai_conversation: dict | None = None
    if shared.ai_conversation_id is not None:
        conv_q = await db.execute(select(AiConversation).where(AiConversation.id == shared.ai_conversation_id))
        conv = conv_q.scalar_one_or_none()
        if conv:
            try:
                messages = json.loads(conv.messages) if isinstance(conv.messages, str) else conv.messages
            except (json.JSONDecodeError, TypeError):
                messages = []
            summary_messages = []
            for msg in messages:
                role = msg.get("role", "")
                content = msg.get("content", "")
                if role in ("user", "assistant") and content:
                    if len(content) > 500:
                        content = content[:500] + "…"
                    summary_messages.append({"role": role, "content": content})
            ai_conversation = {"id": conv.id, "title": conv.title or f"{conv.book} {conv.chapter}", "messages_summary": summary_messages}

    return SharedSessionResolve(
        book=shared.book, chapter=shared.chapter, translation=shared.translation,
        passage=passage, notes=notes, ai_conversation=ai_conversation,
        expires_at=shared.expires_at, view_count=shared.view_count + 1, created_at=shared.created_at,
    )
