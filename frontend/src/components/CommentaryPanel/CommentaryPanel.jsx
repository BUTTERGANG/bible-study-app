import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react'

export default function CommentaryPanel() {
  const { book, chapter, verse } = useStudyStore()
  const [expandedSources, setExpandedSources] = useState(new Set(['MHC', 'JFB']))

  const { data: sourcesData } = useQuery({
    queryKey: ['commentary-sources'],
    queryFn: api.getCommentarySources,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['commentary', book, chapter, verse],
    queryFn: () =>
      verse
        ? api.getVerseCommentary(book, chapter, verse)
        : api.getVerseCommentary(book, chapter, 1),
    enabled: !!book && !!chapter,
  })

  function toggleSource(sourceId) {
    setExpandedSources((prev) => {
      const next = new Set(prev)
      if (next.has(sourceId)) next.delete(sourceId)
      else next.add(sourceId)
      return next
    })
  }

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <BookOpen size={13} />
          Commentary
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">{reference}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-sm text-gray-400 text-center">Loading…</div>
        )}

        {!isLoading && (!data?.entries || data.entries.length === 0) && (
          <div className="p-4 text-sm text-gray-400 text-center">
            No commentary available for this passage.
            <br />
            <span className="text-xs">Run ingest_sword.py to load commentaries.</span>
          </div>
        )}

        {data?.entries &&
          groupBySource(data.entries).map(([source, entries]) => (
            <CommentarySource
              key={source}
              sourceId={source}
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

function CommentarySource({ sourceId, displayName, entries, expanded, onToggle }) {
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
