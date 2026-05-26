import { useQuery } from '@tanstack/react-query'
import { Check, Columns2, Loader2, Settings2 } from 'lucide-react'
import { useStudyStore, FONT_SIZES } from '../../stores/studyStore'
import { api } from '../../api/client'
import { computeWordDiff } from '../../utils/diff'
import clsx from 'clsx'
import { useState } from 'react'

const FALLBACK_TRANSLATIONS = ['KJV', 'ASV', 'YLT', 'Darby', 'Webster', 'NHEB', 'BSB', 'LEB']

export default function ComparePanel() {
  const { book, chapter, selectedVerse, translation: baseTranslation, compareTranslations, setCompareTranslations, fontSizeIdx } = useStudyStore()
  const [showPicker, setShowPicker] = useState(false)

  // Use the navigation verse (1) if no specific verse is selected
  const activeVerse = selectedVerse || 1

  // Ensure compare translations list exists and has defaults
  const activeComparisons = compareTranslations.length > 0 
    ? compareTranslations 
    : [baseTranslation, baseTranslation !== 'KJV' ? 'KJV' : 'ASV']

  const translationsQueryStr = activeComparisons.join(',')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['compare-verse', book, chapter, activeVerse, translationsQueryStr],
    queryFn: () => api.compareTranslations(book, chapter, activeVerse, translationsQueryStr),
    enabled: !!book && !!chapter && !!activeVerse,
  })

  const { data: transData } = useQuery({
    queryKey: ['translations'],
    queryFn: api.getTranslations,
    staleTime: Infinity,
  })
  const availableTranslations = transData?.translations?.filter((t) => t !== 'KJVA') ?? FALLBACK_TRANSLATIONS

  function toggleTranslation(t) {
    if (activeComparisons.includes(t)) {
      if (activeComparisons.length > 1) {
        setCompareTranslations(activeComparisons.filter(x => x !== t))
      }
    } else {
      if (activeComparisons.length < 5) {
        setCompareTranslations([...activeComparisons, t])
      }
    }
  }

  // Transform data.translations { "KJV": "text", "ASV": "text" } into an ordered array
  const results = data?.translations 
    ? activeComparisons.map(t => ({ translation: t, text: data.translations[t] })).filter(r => r.text)
    : []

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Columns2 size={16} className="text-blue-500" />
          <span>{book} {chapter}:{activeVerse}</span>
        </div>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className={clsx(
            "p-1.5 rounded transition-colors",
            showPicker ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
          )}
          title="Select translations"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {showPicker && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 max-h-48 overflow-y-auto grid grid-cols-2 gap-2">
          {availableTranslations.map(t => (
            <button
              key={t}
              onClick={() => toggleTranslation(t)}
              className={clsx(
                "flex items-center justify-between px-2 py-1.5 text-xs rounded border text-left",
                activeComparisons.includes(t)
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400"
              )}
            >
              <span>{t}</span>
              {activeComparisons.includes(t) && <Check size={12} />}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!selectedVerse && (
          <div className="text-xs text-gray-400 dark:text-gray-500 italic mb-4 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
            Click any verse in the reader to compare it. Showing verse 1 by default.
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : isError ? (
          <div className="text-red-500 text-sm text-center py-4">Failed to load translations</div>
        ) : (
          <div className="space-y-6">
            {results.map((res, index) => {
              // The first translation in the list acts as the "base" for diffing
              const baseText = results[0]?.text || ''
              const isBase = index === 0
              
              const words = isBase ? 
                [{ text: res.text, type: 'same' }] : 
                computeWordDiff(baseText, res.text)

              return (
                <div key={res.translation} className="group">
                  <div className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1 flex items-center justify-between">
                    <span>{res.translation}</span>
                    {isBase && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">Base</span>}
                  </div>
                  <div 
                    className="text-gray-800 dark:text-gray-200"
                    style={{ fontSize: FONT_SIZES[fontSizeIdx], lineHeight: 1.6 }}
                  >
                    {isBase ? (
                      res.text
                    ) : (
                      words.map((w, i) => (
                        <span 
                          key={i} 
                          className={clsx(
                            w.type === 'diff' && "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 rounded-sm px-[1px] transition-colors"
                          )}
                        >
                          {w.text}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
