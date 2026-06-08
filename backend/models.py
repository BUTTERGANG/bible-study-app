from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class SharedSession(Base):
    """A shareable read-only permalink to a study session (passage + notes + AI conversation)."""
    __tablename__ = "shared_sessions"
    __table_args__ = (
        Index("ix_shared_sessions_token", "share_token"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    share_token: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    book: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    chapter: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    note_ids: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of note IDs
    ai_conversation_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ai_conversations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    translation: Mapped[str] = mapped_column(String(10), default="KJV")
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Groups ──────────────────────────────────────────────────────────────

class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True, default="")
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invite_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_member"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(10), default="member")  # "owner" | "member"
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class GroupInvite(Base):
    __tablename__ = "group_invites"
    __table_args__ = (
        UniqueConstraint("group_id", "email", name="uq_group_invite"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(254), nullable=False, index=True)
    invited_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(10), default="pending")
    # pending | accepted | declined | cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    responded_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class GroupNote(Base):
    __tablename__ = "group_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("group_notes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    book: Mapped[str] = mapped_column(String(50), nullable=True, index=True)
    chapter: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    verse: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GroupSharedItem(Base):
    """A link from a user's personal note/highlight into a group feed."""
    __tablename__ = "group_shared_items"
    __table_args__ = (
        UniqueConstraint("group_id", "item_type", "item_id", name="uq_group_shared_item"),
        Index("ix_gsi_group_id", "group_id"),
        Index("ix_gsi_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_type: Mapped[str] = mapped_column(String(20), nullable=False)
    item_id: Mapped[int] = mapped_column(Integer, nullable=False)
    shared_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    annotation: Mapped[str] = mapped_column(String(500), nullable=True)


class BibleVerse(Base):
    __tablename__ = "bible_verses"
    __table_args__ = (
        Index("ix_bible_verses_lookup", "translation", "book", "chapter", "verse"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    translation: Mapped[str] = mapped_column(String(10), index=True)
    book: Mapped[str] = mapped_column(String(50), index=True)
    book_num: Mapped[int] = mapped_column(Integer, index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, index=True)
    text: Mapped[str] = mapped_column(Text)


class CommentaryEntry(Base):
    __tablename__ = "commentary_entries"
    __table_args__ = (
        Index("ix_commentary_lookup", "book", "chapter", "verse_start"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(50), index=True)
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse_start: Mapped[int] = mapped_column(Integer, index=True)
    verse_end: Mapped[int] = mapped_column(Integer, nullable=True)
    text: Mapped[str] = mapped_column(Text)


class LexiconEntry(Base):
    __tablename__ = "lexicon_entries"
    __table_args__ = (
        UniqueConstraint("source", "strongs_num", name="uq_lexicon_strongs_source"),
        Index("ix_lexicon_strongs_source", "strongs_num", "source"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(30), index=True)
    strongs_num: Mapped[str] = mapped_column(String(10), index=True)
    original_word: Mapped[str] = mapped_column(String(100))
    transliteration: Mapped[str] = mapped_column(String(100), nullable=True)
    pronunciation: Mapped[str] = mapped_column(String(100), nullable=True)
    definition: Mapped[str] = mapped_column(Text)
    usage: Mapped[str] = mapped_column(Text, nullable=True)


class GreekWord(Base):
    __tablename__ = "greek_words"
    __table_args__ = (
        Index("ix_greek_words_lookup", "book", "chapter", "verse"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, index=True)
    word_position: Mapped[int] = mapped_column(Integer)
    greek: Mapped[str] = mapped_column(String(100))
    transliteration: Mapped[str] = mapped_column(String(100), nullable=True)
    morphology: Mapped[str] = mapped_column(String(50), nullable=True)
    strongs_num: Mapped[str] = mapped_column(String(10), index=True, nullable=True)
    english_gloss: Mapped[str] = mapped_column(String(200), nullable=True)


class HebrewWord(Base):
    __tablename__ = "hebrew_words"
    __table_args__ = (
        Index("ix_hebrew_words_lookup", "book", "chapter", "verse"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, index=True)
    word_position: Mapped[int] = mapped_column(Integer)
    hebrew: Mapped[str] = mapped_column(String(100))
    transliteration: Mapped[str] = mapped_column(String(100), nullable=True)
    morphology: Mapped[str] = mapped_column(String(50), nullable=True)
    strongs_num: Mapped[str] = mapped_column(String(10), index=True, nullable=True)
    english_gloss: Mapped[str] = mapped_column(String(200), nullable=True)


class DictionaryEntry(Base):
    __tablename__ = "dictionary_entries"
    __table_args__ = (
        UniqueConstraint("source", "term", name="uq_dictionary_source_term"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(30), index=True)
    term: Mapped[str] = mapped_column(String(200), index=True)
    text: Mapped[str] = mapped_column(Text)


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        Index("ix_note_user_book_chapter", "user_id", "book", "chapter"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True)
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    content: Mapped[str] = mapped_column(Text)
    tags: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Highlight(Base):
    __tablename__ = "highlights"
    __table_args__ = (
        UniqueConstraint("user_id", "translation", "book", "chapter", "verse", name="uq_highlight_verse"),
        Index("ix_highlight_user_book_chapter", "user_id", "book", "chapter"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True)
    translation: Mapped[str] = mapped_column(String(10))
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, index=True)
    color: Mapped[str] = mapped_column(String(20), default="yellow")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True)
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, nullable=True)
    note: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReadingPlan(Base):
    __tablename__ = "reading_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, nullable=True)
    start_date: Mapped[str] = mapped_column(String(10), nullable=True)
    plan_type: Mapped[str] = mapped_column(String(20), default="built-in", index=True)
    # built-in, ai-generated, custom
    goal: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    days: Mapped[list["ReadingPlanDay"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    progress: Mapped[list["ReadingPlanProgress"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )


class ReadingPlanDay(Base):
    """One row per (plan, date, reference). Replaces the old schedule_json blob."""
    __tablename__ = "reading_plan_days"
    __table_args__ = (
        UniqueConstraint("plan_id", "date", "reference", name="uq_plan_day_ref"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("reading_plans.id", ondelete="CASCADE"), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)
    reference: Mapped[str] = mapped_column(String(100))
    day_label: Mapped[str] = mapped_column(String(50), nullable=True)
    # e.g. "Day 1", "Week 1 - Mon" — optional display label
    description: Mapped[str] = mapped_column(Text, nullable=True)
    # AI-generated description for this day's reading
    plan: Mapped["ReadingPlan"] = relationship(back_populates="days")


class ReadingPlanProgress(Base):
    __tablename__ = "reading_plan_progress"
    __table_args__ = (
        UniqueConstraint("plan_id", "date", "reference", name="uq_progress_entry"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("reading_plans.id", ondelete="CASCADE"), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)
    reference: Mapped[str] = mapped_column(String(100))
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    plan: Mapped["ReadingPlan"] = relationship(back_populates="progress")


class LibraryBook(Base):
    __tablename__ = "library_books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    author: Mapped[str] = mapped_column(String(200), nullable=True)
    category: Mapped[str] = mapped_column(String(50), index=True)
    source_format: Mapped[str] = mapped_column(String(20))
    source_path: Mapped[str] = mapped_column(String(500))
    page_count: Mapped[int] = mapped_column(Integer, nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LibraryPage(Base):
    """Pre-extracted PDF page text — removes runtime PyMuPDF dependency."""
    __tablename__ = "library_pages"
    __table_args__ = (
        UniqueConstraint("book_id", "page_num", name="uq_library_page"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("library_books.id", ondelete="CASCADE"), index=True)
    page_num: Mapped[int] = mapped_column(Integer, index=True)
    text: Mapped[str] = mapped_column(Text)


class FactbookEntry(Base):
    """AI-generated encyclopedia entries for biblical people, places, themes, and events."""
    __tablename__ = "factbook_entries"
    __table_args__ = (
        UniqueConstraint("entity_name", "entity_type", name="uq_factbook_entity"),
        Index("ix_factbook_name", "entity_name"),
        Index("ix_factbook_type", "entity_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    entity_name: Mapped[str] = mapped_column(String(200), index=True)
    entity_type: Mapped[str] = mapped_column(String(20), index=True)  # person, place, theme, event
    content: Mapped[str] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TimelineEvent(Base):
    """A major biblical event with approximate date and verse references."""
    __tablename__ = "timeline_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_name: Mapped[str] = mapped_column(String(200), index=True)
    date_approx: Mapped[str] = mapped_column(String(50))   # e.g. "~1446 BC"
    date_sort: Mapped[int] = mapped_column(Integer, index=True)  # negative = BC
    description: Mapped[str] = mapped_column(Text)
    verse_refs: Mapped[str] = mapped_column(String(500), nullable=True)  # comma-separated
    category: Mapped[str] = mapped_column(String(50), index=True)
    # creation, patriarchs, exodus, conquest, judges, monarchy, exile, restoration,
    # intertestamental, gospels, acts, epistles, revelation


class BiblicalPlace(Base):
    """A geographical location mentioned in the Bible."""
    __tablename__ = "biblical_places"
    __table_args__ = (
        Index("ix_biblical_places_name", "place_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    place_name: Mapped[str] = mapped_column(String(200), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    verse_refs: Mapped[str] = mapped_column(String(500), nullable=True)
    place_type: Mapped[str] = mapped_column(String(50), nullable=True)
    # city, region, mountain, river, sea, wilderness, country


class JourneyRoute(Base):
    """A named journey or travel route from the Bible."""
    __tablename__ = "journey_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    route_name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    coordinates: Mapped[str] = mapped_column(Text)  # JSON array of [lat, lng] pairs
    verse_refs: Mapped[str] = mapped_column(String(500), nullable=True)
    color: Mapped[str] = mapped_column(String(20), default="#3b82f6")  # tailwind blue-500


class AiConversation(Base):
    """Persisted AI conversation history keyed by reference (book/chapter).
    Each message is stored as a JSON blob so we preserve the full message
    structure (role, content, metadata like verse selections) without schema
    churn for every new AI feature."""

    __tablename__ = "ai_conversations"
    __table_args__ = (
        UniqueConstraint("user_id", "reference", name="uq_ai_conv_ref"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True)
    reference: Mapped[str] = mapped_column(String(100), index=True)
    # e.g. "KJV/John/3" — matches the aiHistory key in the frontend store
    translation: Mapped[str] = mapped_column(String(10), default="KJV")
    book: Mapped[str] = mapped_column(String(50))
    chapter: Mapped[int] = mapped_column(Integer)
    messages: Mapped[str] = mapped_column(Text)  # JSON array of {role, content}
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(200), nullable=True)
    # Auto-generated title like "Main theme of John 3" or first prompt
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SermonProject(Base):
    __tablename__ = "sermon_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True)
    title: Mapped[str] = mapped_column(String(200))
    passage_ref: Mapped[str] = mapped_column(String(100))
    audience: Mapped[str] = mapped_column(String(50), default="general")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    sections: Mapped[list["SermonSection"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class SermonSection(Base):
    __tablename__ = "sermon_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("sermon_projects.id", ondelete="CASCADE"), index=True)
    section_type: Mapped[str] = mapped_column(String(30), index=True)
    # outline | illustrations | questions | applications | full_sermon
    content: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project: Mapped["SermonProject"] = relationship(back_populates="sections")


class NtOtConnection(Base):
    """Curated OT-NT connections: quotations, allusions, verbal parallels, thematic echoes."""
    __tablename__ = "nt_ot_connections"
    __table_args__ = (
        Index("ix_nt_ot_nt_ref", "nt_book", "nt_chapter", "nt_verse"),
        Index("ix_nt_ot_ot_ref", "ot_book", "ot_chapter", "ot_verse"),
        Index("ix_nt_ot_type", "connection_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # NT side
    nt_book: Mapped[str] = mapped_column(String(50), index=True)
    nt_chapter: Mapped[int] = mapped_column(Integer)
    nt_verse: Mapped[int] = mapped_column(Integer)
    # OT side
    ot_book: Mapped[str] = mapped_column(String(50), index=True)
    ot_chapter: Mapped[int] = mapped_column(Integer)
    ot_verse: Mapped[int] = mapped_column(Integer)
    # Connection metadata
    connection_type: Mapped[str] = mapped_column(String(30), index=True)
    # direct_quotation, allusion, verbal_parallel, thematic_echo, midrash, typology
    confidence: Mapped[str] = mapped_column(String(10), default="curated")
    # curated, high, medium, low (curated = from known datasets; rest = AI-generated)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    ot_context: Mapped[str] = mapped_column(Text, nullable=True)  # surrounding OT verses
    nt_context: Mapped[str] = mapped_column(Text, nullable=True)  # surrounding NT verses


class MemoryVerse(Base):
    __tablename__ = "memory_verses"
    __table_args__ = (
        UniqueConstraint("user_id", "translation", "book", "chapter", "verse", name="uq_memory_verse"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True)
    translation: Mapped[str] = mapped_column(String(10), default="KJV")
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, index=True)
    verse_text: Mapped[str] = mapped_column(Text)
    # quiz state: 0=not started, 1=learning, 2=familiar, 3=mastered
    mastery_level: Mapped[int] = mapped_column(Integer, default=0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    last_reviewed: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PrayerEntry(Base):
    __tablename__ = "prayer_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    # linked verse (optional)
    book: Mapped[str] = mapped_column(String(50), nullable=True, index=True)
    chapter: Mapped[int] = mapped_column(Integer, nullable=True)
    verse: Mapped[int] = mapped_column(Integer, nullable=True)
    # status: active, answered, archived
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=True)
    answered_note: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StudyProject(Base):
    __tablename__ = "study_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True)
    title: Mapped[str] = mapped_column(String(200))
    passage_ref: Mapped[str] = mapped_column(String(100))
    study_type: Mapped[str] = mapped_column(String(30), default="inductive")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    sections: Mapped[list["StudySection"]] = relationship("StudySection", back_populates="project", cascade="all, delete-orphan")


class StudySection(Base):
    __tablename__ = "study_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("study_projects.id", ondelete="CASCADE"), index=True)
    section_type: Mapped[str] = mapped_column(String(30))
    content: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project: Mapped["StudyProject"] = relationship("StudyProject", back_populates="sections")


class DailyDevotion(Base):
    __tablename__ = "daily_devotions"
    __table_args__ = (
        UniqueConstraint("verse_ref", "date", name="uq_devotion_verse_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    verse_ref: Mapped[str] = mapped_column(String(100), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)
    reflection: Mapped[str] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BookIntroduction(Base):
    __tablename__ = "book_introductions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    book_name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    content_json: Mapped[str] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CulturalNote(Base):
    """AI-generated cultural/historical background notes per verse, cached in DB."""
    __tablename__ = "cultural_notes"
    __table_args__ = (
        UniqueConstraint("book", "chapter", "verse", name="uq_cultural_note_verse"),
        Index("ix_cultural_notes_lookup", "book", "chapter", "verse"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, index=True)
    content: Mapped[str] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MediaFile(Base):
    """Uploaded media file (images, attachments) scoped to a user."""
    __tablename__ = "media_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True)
    note_id: Mapped[int] = mapped_column(Integer, ForeignKey("notes.id", ondelete="SET NULL"), nullable=True, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    storage_path: Mapped[str] = mapped_column(String(500))
    caption: Mapped[str] = mapped_column(String(500), nullable=True)
    width: Mapped[int] = mapped_column(Integer, nullable=True)
    height: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DoctrineEntry(Base):
    """AI-generated doctrinal topic index entry."""
    __tablename__ = "doctrine_entries"
    __table_args__ = (
        UniqueConstraint("name", name="uq_doctrine_name"),
        Index("ix_doctrine_name", "name"),
        Index("ix_doctrine_category", "category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    category: Mapped[str] = mapped_column(String(50), index=True)  # see DOCTRINE_CATEGORIES
    content: Mapped[str] = mapped_column(Text)  # JSON: {definition, key_verses, summary, positions}
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VocabMastery(Base):
    """Per-user mastery tracking for Greek/Hebrew vocabulary words."""
    __tablename__ = "vocab_mastery"
    __table_args__ = (
        UniqueConstraint("user_id", "strongs_num", "language", name="uq_vocab_mastery"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True)
    strongs_num: Mapped[str] = mapped_column(String(10), index=True)
    language: Mapped[str] = mapped_column(String(10))  # "greek" | "hebrew"
    # 0=not started, 1=learning, 2=familiar, 3=mastered
    mastery_level: Mapped[int] = mapped_column(Integer, default=0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    last_reviewed: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class InlineAnnotation(Base):
    """Word/phrase-level annotations anchored within a verse (marginalia style)."""
    __tablename__ = "inline_annotations"
    __table_args__ = (
        Index("ix_inline_annotations_lookup", "user_id", "book", "chapter", "verse"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True
    )
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, index=True)
    word_start: Mapped[int] = mapped_column(Integer)   # 0-based token index (inclusive)
    word_end: Mapped[int] = mapped_column(Integer)     # 0-based token index (inclusive)
    content: Mapped[str] = mapped_column(Text)
    color: Mapped[str] = mapped_column(String(20), default="yellow")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class LibrarySummary(Base):
    """Cached AI-generated summaries for library books."""
    __tablename__ = "library_summaries"
    __table_args__ = (
        UniqueConstraint("book_id", "chunk_size", name="uq_library_summary"),
        Index("ix_library_summaries_book_id", "book_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("library_books.id", ondelete="CASCADE"))
    chunk_size: Mapped[int] = mapped_column(Integer, default=0)
    tldr: Mapped[str] = mapped_column(Text, default="")
    key_points: Mapped[str] = mapped_column(Text, default="")  # JSON array of strings
    outline: Mapped[str] = mapped_column(Text, default="")  # markdown outline
    page_start: Mapped[int] = mapped_column(Integer, default=0)
    page_end: Mapped[int] = mapped_column(Integer, default=0)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Sermon Series ────────────────────────────────────────────────

class SermonSeries(Base):
    """A multi-sermon preaching series spanning a date range."""
    __tablename__ = "sermon_series"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), default=0, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    theme: Mapped[str] = mapped_column(String(500), nullable=True)
    start_date: Mapped[str] = mapped_column(String(10), nullable=False)   # ISO date e.g. "2026-09-07"
    end_date: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    entries: Mapped[list["SermonSeriesEntry"]] = relationship(
        back_populates="series", cascade="all, delete-orphan", order_by="SermonSeriesEntry.scheduled_date"
    )


class SermonSeriesEntry(Base):
    """One slot in a sermon series: a date + optional assigned sermon + status."""
    __tablename__ = "sermon_series_entries"
    __table_args__ = (
        Index("ix_series_entries_series_id", "series_id"),
        Index("ix_series_entries_sermon_id", "sermon_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    series_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sermon_series.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sermon_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sermon_projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    scheduled_date: Mapped[str] = mapped_column(String(10), nullable=False)  # ISO date
    # planned | drafted | preached
    status: Mapped[str] = mapped_column(String(20), default="planned", nullable=False)
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    series: Mapped["SermonSeries"] = relationship(back_populates="entries")
    sermon: Mapped["SermonProject"] = relationship()


# ── Textual Criticism ────────────────────────────────────────────────────

class TextualVariant(Base):
    """A textual variant or disputed passage in the NT/OT manuscript tradition."""
    __tablename__ = "textual_variants"
    __table_args__ = (
        Index("ix_tv_lookup", "book", "chapter_start", "verse_start"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    book: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    chapter_start: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    verse_start: Mapped[int] = mapped_column(Integer, nullable=False)
    chapter_end: Mapped[int] = mapped_column(Integer, nullable=False)
    verse_end: Mapped[int] = mapped_column(Integer, nullable=False)
    short_title: Mapped[str] = mapped_column(String(200), nullable=False)
    manuscript_support: Mapped[str] = mapped_column(Text, nullable=False)
    # critical | high | medium
    significance: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    external_ref: Mapped[str] = mapped_column(String(300), nullable=True)


class TextualNote(Base):
    """Cached AI-generated textual criticism summaries for disputed biblical passages."""
    __tablename__ = "textual_notes"
    __table_args__ = (
        Index("ix_textual_notes_passage_key", "passage_key", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    passage_key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # JSON blob
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CounselingGuide(Base):
    """AI-generated pastoral counseling guides organized by life issue."""
    __tablename__ = "counseling_guides"
    __table_args__ = (
        UniqueConstraint("name", name="uq_counseling_name"),
        Index("ix_counseling_name", "name"),
        Index("ix_counseling_category", "category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    category: Mapped[str] = mapped_column(String(50), index=True)
    content: Mapped[str] = mapped_column(Text)  # JSON blob
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Reading Streaks & Badges ────────────────────────────────────────────────

class ReadingStreak(Base):
    """Per-user reading streak tracking — consecutive daily completions."""
    __tablename__ = "reading_streaks"
    __table_args__ = (
        Index("ix_streak_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_completed_date: Mapped[str | None] = mapped_column(String(10), nullable=True)  # YYYY-MM-DD
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StreakBadge(Base):
    """Milestone badges earned by a user (7, 30, 100, 365 days)."""
    __tablename__ = "streak_badges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    milestone: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g. 7, 30, 100, 365
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Community Tags ─────────────────────────────────────────────────────────

class PassageTag(Base):
    """Community tags attached to passages or library resources."""
    __tablename__ = "passage_tags"
    __table_args__ = (
        Index("ix_passage_tag_ref", "book", "chapter"),
        Index("ix_passage_tag_text", "tag_text"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    book: Mapped[str] = mapped_column(String(50), nullable=True, index=True)
    chapter: Mapped[int] = mapped_column(Integer, nullable=True)
    verse: Mapped[int] = mapped_column(Integer, nullable=True)
    resource_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)  # library item
    tag_text: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    upvotes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TagUpvote(Base):
    """Track which users upvoted which tags (one upvote per user per tag)."""
    __tablename__ = "tag_upvotes"
    __table_args__ = (
        UniqueConstraint("user_id", "tag_id", name="uq_tag_upvote"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("passage_tags.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)