import { FILTER_CATEGORIES, DEFAULT_COLORS } from '../../../utils/morphology'
import { useStudyStore } from '../../../stores/studyStore'
import clsx from 'clsx'
import { Palette, Eye, EyeOff } from 'lucide-react'

const CATEGORY_ORDER = [
  'verb', 'noun', 'adjective', 'participle', 'imperative',
  'pronoun', 'preposition', 'conjunction', 'adverb', 'article',
  'infinitive', 'properNoun', 'numeral', 'interjection', 'particle',
]

export default function VisualFiltersPanel() {
  const visualFiltersEnabled = useStudyStore((s) => s.visualFiltersEnabled)
  const visualFilters = useStudyStore((s) => s.visualFilters)
  const toggleVisualFilters = useStudyStore((s) => s.toggleVisualFilters)
  const toggleVisualFilter = useStudyStore((s) => s.toggleVisualFilter)

  const activeCount = Object.values(visualFilters).filter(Boolean).length
  const totalCount = Object.keys(visualFilters).length

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      {/* Toggle header */}
      <button
        onClick={toggleVisualFilters}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-2 text-xs font-medium transition-colors',
          visualFiltersEnabled
            ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
            : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        )}
      >
        <span className="flex items-center gap-1.5">
          <Palette size={13} />
          Visual Filters
          {visualFiltersEnabled && (
            <span className="ml-1 text-[10px] bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded-full px-1.5">
              {activeCount}/{totalCount}
            </span>
          )}
        </span>
        {visualFiltersEnabled ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>

      {/* Filter toggles */}
      {visualFiltersEnabled && (
        <div className="px-3 py-2 bg-white dark:bg-gray-900 space-y-1">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {CATEGORY_ORDER.map((key) => {
              const config = FILTER_CATEGORIES[key]
              if (!config) return null
              const isActive = visualFilters[key]
              const color = DEFAULT_COLORS[key] || 'rgba(107,114,128,0.2)'

              return (
                <button
                  key={key}
                  onClick={() => toggleVisualFilter(key)}
                  className={clsx(
                    'flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded transition-colors text-left',
                    isActive
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-gray-300 dark:border-gray-600"
                    style={{ backgroundColor: isActive ? color : 'transparent' }}
                  />
                  {config.label}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="pt-1 border-t border-gray-100 dark:border-gray-800 mt-1">
            <p className="text-[9px] text-gray-400 dark:text-gray-500">
              Highlights grammatical categories in the Bible text. Works in both standard and interlinear views.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
