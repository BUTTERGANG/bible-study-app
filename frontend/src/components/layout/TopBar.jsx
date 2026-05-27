import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, ChevronDown, ChevronLeft, ChevronRight, Columns2, GraduationCap, Layers, Menu, Moon,
  PanelRightClose, PanelRightOpen, Search, Sun, X, Filter, Languages, Volume2,
} from 'lucide-react'
import { useStudyStore, FONT_SIZES } from '../../stores/studyStore'
import { getChapterCount } from '../../api/bibleData'
import { api } from '../../api/client'
import clsx from 'clsx'

const FALLBACK_TRANSLATIONS = ['KJV', 'ASV', 'YLT', 'Darby', 'Webster', 'NHEB', 'BSB', 'LEB']

export default function TopBar({ onSearch, onMorphSearch, onToggleAudio }) {
  const {
    book, chapter, translation,
    setTranslation, setReference,
    toggleSidebar,
    rightPanelOpen, toggleRightPanel, rightPanel, setRightPanel,
    darkMode, toggleDarkMode,
    fontSizeIdx, setFontSizeIdx,
    compareMode, toggleCompareMode,
    compareTranslations, setCompareTranslations,
    interlinearMode, toggleInterlinear,
    showLemmas, toggleShowLemmas, lemmaPosition, setLemmaPosition,
    audioPlaying,
  } = useStudyStore()
  const qc = useQueryClient()
  const [comparePickerOpen, setComparePickerOpen] = useState(false)
  const pickerRef = useRef(null)

  const { data: transData } = useQuery({
    queryKey: ['translations'],
    queryFn: api.getTranslations,
    staleTime: Infinity,
  })
  const translations = transData?.translations?.filter((t) => t !== 'KJVA') ?? FALLBACK_TRANSLATIONS

  const { data: booksData } = useQuery({
    queryKey: ['translation-books', translation],
    queryFn: () => api.getTranslationBooks(translation),
    staleTime: Infinity,
  })

  const maxChapter =
    booksData?.books?.find((b) => b.name === book)?.chapters ?? getChapterCount(book)

  function prevChapter() {
    if (chapter > 1) setReference(book, chapter - 1)
  }

  function nextChapter() {
    if (chapter < maxChapter) setReference(book, chapter + 1)
  }

  async function handleTranslationChange(newTranslation) {
    setTranslation(newTranslation)
    try {
      const data = await qc.fetchQuery({
        queryKey: ['translation-books', newTranslation],
        queryFn: () => api.getTranslationBooks(newTranslation),
        staleTime: Infinity,
      })
      const availableNames = new Set(data.books.map((b) => b.name))
      if (!availableNames.has(book)) {
        const matthew = data.books.find((b) => b.name === 'Matthew')
        const fallback = matthew ?? data.books.find((b) => b.testament === 'NT') ?? data.books[0]
        if (fallback) setReference(fallback.name, 1)
      }
    } catch {
      /* leave user on current book; reader will surface a friendly 404 */
    }
  }

  function handleToggleCompare() {
    toggleCompareMode()
    if (!compareMode && compareTranslations.length === 0) {
      // Default: current translation + KJV if different
      const defaults = [translation, translation !== 'KJV' ? 'KJV' : 'ASV']
      setCompareTranslations(defaults)
    }
    setComparePickerOpen(false)
  }

  function toggleCompareTranslation(t) {
    if (compareTranslations.includes(t)) {
      if (compareTranslations.length > 1) {
        setCompareTranslations(compareTranslations.filter((tr) => tr !== t))
      }
    } else {
      setCompareTranslations([...compareTranslations, t])
    }
  }

  // Close picker on outside click
  useEffect(() => {
    function handler(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setComparePickerOpen(false)
      }
    }
    if (comparePickerOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [comparePickerOpen])

  return (
    <div className="h-12 bg-slate-800 flex items-center px-3 gap-3 flex-shrink-0 shadow-md">
      <button
        onClick={toggleSidebar}
        className="text-slate-300 hover:text-white p-1.5 rounded"
        title="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      <div className="flex items-center gap-1.5 text-white font-semibold text-sm">
        <BookOpen size={16} className="text-blue-400" />
        <span className="hidden sm:block">Bible Study</span>
      </div>

      <div className="w-px h-6 bg-slate-600" />

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

      {!compareMode && (
        <select
          value={translation}
          onChange={(e) => handleTranslationChange(e.target.value)}
          className="bg-slate-700 text-white text-xs border border-slate-600 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
        >
          {translations.map((t) => (
            <option key={t} value={t}>
              {t === 'OEB' ? 'OEB (NT only)' : t}
            </option>
          ))}
        </select>
      )}

      {/* Interlinear toggle */}
      <button
        onClick={toggleInterlinear}
        className={clsx(
          'flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
          interlinearMode
            ? 'bg-green-600 text-white border-green-500 hover:bg-green-700'
            : 'text-slate-300 border-slate-600 hover:text-white hover:border-slate-500'
        )}
        title={interlinearMode ? 'Exit interlinear mode' : 'Show interlinear text'}
      >
        <Layers size={14} />
        <span className="hidden sm:block">Interlinear</span>
      </button>

      {/* Lemma toggle */}
      {!compareMode && (
        <div className="relative">
          <button
            onClick={toggleShowLemmas}
            className={clsx(
              'flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
              showLemmas
                ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                : 'text-slate-300 border-slate-600 hover:text-white hover:border-slate-500'
            )}
            title={showLemmas ? 'Hide lemma forms' : 'Show lemma forms (Hebrew/Greek)'}
          >
            <Languages size={14} />
            <span className="hidden sm:block">Lemmas</span>
          </button>
        </div>
      )}

      {/* Compare button */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={handleToggleCompare}
          className={clsx(
            'flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
            compareMode
              ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700'
              : 'text-slate-300 border-slate-600 hover:text-white hover:border-slate-500'
          )}
          title={compareMode ? 'Exit compare mode' : 'Compare translations'}
        >
          <Columns2 size={14} />
          <span className="hidden sm:block">{compareMode ? 'Comparing' : 'Compare'}</span>
          {compareMode && (
            <span className="bg-blue-500 text-white text-[10px] rounded-full px-1.5 py-0.5 ml-0.5">
              {compareTranslations.length}
            </span>
          )}
        </button>

        {/* Compare picker dropdown */}
        {comparePickerOpen && !compareMode && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-2">
            <div className="px-3 py-1.5 text-xs text-slate-400 font-semibold border-b border-slate-700 flex items-center justify-between">
              <span>Select translations to compare</span>
              <button onClick={() => setComparePickerOpen(false)} className="text-slate-500 hover:text-white">
                <X size={12} />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {translations.map((t) => {
                const isSelected = compareTranslations.includes(t)
                return (
                  <button
                    key={t}
                    onClick={() => toggleCompareTranslation(t)}
                    className={clsx(
                      'w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-700 transition-colors',
                      isSelected ? 'text-blue-400' : 'text-slate-300'
                    )}
                  >
                    <span>{t === 'OEB' ? 'OEB (NT only)' : t}</span>
                    {isSelected && <span className="text-blue-400 text-[10px]">✓</span>}
                  </button>
                )
              })}
            </div>
            <div className="px-3 pt-2 border-t border-slate-700">
              <button
                onClick={handleToggleCompare}
                disabled={compareTranslations.length < 2}
                className="w-full text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded py-1.5 transition-colors"
              >
                Compare {compareTranslations.length} translation{compareTranslations.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Active compare translation toggles */}
        {compareMode && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-2">
            <div className="px-3 py-1.5 text-xs text-slate-400 font-semibold border-b border-slate-700 flex items-center justify-between">
              <span>Comparing {compareTranslations.length} translations</span>
              <button onClick={toggleCompareMode} className="text-slate-500 hover:text-red-400" title="Exit compare mode">
                <X size={12} />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {translations.map((t) => {
                const isSelected = compareTranslations.includes(t)
                return (
                  <button
                    key={t}
                    onClick={() => toggleCompareTranslation(t)}
                    className={clsx(
                      'w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-700 transition-colors',
                      isSelected ? 'text-blue-400' : 'text-slate-500'
                    )}
                  >
                    <span>{t === 'OEB' ? 'OEB (NT only)' : t}</span>
                    {isSelected && <span className="text-blue-400 text-[10px]">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center border border-slate-600 rounded overflow-hidden" title="Font size">
        <button
          onClick={() => setFontSizeIdx(fontSizeIdx - 1)}
          disabled={fontSizeIdx === 0}
          className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 font-serif leading-none transition-colors"
          style={{ fontSize: '11px' }}
          title="Decrease font size"
        >
          A
        </button>
        <div className="w-px h-4 bg-slate-600" />
        <button
          onClick={() => setFontSizeIdx(fontSizeIdx + 1)}
          disabled={fontSizeIdx === FONT_SIZES.length - 1}
          className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 font-serif leading-none transition-colors"
          style={{ fontSize: '15px' }}
          title="Increase font size"
        >
          A
        </button>
      </div>

      <button
        onClick={toggleDarkMode}
        className="text-slate-300 hover:text-white p-1.5 rounded transition-colors"
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <button
        onClick={toggleRightPanel}
        className="text-slate-300 hover:text-white p-1.5 rounded transition-colors"
        title={rightPanelOpen ? 'Hide study panel' : 'Show study panel'}
      >
        {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
      </button>

      <div className="w-px h-6 bg-slate-600" />

      <button
        onClick={() => {
          if (!rightPanelOpen || rightPanel !== 'study') {
            setRightPanel('study')
            if (!rightPanelOpen) toggleRightPanel()
          }
        }}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors',
          rightPanel === 'study' && rightPanelOpen
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'bg-slate-700 text-slate-300 hover:bg-emerald-600 hover:text-white'
        )}
        title="Open Study Builder"
      >
        <GraduationCap size={13} />
        <span className="hidden sm:block">Study</span>
      </button>

      <button
        onClick={onMorphSearch}
        className="flex items-center gap-2 bg-slate-700 hover:bg-purple-600 text-slate-300 hover:text-white px-3 py-1.5 rounded text-xs transition-colors"
        title="Morphological search"
      >
        <Filter size={13} />
        <span className="hidden sm:block">Morph</span>
      </button>

      {/* Audio button */}
      <button
        onClick={onToggleAudio}
        className={clsx(
          'text-slate-300 hover:text-white p-1.5 rounded transition-colors',
          audioPlaying ? 'text-blue-400' : ''
        )}
        title={audioPlaying ? 'Stop audio' : 'Play audio for this chapter'}
      >
        <Volume2 size={16} />
      </button>

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
