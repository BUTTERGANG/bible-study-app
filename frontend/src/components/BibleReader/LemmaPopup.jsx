import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Popup that appears on hover/tap of a lemma word.
 * Shows: original form, transliteration, Strong's number, gloss, definition, morphology.
 */
export default function LemmaPopup({ word, position, onClose }) {
  const ref = useRef(null)

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose?.()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!word) return null

  const x = position?.x ?? 0
  const y = position?.y ?? 0

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl w-72 max-w-[calc(100vw-2rem)] overflow-hidden"
      style={{
        left: Math.min(x, window.innerWidth - 300),
        top: y > window.innerHeight / 2 ? y - 260 : y + 8,
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {word.original && (
            <span className="font-serif text-lg text-gray-900 dark:text-gray-100 truncate" dir="auto">
              {word.original}
            </span>
          )}
          {word.transliteration && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {word.transliteration}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0 ml-1"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5 text-sm max-h-52 overflow-y-auto">
        {/* Strong's number */}
        {word.strongs && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
              {word.strongs}
            </span>
          </div>
        )}

        {/* Gloss */}
        {word.gloss && (
          <p className="text-gray-800 dark:text-gray-200 font-medium">
            {word.gloss}
          </p>
        )}

        {/* Definition */}
        {word.definition && (
          <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">
            {word.definition}
          </p>
        )}

        {/* Fallback if no lexicon data */}
        {!word.definition && !word.gloss && (
          <p className="text-gray-400 dark:text-gray-500 text-xs italic">
            No lexicon entry available for this lemma.
          </p>
        )}

        {/* Morphology */}
        {word.morphology && (
          <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">{word.morphology}</span>
          </div>
        )}
      </div>
    </div>
  )
}
