"""Groups router: collaborative study groups with shared notes and feed.

Endpoints cover group CRUD, membership, invitations, group notes,
sharing personal items into groups, and a unified activity feed.
"""

import secrets
import string
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_db
from ..models import (
    Group,
    GroupInvite,
    GroupMember,
    GroupNote,
    GroupSharedItem,
    Highlight,
    Note,
    User,
)

router = APIRouter(prefix="/api/groups", tags=["groups"])


# ── Helpers ─────────────────────────────────────────────────────────────


async def _require_membership(
    db: AsyncSession, group_id: int, user_id: int
) -> GroupMember:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this group",
        )
    return membership


async def _require_owner(
    db: AsyncSession, group_id: int, user_id: int
) -> GroupMember:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.role == "owner",
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can perform this action",
        )
    return membership


def _gen_code() -> str:
    return "".join(
        secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6)
    )


def _group_summary(g: Group, member_count: int) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "description": g.description,
        "owner_id": g.owner_id,
        "invite_code": g.invite_code,
        "member_count": member_count,
        "created_at": g.created_at.isoformat() if g.created_at else None,
        "updated_at": g.updated_at.isoformat() if g.updated_at else None,
    }


# ── Request / response schemas ──────────────────────────────────────────


class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class InviteCreate(BaseModel):
    email: str


class GroupNoteCreate(BaseModel):
    book: Optional[str] = None
    chapter: Optional[int] = None
    verse: Optional[int] = None
    content: str
    tags: Optional[str] = None


class GroupNoteUpdate(BaseModel):
    content: Optional[str] = None
    tags: Optional[str] = None


class ShareCreate(BaseModel):
    item_type: str  # "note" | "highlight"
    item_id: int
    annotation: Optional[str] = None


# ════════════════════════════════════════════════════════════════════════
# GROUP CRUD
# ════════════════════════════════════════════════════════════════════════


@router.post("")
async def create_group(
    body: GroupCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    code = _gen_code()
    # Ensure uniqueness (collision is ~1 in 2 billion but be safe)
    for _ in range(5):
        existing = await db.execute(select(Group).where(Group.invite_code == code))
        if not existing.scalar_one_or_none():
            break
        code = _gen_code()

    group = Group(
        name=body.name.strip(),
        description=(body.description or "").strip(),
        owner_id=user.id,
        invite_code=code,
    )
    db.add(group)
    await db.flush()  # get group.id

    # Owner becomes first member with role=owner
    db.add(GroupMember(group_id=group.id, user_id=user.id, role="owner"))
    await db.commit()
    await db.refresh(group)
    return _group_summary(group, member_count=1)


@router.get("")
async def list_my_groups(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    # Groups the user is a member of
    membership_q = await db.execute(
        select(GroupMember.group_id).where(GroupMember.user_id == user.id)
    )
    group_ids = [r[0] for r in membership_q.all()]
    if not group_ids:
        return {"groups": []}

    groups_q = await db.execute(
        select(Group).where(Group.id.in_(group_ids)).order_by(Group.updated_at.desc())
    )
    groups = list(groups_q.scalars().all())

    # Batch member counts
    from sqlalchemy import func as sa_func

    counts_q = await db.execute(
        select(GroupMember.group_id, sa_func.count())
        .where(GroupMember.group_id.in_(group_ids))
        .group_by(GroupMember.group_id)
    )
    count_map = {gid: cnt for gid, cnt in counts_q.all()}

    return {
        "groups": [
            _group_summary(g, member_count=count_map.get(g.id, 0)) for g in groups
        ]
    }


@router.get("/my-invites")
async def list_pending_invites(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Return pending invites matching the user's email."""
    if not user.email:
        return {"invites": []}
    result = await db.execute(
        select(GroupInvite, Group)
        .join(Group, GroupInvite.group_id == Group.id)
        .where(
            GroupInvite.email == user.email,
            GroupInvite.status == "pending",
        )
        .order_by(GroupInvite.created_at.desc())
    )
    rows = result.all()
    return {
        "invites": [
            {
                "id": inv.id,
                "group_id": grp.id,
                "group_name": grp.name,
                "email": inv.email,
                "invited_by": inv.invited_by,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv, grp in rows
        ]
    }


@router.get("/{group_id}")
async def get_group_detail(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    membership = await _require_membership(db, group_id, user.id)

    group_q = await db.execute(select(Group).where(Group.id == group_id))
    group = group_q.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Members with user emails
    mem_q = await db.execute(
        select(GroupMember, User.email)
        .join(User, GroupMember.user_id == User.id)
        .where(GroupMember.group_id == group_id)
        .order_by(GroupMember.role.desc(), GroupMember.joined_at)
    )
    members = [
        {
            "user_id": m.user_id,
            "email": email,
            "role": m.role,
            "joined_at": m.joined_at.isoformat() if m.joined_at else None,
        }
        for m, email in mem_q.all()
    ]

    # Recent invites
    inv_q = await db.execute(
        select(GroupInvite)
        .where(GroupInvite.group_id == group_id)
        .order_by(GroupInvite.created_at.desc())
        .limit(20)
    )
    invites = [
        {
            "id": inv.id,
            "email": inv.email,
            "status": inv.status,
            "invited_by": inv.invited_by,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "responded_at": inv.responded_at.isoformat() if inv.responded_at else None,
        }
        for inv in inv_q.scalars().all()
    ]

    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "owner_id": group.owner_id,
        "invite_code": group.invite_code,
        "my_role": membership.role,
        "created_at": group.created_at.isoformat() if group.created_at else None,
        "updated_at": group.updated_at.isoformat() if group.updated_at else None,
        "members": members,
        "invites": invites,
    }


@router.put("/{group_id}")
async def update_group(
    group_id: int,
    body: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    await _require_owner(db, group_id, user.id)
    group_q = await db.execute(select(Group).where(Group.id == group_id))
    group = group_q.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if body.name is not None:
        group.name = body.name.strip()
    if body.description is not None:
        group.description = body.description.strip()
    group.updated_at = datetime.now(timezone.utc)
    await db.commit()
    count_result = await db.execute(
        select(func.count()).select_from(GroupMember).where(GroupMember.group_id == group.id)
    )
    return _group_summary(g=group, member_count=count_result.scalar_one())


@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    await _require_owner(db, group_id, user.id)
    await db.execute(delete(Group).where(Group.id == group_id))
    await db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════════
# MEMBERS & INVITES
# ════════════════════════════════════════════════════════════════════════


@router.post("/{group_id}/invites")
async def invite_by_email(
    group_id: int,
    body: InviteCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    await _require_owner(db, group_id, user.id)
    email = body.email.lower().strip()

    # Check if already a member
    existing_mem = await db.execute(
        select(GroupMember, User)
        .join(User, GroupMember.user_id == User.id)
        .where(GroupMember.group_id == group_id, User.email == email)
    )
    if existing_mem.first():
        raise HTTPException(status_code=400, detail="User is already a member")

    # Check for existing pending invite
    existing_inv = await db.execute(
        select(GroupInvite).where(
            GroupInvite.group_id == group_id,
            GroupInvite.email == email,
            GroupInvite.status == "pending",
        )
    )
    if existing_inv.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invite already pending")

    # If user exists with this email, auto-add as member
    user_q = await db.execute(select(User).where(User.email == email))
    target = user_q.scalar_one_or_none()
    if target:
        db.add(GroupMember(group_id=group_id, user_id=target.id, role="member"))
        await db.commit()
        return {"ok": True, "auto_added": True}

    # Otherwise create pending invite
    db.add(
        GroupInvite(
            group_id=group_id,
            email=email,
            invited_by=user.id,
        )
    )
    await db.commit()
    return {"ok": True, "auto_added": False}


@router.post("/{group_id}/invites/accept")
async def accept_invite(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if not user.email:
        raise HTTPException(status_code=400, detail="Authenticated user has no email")

    # Find pending invite
    inv_q = await db.execute(
        select(GroupInvite).where(
            GroupInvite.group_id == group_id,
            GroupInvite.email == user.email,
            GroupInvite.status == "pending",
        )
    )
    inv = inv_q.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="No pending invite found")

    # Check not already a member
    existing = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user.id,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(GroupMember(group_id=group_id, user_id=user.id, role="member"))

    inv.status = "accepted"
    inv.responded_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.post("/{group_id}/invites/decline")
async def decline_invite(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if not user.email:
        raise HTTPException(status_code=400, detail="Authenticated user has no email")
    inv_q = await db.execute(
        select(GroupInvite).where(
            GroupInvite.group_id == group_id,
            GroupInvite.email == user.email,
            GroupInvite.status == "pending",
        )
    )
    inv = inv_q.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="No pending invite found")
    inv.status = "declined"
    inv.responded_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.delete("/{group_id}/members/{target_user_id}")
async def remove_member(
    group_id: int,
    target_user_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    await _require_owner(db, group_id, user.id)
    if target_user_id == user.id:
        raise HTTPException(status_code=400, detail="Owner cannot remove themselves")

    result = await db.execute(
        delete(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == target_user_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"ok": True}


@router.post("/{group_id}/leave")
async def leave_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    membership = await _require_membership(db, group_id, user.id)
    if membership.role == "owner":
        raise HTTPException(
            status_code=400,
            detail="Owner must transfer ownership or delete the group",
        )
    await db.execute(
        delete(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user.id,
        )
    )
    await db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════════
# GROUP NOTES
# ════════════════════════════════════════════════════════════════════════


def _note_dict(n: GroupNote, author_email: str = "") -> dict:
    ref_parts = []
    if n.book:
        ref_parts.append(n.book)
        if n.chapter:
            ref_parts.append(str(n.chapter))
            if n.verse:
                ref_parts.append(f":{n.verse}")
    return {
        "id": n.id,
        "group_id": n.group_id,
        "author_id": n.author_id,
        "author_email": author_email,
        "book": n.book,
        "chapter": n.chapter,
        "verse": n.verse,
        "reference": " ".join(ref_parts) if ref_parts else None,
        "content": n.content,
        "tags": n.tags,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


@router.post("/{group_id}/notes")
async def create_group_note(
    group_id: int,
    body: GroupNoteCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    # Verify group exists + user is a member
    g = await db.execute(select(Group).where(Group.id == group_id))
    if not g.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")
    await _require_membership(db, group_id, user.id)

    note = GroupNote(
        group_id=group_id,
        author_id=user.id,
        book=body.book,
        chapter=body.chapter,
        verse=body.verse,
        content=body.content,
        tags=body.tags,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    email = user.email or ""
    return _note_dict(note, author_email=email)


@router.get("/{group_id}/notes")
async def list_group_notes(
    group_id: int,
    book: Optional[str] = None,
    chapter: Optional[int] = None,
    verse: Optional[int] = None,
    tag: Optional[str] = None,
    offset: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    await _require_membership(db, group_id, user.id)

    query = (
        select(GroupNote, User.email)
        .join(User, GroupNote.author_id == User.id)
        .where(GroupNote.group_id == group_id)
    )
    if book is not None:
        query = query.where(GroupNote.book == book)
    if chapter is not None:
        query = query.where(GroupNote.chapter == chapter)
    if verse is not None:
        query = query.where(GroupNote.verse == verse)
    if tag is not None:
        query = query.where(GroupNote.tags.ilike(f"%{tag}%"))
    query = query.order_by(GroupNote.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    return {
        "notes": [_note_dict(n, email) for n, email in result.all()],
        "offset": offset,
        "limit": limit,
    }


@router.put("/{group_id}/notes/{note_id}")
async def update_group_note(
    group_id: int,
    note_id: int,
    body: GroupNoteUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    membership = await _require_membership(db, group_id, user.id)

    note_q = await db.execute(
        select(GroupNote).where(
            GroupNote.id == note_id,
            GroupNote.group_id == group_id,
        )
    )
    note = note_q.scalar_one_or_none()
    if not note:
        # Try without group_id constraint in case of orphaned note
        note_q = await db.execute(select(GroupNote).where(GroupNote.id == note_id))
        note = note_q.scalar_one_or_none()
        if not note or note.group_id != group_id:
            raise HTTPException(status_code=404, detail="Note not found")

    if note.author_id != user.id and membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author or group owner can edit this note",
        )

    if body.content is not None:
        note.content = body.content
    if body.tags is not None:
        note.tags = body.tags
    note.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return _note_dict(note, author_email=user.email or "")


@router.delete("/{group_id}/notes/{note_id}")
async def delete_group_note(
    group_id: int,
    note_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    membership = await _require_membership(db, group_id, user.id)

    note_q = await db.execute(
        select(GroupNote).where(
            GroupNote.id == note_id,
            GroupNote.group_id == group_id,
        )
    )
    note = note_q.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if note.author_id != user.id and membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author or group owner can delete this note",
        )

    await db.execute(delete(GroupNote).where(GroupNote.id == note_id))
    await db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════════
# SHARING PERSONAL ITEMS
# ════════════════════════════════════════════════════════════════════════


@router.post("/{group_id}/share")
async def share_to_group(
    group_id: int,
    body: ShareCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    await _require_membership(db, group_id, user.id)

    # Verify ownership of the original item
    if body.item_type == "note":
        item_q = await db.execute(
            select(Note).where(
                Note.id == body.item_id,
                Note.user_id == user.id,
            )
        )
    elif body.item_type == "highlight":
        item_q = await db.execute(
            select(Highlight).where(
                Highlight.id == body.item_id,
                Highlight.user_id == user.id,
            )
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid item_type; must be 'note' or 'highlight'")

    item = item_q.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found or not owned by you")

    # Idempotency: skip if already shared
    existing = await db.execute(
        select(GroupSharedItem).where(
            GroupSharedItem.group_id == group_id,
            GroupSharedItem.item_type == body.item_type,
            GroupSharedItem.item_id == body.item_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already shared with this group")

    shared = GroupSharedItem(
        group_id=group_id,
        user_id=user.id,
        item_type=body.item_type,
        item_id=body.item_id,
        annotation=body.annotation,
    )
    db.add(shared)
    await db.commit()
    await db.refresh(shared)

    return {
        "id": shared.id,
        "group_id": shared.group_id,
        "user_id": shared.user_id,
        "item_type": shared.item_type,
        "item_id": shared.item_id,
        "annotation": shared.annotation,
        "shared_at": shared.shared_at.isoformat() if shared.shared_at else None,
    }


@router.delete("/{group_id}/share/{shared_item_id}")
async def unshare_from_group(
    group_id: int,
    shared_item_id: int,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    membership = await _require_membership(db, group_id, user.id)

    shared_q = await db.execute(
        select(GroupSharedItem).where(
            GroupSharedItem.id == shared_item_id,
            GroupSharedItem.group_id == group_id,
        )
    )
    shared = shared_q.scalar_one_or_none()
    if not shared:
        raise HTTPException(status_code=404, detail="Shared item not found")

    if shared.user_id != user.id and membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the sharer or group owner can remove this",
        )

    await db.execute(delete(GroupSharedItem).where(GroupSharedItem.id == shared_item_id))
    await db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════════
# GROUP FEED
# ════════════════════════════════════════════════════════════════════════


@router.get("/{group_id}/feed")
async def get_group_feed(
    group_id: int,
    offset: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    await _require_membership(db, group_id, user.id)

    # Fetch group notes
    gn_q = await db.execute(
        select(GroupNote, User.email)
        .join(User, GroupNote.author_id == User.id)
        .where(GroupNote.group_id == group_id)
        .order_by(GroupNote.created_at.desc())
        .limit(limit + offset)
    )
    gn_rows = gn_q.all()

    # Fetch shared items with original content
    gsi_q = await db.execute(
        select(GroupSharedItem, User.email)
        .join(User, GroupSharedItem.user_id == User.id)
        .where(GroupSharedItem.group_id == group_id)
        .order_by(GroupSharedItem.shared_at.desc())
        .limit(limit + offset)
    )
    gsi_rows = gsi_q.all()

    # Build feed items
    items = []

    for gn, author_email in gn_rows:
        items.append({
            "feed_type": "group_note",
            "id": gn.id,
            "group_id": gn.group_id,
            "author_id": gn.author_id,
            "author_email": author_email,
            "book": gn.book,
            "chapter": gn.chapter,
            "verse": gn.verse,
            "reference": " ".join(
                p
                for p in [
                    gn.book,
                    str(gn.chapter) if gn.chapter else None,
                    f":{gn.verse}" if gn.verse else None,
                ]
                if p
            ) or None,
            "content": gn.content,
            "tags": gn.tags,
            "sort_key": gn.created_at.isoformat() if gn.created_at else "",
        })

    # Batch-fetch all referenced notes and highlights to avoid N+1 queries.
    note_ids = [gsi.item_id for gsi, _ in gsi_rows if gsi.item_type == "note"]
    hl_ids = [gsi.item_id for gsi, _ in gsi_rows if gsi.item_type == "highlight"]

    notes_map: dict[int, Note] = {}
    if note_ids:
        r = await db.execute(select(Note).where(Note.id.in_(note_ids)))
        notes_map = {n.id: n for n in r.scalars().all()}

    hl_map: dict[int, Highlight] = {}
    if hl_ids:
        r = await db.execute(select(Highlight).where(Highlight.id.in_(hl_ids)))
        hl_map = {h.id: h for h in r.scalars().all()}

    for gsi, sharer_email in gsi_rows:
        entry = {
            "feed_type": f"shared_{gsi.item_type}",
            "id": gsi.id,
            "group_id": gsi.group_id,
            "sharer_id": gsi.user_id,
            "sharer_email": sharer_email,
            "item_type": gsi.item_type,
            "item_id": gsi.item_id,
            "annotation": gsi.annotation,
            "sort_key": gsi.shared_at.isoformat() if gsi.shared_at else "",
        }
        if gsi.item_type == "note":
            orig = notes_map.get(gsi.item_id)
            if orig:
                ref_parts = [orig.book, str(orig.chapter)]
                if orig.verse:
                    ref_parts.append(f":{orig.verse}")
                entry["reference"] = " ".join(ref_parts)
                entry["content"] = orig.content
                entry["book"] = orig.book
                entry["chapter"] = orig.chapter
                entry["verse"] = orig.verse
                entry["tags"] = orig.tags
        elif gsi.item_type == "highlight":
            orig = hl_map.get(gsi.item_id)
            if orig:
                ref_parts = [orig.book, str(orig.chapter)]
                if orig.verse:
                    ref_parts.append(f":{orig.verse}")
                entry["reference"] = " ".join(ref_parts)
                entry["highlight_color"] = orig.color
                entry["book"] = orig.book
                entry["chapter"] = orig.chapter
                entry["verse"] = orig.verse
        items.append(entry)

    # Sort by sort_key desc, paginate
    items.sort(key=lambda x: x.get("sort_key", ""), reverse=True)
    items = items[offset : offset + limit]

    # Remove sort_key from response
    for item in items:
        item.pop("sort_key", None)

    return {"feed": items, "offset": offset, "limit": limit}
