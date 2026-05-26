import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Cross, ExternalLink, List, Share2 } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'

const REF_RE = /\b([A-Z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*)*)\s+(\d+):(\d+)(?:-(\d+))?/g

function parseAllRefs(entries) {
  const seen = new Set()
  const refs = []
  for (const entry of entries) {
    for (const m of entry.text.matchAll(REF_RE)) {
      const label = m[0].trim()
      if (!seen.has(label)) {
        seen.add(label)
        refs.push({ label, bookRaw: m[1].trim(), ch: parseInt(m[2]), v: parseInt(m[3]) })
      }
    }
  }
  return refs.slice(0, 24)
}

function isNT(bookRaw) {
  const b = bookRaw.replace(/[.\s]/g, '').toLowerCase()
  return /^(mat|mar|luk|joh|act|rom|cor|gal|eph|phi|col|the|tim|tit|phm|heb|jam|jas|pet|rev)/.test(b)
}

function RadialGraph({ center, refs, onNodeClick }) {
  const [hovered, setHovered] = useState(null)
  const CX = 210
  const CY = 210
  const R = 162
  const n = refs.length
  if (n === 0) return null

  return (
    <svg viewBox="0 0 420 420" className="w-full" style={{ maxHeight: 420 }}>
      <defs>
        <radialGradient id="cg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
        </radialGradient>
      </defs>

      {refs.map((ref, i) => {
        const a = (2 * Math.PI * i) / n - Math.PI / 2
        const x = CX + R * Math.cos(a)
        const y = CY + R * Math.sin(a)
        return (
          <line
            key={`l${i}`}
            x1={CX} y1={CY} x2={x} y2={y}
            stroke={hovered === i ? '#94a3b8' : '#cbd5e1'}
            strokeWidth={hovered === i ? 1.5 : 1}
            opacity="0.5"
          />
        )
      })}

      {refs.map((ref, i) => {
        const a = (2 * Math.PI * i) / n - Math.PI / 2
        const x = CX + R * Math.cos(a)
        const y = CY + R * Math.sin(a)
        const nt = isNT(ref.bookRaw)
        const color = nt ? '#3b82f6' : '#8b5cf6'
        const isHov = hovered === i
        const short = ref.label.length > 11 ? ref.label.slice(0, 9) + '…' : ref.label

        return (
          <g
            key={`n${i}`}
            onClick={() => onNodeClick(ref)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={x} cy={y} r={isHov ? 25 : 22}
              fill={color} fillOpacity={isHov ? 0.22 : 0.12}
              stroke={color} strokeWidth={isHov ? 2 : 1.5}
            />
            <text
              x={x} y={y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="6.5" fill={color} fontWeight="500"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {short}
            </text>
          </g>
        )
      })}

      <circle cx={CX} cy={CY} r="36" fill="url(#cg)" stroke="#3b82f6" strokeWidth="2" />
      <text
        x={CX} y={CY - 6}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="8.5" fill="#3b82f6" fontWeight="700"
        style={{ userSelect: 'none' }}
      >
        {center.length > 10 ? center.slice(0, 9) + '…' : center}
      </text>
      <text
        x={CX} y={CY + 8}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="6.5" fill="#3b82f6" opacity="0.65"
        style={{ userSelect: 'none' }}
      >
        {refs.length} refs
      </text>
    </svg>
  )
}

export default function CrossReferencePanel() {
  const { book, chapter, verse, setReference } = useStudyStore()
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const [view, setView] = useState('list')

  const { data, isLoading } = useQuery({
    queryKey: ['cross-ref', book, chapter, verse],
    queryFn: () => api.getVerseCommentary(book, chapter, verse, 'TSK'),
    enabled: !!book && !!chapter && !!verse,
  })

  const allRefs = useMemo(() => {
    if (!data?.entries) return []
    return parseAllRefs(data.entries)
  }, [data])

  function toggleGroup(key) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function goToReference(refText) {
    const match = refText.match(/^([\w\s.]+?)\s+(\d+):(\d+)(?:-(\d+))?$/)
    if (match) {
      const [, bk, ch, v] = match
      setReference(bk.trim(), parseInt(ch), parseInt(v))
    }
  }

  const groups = {}
  if (data?.entries) {
    for (const entry of data.entries) {
      const key = `${entry.verse_start}-${entry.verse_end}`
      if (!groups[key]) groups[key] = []
      groups[key].push(entry)
    }
  }

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`
  const hasData = !isLoading && verse && data?.entries?.length > 0

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Cross size={13} />
          Cross-References
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">{reference}</span>
          {hasData && (
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
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!verse && (
          <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
            Click any verse to see its cross-references from the Treasury of Scripture Knowledge.
          </div>
        )}

        {isLoading && (
          <div className="p-4 text-sm text-gray-400 text-center">Loading…</div>
        )}

        {!isLoading && verse && (!data?.entries || data.entries.length === 0) && (
          <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
            <Cross size={24} className="mx-auto mb-2 opacity-30" />
            <p>No cross-references available for this verse.</p>
            <p className="text-xs mt-1">Try a verse in the Gospels or Epistles for richer cross-references.</p>
          </div>
        )}

        {hasData && view === 'graph' && (
          <div className="flex flex-col items-center p-4 gap-2">
            <RadialGraph
              center={reference}
              refs={allRefs}
              onNodeClick={(ref) => setReference(ref.bookRaw, ref.ch, ref.v)}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Click a node to navigate ·{' '}
              <span style={{ color: '#3b82f6' }}>●</span> NT ·{' '}
              <span style={{ color: '#8b5cf6' }}>●</span> OT
            </p>
          </div>
        )}

        {hasData && view === 'list' && Object.entries(groups).map(([key, entries]) => {
          const [vs, ve] = key.split('-')
          const label = vs === ve ? `v.${vs}` : `v.${vs}-${ve}`
          const isOpen = expandedGroups.has(key)

          return (
            <div key={key} className="border-b border-gray-100 dark:border-gray-700">
              <button
                onClick={() => toggleGroup(key)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {label}
                </span>
                <span className="text-xs text-gray-400">{entries.length} refs</span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-1.5">
                  {entries.map((entry, i) => {
                    const parts = entry.text.split(/(\b[A-Z][\w\s.]+\s+\d+:\d+(?:-\d+)?)/g)
                    return (
                      <div key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {parts.map((part, j) => {
                          const refMatch = part.match(/^([A-Z][\w\s.]+?)\s+(\d+):(\d+)(?:-(\d+))?$/)
                          if (refMatch) {
                            return (
                              <button
                                key={j}
                                onClick={() => goToReference(part.trim())}
                                className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                              >
                                {part.trim()}
                                <ExternalLink size={9} className="opacity-50" />
                              </button>
                            )
                          }
                          return <span key={j}>{part}</span>
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
