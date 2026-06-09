/**
 * AnnotationPopover — floats near a text selection or annotated word span.
 *
 * Two modes:
 *   create — shown after user makes a text selection; has textarea + color picker + Save/Cancel
 *   edit   — shown when clicking an existing annotated word; has textarea + color picker + Save/Delete
 */
import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Check } from 'lucide-react'
import clsx from 'clsx'

const COLORS = [
  { id: 'yellow', bg: 'bg-yellow-300', ring: 'ring-yellow-400' },
  { id: 'green',  bg: 'bg-green-300',  ring: 'ring-green-400' },
  { id: 'blue',   bg: 'bg-blue-300',   ring: 'ring-blue-400' },
  { id: 'pink',   bg: 'bg-pink-300',   ring: 'ring-pink-400' },
]

export default function AnnotationPopover({
  anchorRect,    // DOMRect — position the popover near this
  mode,          // 'create' | 'edit'
  initialContent = '',
  initialColor = 'yellow',
  isSaving = false,
  onSave,        // ({ content, color }) => void
  onDelete,      // () => void  (edit mode only)
  onCancel,      // () => void
}) {
  const ref = useRef(null)
  const textareaRef = useRef(null)
  const [content, setContent] = useState(initialContent)
  const [color, setColor] = useState(initialColor)

  // Reposition: appear above the anchor, centered, clamped to viewport
  const [style, setStyle] = useState({ opacity: 0 })

  useEffect(() => {
    if (!ref.current || !anchorRect) return
    const el = ref.current
    const w = el.offsetWidth || 240
    const h = el.offsetHeight || 160
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = anchorRect.left + anchorRect.width / 2 - w / 2
    let top  = anchorRect.top - h - 8

    // Flip below if not enough room above
    if (top < 8) top = anchorRect.bottom + 8

    // Clamp horizontal
    left = Math.max(8, Math.min(left, vw - w - 8))
    // Clamp vertical
    top  = Math.max(8, Math.min(top,  vh - h - 8))

    setStyle({ position: 'fixed', left, top, opacity: 1, zIndex: 1100 })
  }, [anchorRect])

  // Focus textarea on open
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onCancel()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onCancel])

  function handleSave() {
    if (!content.trim()) return
    onSave({ content: content.trim(), color })
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); onCancel() }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave()
  }

  return (
    <div
      ref={ref}
      style={style}
      className="w-60 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-600 p-3 flex flex-col gap-2 transition-opacity duration-100"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          {mode === 'create' ? 'Add annotation' : 'Edit annotation'}
        </span>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="Close"
        >
          <X size={13} />
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="Your note… (Ctrl+Enter to save)"
        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Color picker */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400 mr-0.5">Color:</span>
        {COLORS.map(({ id, bg, ring }) => (
          <button
            key={id}
            onClick={() => setColor(id)}
            aria-label={id}
            className={clsx(
              'w-5 h-5 rounded-full border-2 border-white dark:border-gray-700 shadow-sm transition-transform hover:scale-110',
              bg,
              color === id && `ring-2 ${ring} scale-110`
            )}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={handleSave}
          disabled={!content.trim() || isSaving}
          className="flex-1 flex items-center justify-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white rounded px-2 py-1 font-medium"
        >
          <Check size={11} />
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        {mode === 'edit' && onDelete && (
          <button
            onClick={onDelete}
            disabled={isSaving}
            className="flex items-center justify-center gap-1 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 disabled:opacity-50 text-red-600 dark:text-red-400 rounded px-2 py-1"
            aria-label="Delete annotation"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  )
}
