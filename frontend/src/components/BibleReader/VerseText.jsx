import { memo, useRef, useState, useEffect } from 'react'
import { useStudyStore } from '../../stores/studyStore'
import VerseContextMenu from './VerseContextMenu'
import LemmaInline from './LemmaInline'
import AnnotatedVerseText from './AnnotatedVerseText'
import clsx from 'clsx'

const HIGHLIGHT_CLASSES = {
  yellow: 'highlight-yellow',
  blue: 'highlight-blue',
  green: 'highlight-green',
  pink: 'highlight-pink',
  orange: 'highlight-orange',
}

const VerseText = memo(function VerseText({
  verse, text, book, chapter, translation,
  isActive, highlightColor, highlightId,
  lemmaWords, lemmaLanguage,
  // Inline annotation data for this verse (passed from BibleReader)
  verseAnnotations,
  annotationsQueryKey,
}) {
  const selectVerse = useStudyStore((s) => s.selectVerse)
  const showLemmas = useStudyStore((s) => s.showLemmas)
  const lemmaPosition = useStudyStore((s) => s.lemmaPosition)
  const [menuPos, setMenuPos] = useState(null)
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

  function handleClick(e) {
    if (e.target.closest('[data-word-idx]')) return
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

  // When lemmas are enabled and data is available, render via LemmaInline
  const hasLemmaData = showLemmas && lemmaWords && lemmaWords.length > 0

  // Annotations mode: non-empty array means this verse has annotations or we want
  // to support annotation creation (annotationsQueryKey present).
  const hasAnnotations = annotationsQueryKey != null

  function renderBody() {
    if (hasLemmaData) {
      return (
        <LemmaInline
          words={lemmaWords}
          text={text}
          position={lemmaPosition}
        />
      )
    }
    if (hasAnnotations) {
      return (
        <AnnotatedVerseText
          text={text}
          verse={verse}
          book={book}
          chapter={chapter}
          annotations={verseAnnotations || []}
          queryKey={annotationsQueryKey}
        />
      )
    }
    return <>{text}{' '}</>
  }

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
          'cursor-pointer rounded px-0.5 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
          isActive && 'verse-selected',
          flashing && 'verse-flash',
          highlightColor && HIGHLIGHT_CLASSES[highlightColor],
          hasLemmaData && 'lemma-verse'
        )}
      >
        <sup className="verse-num">{verse}</sup>
        {renderBody()}
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
})

export default VerseText
