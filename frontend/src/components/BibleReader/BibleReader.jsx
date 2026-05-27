import { useQuery } from '@tanstack/react-query'
import { useStudyStore, FONT_SIZES } from '../../stores/studyStore'
import { api } from '../../api/client'
import VerseText from './VerseText'
import CompareView from './CompareView'
import InterlinearVerse from './InterlinearVerse'
import VisualFiltersPanel from './VisualFilters/VisualFiltersPanel'
import BookIntroCard from './BookIntroCard'

export default function BibleReader() {
  const { book, chapter, translation, verse: activeVerse, fontSizeIdx, compareMode, interlinearMode, reverseInterlinear, showLemmas, openWordStudy } = useStudyStore()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['chapter', translation, book, chapter],
    queryFn: () => api.getChapter(translation, book, chapter),
    enabled: !!book && !!chapter && !compareMode,
    retry: false,
  })

  const { data: highlightData } = useQuery({
    queryKey: ['highlights', translation, book, chapter],
    queryFn: () => api.getHighlights(book, chapter, translation),
    enabled: !!book && !!chapter && !compareMode,
  })

  // Fetch interlinear data for the whole chapter when interlinear mode is on
  const { data: interlinearData, isLoading: interlinearLoading } = useQuery({
    queryKey: ['interlinear', translation, book, chapter],
    queryFn: () => api.getChapterInterlinear(translation, book, chapter),
    enabled: !!book && !!chapter && (interlinearMode || reverseInterlinear) && !compareMode,
  })

  // Fetch lemma data for inline display when showLemmas is on
  const { data: lemmaData, isLoading: lemmaLoading } = useQuery({
    queryKey: ['lemmas', translation, book, chapter],
    queryFn: () => api.getChapterLemmas(translation, book, chapter),
    enabled: !!book && !!chapter && showLemmas && !compareMode && !interlinearMode && !reverseInterlinear,
  })

  const highlights = highlightData?.highlights ?? {}

  if (compareMode) {
    return <CompareView />
  }

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

  // Build interlinear map: verse -> words[]
  const interlinearMap = {}
  if (interlinearData?.verses) {
    for (const v of interlinearData.verses) {
      interlinearMap[v.verse] = v.words || []
    }
  }

  // Build lemma map: verse -> words[]
  const lemmaMap = {}
  if (lemmaData?.verses) {
    for (const v of lemmaData.verses) {
      lemmaMap[v.verse] = v.words || []
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
      {/* Visual Filters toolbar — always visible when interlinear is on */}
      <VisualFiltersPanel />

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Chapter header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif font-semibold text-gray-800 dark:text-gray-100">
            {data.book}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Chapter {data.chapter} · {data.translation}
            {interlinearMode && !reverseInterlinear && <span className="ml-2 text-blue-500">· Interlinear</span>}
            {reverseInterlinear && <span className="ml-2 text-purple-500">· Reverse Interlinear</span>}
            {showLemmas && !interlinearMode && !reverseInterlinear && <span className="ml-2 text-emerald-500">· Lemmas</span>}
          </p>
          <div className="w-16 h-px bg-gray-300 dark:bg-gray-600 mx-auto mt-3" />
        </div>

        {/* Book introduction card — chapter 1 only */}
        {data.chapter === 1 && <BookIntroCard book={data.book} />}

        {/* Verses */}
        <div
          className="bible-text space-y-0.5 text-gray-900 dark:text-gray-100"
          style={{ fontSize: FONT_SIZES[fontSizeIdx] }}
        >
          {(interlinearMode || reverseInterlinear) && interlinearLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400 dark:text-gray-500">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              Loading interlinear data…
            </div>
          )}

          {(interlinearMode || reverseInterlinear) && lemmaLoading && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-400 dark:text-gray-500">
              <div className="animate-spin w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full" />
              Loading lemma data…
            </div>
          )}

          {data.verses.map(({ verse, text }) => {
            if (interlinearMode || reverseInterlinear) {
              return (
                <InterlinearVerse
                  key={verse}
                  verse={verse}
                  text={text}
                  book={data.book}
                  chapter={data.chapter}
                  translation={data.translation}
                  isActive={activeVerse === verse}
                  highlightColor={highlights[String(verse)]?.color}
                  highlightId={highlights[String(verse)]?.id}
                  words={interlinearMap[verse] || []}
                  language={interlinearData?.language || 'greek'}
                  reverseMode={reverseInterlinear}
                  onWordClick={reverseInterlinear ? openWordStudy : null}
                />
              )
            }
            return (
              <VerseText
                key={verse}
                verse={verse}
                text={text}
                book={data.book}
                chapter={data.chapter}
                translation={data.translation}
                isActive={activeVerse === verse}
                highlightColor={highlights[String(verse)]?.color}
                highlightId={highlights[String(verse)]?.id}
                lemmaWords={lemmaMap[verse] || []}
                lemmaLanguage={lemmaData?.language || null}
              />
            )
          })}
        </div>

        <div className="mt-12 pb-8 text-center text-xs text-gray-400 dark:text-gray-600">
          {data.translation} · {data.verses.length} verses
        </div>
      </div>
    </div>
  )
}
