import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

export default function SearchModal({ onClose }) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('bible')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const { translation, setReference } = useStudyStore()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.length < 3) { setResults(null); setActiveIdx(-1); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await api.search(query, scope, translation)
        setResults(data)
        setActiveIdx(-1)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, scope, translation])

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

        {/* Scope tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-2 bg-white dark:bg-gray-800">
          {['bible', 'commentary', 'all'].map((s) => (
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
        </div>

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
