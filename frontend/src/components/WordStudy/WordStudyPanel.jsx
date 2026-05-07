import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layers, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
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

      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
        <p className="text-xs text-gray-500">
          {reference} · {data?.language ?? '—'}
        </p>
        {!verse && (
          <p className="text-xs text-gray-400 mt-0.5">Click a verse to study its words</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!verse && (
          <div className="p-4 text-sm text-gray-400 text-center">
            Click any verse in the Bible reader to see its original language words.
          </div>
        )}

        {isLoading && (
          <div className="p-4 text-sm text-gray-400 text-center">Loading…</div>
        )}

        {data?.words && (
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
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-lg text-gray-800">{word.original}</span>
                    <span className="text-xs text-gray-400">{word.strongs}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-blue-600">{word.transliteration}</span>
                    {word.morphology && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1 rounded">
                        {word.morphology}
                      </span>
                    )}
                    <span className="text-xs text-gray-600 italic">{word.gloss}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Strong's definition */}
            {selectedWord && strongsData && (
              <div className="border-t border-gray-100 pt-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {selectedWord.strongs} — {selectedWord.original}
                </h3>
                {strongsData.entries?.map((entry) => (
                  <div key={entry.source} className="mb-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">{entry.source}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{entry.definition}</p>
                    {entry.usage && (
                      <p className="text-xs text-gray-500 mt-1 italic">Usage: {entry.usage}</p>
                    )}
                  </div>
                ))}

                <button
                  onClick={() => {/* TODO: show all occurrences */}}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                >
                  See all occurrences <ExternalLink size={11} />
                </button>
              </div>
            )}
          </div>
        )}

        {data?.words?.length === 0 && (
          <div className="p-4 text-sm text-gray-400 text-center">
            No original language data available.
            <br />
            <span className="text-xs">Run ingest_stepbible.py to load word data.</span>
          </div>
        )}
      </div>
    </div>
  )
}
