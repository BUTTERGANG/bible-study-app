import { useState, useCallback } from 'react'
import clsx from 'clsx'
import LemmaPopup from './LemmaPopup'

/**
 * Renders lemma forms inline for a single verse.
 * Each word shows its original language lemma below or alongside the English text.
 * On hover/tap, shows a popup with definition, Strong's number, and morphology.
 *
 * Position: 'below' = lemma words appear in a row below, each aligned to its word
 *           'inline' = lemma form appears directly beneath each verse word token
 */
export default function LemmaInline({ words, text, position = 'below' }) {
  const [popupWord, setPopupWord] = useState(null)
  const [popupPos, setPopupPos] = useState(null)

  const handleWordEnter = useCallback((word, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setPopupWord(word)
    setPopupPos({ x: rect.left, y: rect.top })
  }, [])

  const handleWordLeave = useCallback(() => {
    setPopupWord(null)
    setPopupPos(null)
  }, [])

  const handleWordClick = useCallback((word, e) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    if (popupWord?.position === word.position) {
      setPopupWord(null)
      setPopupPos(null)
    } else {
      setPopupWord(word)
      setPopupPos({ x: rect.left, y: rect.top })
    }
  }, [popupWord])

  if (!words || words.length === 0) {
    return <span>{text}</span>
  }

  // Filter words that have actual lemma data (original + at least a strongs or gloss)
  const meaningfulWords = words.filter(w => w.original && (w.strongs || w.gloss || w.definition))
  if (meaningfulWords.length === 0) {
    return <span>{text}</span>
  }

  if (position === 'inline') {
    // Inline mode: interleave lemma forms beneath each word token in the verse text
    // Split text into tokens for positioning
    const tokens = text.split(/(\s+)/)
    // Map word positions (1-based) to tokens
    // The verse text has the format "word1 word2 word3..." and word positions
    // correspond to the nth non-whitespace token
    let wordIdx = 0
    const enrichedTokens = tokens.map((token, _i) => {
      if (token.trim() === '') return { type: 'space', content: token }
      const word = meaningfulWords.find(w => w.position === wordIdx + 1)
      wordIdx++
      if (word) {
        return { type: 'word', content: token, word }
      }
      return { type: 'word', content: token }
    })

    return (
      <span className="lemma-inline-wrapper">
        <span className="lemma-text">{text}</span>
        <span className="lemma-forms-inline flex flex-wrap">
          {enrichedTokens.map((t, i) => {
            if (t.type === 'space' || !t.word) return <span key={i} className="hidden">{t.content}</span>
            return (
              <span
                key={i}
                className="lemma-inline-word inline-flex flex-col items-center mx-0.5 cursor-pointer"
                onMouseEnter={(e) => handleWordEnter(t.word, e)}
                onMouseLeave={handleWordLeave}
                onClick={(e) => handleWordClick(t.word, e)}
              >
                {t.word.original && (
                  <span className="font-serif text-[11px] leading-tight text-gray-600 dark:text-gray-300">
                    {t.word.original}
                  </span>
                )}
                {t.word.strongs && (
                  <span className="text-[8px] leading-tight text-blue-500 dark:text-blue-400 font-medium">
                    {t.word.strongs}
                  </span>
                )}
              </span>
            )
          })}
        </span>
        {popupWord && (
          <LemmaPopup word={popupWord} position={popupPos} onClose={handleWordLeave} />
        )}
      </span>
    )
  }

  // Below mode (default): show lemma words in a flex row below the verse text
  return (
    <span className="lemma-below-wrapper inline-flex flex-col">
      <span className="lemma-text">{text}</span>
      <span className="lemma-forms-below flex flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5">
        {meaningfulWords.map((word) => (
          <span
            key={word.position}
            className={clsx(
              'lemma-word inline-flex items-center gap-0.5 text-[10px] leading-tight cursor-pointer',
              'rounded px-1 py-0.5 transition-colors',
              'hover:bg-blue-50 dark:hover:bg-blue-900/20',
              popupWord?.position === word.position && 'bg-blue-50 dark:bg-blue-900/20'
            )}
            onMouseEnter={(e) => handleWordEnter(word, e)}
            onMouseLeave={handleWordLeave}
            onClick={(e) => handleWordClick(word, e)}
            title={word.gloss || word.strongs || word.original || ''}
          >
            {word.original && (
              <span className="font-serif text-gray-600 dark:text-gray-300">
                {word.original}
              </span>
            )}
            {word.strongs && (
              <span className="text-blue-500 dark:text-blue-400 font-medium">
                {word.strongs}
              </span>
            )}
          </span>
        ))}
      </span>
      {popupWord && (
        <LemmaPopup word={popupWord} position={popupPos} onClose={handleWordLeave} />
      )}
    </span>
  )
}
