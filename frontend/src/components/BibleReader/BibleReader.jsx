import { useQuery } from '@tanstack/react-query'
import { useStudyStore, FONT_SIZES } from '../../stores/studyStore'
import { api } from '../../api/client'
import VerseText from './VerseText'

export default function BibleReader() {
  const { book, chapter, translation, verse: activeVerse, fontSizeIdx } = useStudyStore()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['chapter', translation, book, chapter],
    queryFn: () => api.getChapter(translation, book, chapter),
    enabled: !!book && !!chapter,
    retry: false,
  })

  const { data: highlightData } = useQuery({
    queryKey: ['highlights', translation, book, chapter],
    queryFn: () => api.getHighlights(book, chapter, translation),
  })

  const highlights = highlightData?.highlights ?? {}

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-2">✝</div>
          <div>Loading {book} {chapter}…</div>
        </div>
      </div>
    )
  }

  if (isError || !data) {
    const isNotFound = error?.message?.startsWith('404')
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 p-8">
        <div className="text-center">
          {isNotFound ? (
            <>
              <p className="font-medium text-gray-600 dark:text-gray-400">
                {book} is not available in {translation}
              </p>
              <p className="text-sm mt-1">
                Try switching to KJV, ASV, or BSB for full Bible coverage.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Could not load {book} {chapter}</p>
              <p className="text-sm mt-1">The server may still be starting up — try again in a moment.</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Chapter header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif font-semibold text-gray-800 dark:text-gray-100">
            {data.book}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Chapter {data.chapter} · {data.translation}
          </p>
          <div className="w-16 h-px bg-gray-300 dark:bg-gray-600 mx-auto mt-3" />
        </div>

        {/* Verses */}
        <div
          className="bible-text space-y-0.5 text-gray-900 dark:text-gray-100"
          style={{ fontSize: FONT_SIZES[fontSizeIdx] }}
        >
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

        <div className="mt-12 pb-8 text-center text-xs text-gray-400 dark:text-gray-600">
          {data.translation} · {data.verses.length} verses
        </div>
      </div>
    </div>
  )
}
