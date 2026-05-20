import { useQuery } from '@tanstack/react-query'
import { useStudyStore, FONT_SIZES } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

const TRANSLATION_COLORS = {
  KJV:  { border: 'border-red-300 dark:border-red-700',  bg: 'bg-red-50 dark:bg-red-900/20',  header: 'text-red-700 dark:text-red-400' },
  ASV:  { border: 'border-blue-300 dark:border-blue-700', bg: 'bg-blue-50 dark:bg-blue-900/20', header: 'text-blue-700 dark:text-blue-400' },
  YLT:  { border: 'border-green-300 dark:border-green-700', bg: 'bg-green-50 dark:bg-green-900/20', header: 'text-green-700 dark:text-green-400' },
  BSB:  { border: 'border-purple-300 dark:border-purple-700', bg: 'bg-purple-50 dark:bg-purple-900/20', header: 'text-purple-700 dark:text-purple-400' },
  Darby: { border: 'border-amber-300 dark:border-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/20', header: 'text-amber-700 dark:text-amber-400' },
  LEB:  { border: 'border-teal-300 dark:border-teal-700', bg: 'bg-teal-50 dark:bg-teal-900/20', header: 'text-teal-700 dark:text-teal-400' },
  NETfree: { border: 'border-orange-300 dark:border-orange-700', bg: 'bg-orange-50 dark:bg-orange-900/20', header: 'text-orange-700 dark:text-orange-400' },
  NHEB: { border: 'border-pink-300 dark:border-pink-700', bg: 'bg-pink-50 dark:bg-pink-900/20', header: 'text-pink-700 dark:text-pink-400' },
  OEB:  { border: 'border-cyan-300 dark:border-cyan-700', bg: 'bg-cyan-50 dark:bg-cyan-900/20', header: 'text-cyan-700 dark:text-cyan-400' },
  Rotherham: { border: 'border-lime-300 dark:border-lime-700', bg: 'bg-lime-50 dark:bg-lime-900/20', header: 'text-lime-700 dark:text-lime-400' },
  Webster: { border: 'border-indigo-300 dark:border-indigo-700', bg: 'bg-indigo-50 dark:bg-indigo-900/20', header: 'text-indigo-700 dark:text-indigo-400' },
  Wycliffe: { border: 'border-rose-300 dark:border-rose-700', bg: 'bg-rose-50 dark:bg-rose-900/20', header: 'text-rose-700 dark:text-rose-400' },
  KJVA: { border: 'border-yellow-300 dark:border-yellow-700', bg: 'bg-yellow-50 dark:bg-yellow-900/20', header: 'text-yellow-700 dark:text-yellow-400' },
}

function colorFor(t) {
  return TRANSLATION_COLORS[t] || { border: 'border-gray-300 dark:border-gray-600', bg: 'bg-gray-50 dark:bg-gray-800', header: 'text-gray-700 dark:text-gray-300' }
}

export default function CompareView() {
  const { book, chapter, compareTranslations, fontSizeIdx } = useStudyStore()
  const translations = compareTranslations.length > 0 ? compareTranslations : [useStudyStore.getState().translation]

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif font-semibold text-gray-800 dark:text-gray-100">
            {book} {chapter}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Comparing {translations.length} translation{translations.length > 1 ? 's' : ''}: {translations.join(', ')}
          </p>
          <div className="w-16 h-px bg-gray-300 dark:bg-gray-600 mx-auto mt-3" />
        </div>

        {/* Translation columns */}
        <div className={clsx('grid gap-4', translations.length <= 2 ? 'grid-cols-1 md:grid-cols-2' : translations.length <= 4 ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3')}>
          {translations.map((t) => (
            <TranslationColumn
              key={t}
              translation={t}
              book={book}
              chapter={chapter}
              fontSize={FONT_SIZES[fontSizeIdx]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TranslationColumn({ translation, book, chapter, fontSize }) {
  const colors = colorFor(translation)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['chapter', translation, book, chapter],
    queryFn: () => api.getChapter(translation, book, chapter),
    enabled: !!book && !!chapter,
    retry: false,
  })

  return (
    <div className={clsx('rounded-lg border', colors.border, colors.bg)}>
      <div className={clsx('px-4 py-2.5 border-b font-semibold text-sm', colors.border, colors.header)}>
        {translation}
      </div>
      <div className="p-4" style={{ fontSize }}>
        {isLoading && (
          <div className="text-gray-400 dark:text-gray-500 text-sm text-center py-8 animate-pulse">
            Loading…
          </div>
        )}
        {isError && (
          <div className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">
            {book} is not available in {translation}
          </div>
        )}
        {data?.verses && (
          <div className="space-y-0.5 text-gray-900 dark:text-gray-100" style={{ lineHeight: 1.9 }}>
            {data.verses.map(({ verse, text }) => (
              <span key={verse} className="inline">
                <sup className="text-xs font-bold text-blue-500 mr-0.5 select-none align-super">{verse}</sup>
                {text}{' '}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
