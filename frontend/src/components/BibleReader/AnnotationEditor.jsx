/**
 * AnnotationEditor — popover for creating or editing a word-level annotation.
 *
 * Props:
 *   annotation: existing annotation (null when creating new)
 *   anchorText: the selected text (used when creating)
 *   position: { x, y } — pointer position for placement
 *   book, chapter, verse: location
 *   wordStart, wordEnd: word indices in the verse
 *   onSave(data): called with { content, color } (update) or full create payload
 *   onDelete(): called when deleting an existing annotation
 *   onClose(): called to dismiss without saving
 */

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

const COLORS = [
  {
    id: 'yellow',
    label: 'Yellow',
    swatch: 'bg-amber-300',
    ring: 'ring-amber-400',
  },
  {
    id: 'blue',
    label: 'Blue',
    swatch: 'bg-blue-400',
    ring: 'ring-blue-400',
  },
  {
    id: 'green',
    label: 'Green',
    swatch: 'bg-green-400',
    ring: 'ring-green-400',
  },
  {
    id: 'pink',
    label: 'Pink',
    swatch: 'bg-pink-400',
    ring: 'ring-pink-400',
  },
]

export default function AnnotationEditor({
  annotation,
  anchorText,
  position,
  book,
  chapter,
  verse,
  wordStart,
  wordEnd,
  onSave,
  onDelete,
  onClose,
}) {
  const isNew = !annotation
  const [content, setContent] = useState(annotation?.content ?? '')
  const [color, setColor] = useState(annotation?.color ?? 'yellow')
  const [saving, setSaving] = useState(false)
  const containerRef = useRef(null)
  const textareaRef = useRef(null)

  // Focus the textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    try {
      if (isNew) {
        await onSave({
          book,
          chapter,
          verse,
          word_start: wordStart,
          word_end: wordEnd,
          anchor_text: anchorText,
          content,
          color,
        })
      } else {
        await onSave({ id: annotation.id, content, color })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await onDelete(annotation.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Position the popover — clamp to viewport
  const style = {}
  if (position) {
    const POPOVER_W = 280
    const POPOVER_H = 200
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = position.x
    let top = position.y + 12
    if (left + POPOVER_W > vw - 8) left = vw - POPOVER_W - 8
    if (left < 8) left = 8
    if (top + POPOVER_H > vh - 8) top = position.y - POPOVER_H - 8
    style.left = left
    style.top = top
  }

  return (
    <div
      ref={containerRef}
      style={style}
      className={clsx(
        'fixed z-50 w-[280px] rounded-xl shadow-xl border',
        'bg-white dark:bg-gray-800',
        'border-gray-200 dark:border-gray-700',
        'p-3 flex flex-col gap-2'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
          {isNew ? 'Annotate' : 'Edit annotation'}{' '}
          <span className="text-gray-400 dark:text-gray-500 italic font-normal">
            &ldquo;{(annotation?.anchor_text ?? anchorText ?? '').slice(0, 40)}
            {(annotation?.anchor_text ?? anchorText ?? '').length > 40 && '…'}&rdquo;
          </span>
        </span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs ml-1 shrink-0"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a note…"
        rows={3}
        className={clsx(
          'w-full resize-none rounded-lg px-2.5 py-1.5 text-sm',
          'border border-gray-200 dark:border-gray-600',
          'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
          'focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500',
          'placeholder:text-gray-400 dark:placeholder:text-gray-500'
        )}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
        }}
      />

      {/* Color picker */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">Color:</span>
        {COLORS.map((c) => (
          <button
            key={c.id}
            onClick={() => setColor(c.id)}
            title={c.label}
            className={clsx(
              'w-5 h-5 rounded-full border-2 transition-transform',
              c.swatch,
              color === c.id
                ? `border-gray-600 dark:border-gray-200 scale-110 ring-2 ${c.ring}`
                : 'border-transparent hover:scale-110'
            )}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={handleSave}
          disabled={saving}
          className={clsx(
            'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors',
            'bg-blue-500 hover:bg-blue-600 text-white',
            saving && 'opacity-60 cursor-not-allowed'
          )}
        >
          {saving ? 'Saving…' : isNew ? 'Add Note' : 'Save'}
        </button>
        {!isNew && (
          <button
            onClick={handleDelete}
            disabled={saving}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              'bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400',
              saving && 'opacity-60 cursor-not-allowed'
            )}
          >
            Delete
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-600 text-right -mt-1">
        ⌘↵ to save
      </p>
    </div>
  )
}
