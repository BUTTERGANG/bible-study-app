import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { api } from '../../api/client'
import { useStudyStore } from '../../stores/studyStore'
import clsx from 'clsx'

const GOSPEL_COLORS = {
  matt: { bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', badge: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
  mark: { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  luke: { bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
  john: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
}

function VerseCell({ verse, text, color, onClick }) {
  return (
    <button
      onClick={() => onClick && onClick()}
      className={clsx(
        'text-left px-2 py-1 rounded text-xs leading-relaxed transition-colors w-full',
        color?.bg || 'hover:bg-gray-50 dark:hover:bg-gray-800',
        onClick && 'cursor-pointer'
      )}
    >
      <span className={clsx('font-semibold mr-1', color?.text || 'text-gray-500 dark:text-gray-400')}>
        {verse}
      </span>
      <span className="text-gray-700 dark:text-gray-200">{text}</span>
    </button>
  )
}

function GospelColumn({ column, color, onNavigate }) {
  if (!column.present) {
    return (
      <div className="flex-1 min-w-0 px-2 py-3 opacity-40">
        <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-2 text-center">
          {column.gospel_name}
        </div>
        <div className="text-[10px] text-gray-400 dark:text-gray-600 text-center italic">
          Not in this Gospel
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('flex-1 min-w-0 px-2 py-3 border-l', color.border, 'first:border-l-0')}>
      <button
        onClick={() => {
          if (column.reference) {
            const parts = column.reference.split(' ')
            const chapter = parseInt(parts[parts.length - 1].split(':')[0])
            const book = parts.slice(0, parts.length - 1).join(' ')
            onNavigate(book, chapter)
          }
        }}
        className={clsx('text-xs font-semibold mb-2 text-center block w-full hover:underline', color.text)}
      >
        {column.gospel_name}
        <span className="font-normal text-gray-400 dark:text-gray-500 ml-1">
          {column.reference}
        </span>
      </button>
      <div className="space-y-0.5">
        {column.verses.map((v) => (
          <VerseCell
            key={v.verse}
            verse={v.verse}
            text={v.text}
            color={color}
            onClick={() => {
              if (column.reference) {
                const parts = column.reference.split(' ')
                const chapter = parseInt(parts[parts.length - 1].split(':')[0])
                const book = parts.slice(0, parts.length - 1).join(' ')
                onNavigate(book, chapter, v.verse)
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}

function PericopeRow({ pericope, sectionLabel, translation, onNavigate }) {
  const [expanded, setExpanded] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['harmony', pericope.id, translation],
    queryFn: () => api.getHarmonyPericope(pericope.id, translation),
    enabled: expanded,
    staleTime: 5 * 60 * 1000,
  })

  const hasAnyRef = pericope.matt || pericope.mark || pericope.luke || pericope.john

  return (
    <div className="border-b border-gray-100 dark:border-gray-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{pericope.title}</span>
          <div className="flex gap-1 mt-0.5">
            {pericope.matt && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">Mt</span>}
            {pericope.mark && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">Mk</span>}
            {pericope.luke && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">Lk</span>}
            {pericope.john && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">Jn</span>}
            {!hasAnyRef && <span className="text-[10px] text-gray-400 italic">No synoptic parallel</span>}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-xs text-gray-400">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
              Loading passages...
            </div>
          ) : data?.columns ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="flex">
                {data.columns.map((col) => (
                  <GospelColumn
                    key={col.gospel}
                    column={col}
                    color={GOSPEL_COLORS[col.gospel]}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 text-center py-4">
              No passage data available. Check translation selection.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GospelHarmony() {
  const { translation, setBook, setChapter, setVerse } = useStudyStore()
  const [search, setSearch] = useState('')
  const [expandedSections, setExpandedSections] = useState({})

  const { data: harmonyData, isLoading } = useQuery({
    queryKey: ['harmony-list'],
    queryFn: api.getHarmonyList,
    staleTime: Infinity,
  })

  const filteredSections = useMemo(() => {
    if (!harmonyData?.sections) return []
    if (!search.trim()) return harmonyData.sections

    const q = search.toLowerCase()
    return harmonyData.sections
      .map((section) => ({
        ...section,
        pericopes: section.pericopes.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            section.label.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.pericopes.length > 0)
  }, [harmonyData, search])

  function handleNavigate(book, chapter, verse) {
    setBook(book)
    setChapter(chapter)
    if (verse) setVerse(verse)
  }

  function toggleSection(sectionId) {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
          <div className="text-xs">Loading Gospel Harmony...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Gospel Harmony</h2>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pericopes..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredSections.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-400">
            {search ? 'No matching pericopes found.' : 'No harmony data available.'}
          </div>
        ) : (
          filteredSections.map((section) => (
            <div key={section.id} className="border-b border-gray-100 dark:border-gray-800">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {expandedSections[section.id] ? (
                  <ChevronDown size={12} className="text-gray-500" />
                ) : (
                  <ChevronRight size={12} className="text-gray-500" />
                )}
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  {section.label}
                </span>
                <span className="text-[10px] text-gray-400 ml-auto">
                  {section.pericopes.length} pericope{section.pericopes.length !== 1 ? 's' : ''}
                </span>
              </button>

              {(expandedSections[section.id] || search) && (
                <div>
                  {section.pericopes.map((pericope) => (
                    <PericopeRow
                      key={pericope.id}
                      pericope={pericope}
                      sectionLabel={section.label}
                      translation={translation}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500 text-center">
        Synoptic Gospel parallels based on standard Gospel Harmony
      </div>
    </div>
  )
}
