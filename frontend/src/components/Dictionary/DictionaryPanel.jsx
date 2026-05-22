import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ChevronRight, Search } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

const DICTIONARY_SOURCES = [
  { id: 'Easton', name: "Easton's Bible Dictionary" },
  { id: 'ISBE', name: 'International Standard Bible Encyclopedia' },
  { id: 'Nave', name: "Nave's Topical Bible" },
  { id: 'Smith', name: "Smith's Bible Dictionary" },
  { id: 'Webster1828', name: "Webster's 1828 Dictionary" },
]

export default function DictionaryPanel() {
  const { book, chapter, verse } = useStudyStore()
  const [query, setQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [activeEntry, setActiveEntry] = useState(null)
  const [searchQ, setSearchQ] = useState('')

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`

  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ['dictionary-search', searchQ, selectedSource],
    queryFn: () => api.searchDictionary(searchQ, selectedSource || undefined),
    enabled: searchQ.length >= 2,
  })

  const { data: entryData, isLoading: loadingEntry } = useQuery({
    queryKey: ['dictionary-entry', activeEntry?.source, activeEntry?.term],
    queryFn: () => api.getDictionaryEntry(activeEntry.source, activeEntry.term),
    enabled: !!activeEntry,
  })

  function handleSearch(e) {
    e.preventDefault()
    if (query.trim().length >= 2) {
      setSearchQ(query.trim())
      setActiveEntry(null)
    }
  }

  function selectEntry(result) {
    setActiveEntry({ source: result.source, term: result.term })
  }

  const results = searchResults?.results ?? []

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <BookOpen size={13} />
          Dictionary
        </span>
        {activeEntry && (
          <button
            onClick={() => { setActiveEntry(null); setSearchQ('') }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            Back
          </button>
        )}
      </div>

      {!activeEntry && (
        <>
          {/* Search form */}
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 space-y-2">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1 flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1">
                <Search size={12} className="text-gray-400 flex-shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search dictionary…"
                  className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
                />
              </div>
              <button
                type="submit"
                disabled={query.trim().length < 2}
                className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md disabled:opacity-40 hover:bg-blue-700"
              >
                Go
              </button>
            </form>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedSource('')}
                className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded-full border transition-colors',
                  !selectedSource
                    ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                    : 'text-gray-500 border-gray-300 hover:border-gray-400 dark:border-gray-600'
                )}
              >
                All
              </button>
              {DICTIONARY_SOURCES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSource(selectedSource === s.id ? '' : s.id)}
                  className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded-full border transition-colors',
                    selectedSource === s.id
                      ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                      : 'text-gray-500 border-gray-300 hover:border-gray-400 dark:border-gray-600'
                  )}
                >
                  {s.id}
                </button>
              ))}
            </div>
          </div>

          {/* Search results */}
          <div className="flex-1 overflow-y-auto">
            {!searchQ && (
              <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
                <BookOpen size={24} className="mx-auto mb-2 opacity-30" />
                <p>Search Bible dictionaries and encyclopedias</p>
                <p className="text-xs mt-1">Easton, ISBE, Nave, Smith, Webster 1828</p>
              </div>
            )}

            {searching && (
              <div className="p-4 text-sm text-gray-400 text-center">Searching…</div>
            )}

            {!searching && searchQ && results.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">
                No results for "{searchQ}"
              </div>
            )}

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {results.map((result) => (
                <button
                  key={`${result.source}-${result.id}`}
                  onClick={() => selectEntry(result)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{result.term}</span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      {result.source}
                      <ChevronRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{result.snippet}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {activeEntry && (
        <div className="flex-1 overflow-y-auto">
          {loadingEntry ? (
            <div className="p-4 text-sm text-gray-400 text-center">Loading…</div>
          ) : entryData ? (
            <div className="p-4">
              <div className="mb-4">
                <h2 className="text-lg font-serif font-semibold text-gray-800 dark:text-gray-100">
                  {entryData.term}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {DICTIONARY_SOURCES.find((s) => s.id === entryData.source)?.name || entryData.source}
                </p>
                <div className="w-12 h-px bg-gray-300 dark:bg-gray-600 mt-2" />
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {entryData.text}
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-gray-400 text-center">Entry not found</div>
          )}
        </div>
      )}
    </div>
  )
}
