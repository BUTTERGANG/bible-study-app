import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ChevronDown, ChevronRight, Globe, Loader2 } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

/** Sanitize rendered HTML to prevent XSS in AI-generated content. */
function sanitizeHtml(raw) {
  return DOMPurify.sanitize(
    raw
      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:600">$1</strong>')
      .replace(/\n/g, '<br/>'),
    { ALLOWED_TAGS: ['strong', 'br', 'p', 'em', 'ul', 'ol', 'li'], ALLOWED_ATTR: ['style'] }
  )
}

/**
 * CulturalContextPanel — shows AI-generated cultural/historical background notes
 * for verses in the current chapter. Notes are loaded per-chapter and cached in DB.
 *
 * Two display modes:
 * - "chapter" (default): shows all notes for the chapter, grouped by verse
 * - "verse": when a verse is selected, filters to just that verse's notes
 */

export default function CulturalContextPanel({ embedded = false }) {
  const book = useStudyStore((s) => s.book)
  const chapter = useStudyStore((s) => s.chapter)
  const verse = useStudyStore((s) => s.verse)
  const selectedVerse = useStudyStore((s) => s.selectedVerse)
  const activeVerse = selectedVerse || verse

  const enabled = !!book && !!chapter

  const { data: notes, isLoading, isError } = useQuery({
    queryKey: ['cultural-notes', book, chapter],
    queryFn: () => api.getCulturalNotes(book, chapter),
    enabled,
    staleTime: 1000 * 60 * 30, // 30 min — cached server-side too
  })

  // Group notes by verse
  const notesByVerse = useMemo(() => {
    if (!notes) return {}
    const map = {}
    for (const n of notes) {
      if (!map[n.verse]) map[n.verse] = []
      map[n.verse].push(n)
    }
    return map
  }, [notes])

  const verseNotes = activeVerse ? (notesByVerse[activeVerse] || []) : []
  const allVerses = Object.keys(notesByVerse).map(Number).sort((a, b) => a - b)

  // In embedded mode, only show notes for currently selected verse
  if (embedded) {
    if (!activeVerse) return null
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-3">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1">
          <Globe size={11} /> Cultural Context — {book} {chapter}:{activeVerse}
        </p>
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 size={10} className="animate-spin" /> Loading…
          </div>
        ) : isError ? (
          <p className="text-xs text-gray-400">Failed to load notes.</p>
        ) : verseNotes.length === 0 ? (
          <p className="text-xs text-gray-400">No cultural notes for this verse yet.</p>
        ) : (
          <div className="space-y-2">
            {verseNotes.map((n, i) => (
              <div key={i} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.content) }} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Standalone panel mode (in Insights tabs)
  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Globe size={13} /> Cultural Context
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">
          {book} {chapter}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!activeVerse && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 italic">
            Click any verse to see its cultural background. Showing all verses with notes.
          </p>
        )}

        {activeVerse && verseNotes.length > 0 && (
          <div className="mb-4">
            <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <BookOpen size={11} /> {book} {chapter}:{activeVerse}
                </span>
                <button
                  onClick={() => useStudyStore.getState().selectVerse(null, '')}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-[10px]"
                >
                  Show all
                </button>
              </p>
              {verseNotes.map((n, i) => (
                <div key={i} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.content) }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-amber-500" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-xs text-gray-400">
            Failed to load cultural notes.
          </div>
        ) : allVerses.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            No cultural notes found for this chapter yet.
          </div>
        ) : (
          <VerseNotesList
            book={book}
            chapter={chapter}
            notesByVerse={notesByVerse}
            allVerses={allVerses}
            activeVerse={activeVerse}
          />
        )}
      </div>
    </div>
  )
}

function VerseNotesList({ book, chapter, notesByVerse, allVerses, activeVerse }) {
  const [expandedVerses, setExpandedVerses] = useState(new Set(activeVerse ? [activeVerse] : allVerses))

  function toggleVerse(v) {
    setExpandedVerses(prev => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  return (
    <div className="space-y-1">
      {allVerses.map(v => {
        const notes = notesByVerse[v]
        const isExpanded = expandedVerses.has(v)
        const isActive = activeVerse === v
        return (
          <div key={v} className={clsx(
            'rounded-lg border transition-colors',
            isActive
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
              : 'border-gray-200 dark:border-gray-700'
          )}>
            <button
              onClick={() => toggleVerse(v)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className={clsx('font-bold', isActive ? 'text-amber-600 dark:text-amber-400' : 'text-blue-500 dark:text-blue-400')}>
                {chapter}:{v}
              </span>
              <span className="text-gray-400 dark:text-gray-500 font-normal">
                {notes.length} note{notes.length > 1 ? 's' : ''}
              </span>
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                {notes.map((n, i) => (
                  <div key={i} className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pl-5">
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(n.content) }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
