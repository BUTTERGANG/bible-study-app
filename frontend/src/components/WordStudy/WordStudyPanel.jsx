import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layers, ExternalLink, BarChart2 } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { useActiveVerse } from '../../hooks/useActiveVerse'
import { api } from '../../api/client'
import clsx from 'clsx'

// Palette for up to 12 segments
const PALETTE = [
  '#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4',
  '#ec4899','#84cc16','#f97316','#6366f1','#14b8a6','#a855f7',
]

function DonutChart({ glosses, activeGloss, onHover }) {
  const R = 40, cx = 55, cy = 55, stroke = 14
  const circumference = 2 * Math.PI * R
  let offset = 0
  const segments = glosses.map((g, i) => {
    const dash = (g.percent / 100) * circumference
    const seg = { ...g, dash, offset, color: PALETTE[i % PALETTE.length] }
    offset += dash
    return seg
  })

  return (
    <svg width={110} height={110} viewBox="0 0 110 110" className="flex-shrink-0">
      {segments.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${s.dash} ${circumference - s.dash}`}
          strokeDashoffset={-s.offset}
          opacity={activeGloss && activeGloss !== s.gloss ? 0.3 : 1}
          style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
          onMouseEnter={() => onHover(s.gloss)}
          onMouseLeave={() => onHover(null)}
        />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fill="currentColor" className="text-gray-600 dark:text-gray-300">
        {activeGloss ? glosses.find(g => g.gloss === activeGloss)?.percent + '%' : glosses.length}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8" fill="currentColor" className="text-gray-400">
        {activeGloss ? activeGloss.slice(0, 10) : 'glosses'}
      </text>
    </svg>
  )
}

function SemanticRangeSection({ strongs }) {
  const [testament, setTestament] = useState('all')
  const [activeGloss, setActiveGloss] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['semantic-range', strongs, testament],
    queryFn: () => api.getSemanticRange(strongs, testament),
    enabled: !!strongs,
    staleTime: 10 * 60 * 1000,
  })

  const glosses = data?.glosses?.slice(0, 12) || []

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
          <BarChart2 size={12} />
          Semantic Range
        </span>
        <div className="flex gap-0.5">
          {['all','OT','NT'].map(t => (
            <button
              key={t}
              onClick={() => setTestament(t)}
              className={clsx(
                'text-[10px] px-1.5 py-0.5 rounded transition-colors',
                testament === t
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400 text-center py-3">Loading range data…</p>
      ) : glosses.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">No range data for {strongs}</p>
      ) : (
        <div className="flex gap-3 items-start">
          <DonutChart glosses={glosses} activeGloss={activeGloss} onHover={setActiveGloss} />
          <div className="flex-1 min-w-0 space-y-1">
            {glosses.map((g, i) => (
              <div
                key={g.gloss}
                className={clsx(
                  'flex items-center gap-1.5 cursor-default rounded px-1 py-0.5 transition-colors',
                  activeGloss === g.gloss ? 'bg-gray-100 dark:bg-gray-700' : ''
                )}
                onMouseEnter={() => setActiveGloss(g.gloss)}
                onMouseLeave={() => setActiveGloss(null)}
              >
                <span
                  className="flex-shrink-0 w-2 h-2 rounded-full"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="text-[11px] text-gray-700 dark:text-gray-200 truncate flex-1">{g.gloss}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{g.percent}%</span>
              </div>
            ))}
            {data?.total > 0 && (
              <p className="text-[10px] text-gray-400 mt-1 pl-1">{data.total} occurrences total</p>
            )}
          </div>
        </div>
      )}

      {/* Example verses for hovered gloss */}
      {activeGloss && (
        <div className="mt-2 space-y-0.5">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">"{activeGloss}" examples</p>
          {(glosses.find(g => g.gloss === activeGloss)?.examples || []).map((ex, i) => (
            <p key={i} className="text-[11px] text-blue-600 dark:text-blue-400">{ex.reference}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function WordStudyPanel() {
  const { book, chapter, interlinearMode, reverseInterlinear, toggleInterlinear, toggleReverseInterlinear, focusedStrongs, clearFocusedStrongs, setReference } = useStudyStore()
  const verse = useActiveVerse()
  const [selectedWord, setSelectedWord] = useState(null)
  const [expandedStrongs, setExpandedStrongs] = useState(null)
  const [showOccurrences, setShowOccurrences] = useState(null)

  useEffect(() => {
    if (focusedStrongs) {
      setExpandedStrongs(focusedStrongs)
      setSelectedWord(null)
      clearFocusedStrongs()
    }
  }, [focusedStrongs, clearFocusedStrongs])

  // Reset word selection when verse changes
  useEffect(() => {
    setSelectedWord(null)
    setExpandedStrongs(null)
  }, [verse])

  const { data, isLoading } = useQuery({
    queryKey: ['words', book, chapter, verse],
    queryFn: () => api.getVerseWords(book, chapter, verse),
    enabled: !!book && !!chapter && !!verse,
  })

  const { data: strongsData } = useQuery({
    queryKey: ['strongs', expandedStrongs],
    queryFn: () => api.getStrongsEntry(expandedStrongs),
    enabled: !!expandedStrongs,
  })

  const { data: occurrencesData } = useQuery({
    queryKey: ['strongs-occurrences', showOccurrences],
    queryFn: () => api.getStrongsOccurrences(showOccurrences),
    enabled: !!showOccurrences,
  })

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`

  function goToOccurrence(occ) {
    setReference(occ.book, occ.chapter, occ.verse)
    setShowOccurrences(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Layers size={13} />
          Word Study
        </span>
        <div className="flex gap-1">
          <button
            onClick={toggleInterlinear}
            className={clsx(
              'text-xs px-2 py-0.5 rounded-full border transition-colors',
              interlinearMode
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-600'
                : 'text-gray-500 border-gray-300 hover:border-gray-400 dark:text-gray-400 dark:border-gray-600'
            )}
          >
            Interlinear
          </button>
          <button
            onClick={toggleReverseInterlinear}
            className={clsx(
              'text-xs px-2 py-0.5 rounded-full border transition-colors',
              reverseInterlinear
                ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-600'
                : 'text-gray-500 border-gray-300 hover:border-gray-400 dark:text-gray-400 dark:border-gray-600'
            )}
            title="Show English-first interlinear with clickable word tiles"
          >
            Reverse
          </button>
        </div>
      </div>

      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {reference} · {data?.language ?? '—'}
        </p>
        {!verse && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Click a verse to study its words</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!verse && (
          <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
            Click any verse in the Bible reader to see its original language words.
          </div>
        )}

        {isLoading && (
          <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">Loading…</div>
        )}

        {data?.words && data.words.length > 0 && (
          <div className="p-3">
            {/* Word list */}
            <div className="space-y-1 mb-4">
              {data.words.map((word) => (
                <button
                  key={word.position}
                  onClick={() => {
                    setSelectedWord(word)
                    if (word.strongs) setExpandedStrongs(word.strongs)
                  }}
                  className={clsx(
                    'w-full text-left px-3 py-2 rounded-lg border transition-colors',
                    selectedWord?.position === word.position
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:border-gray-500'
                  )}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-lg text-gray-800 dark:text-gray-100">{word.original}</span>
                    {word.strongs && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowOccurrences(word.strongs)
                        }}
                        className="text-xs text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                        title={`See all occurrences of ${word.strongs}`}
                      >
                        {word.strongs}
                        <ExternalLink size={9} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-blue-600 dark:text-blue-400">{word.transliteration}</span>
                    {word.morphology && (
                      <span className="text-xs text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1 rounded">
                        {word.morphology}
                      </span>
                    )}
                    <span className="text-xs text-gray-600 dark:text-gray-400 italic">{word.gloss}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Strong's definition */}
            {selectedWord && strongsData && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {selectedWord.strongs} — {selectedWord.original}
                  </h3>
                  {selectedWord.strongs && (
                    <button
                      onClick={() => setShowOccurrences(selectedWord.strongs)}
                      className="text-xs text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                    >
                      All occurrences
                      <ExternalLink size={10} />
                    </button>
                  )}
                </div>
                {strongsData.entries?.map((entry) => (
                  <div key={entry.source} className="mb-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{entry.source}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{entry.definition}</p>
                    {entry.usage && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">Usage: {entry.usage}</p>
                    )}
                  </div>
                ))}
                {/* Semantic Range chart */}
                {selectedWord.strongs && (
                  <SemanticRangeSection strongs={selectedWord.strongs} />
                )}
              </div>
            )}

            {/* Occurrences panel */}
            {showOccurrences && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Occurrences of {showOccurrences}
                  </h3>
                  <button
                    onClick={() => setShowOccurrences(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    Close
                  </button>
                </div>
                {!occurrencesData ? (
                  <p className="text-xs text-gray-400">Loading…</p>
                ) : occurrencesData.occurrences?.length === 0 ? (
                  <p className="text-xs text-gray-400">No occurrences found.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {occurrencesData.occurrences?.map((occ, i) => (
                      <button
                        key={i}
                        onClick={() => goToOccurrence(occ)}
                        className="w-full text-left text-xs px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center gap-1"
                      >
                        <ExternalLink size={9} />
                        {occ.book} {occ.chapter}:{occ.verse}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {verse && data?.words?.length === 0 && (
          <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
            <p className="font-medium">Original language data unavailable</p>
            <p className="text-xs mt-1">
              Greek/Hebrew word data for this verse isn't loaded in this instance.
              Try the AI Study tab for word study insights.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
