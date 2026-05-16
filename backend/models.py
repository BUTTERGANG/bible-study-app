from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class BibleVerse(Base):
    __tablename__ = "bible_verses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    translation: Mapped[str] = mapped_column(String(10), index=True)
    book: Mapped[str] = mapped_column(String(50), index=True)
    book_num: Mapped[int] = mapped_column(Integer, index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, index=True)
    text: Mapped[str] = mapped_column(Text)


class CommentaryEntry(Base):
    __tablename__ = "commentary_entries"

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
        UniqueConstraint("translation", "book", "chapter", "verse", name="uq_highlight_verse"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    translation: Mapped[str] = mapped_column(String(10))
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, index=True)
    color: Mapped[str] = mapped_column(String(20), default="yellow")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    book: Mapped[str] = mapped_column(String(50), index=True)
    chapter: Mapped[int] = mapped_column(Integer, index=True)
    verse: Mapped[int] = mapped_column(Integer, nullable=True)
    note: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReadingPlan(Base):
    __tablename__ = "reading_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
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
