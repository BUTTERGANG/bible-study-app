import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Search, Sparkles, X } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import { streamAI } from '../../api/streamAI'
import { normalizeSearchInput, getSuggestions } from '../../utils/bibleSearch'
import { useFocusTrap } from '../../hooks/useFocusTrap'
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
  const dialogRef = useRef(null)
  const listRef = useRef(null)
  const synopsisStopRef = useRef(null)
  const { translation, setReference } = useStudyStore()

  useFocusTrap(dialogRef, onClose)

  // Fuzzy reference resolution state
  const [resolvedRef, setResolvedRef] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [normalizedQuery, setNormalizedQuery] = useState('')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Fuzzy resolve the query as the user types
  useEffect(() => {
    if (query.length < 2) {
      setResolvedRef(null)
      setSuggestions([])
      setNormalizedQuery('')
      return
    }

    const normalized = normalizeSearchInput(query)
    if (normalized.type === 'reference' && normalized.parsed) {
      setResolvedRef(normalized.parsed)
      setNormalizedQuery(normalized.query)
      setSuggestions([])
    } else {
      setResolvedRef(null)
      setNormalizedQuery(normalized.query)
      // Check if the first word(s) are close to a book name
      const words = query.trim().split(/\s+/)
      if (words.length <= 3 && words[0].length >= 2) {
        const sugg = getSuggestions(words[0])
        setSuggestions(sugg)
      } else {
        setSuggestions([])
      }
    }
  }, [query])

  useEffect(() => {
    if (query.length < 3) { setResults(null); setActiveIdx(-1); setSynopsis(''); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        // Use normalized query if we resolved a reference, otherwise raw query
        const searchQuery = normalizedQuery || query
        const data = semantic
          ? await api.semanticSearch(searchQuery, translation)
          : await api.search(searchQuery, scope, translation)
        setResults(data)
        setActiveIdx(-1)

        // Stream AI synopsis for non-empty results
        if (data?.results?.length > 0) {
          synopsisStopRef.current?.()
          setSynopsis('')
          setSynopsisLoading(true)
          synopsisStopRef.current = streamAI(
            'search-synopsis',
            { query: searchQuery, results: data.results.slice(0, 8) },
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
  }, [query, normalizedQuery, scope, semantic, translation])

  const resultList = useMemo(() => results?.results ?? [], [results?.results])

  const navigate = useCallback((result) => {
    setReference(result.book, result.chapter, result.verse)
    onClose()
  }, [setReference, onClose])

  // Navigate directly to a parsed reference
  function navigateToReference(parsed) {
    if (parsed && parsed.bookName && parsed.chapter) {
      setReference(parsed.bookName, parsed.chapter, parsed.verse || null)
      onClose()
    }
  }

  // Accept a suggestion
  function acceptSuggestion(suggestion) {
    // Replace the first word with the suggestion, keep the rest
    const words = query.trim().split(/\s+/)
    words[0] = suggestion
    const newQuery = words.join(' ')
    setQuery(newQuery)
    setSuggestions([])
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
  }, [resultList, activeIdx, onClose, navigate])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Scripture search"
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || (e.key === 'Enter' && activeIdx >= 0)) {
                e.preventDefault()
                handleKeyDown(e)
              }
            }}
            aria-label="Search scriptures and commentaries"
            placeholder="Search scriptures and commentaries…"
            className="flex-1 text-base focus:outline-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Fuzzy reference resolution banner */}
        {resolvedRef && resolvedRef.reference && (
          <div className="px-4 py-2 bg-green-50 dark:bg-green-950/30 border-b border-green-100 dark:border-green-900/50 flex items-center justify-between">
            <p className="text-xs text-green-700 dark:text-green-300">
              <span className="font-medium">Resolved:</span>{' '}
              <span className="font-semibold">{resolvedRef.reference}</span>
            </p>
            <button
              onClick={() => navigateToReference(resolvedRef)}
              className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded font-medium transition-colors"
            >
              Go
            </button>
          </div>
        )}

        {/* Did you mean suggestions */}
        {suggestions.length > 0 && !resolvedRef && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/50">
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-1">Did you mean?</p>
            <div className="flex gap-1.5 flex-wrap">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => acceptSuggestion(s)}
                  className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

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
        <div className="max-h-80 overflow-y-auto" ref={listRef} role="listbox" aria-label="Search results">
          {loading && (
            <div className="p-4 text-sm text-gray-400 text-center">Searching…</div>
          )}

          {!loading && query.length >= 3 && results?.results?.length === 0 && (
            <div className="p-4 text-sm text-gray-400 text-center">
              No results for "{normalizedQuery || query}"
            </div>
          )}

          {resultList.map((result, i) => (
            <button
              key={i}
              role="option"
              aria-selected={activeIdx === i}
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
