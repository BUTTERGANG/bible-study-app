import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Cross, List, Share2 } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { useActiveVerse } from '../../hooks/useActiveVerse'
import { api } from '../../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

const NT_BOOKS = new Set([
  'Matthew','Mark','Luke','John','Acts','Romans',
  '1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians',
  'Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy',
  'Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
  '1 John','2 John','3 John','Jude','Revelation',
])

function isNT(bookRaw) {
  const b = bookRaw.replace(/[\d.\s]/g, '').toLowerCase()
  return /^(mat|mar|luk|joh|act|rom|cor|gal|eph|phi|col|the|tim|tit|phm|heb|jam|jas|pet|rev)/.test(b)
}

const REF_RE = /\b(\d?\s*[A-Z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*)*)\s+(\d+):(\d+)(?:-(\d+))?/g

function parseRefs(entries) {
  const seen = new Set()
  const refs = []
  for (const entry of entries) {
    // New TSK format: "Luke 2:14; Romans 5:8; ..." — split on semicolons first
    const segments = entry.text.split(/;\s*/)
    for (const seg of segments) {
      const m = seg.trim().match(/^(\d?\s*[A-Z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*)*)\s+(\d+):(\d+)(?:-(\d+))?$/)
      if (m) {
        const label = m[0].trim()
        if (!seen.has(label)) {
          seen.add(label)
          refs.push({ label, bookRaw: m[1].trim(), ch: parseInt(m[2]), v: parseInt(m[3]) })
        }
        continue
      }
      // Fallback: scan with regex (handles old-style inline refs)
      for (const rm of seg.matchAll(REF_RE)) {
        const label = rm[0].trim()
        if (!seen.has(label)) {
          seen.add(label)
          refs.push({ label, bookRaw: rm[1].trim(), ch: parseInt(rm[2]), v: parseInt(rm[3]) })
        }
      }
    }
  }
  return refs
}

// ── Ref Chip ─────────────────────────────────────────────────────────────────

function RefChip({ ref, active, onHover, onLeave, onClick }) {
  const nt = isNT(ref.bookRaw)
  return (
    <button
      onClick={() => onClick(ref)}
      onMouseEnter={() => onHover(ref)}
      onMouseLeave={onLeave}
      title={ref.label}
      className={[
        'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-all',
        'border focus:outline-none focus:ring-1',
        nt
          ? active
            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600 ring-blue-400'
            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:border-blue-300 dark:hover:border-blue-600'
          : active
            ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-600 ring-violet-400'
            : 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:border-violet-300 dark:hover:border-violet-600',
      ].join(' ')}
    >
      {ref.label}
    </button>
  )
}

// ── Verse Peek Panel ──────────────────────────────────────────────────────────

function PeekPanel({ ref: peeked, translation, onNavigate }) {
  const { data, isLoading } = useQuery({
    queryKey: ['peek', peeked?.bookRaw, peeked?.ch, peeked?.v, translation],
    queryFn: () => api.getVerse(translation, peeked.bookRaw, peeked.ch, peeked.v),
    enabled: !!peeked,
    staleTime: Infinity,
  })

  if (!peeked) return null

  const verseText = data?.text ?? data?.verse?.text

  return (
    <div className="mx-3 mb-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {peeked.label}
        </span>
        <button
          onClick={() => onNavigate(peeked)}
          className="shrink-0 flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
        >
          <BookOpen size={10} />
          Open
        </button>
      </div>
      {isLoading ? (
        <p className="mt-1.5 text-xs text-gray-400 italic">Loading…</p>
      ) : verseText ? (
        <p className="mt-1.5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed italic">
          "{verseText}"
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-gray-400 italic">Verse text unavailable</p>
      )}
    </div>
  )
}

// ── Radial Graph (polished) ───────────────────────────────────────────────────

function RadialGraph({ center, refs, onNodeClick }) {
  const [hovered, setHovered] = useState(null)
  const CX = 200
  const CY = 200
  const R = 155
  const n = refs.length
  if (n === 0) return null

  const ntRefs = refs.filter(r => isNT(r.bookRaw))
  const otRefs = refs.filter(r => !isNT(r.bookRaw))
  // Interleave OT/NT by placing NT in top half, OT in bottom half
  const ordered = [...ntRefs, ...otRefs]

  return (
    <div className="w-full">
      <svg viewBox="0 0 400 400" className="w-full" style={{ maxHeight: 380 }}>
        <defs>
          <radialGradient id="cg2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.04" />
          </radialGradient>
        </defs>

        {/* Separator arc hint */}
        {ntRefs.length > 0 && otRefs.length > 0 && (
          <line
            x1={CX} y1={CY - R - 10} x2={CX} y2={CY + R + 10}
            stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" opacity="0.5"
          />
        )}

        {/* Connection lines */}
        {ordered.map((ref, i) => {
          const a = (2 * Math.PI * i) / n - Math.PI / 2
          const x = CX + R * Math.cos(a)
          const y = CY + R * Math.sin(a)
          const nt = isNT(ref.bookRaw)
          return (
            <line
              key={`l${i}`}
              x1={CX} y1={CY} x2={x} y2={y}
              stroke={hovered === i ? (nt ? '#93c5fd' : '#c4b5fd') : '#e2e8f0'}
              strokeWidth={hovered === i ? 1.5 : 0.8}
              className="dark:stroke-gray-700"
            />
          )
        })}

        {/* Nodes */}
        {ordered.map((ref, i) => {
          const a = (2 * Math.PI * i) / n - Math.PI / 2
          const x = CX + R * Math.cos(a)
          const y = CY + R * Math.sin(a)
          const nt = isNT(ref.bookRaw)
          const color = nt ? '#3b82f6' : '#8b5cf6'
          const isHov = hovered === i
          // Split label into book and ch:v for two-line display
          const refParts = ref.label.match(/^(.*?)\s+(\d+:\d+(?:-\d+)?)$/)
          const bookPart = refParts ? (refParts[1].length > 7 ? refParts[1].slice(0, 6) + '…' : refParts[1]) : ref.label.slice(0, 7)
          const cvPart = refParts ? refParts[2] : ''

          return (
            <g
              key={`n${i}`}
              onClick={() => onNodeClick(ref)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={x} cy={y} r={isHov ? 27 : 24}
                fill={color} fillOpacity={isHov ? 0.2 : 0.1}
                stroke={color} strokeWidth={isHov ? 2 : 1.5}
              />
              <text
                x={x} y={y - (cvPart ? 4 : 0)}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="7" fill={color} fontWeight="600"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {bookPart}
              </text>
              {cvPart && (
                <text
                  x={x} y={y + 6}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="6" fill={color} opacity="0.8"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {cvPart}
                </text>
              )}
            </g>
          )
        })}

        {/* Center node */}
        <circle cx={CX} cy={CY} r="32" fill="url(#cg2)" stroke="#3b82f6" strokeWidth="1.5" />
        {(() => {
          const parts = center.match(/^(.*?)\s+(\d+:\d+)$/)
          return parts ? (
            <>
              <text x={CX} y={CY - 6} textAnchor="middle" dominantBaseline="middle"
                fontSize="8" fill="#3b82f6" fontWeight="700" style={{ userSelect: 'none' }}>
                {parts[1].length > 8 ? parts[1].slice(0, 7) + '…' : parts[1]}
              </text>
              <text x={CX} y={CY + 7} textAnchor="middle" dominantBaseline="middle"
                fontSize="7" fill="#3b82f6" opacity="0.75" style={{ userSelect: 'none' }}>
                {parts[2]}
              </text>
            </>
          ) : (
            <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
              fontSize="8" fill="#3b82f6" fontWeight="700" style={{ userSelect: 'none' }}>
              {center.length > 10 ? center.slice(0, 9) + '…' : center}
            </text>
          )
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pb-1">
        <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 opacity-70 inline-block" />
          NT ({ntRefs.length})
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500 opacity-70 inline-block" />
          OT ({otRefs.length})
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-600">Click to navigate</span>
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function CrossReferencePanel() {
  const { book, chapter, translation, setReference } = useStudyStore()
  const verse = useActiveVerse()
  const [view, setView] = useState('list')
  const [peeked, setPeeked] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cross-ref', book, chapter, verse],
    queryFn: () => api.getVerseCommentary(book, chapter, verse, 'TSK'),
    enabled: !!book && !!chapter && !!verse,
  })

  const { ntRefs, otRefs, allRefs } = useMemo(() => {
    if (!data?.entries) return { ntRefs: [], otRefs: [], allRefs: [] }
    const all = parseRefs(data.entries)
    return {
      ntRefs: all.filter(r => isNT(r.bookRaw)),
      otRefs: all.filter(r => !isNT(r.bookRaw)),
      allRefs: all,
    }
  }, [data])

  function goToRef(ref) {
    setReference(ref.bookRaw, ref.ch, ref.v)
  }

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`
  const total = ntRefs.length + otRefs.length
  const hasData = !isLoading && verse && total > 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Cross size={13} />
          Cross-References
        </span>
        <div className="flex items-center gap-2">
          {verse && (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
              {reference}
            </span>
          )}
          <div className="flex rounded overflow-hidden border border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setView('list')}
              className={`px-2 py-0.5 text-xs transition-colors flex items-center gap-1 ${
                view === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <List size={10} />
              List
            </button>
            <button
              onClick={() => setView('graph')}
              className={`px-2 py-0.5 text-xs transition-colors flex items-center gap-1 ${
                view === 'graph'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Share2 size={10} />
              Graph
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto flex flex-col">

        {/* Empty state — no verse selected */}
        {!verse && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Cross size={28} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Click any verse</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Cross-references from the Treasury of Scripture Knowledge will appear here.
            </p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-10 gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-400">Loading…</span>
          </div>
        )}

        {/* No data for this verse */}
        {!isLoading && verse && total === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Cross size={28} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No cross-references</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Try a verse in the Gospels or Epistles for richer results.
            </p>
          </div>
        )}

        {/* LIST VIEW */}
        {hasData && view === 'list' && (
          <>
            {/* Summary bar */}
            <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {total} reference{total !== 1 ? 's' : ''}
              </span>
              {peeked && (
                <span className="text-[10px] text-gray-400 dark:text-gray-600">
                  · hover to preview · click to navigate
                </span>
              )}
            </div>

            {/* NT section */}
            {ntRefs.length > 0 && (
              <div className="px-3 pb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                    New Testament · {ntRefs.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ntRefs.map(ref => (
                    <RefChip
                      key={ref.label}
                      ref={ref}
                      active={peeked?.label === ref.label}
                      onHover={setPeeked}
                      onLeave={() => {}}
                      onClick={goToRef}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* OT section */}
            {otRefs.length > 0 && (
              <div className="px-3 pb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    Old Testament · {otRefs.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {otRefs.map(ref => (
                    <RefChip
                      key={ref.label}
                      ref={ref}
                      active={peeked?.label === ref.label}
                      onHover={setPeeked}
                      onLeave={() => {}}
                      onClick={goToRef}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Peek panel — sticky at bottom */}
            <div className="mt-auto pt-1 border-t border-gray-100 dark:border-gray-700/50">
              {peeked ? (
                <PeekPanel
                  ref={peeked}
                  translation={translation || 'KJV'}
                  onNavigate={goToRef}
                />
              ) : (
                <p className="px-3 py-2.5 text-[10px] text-gray-400 dark:text-gray-600 italic">
                  Hover a reference to preview the verse text.
                </p>
              )}
            </div>
          </>
        )}

        {/* GRAPH VIEW */}
        {hasData && view === 'graph' && (
          <div className="flex flex-col items-center p-3 pt-4">
            <RadialGraph
              center={reference}
              refs={allRefs.slice(0, 24)}
              onNodeClick={goToRef}
            />
          </div>
        )}
      </div>
    </div>
  )
}
