import { useState, useRef } from 'react'
import { useClickOutside } from '../../hooks/useClickOutside'
import {
  AlertCircle, Bookmark, Copy, Download, Highlighter, Image, Layers, Link,
  Loader2, MessageSquare, Printer, Share2, StickyNote, X,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import { getVerseExportData, getPassageExportData, printPassage } from '../../utils/export'
import ShareCardModal from './ShareCardModal'
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
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showCard, setShowCard] = useState(false)

  useClickOutside(ref, onClose)

  const highlightMutation = useMutation({
    mutationFn: (color) =>
      api.createHighlight({ translation, book, chapter, verse, color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['highlights', translation, book, chapter] })
      setError(null)
      onClose()
    },
    onError: (err) => setError(err.message || 'Failed to save highlight'),
  })

  const removeHighlightMutation = useMutation({
    mutationFn: () => api.deleteHighlight(highlightId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['highlights', translation, book, chapter] })
      setError(null)
      onClose()
    },
    onError: (err) => setError(err.message || 'Failed to remove highlight'),
  })

  const bookmarkMutation = useMutation({
    mutationFn: () => api.createBookmark({ book, chapter, verse }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookmarks'] })
      setError(null)
      onClose()
    },
    onError: (err) => setError(err.message || 'Failed to save bookmark'),
  })

  const isMutating = highlightMutation.isPending || removeHighlightMutation.isPending || bookmarkMutation.isPending

  function copyVerse() {
    navigator.clipboard.writeText(`${book} ${chapter}:${verse} — ${text}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function copyLink() {
    const url = `${window.location.origin}/${translation}/${book}/${chapter}/${verse}`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  function shareVerse() {
    const shareData = {
      title: `${book} ${chapter}:${verse}`,
      text: `${book} ${chapter}:${verse} — ${text}\n\n${translation}`,
      url: `${window.location.origin}/${translation}/${book}/${chapter}/${verse}`,
    }
    if (navigator.share) {
      navigator.share(shareData).catch(() => {})
    } else {
      copyLink()
    }
    onClose()
  }

  async function exportPassage() {
    setIsExporting(true)
    try {
      const content = await getVerseExportData(book, chapter, verse, text, translation)
      
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${book}-${chapter}-${verse}.md`
      a.click()
      
      // Revoke after a tick so the download has time to start
      setTimeout(() => URL.revokeObjectURL(url), 100)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Failed to export passage')
      setIsExporting(false)
    }
  }

  function openPanel(panel) {
    setRightPanel(panel)
    setRightPanelOpen(true)
    onClose()
  }

  // Measure actual menu size for proper clamping
  const menuWidth = 208 // w-52 = 13rem = 208px
  const menuHeight = 380 // generous estimate including error banner
  const style = {
    position: 'fixed',
    left: Math.min(pos.x, window.innerWidth - menuWidth - 8),
    top: Math.min(pos.y, window.innerHeight - menuHeight - 8),
    zIndex: 1000,
  }

  return (
    <>
    <div
      ref={ref}
      style={style}
      className="w-52 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 py-1 text-sm"
    >
      <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-100 dark:border-gray-700">
        {book} {chapter}:{verse}
      </div>

      {error && (
        <div className="mx-2 mt-1.5 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded px-2 py-1.5">
          <AlertCircle size={12} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <button onClick={copyVerse} className="menu-item">
        <Copy size={13} />
        {copied ? 'Copied!' : 'Copy verse'}
      </button>

      <button onClick={copyLink} className="menu-item">
        <Link size={13} />
        {linkCopied ? 'Link copied!' : 'Copy link'}
      </button>

      <button onClick={shareVerse} className="menu-item">
        <Share2 size={13} />
        Share verse
      </button>

      <button onClick={() => setShowCard(true)} className="menu-item">
        <Image size={13} />
        Share as card
      </button>

      <button onClick={exportPassage} disabled={isExporting} className="menu-item">
        {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        Export passage
      </button>

      <button onClick={async () => {
        setIsExporting(true)
        try {
          const data = await getPassageExportData(translation, book, chapter, { includeNotes: true, includeHighlights: true })
          printPassage(data)
          onClose()
        } catch (err) {
          setError('Failed to prepare print view')
        } finally {
          setIsExporting(false)
        }
      }} disabled={isExporting} className="menu-item">
        <Printer size={13} />
        Print / PDF
      </button>

      <div className="border-t border-gray-100 dark:border-gray-700" />

      <button onClick={() => openPanel('compare')} className="menu-item">
        <Layers size={13} />
        Compare translations
      </button>

      <button onClick={() => openPanel('notes')} className="menu-item">
        <StickyNote size={13} />
        Add note
      </button>

      <button
        onClick={() => !isMutating && bookmarkMutation.mutate()}
        disabled={isMutating}
        className="menu-item"
      >
        {isMutating && bookmarkMutation.isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Bookmark size={13} />
        )}
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
              onClick={() => !isMutating && removeHighlightMutation.mutate()}
              disabled={isMutating}
              title="Remove highlight"
              className="text-gray-400 hover:text-red-500 flex items-center gap-0.5 disabled:opacity-40"
            >
              {isMutating && removeHighlightMutation.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <X size={11} />
              )}
              remove
            </button>
          )}
        </p>
        <div className="flex gap-1.5">
          {COLORS.map(({ id, label, cls }) => (
            <button
              key={id}
              onClick={() => !isMutating && highlightMutation.mutate(id)}
              disabled={isMutating}
              title={label}
              className={clsx(
                'w-5 h-5 rounded-full border border-white shadow-sm hover:scale-110 transition-transform',
                cls,
                isMutating && 'opacity-50 pointer-events-none'
              )}
            />
          ))}
        </div>
      </div>
    </div>

    {showCard && (
      <ShareCardModal
        verse={verse}
        text={text}
        book={book}
        chapter={chapter}
        translation={translation}
        onClose={() => { setShowCard(false); onClose() }}
      />
    )}
    </>
  )
}
