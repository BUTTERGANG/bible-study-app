import { useEffect, useRef } from 'react'
import { Bookmark, Copy, Highlighter, Layers, MessageSquare, StickyNote, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

const COLORS = [
  { id: 'yellow', label: 'Yellow', cls: 'bg-yellow-300' },
  { id: 'blue', label: 'Blue', cls: 'bg-blue-300' },
  { id: 'green', label: 'Green', cls: 'bg-green-300' },
  { id: 'pink', label: 'Pink', cls: 'bg-pink-300' },
  { id: 'orange', label: 'Orange', cls: 'bg-orange-300' },
]

export default function VerseContextMenu({
  pos, verse, text, book, chapter, translation, highlightId, onClose,
}) {
  const ref = useRef(null)
  const qc = useQueryClient()
  const setRightPanel = useStudyStore((s) => s.setRightPanel)
  const setRightPanelOpen = useStudyStore((s) => s.setRightPanelOpen)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const highlightMutation = useMutation({
    mutationFn: (color) =>
      api.createHighlight({ translation, book, chapter, verse, color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['highlights', translation, book, chapter] })
      onClose()
    },
  })

  const removeHighlightMutation = useMutation({
    mutationFn: () => api.deleteHighlight(highlightId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['highlights', translation, book, chapter] })
      onClose()
    },
  })

  const bookmarkMutation = useMutation({
    mutationFn: () => api.createBookmark({ book, chapter, verse }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookmarks'] })
      onClose()
    },
  })

  function copyVerse() {
    navigator.clipboard.writeText(`${book} ${chapter}:${verse} — ${text}`)
    onClose()
  }

  function openPanel(panel) {
    setRightPanel(panel)
    setRightPanelOpen(true)
    onClose()
  }

  const style = {
    position: 'fixed',
    left: Math.min(pos.x, window.innerWidth - 220),
    top: Math.min(pos.y, window.innerHeight - 280),
    zIndex: 1000,
  }

  return (
    <div
      ref={ref}
      style={style}
      className="w-52 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 py-1 text-sm"
    >
      <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-100 dark:border-gray-700">
        {book} {chapter}:{verse}
      </div>

      <button onClick={copyVerse} className="menu-item">
        <Copy size={13} />
        Copy verse
      </button>

      <button onClick={() => openPanel('notes')} className="menu-item">
        <StickyNote size={13} />
        Add note
      </button>

      <button onClick={bookmarkMutation.mutate} className="menu-item">
        <Bookmark size={13} />
        Bookmark
      </button>

      <button onClick={() => openPanel('ai')} className="menu-item">
        <MessageSquare size={13} />
        Ask AI about verse
      </button>

      <button onClick={() => openPanel('word-study')} className="menu-item">
        <Layers size={13} />
        Word study
      </button>

      <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Highlighter size={11} />
            Highlight
          </span>
          {highlightId && (
            <button
              onClick={() => removeHighlightMutation.mutate()}
              title="Remove highlight"
              className="text-gray-400 hover:text-red-500 flex items-center gap-0.5"
            >
              <X size={11} /> remove
            </button>
          )}
        </p>
        <div className="flex gap-1.5">
          {COLORS.map(({ id, label, cls }) => (
            <button
              key={id}
              onClick={() => highlightMutation.mutate(id)}
              title={label}
              className={clsx('w-5 h-5 rounded-full border border-white shadow-sm hover:scale-110 transition-transform', cls)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
