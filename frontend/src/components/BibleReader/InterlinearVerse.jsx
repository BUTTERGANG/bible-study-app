import { useState, useRef } from 'react'
import clsx from 'clsx'
import { useStudyStore } from '../../stores/studyStore'
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
  isActive, highlightColor, highlightId, words,
}) {
  const selectVerse = useStudyStore((s) => s.selectVerse)
  const [menuPos, setMenuPos] = useState(null)
  const [showWords, setShowWords] = useState(false)
  const ref = useRef(null)

  function handleClick() {
    selectVerse(verse, text)
    setMenuPos(null)
  }

  function handleContextMenu(e) {
    e.preventDefault()
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

      {/* Interlinear words toggle */}
      {words.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowWords(!showWords) }}
          className="ml-1 text-[9px] text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 align-super opacity-60 hover:opacity-100 transition-opacity"
          title="Toggle interlinear words"
        >
          [{words.length}]
        </button>
      )}

      {/* Interlinear word display */}
      {showWords && words.length > 0 && (
        <div className="mt-1 ml-4 pl-2 border-l-2 border-blue-200 dark:border-blue-800">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {words.map((word, i) => (
              <span key={i} className="inline-flex flex-col items-center text-[11px]">
                <span className="font-serif text-gray-800 dark:text-gray-100">{word.original}</span>
                <span className="text-gray-400 dark:text-gray-500 text-[9px]">{word.transliteration}</span>
                {word.strongs && (
                  <span className="text-blue-500 dark:text-blue-400 text-[9px] font-medium">{word.strongs}</span>
                )}
              </span>
            ))}
          </div>
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
