import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layers } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

export default function WordStudyPanel() {
  const { book, chapter, verse, interlinearMode, toggleInterlinear } = useStudyStore()
  const [selectedWord, setSelectedWord] = useState(null)
  const [expandedStrongs, setExpandedStrongs] = useState(null)

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

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Layers size={13} />
          Word Study
        </span>
        <button
          onClick={toggleInterlinear}
          className={clsx(
            'text-xs px-2 py-0.5 rounded-full border transition-colors',
            interlinearMode
              ? 'bg-blue-100 text-blue-700 border-blue-300'
              : 'text-gray-500 border-gray-300 hover:border-gray-400'
          )}
        >
          Interlinear
        </button>
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
                    <span className="text-xs text-gray-400 dark:text-gray-500">{word.strongs}</span>
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
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  {selectedWord.strongs} — {selectedWord.original}
                </h3>
                {strongsData.entries?.map((entry) => (
                  <div key={entry.source} className="mb-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{entry.source}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{entry.definition}</p>
                    {entry.usage && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">Usage: {entry.usage}</p>
                    )}
                  </div>
                ))}
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
