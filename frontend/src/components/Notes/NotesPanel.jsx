import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check, Edit2, Image, Link, Loader2, Plus, Sparkles,
  StickyNote, Tag, Trash2, X, Upload
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

// Extend the default rehype-sanitize schema to allow image attributes we need
const markdownSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes.img || []), 'alt', 'title', 'width', 'height'],
    // Also allow className on code for syntax highlighting
    code: [['className', /^language-/]],
  },
  tagNames: [...(defaultSchema.tagNames || []), 'img'],
}
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

// ── Image compression helper ──────────────────────────────────────────────
// Resizes a File (image) to max width/height using canvas, returns a new File.
function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        if (width <= maxWidth && height <= maxHeight) {
          resolve(file) // no resize needed
          return
        }
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Compression failed'))
            const compressed = new File([blob], file.name, { type: 'image/jpeg' })
            resolve(compressed)
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Media Picker Modal ────────────────────────────────────────────────────
function MediaPickerModal({ onInsert, onClose }) {
  const [mode, setMode] = useState('upload') // 'upload' | 'url'
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadPreview, setUploadPreview] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const [noteId] = useState(0) // 0 = unlinked

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    setError('')
    // Client-side preview
    const reader = new FileReader()
    reader.onload = (ev) => setUploadPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Please select a file first.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const compressed = await compressImage(file, 1200, 1200, 0.8)
      const result = await api.uploadMedia(compressed, caption, noteId)
      const altText = caption || result.original_filename
      onInsert(`![${altText}](${result.url})`)
      onClose()
    } catch (err) {
      setError(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleUrlInsert = () => {
    if (!url.trim()) return
    const altText = caption || 'Image'
    onInsert(`![${altText}](${url.trim()})`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Insert Image</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        {/* Tab: Upload / URL */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => setMode('upload')}
            className={clsx(
              'flex-1 text-xs py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors',
              mode === 'upload'
                ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            )}
          >
            <Upload size={12} /> Upload
          </button>
          <button
            onClick={() => setMode('url')}
            className={clsx(
              'flex-1 text-xs py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors',
              mode === 'url'
                ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            )}
          >
            <Link size={12} /> URL
          </button>
        </div>

        {mode === 'upload' ? (
          <div className="space-y-3">
            <div
              className={clsx(
                'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
                uploadPreview
                  ? 'border-blue-300 dark:border-blue-600'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
              )}
              onClick={() => fileRef.current?.click()}
            >
              {uploadPreview ? (
                <img src={uploadPreview} alt="Preview" className="max-h-40 mx-auto rounded-md" />
              ) : (
                <div className="space-y-1">
                  <Image size={24} className="mx-auto text-gray-400" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Click to choose an image (max 5 MB)
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    JPG, PNG, GIF, WebP, SVG
                  </p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-200 placeholder-gray-400"
            />
          </div>
        )}

        {/* Caption */}
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption (optional)"
          className="w-full text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-200 placeholder-gray-400"
        />

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-1.5"
          >
            Cancel
          </button>
          {mode === 'upload' ? (
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadPreview}
              className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-md disabled:opacity-40 hover:bg-blue-700 flex items-center gap-1"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? 'Uploading...' : 'Insert'}
            </button>
          ) : (
            <button
              onClick={handleUrlInsert}
              disabled={!url.trim()}
              className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-md disabled:opacity-40 hover:bg-blue-700 flex items-center gap-1"
            >
              <Link size={12} /> Insert
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Lightbox for full-size image viewing ──────────────────────────────────
function ImageLightbox({ src, alt, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
        {alt && (
          <p className="text-center text-xs text-gray-300 mt-2">{alt}</p>
        )}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-white dark:bg-gray-700 rounded-full p-1 shadow-lg text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Rendered markdown note content with clickable images ──────────────────
function MarkdownContent() {
  const [lightbox, setLightbox] = useState(null)

  return (
    <>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSchema]]}
        components={{
          img: ({ src, alt }) => (
            <span className="inline-block my-1">
              <img
                src={src}
                alt={alt || ''}
                className="max-w-full max-h-64 rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                loading="lazy"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox({ src, alt: alt || '' })
                }}
                title={alt || 'Click to enlarge'}
              />
              {alt && (
                <span className="block text-[10px] text-gray-400 dark:text-gray-500 italic text-center mt-0.5">
                  {alt}
                </span>
              )}
            </span>
          ),
          // Render links that point to images as inline images
          a: ({ href, children, ...props }) => {
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(href || '')
            if (isImage) {
              const childText = typeof children === 'string' ? children : children?.[0] || href
              return (
                <span className="inline-block my-1">
                  <img
                    src={href}
                    alt={childText}
                    className="max-w-full max-h-64 rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                    onClick={(e) => {
                      e.stopPropagation()
                      setLightbox({ src: href, alt: childText })
                    }}
                  />
                </span>
              )
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline" {...props}>
                {children}
              </a>
            )
          },
        }}
        className="notes-markdown"
      />
      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}

// ── Main NotesPanel ───────────────────────────────────────────────────────
export default function NotesPanel() {
  const book = useStudyStore((s) => s.book)
  const chapter = useStudyStore((s) => s.chapter)
  const verse = useStudyStore((s) => s.verse)
  const translation = useStudyStore((s) => s.translation)
  const qc = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [newNote, setNewNote] = useState('')
  const [newTags, setNewTags] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [viewAll, setViewAll] = useState(false)
  const [filterTag, setFilterTag] = useState('')
  const [editTags, setEditTags] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [insertTarget, setInsertTarget] = useState(null) // null = newNote, number = editing note id
  const editAreaRef = useRef(null)
  const newAreaRef = useRef(null)

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`
  const notesKey = viewAll
    ? ['notes', 'all', filterTag || null]
    : ['notes', book, chapter, verse ?? null]

  const { data } = useQuery({
    queryKey: notesKey,
    queryFn: viewAll
      ? () => api.getAllNotes(filterTag || undefined)
      : () => api.getNotes(book, chapter, verse ?? undefined),
    enabled: viewAll || !!book,
  })

  const allNotes = useMemo(() => data?.notes ?? [], [data?.notes])

  // Extract unique tags from all notes for the tag filter
  const allTags = useMemo(() => {
    const tagSet = new Set()
    for (const note of allNotes) {
      if (note.tags) {
        for (const t of note.tags.split(',').map((s) => s.trim()).filter(Boolean)) {
          tagSet.add(t)
        }
      }
    }
    return [...tagSet].sort()
  }, [allNotes])

  // Helper to insert media markdown into a textarea at cursor position
  const insertMediaAtCursor = useCallback((markdown) => {
    const textarea = insertTarget === null ? newAreaRef.current : editAreaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = insertTarget === null ? newNote : textarea.value
    const updated = currentValue.substring(0, start) + markdown + currentValue.substring(end)
    if (insertTarget === null) {
      setNewNote(updated)
    } else {
      // For the editing note, we update via the NoteCard's content state
      // We dispatch a custom approach: set the edit content directly
      setEditContentDirect(updated)
    }
  }, [insertTarget, newNote])

  // We need a way to update editing content from the parent
  // We'll use a callback ref approach — store a setter that NoteCard can call
  const editContentSetterRef = useRef(null)
  const setEditContentDirect = (val) => {
    if (editContentSetterRef.current) editContentSetterRef.current(val)
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.createNote({
        book,
        chapter,
        verse: verse ?? null,
        content: newNote,
        tags: newTags.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notesKey })
      qc.invalidateQueries({ queryKey: ['notes', 'all'] })
      setNewNote('')
      setNewTags('')
      setShowNew(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, content, tags }) => api.updateNote(id, { content, tags }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notesKey })
      qc.invalidateQueries({ queryKey: ['notes', 'all'] })
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notesKey })
      qc.invalidateQueries({ queryKey: ['notes', 'all'] })
    },
  })

  const generateOutline = async () => {
    setIsGenerating(true)
    setGenerateError('')
    try {
      const res = await api.generateOutline(reference, translation)
      setNewNote(res.outline)
      setNewTags('outline, study')
      setShowNew(true)
    } catch (err) {
      setGenerateError(err.message?.includes('503') ? 'AI key not configured.' : 'Generation failed — try again.')
      setTimeout(() => setGenerateError(''), 4000)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with toolbar */}
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <StickyNote size={13} />
          Notes
        </span>
        <div className="flex items-center gap-1">
          {!viewAll && (
            <div className="flex items-center gap-1 mr-1">
              <button
                onClick={generateOutline}
                disabled={isGenerating}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 disabled:opacity-50"
                title="Generate AI study outline"
              >
                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                AI Outline
              </button>
              {generateError && (
                <span className="text-[10px] text-red-500">{generateError}</span>
              )}
            </div>
          )}
          <button
            onClick={() => setViewAll(!viewAll)}
            className={clsx(
              'text-xs px-2 py-0.5 rounded-full border transition-colors',
              viewAll
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                : 'text-gray-500 border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:text-gray-400'
            )}
          >
            {viewAll ? 'All Notes' : 'This Passage'}
          </button>
          {!viewAll && (
            <button
              onClick={() => setShowNew(!showNew)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus size={12} />
              New
            </button>
          )}
        </div>
      </div>

      {/* Reference bar */}
      {!viewAll && (
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Notes for <strong>{reference}</strong>
          </p>
        </div>
      )}

      {/* Tag filter bar */}
      {viewAll && (
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600 space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            All Notes ({allNotes.length})
          </p>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setFilterTag('')}
                className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded-full border transition-colors',
                  !filterTag
                    ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                    : 'text-gray-500 border-gray-300 hover:border-gray-400 dark:border-gray-600'
                )}
              >
                All
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTag(filterTag === t ? '' : t)}
                  className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded-full border transition-colors flex items-center gap-0.5',
                    filterTag === t
                      ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                      : 'text-gray-500 border-gray-300 hover:border-gray-400 dark:border-gray-600'
                  )}
                >
                  <Tag size={8} />
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* New note editor */}
        {showNew && !viewAll && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
            <div className="flex items-center gap-1 mb-2">
              <button
                onClick={() => { setInsertTarget(null); setShowMediaPicker(true) }}
                className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 px-3 py-2 rounded hover:bg-yellow-100 dark:hover:bg-yellow-800/30 transition-colors min-h-[36px]"
                title="Insert image"
              >
                <Image size={12} />
                Image
              </button>
              <span className="text-[10px] text-gray-400">Supports Markdown</span>
            </div>
            <textarea
              ref={newAreaRef}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write your note... (Markdown supported)"
              rows={4}
              className="w-full text-sm bg-transparent border-none focus:outline-none resize-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 font-mono"
              autoFocus
            />
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1">
                <Tag size={11} className="text-gray-400 flex-shrink-0" />
                <input
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="Tags (comma-separated)"
                  className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => { setShowNew(false); setNewNote(''); setNewTags('') }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newNote.trim()}
                className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md disabled:opacity-40 hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {allNotes.length === 0 && !showNew && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            {viewAll
              ? (filterTag ? `No notes with tag "${filterTag}"` : 'No notes yet. Right-click any verse to add one.')
              : 'No notes for this passage yet.'}
          </p>
        )}

        {/* Note cards */}
        {allNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            editing={editing === note.id}
            editTags={editTags}
            onEditTagsChange={setEditTags}
            onEdit={() => { setEditing(note.id); setEditTags(note.tags || '') }}
            onDelete={() => deleteMutation.mutate(note.id)}
            onSave={(content, tags) => updateMutation.mutate({ id: note.id, content, tags })}
            onCancelEdit={() => { setEditing(null); setEditTags('') }}
            onInsertImage={() => { setInsertTarget(note.id); setShowMediaPicker(true) }}
            editAreaRef={editing === note.id ? editAreaRef : null}
            editContentSetterRef={editing === note.id ? editContentSetterRef : null}
            registerEditContentSetter={editing === note.id ? ((fn) => { editContentSetterRef.current = fn; }) : null}
          />
        ))}
      </div>

      {/* Media picker modal */}
      {showMediaPicker && (
        <MediaPickerModal
          onInsert={(markdown) => {
            insertMediaAtCursor(markdown)
            setShowMediaPicker(false)
          }}
          onClose={() => setShowMediaPicker(false)}
        />
      )}
    </div>
  )
}

// ── Note Card ──────────────────────────────────────────────────────────────
function NoteCard({
  note, editing, editTags, onEditTagsChange, onEdit, onDelete,
  onSave, onCancelEdit, onInsertImage, editAreaRef, _editContentSetterRef,
  registerEditContentSetter
}) {
  const [content, setContent] = useState(note.content)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const tags = note.tags ? note.tags.split(',').map((s) => s.trim()).filter(Boolean) : []

  // Auto-cancel confirm after 3s
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  // Register the content setter so parent can insert images
  useEffect(() => {
    if (registerEditContentSetter) {
      registerEditContentSetter(setContent)
    }
  }, [registerEditContentSetter])

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
      {editing ? (
        <>
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={onInsertImage}
              className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-800/30 transition-colors"
              title="Insert image"
            >
              <Image size={12} />
              Image
            </button>
            <span className="text-[10px] text-gray-400">Markdown supported</span>
          </div>
          <textarea
            ref={editAreaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full text-sm bg-transparent border-none focus:outline-none resize-none text-gray-700 dark:text-gray-200 font-mono"
            autoFocus
          />
          <div className="flex items-center gap-1.5 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1">
            <Tag size={11} className="text-gray-400 flex-shrink-0" />
            <input
              value={editTags}
              onChange={(e) => onEditTagsChange(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onCancelEdit} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={13} />
            </button>
            <button onClick={() => onSave(content, editTags.trim() || null)} className="p-1 text-green-600 hover:text-green-700">
              <Check size={13} />
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Render markdown content */}
          <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
            <MarkdownContent content={note.content} />
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center gap-0.5">
                  <Tag size={8} />
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {note.reference}
              </span>
              <span className="text-xs text-gray-300 dark:text-gray-600">
                {new Date(note.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={onEdit} className="p-1 text-gray-400 hover:text-blue-500">
                <Edit2 size={12} />
              </button>
              {confirmDelete ? (
                <button
                  onClick={() => { onDelete(); setConfirmDelete(false) }}
                  className="p-1 text-red-500 hover:text-red-600 text-[10px] font-medium"
                  title="Click again to confirm"
                >
                  Delete?
                </button>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="p-1 text-gray-400 hover:text-red-500">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
