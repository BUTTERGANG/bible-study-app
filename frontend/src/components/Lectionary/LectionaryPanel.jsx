import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Calendar, ChevronLeft, ChevronRight, Church } from 'lucide-react'
import { api } from '../../api/client'
import { useStudyStore } from '../../stores/studyStore'
import clsx from 'clsx'

const SEASON_COLORS = {
  'Advent': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
  'Christmas': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
  'Epiphany': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  'Transfiguration': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  'Lent': 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
  'Holy Week': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
  'Easter': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  'Pentecost': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
  'Trinity': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  'Ordinary Time': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  'Christ the King': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  'All Saints': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
}

function SeasonBadge({ season }) {
  const colorClass = SEASON_COLORS[season] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
  return (
    <span className={clsx('text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border', colorClass)}>
      {season}
    </span>
  )
}

export default function LectionaryPanel() {
  const { setBook, setChapter, setVerse } = useStudyStore()
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['lectionary', selectedDate],
    queryFn: () => api.getReadingsByDate(selectedDate),
    staleTime: 30 * 60 * 1000,
  })

  function handlePrevDay() {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  function handleNextDay() {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  function handleToday() {
    setSelectedDate(new Date().toISOString().split('T')[0])
  }

  function handleNavigate(citation) {
    // citation is like "Isaiah 2:1-5"
    const parts = citation.split(' ')
    const chapter_verses = parts[parts.length - 1]
    const chapter = parseInt(chapter_verses.split(':')[0])
    const book = parts.slice(0, parts.length - 1).join(' ')
    if (book && chapter) {
      setBook(book)
      setChapter(chapter)
    }
  }

  const formattedDate = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00')
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }, [selectedDate])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex items-center gap-2">
          <Church size={14} className="text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Lectionary</h2>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevDay}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            title="Previous day"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={handleToday}
            className="flex-1 text-center text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded py-1 truncate px-1"
          >
            {formattedDate}
          </button>
          <button
            onClick={handleNextDay}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            title="Next day"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={handleToday}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            title="Today"
          >
            <Calendar size={14} />
          </button>
        </div>

        {/* Season & Sunday name */}
        {data?.season && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <SeasonBadge season={data.season} />
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                Year {data.year_cycle || 'A'}
              </span>
            </div>
            {data.sunday_name && (
              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                {data.sunday_name}
              </p>
            )}
            {data.matched_date && data.matched_date !== selectedDate && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                Showing nearest reading: {data.matched_date}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Readings */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-xs text-gray-400">
            <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full mr-2" />
            Loading readings...
          </div>
        ) : isError ? (
          <div className="p-4 text-center text-xs text-red-400">
            Failed to load lectionary data.
          </div>
        ) : data?.readings?.length > 0 ? (
          <div className="p-3 space-y-2">
            {data.readings.map((reading, idx) => (
              <button
                key={idx}
                onClick={() => handleNavigate(reading.citation)}
                className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-500 dark:text-purple-400">
                    {reading.lectionary_label}
                  </span>
                  <BookOpen size={10} className="text-gray-400 group-hover:text-purple-500" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-purple-700 dark:group-hover:text-purple-300">
                  {reading.citation}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
            <Calendar size={24} className="mb-2 opacity-40" />
            <p className="text-xs">No readings for this date</p>
            <p className="text-[10px] mt-1 text-gray-400 dark:text-gray-600">
              Try a Sunday or major feast day
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500 text-center">
        Revised Common Lectionary (RCL) — Year {data?.year_cycle || 'A'}
      </div>
    </div>
  )
}
