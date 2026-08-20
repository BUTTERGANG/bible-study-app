import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStudyStore } from '../../stores/studyStore'
import { useActiveVerse } from '../../hooks/useActiveVerse'
import { api } from '../../api/client'
import { BookOpen, Check, ChevronDown, ChevronRight, Filter } from 'lucide-react'
import clsx from 'clsx'
import { PanelHeader, PanelState } from '../common/PanelPrimitives'

export default function CommentaryPanel() {
  const { book, chapter, commentarySources, setCommentarySources } = useStudyStore()
  const verse = useActiveVerse()
  const [expandedSources, setExpandedSources] = useState(new Set(['MHC', 'JFB']))
  const [showSourcePicker, setShowSourcePicker] = useState(false)

  const selectedSources = commentarySources

  const { data: sourcesData } = useQuery({
    queryKey: ['commentary-sources'],
    queryFn: api.getCommentarySources,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['commentary', book, chapter, verse, selectedSources.join(',')],
    queryFn: () => api.getVerseCommentary(book, chapter, verse, selectedSources.join(',')),
    enabled: !!book && !!chapter && !!verse,
  })

  function toggleSource(sourceId) {
    setExpandedSources((prev) => {
      const next = new Set(prev)
      if (next.has(sourceId)) next.delete(sourceId)
      else next.add(sourceId)
      return next
    })
  }

  function toggleFilterSource(sourceId) {
    setCommentarySources(
      selectedSources.includes(sourceId)
        ? selectedSources.filter((s) => s !== sourceId)
        : [...selectedSources, sourceId]
    )
  }

  const sources = sourcesData?.sources ?? []
  const activeFilterCount = selectedSources.length
  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader
        icon={BookOpen}
        title="Commentary"
        subtitle={reference}
        actions={sources.length > 0 && (
          <button
            aria-label="Filter commentary sources"
            onClick={() => setShowSourcePicker(!showSourcePicker)}
            className={clsx(
              'inline-flex min-h-10 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
              activeFilterCount > 0
                ? 'border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'border-gray-300 text-gray-500 hover:border-gray-400 dark:border-gray-600 dark:text-gray-400'
            )}
          >
            <Filter size={11} />
            {activeFilterCount > 0 ? activeFilterCount : 'Filter'}
          </button>
        )}
      />

      {/* Source picker dropdown */}
      {showSourcePicker && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Filter Sources
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setCommentarySources([])}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleFilterSource(s.id)}
                  className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded-full border transition-colors flex items-center gap-0.5',
                    selectedSources.includes(s.id)
                      ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                      : 'text-gray-500 border-gray-300 hover:border-gray-400 dark:border-gray-600'
                  )}
                >
                  {selectedSources.includes(s.id) && <Check size={8} />}
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-sm text-gray-400 text-center">Loading…</div>
        )}

        {!isLoading && !verse && (
          <PanelState
            icon={BookOpen}
            title="Choose a verse to begin"
            description="Select a verse in the reader and commentary will appear here."
          />
        )}

        {!isLoading && verse && (!data?.entries || data.entries.length === 0) && (
          <PanelState
            icon={BookOpen}
            title="No commentary for this verse"
            description="Try another verse or broaden the selected sources."
          />
        )}

        {data?.entries &&
          groupBySource(data.entries).map(([source, entries]) => (
            <CommentarySource
              key={source}
              displayName={entries[0].display_name}
              entries={entries}
              expanded={expandedSources.has(source)}
              onToggle={() => toggleSource(source)}
            />
          ))}
      </div>
    </div>
  )
}

function CommentarySource({ displayName, entries, expanded, onToggle }) {
  return (
    <div className="border-b border-gray-100 dark:border-gray-700">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{displayName}</span>
        {expanded ? (
          <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {entries.map((entry) => (
            <div key={entry.id} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
              {entry.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function groupBySource(entries) {
  const map = new Map()
  for (const entry of entries) {
    if (!map.has(entry.source)) map.set(entry.source, [])
    map.get(entry.source).push(entry)
  }
  return [...map.entries()]
}
