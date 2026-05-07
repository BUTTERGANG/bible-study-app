import { useQuery } from '@tanstack/react-query'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import VerseText from './VerseText'
import clsx from 'clsx'

export default function BibleReader() {
  const { book, chapter, translation, verse: activeVerse } = useStudyStore()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['chapter', translation, book, chapter],
    queryFn: () => api.getChapter(translation, book, chapter),
    enabled: !!book && !!chapter,
  })

  const { data: highlightData } = useQuery({
    queryKey: ['highlights', book, chapter],
    queryFn: () => api.getHighlights(book, chapter),
  })

  const highlights = highlightData?.highlights ?? {}

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-2">✝</div>
          <div>Loading {book} {chapter}…</div>
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 p-8">
        <div className="text-center">
          <p className="font-medium">Chapter not available</p>
          <p className="text-sm mt-1">Run the SWORD ingestion script to load Bible text</p>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 block">
            python app/ingest/ingest_sword.py
          </code>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Chapter header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif font-semibold text-gray-800">
            {data.book}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Chapter {data.chapter} · {data.translation}
          </p>
          <div className="w-16 h-px bg-gray-300 mx-auto mt-3" />
        </div>

        {/* Verses */}
        <div className="bible-text space-y-0.5">
          {data.verses.map(({ verse, text }) => (
            <VerseText
              key={verse}
              verse={verse}
              text={text}
              book={data.book}
              chapter={data.chapter}
              translation={data.translation}
              isActive={activeVerse === verse}
              highlightColor={highlights[String(verse)]?.color}
            />
          ))}
        </div>

        <div className="mt-12 pb-8 text-center text-xs text-gray-400">
          {data.translation} · {data.verses.length} verses
        </div>
      </div>
    </div>
  )
}
