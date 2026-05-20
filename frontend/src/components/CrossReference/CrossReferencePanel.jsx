import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Cross, ExternalLink } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'

export default function CrossReferencePanel() {
  const { book, chapter, verse, setReference } = useStudyStore()
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['cross-ref', book, chapter, verse],
    queryFn: () => api.getVerseCommentary(book, chapter, verse, 'TSK'),
    enabled: !!book && !!chapter && !!verse,
  })

  function toggleGroup(key) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function goToReference(refText) {
    // Parse references like "Gen. 1:1" or "John 3:16" or "Rom. 5:12-14"
    const match = refText.match(/^([\w\s.]+?)\s+(\d+):(\d+)(?:-(\d+))?$/)
    if (match) {
      const [, bk, ch, v] = match
      setReference(bk.trim(), parseInt(ch), parseInt(v))
    }
  }

  // Group cross-references by verse range
  const groups = {}
  if (data?.entries) {
    for (const entry of data.entries) {
      const key = `${entry.verse_start}-${entry.verse_end}`
      if (!groups[key]) groups[key] = []
      groups[key].push(entry)
    }
  }

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Cross size={13} />
          Cross-References
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">{reference}</span>
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

        {Object.entries(groups).map(([key, entries]) => {
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
                    // Parse the text to extract reference links
                    // TSK entries typically contain references like "Gen. 1:1" or "John 3:16"
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
