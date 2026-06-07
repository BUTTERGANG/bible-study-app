import { useState, useRef, useMemo, useEffect } from 'react'
import clsx from 'clsx'
import { useStudyStore } from '../../stores/studyStore'
import { getHighlightClass, DEFAULT_COLORS } from '../../utils/morphology'
import VerseContextMenu from './VerseContextMenu'

const HIGHLIGHT_CLASSES = {
  yellow: 'highlight-yellow',
  blue: 'highlight-blue',
  green: 'highlight-green',
  pink: 'highlight-pink',
  orange: 'highlight-orange',
}

export default function InterlinearVerse({
  verse, text, book, chapter, translation,
  isActive, highlightColor, highlightId, words, language = 'greek',
  reverseMode = false, onWordClick = null,
}) {
  const selectVerse = useStudyStore((s) => s.selectVerse)
  const visualFiltersEnabled = useStudyStore((s) => s.visualFiltersEnabled)
  const visualFilters = useStudyStore((s) => s.visualFilters)
  const [menuPos, setMenuPos] = useState(null)
  const [showWords, setShowWords] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const ref = useRef(null)
  const suppressFlash = useRef(false)

  useEffect(() => {
    if (!isActive) return
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    if (!suppressFlash.current) {
      setFlashing(true)
      const t = setTimeout(() => setFlashing(false), 1400)
      return () => clearTimeout(t)
    }
    suppressFlash.current = false
  }, [isActive])

  // Build active filter set for quick lookup
  const activeFilterSet = useMemo(() => {
    if (!visualFiltersEnabled) return new Set()
    const s = new Set()
    for (const [key, on] of Object.entries(visualFilters)) {
      if (on) s.add(key)
    }
    return s
  }, [visualFiltersEnabled, visualFilters])

  function handleClick() {
    suppressFlash.current = true
    selectVerse(verse, text)
    setMenuPos(null)
  }

  function handleContextMenu(e) {
    e.preventDefault()
    suppressFlash.current = true
    selectVerse(verse, text)
    setMenuPos({ x: e.clientX, y: e.clientY })
  }

  return (
    <div
      ref={ref}
      id={`v${verse}`}
      className={clsx(
        'rounded-lg px-2 py-1.5 transition-colors',
        isActive && 'verse-selected',
        flashing && 'verse-flash',
        highlightColor && HIGHLIGHT_CLASSES[highlightColor]
      )}
    >
      {/* Main verse text */}
      <span
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded px-0.5"
      >
        <sup className="verse-num">{verse}</sup>
        {text}{' '}
      </span>

      {/* Interlinear words toggle — hidden in reverse mode (always expanded) */}
      {!reverseMode && words.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowWords(!showWords) }}
          className="ml-1 text-[9px] text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 align-super opacity-60 hover:opacity-100 transition-opacity"
          title="Toggle interlinear words"
        >
          [{words.length}]
        </button>
      )}

      {/* Interlinear word display — forward mode (original first) */}
      {!reverseMode && showWords && words.length > 0 && (
        <div className="mt-1 ml-4 pl-2 border-l-2 border-blue-200 dark:border-blue-800">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {words.map((word, i) => {
              const vfClass = getHighlightClass(word.morphology, language, activeFilterSet)
              const vfStyle = vfClass
                ? { backgroundColor: getFilterColor(word.morphology, language, activeFilterSet) }
                : {}

              return (
                <span
                  key={i}
                  className={clsx(
                    'inline-flex flex-col items-center text-[11px] rounded px-0.5',
                    vfClass && 'vf-word-highlight'
                  )}
                  style={vfStyle}
                >
                  <span className="font-serif text-gray-800 dark:text-gray-100">{word.original}</span>
                  <span className="text-gray-400 dark:text-gray-500 text-[9px]">{word.transliteration}</span>
                  {word.strongs && (
                    <span className="text-blue-500 dark:text-blue-400 text-[9px] font-medium">{word.strongs}</span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Reverse interlinear — English gloss prominent, original below, clickable */}
      {reverseMode && words.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {words.map((word, i) => {
            const vfClass = getHighlightClass(word.morphology, language, activeFilterSet)
            const vfStyle = vfClass
              ? { backgroundColor: getFilterColor(word.morphology, language, activeFilterSet) }
              : {}
            const clickable = !!onWordClick && !!word.strongs

            return (
              <span
                key={i}
                onClick={clickable ? (e) => { e.stopPropagation(); onWordClick(word.strongs) } : undefined}
                className={clsx(
                  'inline-flex flex-col items-center rounded border px-1.5 py-1 text-[11px] transition-colors',
                  'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800',
                  clickable && 'cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
                  vfClass && 'vf-word-highlight'
                )}
                style={vfStyle}
                title={clickable ? `Open word study for ${word.strongs}` : undefined}
              >
                <span className="font-medium text-gray-800 dark:text-gray-100 text-[12px] leading-tight">
                  {word.gloss || '—'}
                </span>
                <span className="font-serif text-gray-500 dark:text-gray-400 text-[10px] leading-tight">
                  {word.original}
                </span>
                {word.strongs && (
                  <span className="text-blue-500 dark:text-blue-400 text-[8px] leading-tight">{word.strongs}</span>
                )}
              </span>
            )
          })}
        </div>
      )}

      {menuPos && (
        <VerseContextMenu
          pos={menuPos}
          verse={verse}
          text={text}
          book={book}
          chapter={chapter}
          translation={translation}
          highlightId={highlightId}
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  )
}

/** Get the background color for a word based on active visual filters. */
function getFilterColor(code, language, activeFilters) {
  if (!code || !activeFilters || activeFilters.size === 0) return undefined

  const categories = language === 'hebrew'
    ? parseHebrewForColor(code)
    : parseGreekForColor(code)

  for (const cat of categories) {
    if (activeFilters.has(cat)) {
      return DEFAULT_COLORS[cat]
    }
  }
  return undefined
}

function parseGreekForColor(code) {
  if (!code) return []
  const parts = code.trim().split('-')
  if (parts.length < 2) return []
  const cats = []
  const pos = parts[0]
  if (pos === 'V') {
    cats.push('verb')
    if (parts.length >= 2) {
      const tv = parts[1]
      if (tv.length >= 3) {
        const mood = { S: 'participle', M: 'imperative', N: 'infinitive' }[tv[2]]
        if (mood) cats.push(mood)
      }
    }
  } else if (pos === 'N') {
    cats.push('noun')
  } else if (pos === 'A') {
    cats.push('adjective')
  } else if (pos === 'P') {
    cats.push('pronoun')
  } else if (pos === 'R') {
    cats.push('preposition')
  } else if (pos === 'C') {
    cats.push('conjunction')
  } else if (pos === 'D') {
    cats.push('adverb')
  } else if (pos === 'T') {
    cats.push('article')
  } else if (pos === 'S') {
    cats.push('numeral')
  } else if (pos === 'I') {
    cats.push('interjection')
  } else if (pos === 'X') {
    cats.push('particle')
  }
  return cats
}

function parseHebrewForColor(code) {
  if (!code) return []
  const parts = code.trim().split('-')
  if (parts.length < 1) return []
  const cats = []
  const pos = parts[0]
  if (pos === 'V') {
    cats.push('verb')
  } else if (pos === 'N') {
    cats.push('noun')
  } else if (pos === 'A') {
    cats.push('adjective')
  } else if (pos === 'P') {
    cats.push('pronoun')
  } else if (pos === 'R') {
    cats.push('preposition')
  } else if (pos === 'C') {
    cats.push('conjunction')
  } else if (pos === 'D') {
    cats.push('adverb')
  } else if (pos === 'T') {
    cats.push('article')
  } else if (pos === 'S') {
    cats.push('properNoun')
  } else if (pos === 'I') {
    cats.push('interjection')
  } else if (pos === 'X') {
    cats.push('particle')
  }
  return cats
}
