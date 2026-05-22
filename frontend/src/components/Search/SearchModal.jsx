import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Sparkles, X } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import { streamAI } from '../../api/streamAI'
import clsx from 'clsx'

export default function SearchModal({ onClose }) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('bible')
  const [semantic, setSemantic] = useState(false)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [synopsis, setSynopsis] = useState('')
  const [synopsisLoading, setSynopsisLoading] = useState(false)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const synopsisStopRef = useRef(null)
  const { translation, setReference } = useStudyStore()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.length < 3) { setResults(null); setActiveIdx(-1); setSynopsis(''); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = semantic
          ? await api.semanticSearch(query, translation)
          : await api.search(query, scope, translation)
        setResults(data)
        setActiveIdx(-1)

        // Stream AI synopsis for non-empty results
        if (data?.results?.length > 0) {
          synopsisStopRef.current?.()
          setSynopsis('')
          setSynopsisLoading(true)
          synopsisStopRef.current = streamAI(
            'search-synopsis',
            { query, results: data.results.slice(0, 8) },
            (chunk) => setSynopsis((s) => s + chunk),
            () => setSynopsisLoading(false),
          )
        } else {
          setSynopsis('')
        }
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      synopsisStopRef.current?.()
    }
  }, [query, scope, semantic, translation])

  const resultList = results?.results ?? []

  function navigate(result) {
    setReference(result.book, result.chapter, result.verse)
    onClose()
  }

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (resultList.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((prev) => {
        const next = prev < resultList.length - 1 ? prev + 1 : 0
        // Scroll active item into view
        const list = listRef.current
        if (list) {
          const item = list.children[next]
          if (item) item.scrollIntoView({ block: 'nearest' })
        }
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((prev) => {
        const next = prev > 0 ? prev - 1 : resultList.length - 1
        const list = listRef.current
        if (list) {
          const item = list.children[next]
          if (item) item.scrollIntoView({ block: 'nearest' })
        }
        return next
      })
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      navigate(resultList[activeIdx])
    }
  }, [resultList, activeIdx, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Prevent ArrowDown/ArrowUp from moving cursor in input when navigating
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || (e.key === 'Enter' && activeIdx >= 0)) {
                e.preventDefault()
                handleKeyDown(e)
              }
            }}
            placeholder="Search scriptures and commentaries…"
            className="flex-1 text-base focus:outline-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={18} />
          </button>
        </div>

        {/* Scope tabs + Semantic toggle */}
        <div className="flex items-center border-b border-gray-100 dark:border-gray-700 px-2 bg-white dark:bg-gray-800">
          {!semantic && ['bible', 'commentary', 'all'].map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={clsx(
                'px-3 py-2 text-xs font-medium capitalize transition-colors',
                scope === s
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              {s}
            </button>
          ))}
          {semantic && (
            <span className="px-3 py-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
              Searching by theme…
            </span>
          )}
          <div className="ml-auto">
            <button
              onClick={() => setSemantic((v) => !v)}
              title={semantic ? 'Switch to keyword search' : 'Switch to semantic/theme search'}
              className={clsx(
                'flex items-center gap-1 px-2 py-1 my-1 rounded text-xs font-medium transition-colors',
                semantic
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              )}
            >
              <Sparkles size={11} />
              Semantic
            </button>
          </div>
        </div>

        {/* Semantic theme match banner */}
        {semantic && results?.matched_themes?.length > 0 && (
          <div className="px-4 py-1.5 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-100 dark:border-purple-900/50">
            <p className="text-[10px] text-purple-600 dark:text-purple-400">
              Themes matched: {results.matched_themes.join(', ')}
            </p>
          </div>
        )}

        {/* AI Synopsis */}
        {(synopsis || synopsisLoading) && (
          <div className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/50">
            <p className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 mb-1 flex items-center gap-1">
              <Sparkles size={9} />
              AI Synthesis
            </p>
            <p className="text-xs text-indigo-800 dark:text-indigo-200 leading-relaxed">
              {synopsis}
              {synopsisLoading && <span className="inline-block w-1.5 h-3 bg-indigo-400 animate-pulse ml-0.5 rounded-sm" />}
            </p>
          </div>
        )}

        {/* Results */}
        <div className="max-h-80 overflow-y-auto" ref={listRef}>
          {loading && (
            <div className="p-4 text-sm text-gray-400 text-center">Searching…</div>
          )}

          {!loading && query.length >= 3 && results?.results?.length === 0 && (
            <div className="p-4 text-sm text-gray-400 text-center">
              No results for "{query}"
            </div>
          )}

          {resultList.map((result, i) => (
            <button
              key={i}
              onClick={() => navigate(result)}
              className={clsx(
                'w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-700 transition-colors',
                activeIdx === i
                  ? 'bg-blue-50 dark:bg-blue-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{result.reference}</span>
                {result.translation && (
                  <span className="text-xs text-gray-400">{result.translation}</span>
                )}
                {result.source && (
                  <span className="text-xs text-gray-400">{result.source}</span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-snug">
                {result.snippet || result.text}
              </p>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-400">
          <span>↑↓ to navigate · Enter to go · Esc to close</span>
          {results && <span>{results.count} results</span>}
        </div>
      </div>
    </div>
  )
}
