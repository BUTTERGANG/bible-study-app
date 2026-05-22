import { useState, useEffect, useRef } from 'react'
import { useStudyStore } from '../../stores/studyStore'

const CATEGORY_COLORS = {
  creation:        { bg: 'bg-emerald-100 dark:bg-emerald-900/40', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', label: 'Creation' },
  patriarchs:      { bg: 'bg-amber-100 dark:bg-amber-900/40',     dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300',   label: 'Patriarchs' },
  exodus:          { bg: 'bg-orange-100 dark:bg-orange-900/40',   dot: 'bg-orange-500',  text: 'text-orange-700 dark:text-orange-300', label: 'Exodus' },
  conquest:        { bg: 'bg-lime-100 dark:bg-lime-900/40',       dot: 'bg-lime-600',    text: 'text-lime-700 dark:text-lime-300',     label: 'Conquest' },
  judges:          { bg: 'bg-yellow-100 dark:bg-yellow-900/40',   dot: 'bg-yellow-500',  text: 'text-yellow-700 dark:text-yellow-300', label: 'Judges' },
  monarchy:        { bg: 'bg-purple-100 dark:bg-purple-900/40',   dot: 'bg-purple-500',  text: 'text-purple-700 dark:text-purple-300', label: 'Monarchy' },
  exile:           { bg: 'bg-red-100 dark:bg-red-900/40',         dot: 'bg-red-500',     text: 'text-red-700 dark:text-red-300',       label: 'Exile' },
  restoration:     { bg: 'bg-teal-100 dark:bg-teal-900/40',       dot: 'bg-teal-500',    text: 'text-teal-700 dark:text-teal-300',     label: 'Restoration' },
  intertestamental:{ bg: 'bg-gray-100 dark:bg-gray-700/40',       dot: 'bg-gray-400',    text: 'text-gray-600 dark:text-gray-300',     label: 'Inter-Testamental' },
  gospels:         { bg: 'bg-blue-100 dark:bg-blue-900/40',       dot: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-300',     label: 'Gospels' },
  acts:            { bg: 'bg-indigo-100 dark:bg-indigo-900/40',   dot: 'bg-indigo-500',  text: 'text-indigo-700 dark:text-indigo-300', label: 'Acts' },
  epistles:        { bg: 'bg-violet-100 dark:bg-violet-900/40',   dot: 'bg-violet-500',  text: 'text-violet-700 dark:text-violet-300', label: 'Epistles' },
  revelation:      { bg: 'bg-rose-100 dark:bg-rose-900/40',       dot: 'bg-rose-500',    text: 'text-rose-700 dark:text-rose-300',     label: 'Revelation' },
}

const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS)

function useTimeline(book) {
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setEvents(null)
    setError(null)

    const url = book
      ? `/api/timeline/by-verse?book=${encodeURIComponent(book)}`
      : '/api/timeline'

    fetch(url)
      .then(r => r.json())
      .then(data => { if (!cancelled) setEvents(data.events) })
      .catch(e => { if (!cancelled) setError(e.message) })

    return () => { cancelled = true }
  }, [book])

  return { events, error }
}

function EventCard({ event, isHighlighted }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.creation

  return (
    <div
      className={`relative pl-6 pb-4 ${isHighlighted ? 'ring-2 ring-blue-400 rounded-lg' : ''}`}
      onClick={() => setExpanded(v => !v)}
    >
      {/* Timeline dot */}
      <span className={`absolute left-0 top-1.5 w-3 h-3 rounded-full ${cfg.dot} ring-2 ring-white dark:ring-gray-800 z-10`} />
      {/* Connector line — rendered by parent */}

      <div className={`rounded-lg p-2.5 cursor-pointer hover:opacity-90 transition-opacity ${cfg.bg}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-xs text-gray-800 dark:text-gray-100 leading-tight">{event.event_name}</p>
            <p className={`text-[10px] font-medium mt-0.5 ${cfg.text}`}>{event.date_approx}</p>
          </div>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${cfg.text} ${cfg.bg} border border-current/20`}>
            {CATEGORY_COLORS[event.category]?.label ?? event.category}
          </span>
        </div>

        {expanded && (
          <div className="mt-2 space-y-1.5 border-t border-black/10 dark:border-white/10 pt-2">
            <p className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed">{event.description}</p>
            {event.verse_refs && (
              <p className="text-[10px] text-blue-600 dark:text-blue-400 italic">📖 {event.verse_refs}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TimelinePanel() {
  const { book } = useStudyStore()
  const [filterMode, setFilterMode] = useState('all')      // 'all' | 'passage'
  const [activeCategory, setActiveCategory] = useState(null)
  const activeBook = filterMode === 'passage' ? book : null
  const { events, error } = useTimeline(activeBook)

  const filtered = events
    ? (activeCategory ? events.filter(e => e.category === activeCategory) : events)
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden text-sm">
      {/* Toolbar */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700 space-y-2 flex-shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => setFilterMode('all')}
            className={`flex-1 text-xs py-1 rounded font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilterMode('passage')}
            className={`flex-1 text-xs py-1 rounded font-medium transition-colors ${
              filterMode === 'passage'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            This Book ({book})
          </button>
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${
              activeCategory === null
                ? 'bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            All
          </button>
          {ALL_CATEGORIES.map(cat => {
            const cfg = CATEGORY_COLORS[cat]
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${
                  activeCategory === cat ? `${cfg.dot} text-white` : `${cfg.bg} ${cfg.text}`
                }`}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline list */}
      <div className="flex-1 overflow-y-auto p-3">
        {error && (
          <p className="text-xs text-red-500 text-center py-4">Failed to load timeline.</p>
        )}
        {!events && !error && (
          <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
        )}
        {filtered && filtered.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            {filterMode === 'passage'
              ? `No events found related to ${book}.`
              : 'No events match the selected filter.'}
          </p>
        )}
        {filtered && filtered.length > 0 && (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
            <div className="space-y-1">
              {filtered.map(event => (
                <EventCard key={event.id} event={event} isHighlighted={false} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <p className="text-[9px] text-gray-400 text-center">
          {filtered ? `${filtered.length} events · click to expand` : ''}
        </p>
      </div>
    </div>
  )
}
