import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, RefreshCw, BookOpen, MapPin, Users, Sparkles, Loader, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { api } from '../../api/client'
import clsx from 'clsx'

const ENTITY_TYPES = [
  { value: '', label: 'All', icon: BookOpen },
  { value: 'person', label: 'People', icon: Users },
  { value: 'place', label: 'Places', icon: MapPin },
  { value: 'theme', label: 'Themes', icon: Sparkles },
]

const MARKDOWN_COMPONENTS = {
  h1: (p) => <h3 className="text-base font-semibold mt-3 mb-1" {...p} />,
  h2: (p) => <h4 className="text-sm font-semibold mt-2 mb-1 text-amber-700 dark:text-amber-400" {...p} />,
  h3: (p) => <h5 className="text-sm font-semibold mt-1.5 mb-0.5" {...p} />,
  p: (p) => <p className="my-1 leading-relaxed" {...p} />,
  ul: (p) => <ul className="list-disc ml-5 my-1 space-y-0.5" {...p} />,
  ol: (p) => <ol className="list-decimal ml-5 my-1 space-y-0.5" {...p} />,
  blockquote: (p) => (
    <blockquote
      className="border-l-2 border-amber-300 dark:border-amber-700 pl-3 my-1 italic text-gray-600 dark:text-gray-300"
      {...p}
    />
  ),
  code: ({ inline, ...rest }) =>
    inline ? (
      <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-[0.85em] font-mono" {...rest} />
    ) : (
      <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded my-2 text-xs overflow-x-auto">
        <code {...rest} />
      </pre>
    ),
  a: (p) => <a className="text-blue-600 dark:text-blue-400 underline" {...p} />,
}

const SUGGESTED_ENTITIES = [
  'David', 'Paul', 'Moses', 'Jesus', 'Abraham',
  'Jerusalem', 'Bethlehem', 'Red Sea', 'Mount Sinai',
  'Grace', 'Covenant', 'Resurrection', 'Faith',
]

export default function FactbookPanel() {
  const [searchInput, setSearchInput] = useState('')
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [selectedType, setSelectedType] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [questionsOpen, setQuestionsOpen] = useState(false)
  const bottomRef = useRef(null)
  const qc = useQueryClient()

  // Fetch entity entry
  const { data: entry, isLoading, isError, error } = useQuery({
    queryKey: ['factbook', selectedEntity, selectedType],
    queryFn: () => api.getFactbookEntry(selectedEntity, selectedType || undefined),
    enabled: !!selectedEntity,
    retry: false,
  })

  // Fetch entry list for browsing
  const { data: entriesList } = useQuery({
    queryKey: ['factbook-list', selectedType, searchInput],
    queryFn: () => api.listFactbookEntries(
      selectedType || undefined,
      searchInput || undefined,
      50
    ),
    retry: false,
  })

  const { data: questionsData, isLoading: questionsLoading } = useQuery({
    queryKey: ['factbook-questions', selectedEntity, selectedType],
    queryFn: () => api.getFactbookQuestions(selectedEntity, selectedType || undefined),
    enabled: !!selectedEntity && questionsOpen,
    staleTime: 1000 * 60 * 30,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entry?.content])

  const handleSearch = useCallback((e) => {
    e.preventDefault()
    if (!searchInput.trim()) return
    setSelectedEntity(searchInput.trim())
  }, [searchInput])

  const handleRefresh = useCallback(async () => {
    if (!selectedEntity) return
    setIsGenerating(true)
    try {
      await qc.fetchQuery({
        queryKey: ['factbook', selectedEntity, selectedType],
        queryFn: () => api.getFactbookEntry(selectedEntity, selectedType || undefined, true),
        staleTime: 0,
      })
    } finally {
      setIsGenerating(false)
    }
  }, [selectedEntity, selectedType, qc])

  const handleSuggestedClick = useCallback((entity) => {
    setSearchInput(entity)
    setSelectedEntity(entity)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <BookOpen size={13} />
          Factbook
        </span>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSearch} className="flex gap-1.5">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search people, places, themes…"
            className="flex-1 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded px-2 py-1.5 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={!searchInput.trim()}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded px-2 py-1.5 transition-colors"
          >
            <Search size={12} />
          </button>
        </form>

        {/* Type filter tabs */}
        <div className="flex gap-1 mt-1.5">
          {ENTITY_TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setSelectedType(value)}
              className={clsx(
                'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors',
                selectedType === value
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Icon size={10} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {/* No entity selected — show suggestions */}
        {!selectedEntity && (
          <div className="p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Suggested entries:</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_ENTITIES.map((entity) => (
                <button
                  key={entity}
                  onClick={() => handleSuggestedClick(entity)}
                  className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                >
                  {entity}
                </button>
              ))}
            </div>

            {/* Show cached entries if any */}
            {entriesList?.entries?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Cached entries:</p>
                <div className="space-y-1">
                  {entriesList.entries.map((e) => (
                    <button
                      key={`${e.entity_name}-${e.entity_type}`}
                      onClick={() => handleSuggestedClick(e.entity_name)}
                      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-2"
                    >
                      <span className="font-medium">{e.entity_name}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded px-1">
                        {e.entity_type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader size={24} className="animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Generating entry for <strong>{selectedEntity}</strong>…
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="p-4 text-center">
            <p className="text-xs text-red-600 dark:text-red-400 mb-1">Failed to load entry</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{error?.message}</p>
          </div>
        )}

        {/* Entry content */}
        {entry && !isLoading && (
          <div className="p-3">
            {/* Entry header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {entry.entity_name}
                </h3>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5">
                  {entry.entity_type}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {entry.cached && (
                  <span className="text-[9px] text-gray-400 dark:text-gray-500 mr-1">cached</span>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={isGenerating}
                  className="text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-40"
                  title="Regenerate"
                >
                  <RefreshCw size={12} className={isGenerating ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Entry body */}
            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={MARKDOWN_COMPONENTS}
              >
                {entry.content}
              </ReactMarkdown>
            </div>

            {/* Study Questions */}
            <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-3">
              <button
                onClick={() => setQuestionsOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors w-full"
              >
                <HelpCircle size={12} />
                Study Questions
                {questionsOpen ? <ChevronDown size={11} className="ml-auto" /> : <ChevronRight size={11} className="ml-auto" />}
              </button>

              {questionsOpen && (
                <div className="mt-2 space-y-2">
                  {questionsLoading ? (
                    <div className="space-y-1.5">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-3 bg-amber-50 dark:bg-amber-900/20 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : questionsData?.questions?.length > 0 ? (
                    <ol className="space-y-2 list-none">
                      {questionsData.questions.map((q, i) => (
                        <li key={i} className="flex gap-2 text-xs text-gray-700 dark:text-gray-300">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] flex items-center justify-center font-semibold">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{q}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-gray-400">No questions available.</p>
                  )}
                </div>
              )}
            </div>

            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
