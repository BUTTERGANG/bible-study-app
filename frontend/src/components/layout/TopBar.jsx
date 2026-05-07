import { useQuery } from '@tanstack/react-query'
import { Menu, Search, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { getChapterCount } from '../../api/bibleData'
import { api } from '../../api/client'

const FALLBACK_TRANSLATIONS = ['KJV', 'ASV', 'YLT', 'Darby', 'Webster', 'NHEB', 'BSB', 'LEB']

export default function TopBar({ onSearch }) {
  const {
    book, chapter, translation,
    setTranslation, setReference,
    toggleSidebar,
  } = useStudyStore()

  const { data: transData } = useQuery({
    queryKey: ['translations'],
    queryFn: api.getTranslations,
    staleTime: Infinity,
  })
  const translations = transData?.translations?.filter((t) => t !== 'KJVA') ?? FALLBACK_TRANSLATIONS

  const maxChapter = getChapterCount(book)

  function prevChapter() {
    if (chapter > 1) setReference(book, chapter - 1)
  }

  function nextChapter() {
    if (chapter < maxChapter) setReference(book, chapter + 1)
  }

  return (
    <div className="h-12 bg-slate-800 flex items-center px-3 gap-3 flex-shrink-0 shadow-md">
      <button
        onClick={toggleSidebar}
        className="text-slate-300 hover:text-white p-1.5 rounded"
        title="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      {/* App name */}
      <div className="flex items-center gap-1.5 text-white font-semibold text-sm">
        <BookOpen size={16} className="text-blue-400" />
        <span className="hidden sm:block">Bible Study</span>
      </div>

      <div className="w-px h-6 bg-slate-600" />

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={prevChapter}
          disabled={chapter <= 1}
          className="text-slate-300 hover:text-white disabled:opacity-30 p-1 rounded"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="text-white text-sm font-medium min-w-[120px] text-center">
          {book} {chapter}
        </span>

        <button
          onClick={nextChapter}
          disabled={chapter >= maxChapter}
          className="text-slate-300 hover:text-white disabled:opacity-30 p-1 rounded"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="w-px h-6 bg-slate-600" />

      {/* Translation selector */}
      <select
        value={translation}
        onChange={(e) => setTranslation(e.target.value)}
        className="bg-slate-700 text-white text-xs border border-slate-600 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
      >
        {translations.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <div className="flex-1" />

      {/* Search */}
      <button
        onClick={onSearch}
        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded text-xs transition-colors"
      >
        <Search size={13} />
        <span className="hidden sm:block">Search</span>
        <kbd className="hidden sm:block text-xs text-slate-500 ml-1">⌘K</kbd>
      </button>
    </div>
  )
}
