import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Check, ChevronDown, Columns2, Save, Settings2, X } from 'lucide-react'
import { useStudyStore, FONT_SIZES } from '../../stores/studyStore'
import { api } from '../../api/client'
import { computeWordDiff } from '../../utils/diff'
import clsx from 'clsx'

const TRANSLATION_COLORS = {
  KJV:  { border: 'border-red-300 dark:border-red-700',  bg: 'bg-red-50 dark:bg-red-900/20',  header: 'text-red-700 dark:text-red-400', dot: 'bg-red-400' },
  ASV:  { border: 'border-blue-300 dark:border-blue-700', bg: 'bg-blue-50 dark:bg-blue-900/20', header: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-400' },
  YLT:  { border: 'border-green-300 dark:border-green-700', bg: 'bg-green-50 dark:bg-green-900/20', header: 'text-green-700 dark:text-green-400', dot: 'bg-green-400' },
  BSB:  { border: 'border-purple-300 dark:border-purple-700', bg: 'bg-purple-50 dark:bg-purple-900/20', header: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-400' },
  Darby: { border: 'border-amber-300 dark:border-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/20', header: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-400' },
  LEB:  { border: 'border-teal-300 dark:border-teal-700', bg: 'bg-teal-50 dark:bg-teal-900/20', header: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-400' },
  NETfree: { border: 'border-orange-300 dark:border-orange-700', bg: 'bg-orange-50 dark:bg-orange-900/20', header: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-400' },
  NHEB: { border: 'border-pink-300 dark:border-pink-700', bg: 'bg-pink-50 dark:bg-pink-900/20', header: 'text-pink-700 dark:text-pink-400', dot: 'bg-pink-400' },
  OEB:  { border: 'border-cyan-300 dark:border-cyan-700', bg: 'bg-cyan-50 dark:bg-cyan-900/20', header: 'text-cyan-700 dark:text-cyan-400', dot: 'bg-cyan-400' },
  Rotherham: { border: 'border-lime-300 dark:border-lime-700', bg: 'bg-lime-50 dark:bg-lime-900/20', header: 'text-lime-700 dark:text-lime-400', dot: 'bg-lime-400' },
  Webster: { border: 'border-indigo-300 dark:border-indigo-700', bg: 'bg-indigo-50 dark:bg-indigo-900/20', header: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-400' },
  Wycliffe: { border: 'border-rose-300 dark:border-rose-700', bg: 'bg-rose-50 dark:bg-rose-900/20', header: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-400' },
  KJVA: { border: 'border-yellow-300 dark:border-yellow-700', bg: 'bg-yellow-50 dark:bg-yellow-900/20', header: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-400' },
}

function colorFor(t) {
  return TRANSLATION_COLORS[t] || { border: 'border-gray-300 dark:border-gray-600', bg: 'bg-gray-50 dark:bg-gray-800', header: 'text-gray-700 dark:text-gray-300', dot: 'bg-gray-400' }
}

const FALLBACK_TRANSLATIONS = ['KJV', 'ASV', 'YLT', 'Darby', 'Webster', 'NHEB', 'BSB', 'LEB']

export default function CompareView() {
  const {
    book, chapter, compareTranslations, fontSizeIdx,
    selectedVerse, selectVerse, translation: baseTranslation,
    compareMode, comparePickerOpen, setComparePickerOpen,
    setCompareTranslations, toggleCompareMode,
  } = useStudyStore(typeof compareMode === 'function' ? '' : undefined)

  // Use a local shim since the store may not have all new fields yet
  const state = useStudyStore()
  const translations = compareTranslations.length > 0 ? compareTranslations : [baseTranslation, baseTranslation !== 'KJV' ? 'KJV' : 'ASV']
  const qc = useQueryClient()
  const [showPicker, setShowPicker] = useState(false)
  const [syncScroll, setSyncScroll] = useState(true)
  const [activeVerse, setActiveVerse] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const scrollRefs = useRef({})
  const isScrollingSync = useRef(false)

  const { data: transData } = useQuery({
    queryKey: ['translations'],
    queryFn: api.getTranslations,
    staleTime: Infinity,
  })
  const availableTranslations = transData?.translations?.filter((t) => t !== 'KJVA') ?? FALLBACK_TRANSLATIONS

  // Fetch all translation chapters in parallel
  const chapterQueries = useQuery({
    queryKey: ['compare-chapters', book, chapter, translations.join(',')],
    queryFn: async () => {
      const results = {}
      await Promise.all(translations.map(async (t) => {
        try {
          results[t] = await api.getChapter(t, book, chapter)
        } catch { results[t] = null }
      }))
      return results
    },
    enabled: !!book && !!chapter && translations.length > 0,
  })

  const chapterData = chapterQueries.data || {}
  const allTranslations = translations.filter(t => chapterData[t])

  // Determine the base (first) translation text for diffing
  const baseTrans = allTranslations[0]
  const baseVerses = baseTrans ? (chapterData[baseTrans]?.verses || []) : []

  // Sync selected verse from reader
  useEffect(() => {
    if (selectedVerse) setActiveVerse(selectedVerse)
  }, [selectedVerse])

  // Synchronized scroll handler
  const handleScroll = useCallback((sourceTrans, e) => {
    if (!syncScroll || isScrollingSync.current) return
    isScrollingSync.current = true

    const sourceEl = e.target
    const scrollPercentage = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight)

    for (const t of allTranslations) {
      if (t === sourceTrans) continue
      const el = scrollRefs.current[t]
      if (el) {
        const targetScroll = scrollPercentage * (el.scrollHeight - el.clientHeight)
        el.scrollTop = targetScroll
      }
    }

    requestAnimationFrame(() => { isScrollingSync.current = false })
  }, [syncScroll, allTranslations])

  // Register scroll listeners
  useEffect(() => {
    if (!syncScroll) return
    const handlers = []
    for (const t of allTranslations) {
      const el = scrollRefs.current[t]
      if (el) {
        const handler = (e) => handleScroll(t, e)
        el.addEventListener('scroll', handler, { passive: true })
        handlers.push({ el, handler })
      }
    }
    return () => {
      for (const { el, handler } of handlers) {
        el.removeEventListener('scroll', handler)
      }
    }
  }, [syncScroll, allTranslations, handleScroll])

  function toggleTranslationInPicker(t) {
    if (translations.includes(t)) {
      if (translations.length > 1) {
        setCompareTranslations(translations.filter(tr => tr !== t))
      }
    } else {
      if (translations.length < 5) {
        setCompareTranslations([...translations, t])
      }
    }
  }

  async function saveComparedView() {
    try {
      await api.createBookmark({
        book,
        chapter,
        note: `Compare: ${translations.join(', ')} — ${book} ${chapter}`,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch {
      // silent fail
    }
  }

  // Verse highlight handler
  const handleVerseClick = useCallback((verseNum) => {
    setActiveVerse(verseNum)
    selectVerse(verseNum, '')
  }, [selectVerse])

  // Column grid class
  const colCount = allTranslations.length
  const gridClass = colCount <= 2
    ? 'grid-cols-1 md:grid-cols-2'
    : colCount <= 4
      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
        <Columns2 size={16} className="text-blue-500" />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {book} {chapter}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          — Comparing {allTranslations.length} translation{allTranslations.length > 1 ? 's' : ''}
        </span>

        <div className="flex-1" />

        {/* Sync scroll toggle */}
        <button
          onClick={() => setSyncScroll(!syncScroll)}
          className={clsx(
            'flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
            syncScroll
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
              : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          )}
          title={syncScroll ? 'Scroll sync on (click to disable)' : 'Scroll sync off (click to enable)'}
        >
          <span className="relative flex h-2 w-2">
            <span className={clsx(
              'absolute inline-flex h-full w-full rounded-full opacity-75',
              syncScroll ? 'animate-ping bg-blue-400' : 'bg-gray-400'
            )} />
            <span className={clsx(
              'relative inline-flex rounded-full h-2 w-2',
              syncScroll ? 'bg-blue-500' : 'bg-gray-400'
            )} />
          </span>
          Sync
        </button>

        {/* Save bookmark */}
        <button
          onClick={saveComparedView}
          className={clsx(
            'flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
            saveSuccess
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400'
              : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          )}
          title="Save this comparison"
        >
          {saveSuccess ? <Check size={14} /> : <Save size={14} />}
          {saveSuccess ? 'Saved!' : 'Save'}
        </button>

        {/* Translation picker */}
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className={clsx(
              'flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
              showPicker
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <Settings2 size={14} />
            Translations ({translations.length}/5)
          </button>

          {showPicker && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-2">
              <div className="px-3 py-1.5 text-xs text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span>Select translations (max 5)</span>
                <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-white">
                  <X size={12} />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {availableTranslations.map((t) => {
                  const isSelected = translations.includes(t)
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTranslationInPicker(t)}
                      disabled={isSelected && translations.length <= 1}
                      className={clsx(
                        'w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                        isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400',
                        isSelected && translations.length <= 1 && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className={clsx('w-2 h-2 rounded-full', colorFor(t).dot)} />
                        {t === 'OEB' ? 'OEB (NT only)' : t}
                      </span>
                      {isSelected && <Check size={12} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Translation columns */}
      <div className="flex-1 overflow-hidden">
        {chapterQueries.isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <div className="animate-pulse text-4xl mb-2">✝</div>
              <div>Loading translations…</div>
            </div>
          </div>
        ) : (
          <div className={clsx('grid gap-0 h-full overflow-hidden', gridClass)}>
            {allTranslations.map((t, colIdx) => (
              <TranslationColumn
                key={t}
                translation={t}
                book={book}
                chapter={chapter}
                chapterData={chapterData[t]}
                fontSize={FONT_SIZES[fontSizeIdx]}
                isActive={activeVerse}
                onVerseClick={handleVerseClick}
                isBase={colIdx === 0}
                baseVerses={baseVerses}
                scrollRef={(el) => { scrollRefs.current[t] = el }}
                syncScroll={syncScroll}
                borderRight={colIdx < allTranslations.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Active verse indicator bar */}
      {activeVerse && (
        <div className="flex-shrink-0 px-4 py-1.5 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 text-xs text-blue-600 dark:text-blue-400 flex items-center justify-between">
          <span>Verse {activeVerse} highlighted across all columns</span>
          <button onClick={() => setActiveVerse(null)} className="hover:text-blue-800 dark:hover:text-blue-200">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

function TranslationColumn({ translation, chapterData, fontSize, isActive, onVerseClick, isBase, baseVerses, scrollRef, syncScroll, borderRight }) {
  const colors = colorFor(translation)
  const isLoading = !chapterData
  const isError = chapterData === null
  const verses = chapterData?.verses || []

  // Build a base text map for diffing: verseNum -> text
  const baseMap = {}
  for (const v of baseVerses) {
    baseMap[v.verse] = v.text
  }

  return (
    <div className={clsx(
      'flex flex-col overflow-hidden min-w-0',
      borderRight && 'border-r border-gray-200 dark:border-gray-700'
    )}>
      {/* Column header */}
      <div className={clsx(
        'flex-shrink-0 px-4 py-2 border-b flex items-center gap-2 text-sm font-semibold',
        colors.border, colors.header,
        'bg-gray-50 dark:bg-gray-800/50'
      )}>
        <span className={clsx('w-2.5 h-2.5 rounded-full', colors.dot)} />
        {translation}
        {isBase && <span className="text-[10px] font-normal opacity-60 ml-1">(base)</span>}
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className={clsx('flex-1 overflow-y-auto p-3', colors.bg)}
        style={{ scrollbarWidth: 'thin' }}
      >
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-gray-400 dark:text-gray-500 text-sm">Loading…</div>
          </div>
        )}
        {isError && (
          <div className="text-gray-400 dark:text-gray-500 text-sm text-center py-12">
            Not available in {translation}
          </div>
        )}
        {verses.length > 0 && (
          <div className="space-y-0.5 text-gray-900 dark:text-gray-100" style={{ fontSize, lineHeight: 1.9 }}>
            {verses.map(({ verse, text }) => {
              const isHighlighted = isActive === verse
              // Compute word-level diff if not base column
              let renderedContent
              if (isBase) {
                renderedContent = text
              } else {
                const baseText = baseMap[verse] || ''
                if (baseText) {
                  const words = computeWordDiff(baseText, text)
                  renderedContent = words.map((w, i) => (
                    <span
                      key={i}
                      className={clsx(
                        w.type === 'diff' && 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 rounded-sm px-[1px]'
                      )}
                    >
                      {w.text}
                    </span>
                  ))
                } else {
                  renderedContent = text
                }
              }

              return (
                <span
                  key={verse}
                  onClick={() => onVerseClick(verse)}
                  className={clsx(
                    'inline cursor-pointer rounded-sm transition-colors',
                    isHighlighted && 'bg-yellow-100 dark:bg-yellow-900/30 ring-1 ring-yellow-400 dark:ring-yellow-600'
                  )}
                >
                  <sup className="text-[0.65rem] font-bold text-blue-500 dark:text-blue-400 mr-0.5 select-none align-super">
                    {verse}
                  </sup>
                  <span>{renderedContent}</span>{' '}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
