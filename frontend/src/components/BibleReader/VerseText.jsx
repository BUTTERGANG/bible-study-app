import { useState, useRef } from 'react'
import { useStudyStore } from '../../stores/studyStore'
import VerseContextMenu from './VerseContextMenu'
import clsx from 'clsx'

const HIGHLIGHT_CLASSES = {
  yellow: 'highlight-yellow',
  blue: 'highlight-blue',
  green: 'highlight-green',
  pink: 'highlight-pink',
  orange: 'highlight-orange',
}

export default function VerseText({
  verse, text, book, chapter, translation,
  isActive, highlightColor,
}) {
  const { selectVerse, setRightPanel } = useStudyStore()
  const [menuPos, setMenuPos] = useState(null)
  const ref = useRef(null)

  function handleClick(e) {
    selectVerse(verse, text)
    // Close any open menu on single click
    setMenuPos(null)
  }

  function handleContextMenu(e) {
    e.preventDefault()
    selectVerse(verse, text)
    setMenuPos({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <span
        ref={ref}
        id={`v${verse}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={clsx(
          'cursor-pointer rounded px-0.5 transition-colors hover:bg-blue-50',
          isActive && 'verse-selected',
          highlightColor && HIGHLIGHT_CLASSES[highlightColor]
        )}
      >
        <sup className="verse-num">{verse}</sup>
        {text}{' '}
      </span>

      {menuPos && (
        <VerseContextMenu
          pos={menuPos}
          verse={verse}
          text={text}
          book={book}
          chapter={chapter}
          translation={translation}
          onClose={() => setMenuPos(null)}
        />
      )}
    </>
  )
}
