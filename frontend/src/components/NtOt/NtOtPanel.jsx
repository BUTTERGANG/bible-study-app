import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BookOpen, ExternalLink, Link2 } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

const NT_BOOKS = new Set([
  'Matthew','Mark','Luke','John','Acts','Romans',
  '1 Corinthians','2 Corinthians','Galatians','Ephesians',
  'Philippians','Colossians','1 Thessalonians','2 Thessalonians',
  '1 Timothy','2 Timothy','Titus','Philemon','Hebrews',
  'James','1 Peter','2 Peter','1 John','2 John','3 John',
  'Jude','Revelation',
])

const TYPE_META = {
  direct_quotation: { label: 'Quotation',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  verbal_parallel:  { label: 'Parallel',   color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  allusion:         { label: 'Allusion',   color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  thematic_echo:    { label: 'Theme',      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  typology:         { label: 'Typology',   color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

function TypeBadge({ type }) {
  const meta = TYPE_META[type] ?? { label: type, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-full', meta.color)}>
      {meta.label}
    </span>
  )
}

function ConnectionCard({ conn, onNavigate }) {
  const [expanded, setExpanded] = useState(false)
  const isNtView = !!conn.nt.text || !!conn.ot.text

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        className="w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <TypeBadge type={conn.connection_type} />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
              {conn.ot.reference}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
            {expanded ? '▲' : '▼'}
          </span>
        </div>

        {!expanded && conn.notes && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {conn.notes}
          </p>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-700 pt-2">
          {/* Notes */}
          {conn.notes && (
            <p className="text-[11px] text-gray-600 dark:text-gray-300 italic leading-relaxed">
              {conn.notes}
            </p>
          )}

          {/* NT verse text */}
          {conn.nt.text && (
            <div className="space-y-0.5">
              <button
                className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                onClick={(e) => { e.stopPropagation(); onNavigate(conn.nt) }}
              >
                {conn.nt.reference}
                <ExternalLink size={9} />
              </button>
              <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1 italic">
                "{conn.nt.text}"
              </p>
            </div>
          )}

          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <ArrowRight size={10} />
            <span>cites</span>
          </div>

          {/* OT verse text */}
          <div className="space-y-0.5">
            <button
              className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
              onClick={(e) => { e.stopPropagation(); onNavigate(conn.ot) }}
            >
              {conn.ot.reference}
              <ExternalLink size={9} />
            </button>
            {conn.ot.text && (
              <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1 italic">
                "{conn.ot.text}"
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NtOtPanel() {
  const { book, chapter, verse, setReference } = useStudyStore()
  const isNt = NT_BOOKS.has(book)

  // Build query params based on which testament we're in
  const queryParams = isNt
    ? { nt_book: book, nt_chapter: chapter, ...(verse ? { nt_verse: verse } : {}) }
    : { ot_book: book, ot_chapter: chapter, ...(verse ? { ot_verse: verse } : {}) }

  const { data, isLoading } = useQuery({
    queryKey: ['nt-ot', book, chapter, verse],
    queryFn: () => api.getNtOtConnections(queryParams),
    enabled: !!book && !!chapter,
    staleTime: Infinity,
  })

  const connections = data?.connections ?? []

  function handleNavigate(ref) {
    setReference(ref.book, ref.chapter, ref.verse)
  }

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Link2 size={13} />
          NT Use of OT
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">{reference}</span>
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">
          {isNt
            ? 'OT passages cited or echoed in this NT text'
            : 'NT passages that cite this OT text'}
        </p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(TYPE_META).map(([key, { label, color }]) => (
            <span key={key} className={clsx('text-[9px] px-1.5 py-0.5 rounded-full font-medium', color)}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Loading…</div>
        )}

        {!isLoading && connections.length === 0 && (
          <div className="text-center py-10">
            <BookOpen size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No connections recorded for {reference}.
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              {isNt
                ? 'Try the Gospels, Romans, or Hebrews for rich OT connections.'
                : 'Try Isaiah 53, Psalm 22, or Psalm 110.'}
            </p>
          </div>
        )}

        {connections.map((conn) => (
          <ConnectionCard
            key={conn.id}
            conn={conn}
            onNavigate={handleNavigate}
          />
        ))}

        {connections.length > 0 && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center pt-2">
            {connections.length} connection{connections.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>
    </div>
  )
}
