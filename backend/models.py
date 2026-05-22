from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(30), index=True)
    term: Mapped[str] = mapped_column(String(200), index=True)
    text: Mapped[str] = mapped_column(Text)


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=0, index=True)
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
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=0, index=True)
    translation: Mapped[str] = mapped_column(String(10))
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, index=True)
    color: Mapped[str] = mapped_column(String(20), default="yellow")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=0, index=True)
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, nullable=True)
    note: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReadingPlan(Base):
    __tablename__ = "reading_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=0, index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, nullable=True)
    start_date: Mapped[str] = mapped_column(String(10), nullable=True)
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
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("reading_plans.id"), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)
    reference: Mapped[str] = mapped_column(String(100))
    plan: Mapped["ReadingPlan"] = relationship(back_populates="days")


class ReadingPlanProgress(Base):
    __tablename__ = "reading_plan_progress"
    __table_args__ = (
        UniqueConstraint("plan_id", "date", "reference", name="uq_progress_entry"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("reading_plans.id"), index=True)
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
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("library_books.id"), index=True)
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
    __table_args__ = (
        Index("ix_timeline_events_category", "category"),
        Index("ix_timeline_events_date_sort", "date_sort"),
    )

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
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=0, index=True)
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
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=0, index=True)
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
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("sermon_projects.id"), index=True)
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
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=0, index=True)
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
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=0, index=True)
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
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=0, index=True)
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
