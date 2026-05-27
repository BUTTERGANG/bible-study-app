import { useRef, useState, useEffect } from 'react'
import { useStudyStore } from '../../stores/studyStore'
import VerseContextMenu from './VerseContextMenu'
import LemmaInline from './LemmaInline'
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
  isActive, highlightColor, highlightId,
  lemmaWords, lemmaLanguage,
}) {
  const selectVerse = useStudyStore((s) => s.selectVerse)
  const showLemmas = useStudyStore((s) => s.showLemmas)
  const lemmaPosition = useStudyStore((s) => s.lemmaPosition)
  const [menuPos, setMenuPos] = useState(null)
  const [flashing, setFlashing] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!isActive) return
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setFlashing(true)
    const t = setTimeout(() => setFlashing(false), 1400)
    return () => clearTimeout(t)
  }, [isActive])

  function handleClick() {
    selectVerse(verse, text)
    setMenuPos(null)
  }

  function handleContextMenu(e) {
    e.preventDefault()
    selectVerse(verse, text)
    setMenuPos({ x: e.clientX, y: e.clientY })
  }

  // When lemmas are enabled and data is available, render via LemmaInline
  const hasLemmaData = showLemmas && lemmaWords && lemmaWords.length > 0

  return (
    <>
      <span
        ref={ref}
        id={`v${verse}`}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        onContextMenu={handleContextMenu}
        className={clsx(
          'cursor-pointer rounded px-0.5 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
          isActive && 'verse-selected',
          flashing && 'verse-flash',
          highlightColor && HIGHLIGHT_CLASSES[highlightColor],
          hasLemmaData && 'lemma-verse'
        )}
      >
        <sup className="verse-num">{verse}</sup>
        {hasLemmaData ? (
          <LemmaInline
            words={lemmaWords}
            text={text}
            position={lemmaPosition}
          />
        ) : (
          <>{text}{' '}</>
        )}
      </span>

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
    </>
  )
}
