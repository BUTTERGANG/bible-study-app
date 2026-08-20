import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Compass, ChevronRight, Eye, Grid3X3, List, Search as SearchIcon, X } from 'lucide-react';
import { useStudyStore } from '../../stores/studyStore';
import { OT_BOOKS, NT_BOOKS } from '../../api/bibleData';
import { api } from '../../api/client';
import { resolveBook } from '../../utils/bibleSearch';
import clsx from 'clsx';

const TESTAMENTS = [
  { id: 'all', label: 'All', books: [...OT_BOOKS, ...NT_BOOKS] },
  { id: 'OT', label: 'Old Testament', books: OT_BOOKS },
  { id: 'NT', label: 'New Testament', books: NT_BOOKS },
];

const BOOK_GROUPS = [
  { id: 'pentateuch', label: 'Pentateuch', books: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'] },
  { id: 'history', label: 'History', books: ['Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther'] },
  { id: 'wisdom', label: 'Wisdom', books: ['Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon'] },
  { id: 'prophets', label: 'Prophets', books: ['Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'] },
  { id: 'gospels', label: 'Gospels', books: ['Matthew', 'Mark', 'Luke', 'John'] },
  { id: 'acts', label: 'Acts', books: ['Acts'] },
  { id: 'paul', label: 'Paul\'s Letters', books: ['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon'] },
  { id: 'general', label: 'General Letters', books: ['Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude'] },
  { id: 'revelation', label: 'Revelation', books: ['Revelation'] },
];

// ── Book Grid Card ────────────────────────────────────────────────
function BookCard({ book, view, isRecent, readingProgress, onSelect, isActive, isFocused }) {
  const progressPercent = readingProgress != null ? Math.round(readingProgress * 100) : null;
  const isCompact = view === 'list';

  return (
    <button
      onClick={() => onSelect(book)}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`${book.name}${isActive ? ' (selected)' : ''}`}
      className={clsx(
        'text-left transition-all rounded-lg border group',
        isCompact ? 'flex items-center gap-3 px-3 py-2.5' : 'flex flex-col p-3',
        isActive
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400'
          : isFocused
          ? 'border-purple-400 dark:border-purple-500 ring-1 ring-purple-300 dark:ring-purple-600 bg-purple-50 dark:bg-purple-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm bg-white dark:bg-gray-800',
      )}
    >
      <div className={clsx(isCompact ? 'flex items-center gap-3 flex-1 min-w-0' : 'flex items-center justify-between w-full')}>
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen size={isCompact ? 14 : 16} className={clsx(
            'flex-shrink-0',
            isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400'
          )} />
          <div className="min-w-0">
            <p className={clsx(
              'font-medium truncate',
              isCompact ? 'text-sm' : 'text-sm',
              isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-100'
            )}>
              {book.name}
            </p>
            {!isCompact && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                {book.chapters} chapter{book.chapters !== 1 ? 's' : ''}
              </p>
            )}
            {isCompact && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {book.chapters} ch · {book.testament}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isRecent && (
            <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">
              Recent
            </span>
          )}
          {progressPercent !== null && progressPercent > 0 && (
            <span className={clsx(
              'text-[10px] font-medium',
              progressPercent >= 80 ? 'text-green-600 dark:text-green-400' :
              progressPercent >= 40 ? 'text-amber-600 dark:text-amber-400' :
              'text-gray-400 dark:text-gray-500'
            )}>
              {progressPercent}%
            </span>
          )}
          <ChevronRight size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors" />
        </div>
      </div>
      {/* Progress bar for grid view */}
      {!isCompact && progressPercent !== null && (
        <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all',
              progressPercent >= 80 ? 'bg-green-500' :
              progressPercent >= 40 ? 'bg-amber-500' :
              'bg-blue-400'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </button>
  );
}

// ── Chapter Picker Panel ─────────────────────────────────────────
function ChapterPicker({ book, onClose, onNavigate }) {
  const { translation } = useStudyStore();
  const [previewChapter, setPreviewChapter] = useState(null);
  const [jumpToVerse, setJumpToVerse] = useState('');

  // Fetch preview for selected chapter
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['browse-preview', translation, book.name, previewChapter],
    queryFn: () => api.getChapter(translation, book.name, previewChapter),
    enabled: !!previewChapter,
  });

  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1);

  function handleVerseJump(e) {
    e.preventDefault();
    const v = parseInt(jumpToVerse, 10);
    if (v >= 1 && v <= (previewData?.verses?.length || 999)) {
      onNavigate(book.name, previewChapter, v);
      setJumpToVerse('');
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <button onClick={onClose} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <X size={12} /> Close
        </button>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{book.name}</span>
        <span className="text-[10px] text-gray-400">{book.chapters} chapters</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chapter grid */}
        <div className="w-48 flex-shrink-0 border-r border-gray-100 dark:border-gray-700 overflow-y-auto p-2">
          <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-1">Chapters</p>
          <div className="grid grid-cols-5 gap-0.5">
            {chapters.map((ch) => (
              <button
                key={ch}
                onClick={() => setPreviewChapter(ch)}
                className={clsx(
                  'text-xs py-1.5 rounded text-center transition-colors',
                  previewChapter === ch
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                )}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Preview pane */}
        <div className="flex-1 overflow-y-auto">
          {previewChapter && previewData ? (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {book.name} {previewChapter}
                </p>
                <div className="flex items-center gap-2">
                  <form onSubmit={handleVerseJump} className="flex items-center gap-1">
                    <input
                      type="number"
                      value={jumpToVerse}
                      onChange={(e) => setJumpToVerse(e.target.value)}
                      placeholder="v"
                      min={1}
                      className="w-10 text-center text-[10px] border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400"
                    />
                    <button
                      type="submit"
                      className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded hover:bg-blue-700"
                    >
                      Go
                    </button>
                  </form>
                  <button
                    onClick={() => onNavigate(book.name, previewChapter)}
                    className="flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Eye size={9} /> Read
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed space-y-1">
                {previewData.verses.slice(0, 10).map(({ verse, text }) => (
                  <p key={verse} className="leading-snug">
                    <sup className="text-[9px] text-blue-500 dark:text-blue-400 font-semibold mr-0.5">{verse}</sup>
                    {text}
                  </p>
                ))}
                {previewData.verses.length > 10 && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-1">
                    +{previewData.verses.length - 10} more verses…
                  </p>
                )}
              </div>
            </div>
          ) : previewLoading ? (
            <div className="p-6 text-center">
              <div className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-gray-400">Loading preview…</p>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-400 dark:text-gray-500">
              <Eye size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">Select a chapter to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Bible Browser ───────────────────────────────────────────
export default function BibleBrowser() {
  const { setReference, translation } = useStudyStore();
  const navigate = useNavigate();
  const [testament, setTestament] = useState('all');
  const [view, setView] = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [focusedBookIdx, setFocusedBookIdx] = useState(-1);
  const [recentBooks, setRecentBooks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('browse-recent') || '[]');
    } catch {
      return [];
    }
  });

  // Filter books based on testament + search (fuzzy-aware)
  const filteredBooks = useMemo(() => {
    const base = TESTAMENTS.find((t) => t.id === testament)?.books || [];
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();

    // First try exact substring match (fast path)
    const exactMatches = base.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.testament.toLowerCase().includes(q)
    );
    if (exactMatches.length > 0) return exactMatches;

    // Fall back to fuzzy book resolution via resolveBook
    const resolved = resolveBook(q);
    if (resolved) {
      const canonicalName = resolved.book.name;
      const fuzzyMatch = base.find((b) => b.name === canonicalName);
      if (fuzzyMatch) return [fuzzyMatch];
    }

    return [];
  }, [testament, searchQuery]);

  // Group books by category when showing all/OT
  const groupedBooks = useMemo(() => {
    if (testament === 'NT') {
      // For NT, show groups
      const groups = [];
      for (const group of BOOK_GROUPS) {
        if (group.id === 'pentateuch' || group.id === 'history' || group.id === 'wisdom' || group.id === 'prophets') continue;
        const groupBooks = group.books
          .map((name) => NT_BOOKS.find((b) => b.name === name))
          .filter(Boolean);
        if (groupBooks.length > 0) groups.push({ ...group, books: groupBooks });
      }
      return groups;
    }
    // For all/OT, use groups
    const relevantGroups = testament === 'OT'
      ? BOOK_GROUPS.filter((g) => ['pentateuch', 'history', 'wisdom', 'prophets'].includes(g.id))
      : BOOK_GROUPS;
    return relevantGroups
      .map((group) => ({
        ...group,
        books: group.books
          .map((name) => filteredBooks.find((b) => b.name === name))
          .filter(Boolean),
      }))
      .filter((group) => group.books.length > 0);
  }, [testament, filteredBooks]);

  // Track recently visited books
  const trackRecent = useCallback((book) => {
    setRecentBooks((prev) => {
      const updated = [book.name, ...prev.filter((n) => n !== book.name)].slice(0, 10);
      try {
        localStorage.setItem('browse-recent', JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
  }, []);

  // Navigate to reader — sets reference then routes back to main layout
  const navigateToBook = useCallback((book, chapter = 1, verse = null) => {
    trackRecent(book);
    setReference(book.name, chapter, verse);
    setSelectedBook(null);
    navigate('/read');
  }, [setReference, trackRecent, navigate]);

  // Reset selected book and focus when testament changes
  useEffect(() => {
    setSelectedBook(null);
    setFocusedBookIdx(-1);
  }, [testament]);

  // Keyboard navigation for the book grid
  const flatBooks = useMemo(() => {
    if (searchQuery.trim()) return filteredBooks;
    return groupedBooks.flatMap((g) => g.books);
  }, [searchQuery, filteredBooks, groupedBooks]);

  useEffect(() => {
    function handleKey(e) {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) return;
      if (document.activeElement?.tagName === 'INPUT') return;
      e.preventDefault();
      const cols = view === 'list' ? 1 : 4;
      if (e.key === 'Escape') {
        if (selectedBook) { setSelectedBook(null); setFocusedBookIdx(-1); }
        else navigate('/read');
        return;
      }
      if (e.key === 'Enter' && focusedBookIdx >= 0 && flatBooks[focusedBookIdx]) {
        setSelectedBook((prev) => {
          const b = flatBooks[focusedBookIdx];
          return prev?.name === b.name ? null : b;
        });
        return;
      }
      setFocusedBookIdx((prev) => {
        const total = flatBooks.length;
        if (total === 0) return prev;
        let next = prev;
        if (e.key === 'ArrowRight') next = Math.min(prev + 1, total - 1);
        if (e.key === 'ArrowLeft') next = Math.max(prev - 1, 0);
        if (e.key === 'ArrowDown') next = Math.min(prev + cols, total - 1);
        if (e.key === 'ArrowUp') next = Math.max(prev - cols, 0);
        return next < 0 ? 0 : next;
      });
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [flatBooks, focusedBookIdx, view, navigate, selectedBook]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/read')}
              title="Back to reader"
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mr-1"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Back</span>
            </button>
            <Compass size={16} className="text-blue-600 dark:text-blue-400" />
            <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Bible Browser</h1>
            <span className="hidden sm:inline text-[10px] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5">
              ↑↓←→ navigate · Enter select
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView('grid')}
              title="Grid view"
              className={clsx(
                'p-1.5 rounded transition-colors',
                view === 'grid' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              )}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setView('list')}
              title="List view"
              className={clsx(
                'p-1.5 rounded transition-colors',
                view === 'list' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              )}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {/* Testament tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-3">
          {TESTAMENTS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTestament(t.id)}
              className={clsx(
                'px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                testament === t.id
                  ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              {t.label}
              <span className="ml-1 text-[10px] opacity-60">({t.books.length})</span>
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5">
            <SearchIcon size={13} className="text-gray-400 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search books…"
              className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Book list */}
        <div className={clsx(
          'overflow-y-auto flex-1',
          selectedBook ? 'w-1/2 border-r border-gray-200 dark:border-gray-700' : 'w-full'
        )}>
          {/* Recent books strip */}
          {!searchQuery && recentBooks.length > 0 && testament === 'all' && (
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                Recently Visited
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {recentBooks.slice(0, 8).map((name) => {
                  const book = [...OT_BOOKS, ...NT_BOOKS].find((b) => b.name === name);
                  if (!book) return null;
                  return (
                    <button
                      key={name}
                      onClick={() => navigateToBook(book)}
                      className="flex-shrink-0 text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Book groups */}
          <div className={clsx(
            'p-3',
            view === 'grid' ? 'space-y-4' : 'space-y-3'
          )}>
            {!searchQuery ? (
              (() => {
                let flatIdx = 0;
                return groupedBooks.map((group) => (
                  <div key={group.id}>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                      {group.label}
                    </p>
                    <div className={clsx(
                      view === 'grid'
                        ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2'
                        : 'space-y-1'
                    )}>
                      {group.books.map((book) => {
                        const idx = flatIdx++;
                        return (
                          <BookCard
                            key={book.name}
                            book={book}
                            view={view}
                            isRecent={recentBooks.includes(book.name)}
                            readingProgress={null}
                            onSelect={(b) => { setSelectedBook(b.name === selectedBook?.name ? null : b); setFocusedBookIdx(idx); }}
                            isActive={selectedBook?.name === book.name}
                            isFocused={focusedBookIdx === idx}
                          />
                        );
                      })}
                    </div>
                  </div>
                ));
              })()
            ) : (
              /* Flat search results */
              <div>
                {filteredBooks.length === 0 ? (
                  <div className="text-center py-12">
                    <SearchIcon size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No books found for "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className={clsx(
                    view === 'grid'
                      ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2'
                      : 'space-y-1'
                  )}>
                    {filteredBooks.map((book, idx) => (
                      <BookCard
                        key={book.name}
                        book={book}
                        view={view}
                        isRecent={recentBooks.includes(book.name)}
                        readingProgress={null}
                        onSelect={(b) => { setSelectedBook(b.name === selectedBook?.name ? null : b); setFocusedBookIdx(idx); }}
                        isActive={selectedBook?.name === book.name}
                        isFocused={focusedBookIdx === idx}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chapter picker panel (appears when a book is selected) */}
        {selectedBook && (
          <div className="w-1/2 flex-shrink-0 overflow-hidden">
            <ChapterPicker
              book={selectedBook}
              onClose={() => setSelectedBook(null)}
              onNavigate={navigateToBook}
            />
          </div>
        )}
      </div>
    </div>
  );
}
