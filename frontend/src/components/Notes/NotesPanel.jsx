import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Edit2, Filter, Plus, StickyNote, Tag, Trash2, X } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

export default function NotesPanel() {
  const { book, chapter, verse } = useStudyStore()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [newNote, setNewNote] = useState('')
  const [newTags, setNewTags] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [viewAll, setViewAll] = useState(false)
  const [filterTag, setFilterTag] = useState('')
  const [editTags, setEditTags] = useState('')

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

  const allNotes = data?.notes ?? []

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
      qc.invalidateQueries({ queryKey: ['notes'] })
      setNewNote('')
      setNewTags('')
      setShowNew(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, content, tags }) => api.updateNote(id, { content, tags }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <StickyNote size={13} />
          Notes
        </span>
        <div className="flex items-center gap-1">
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

      {!viewAll && (
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Notes for <strong>{reference}</strong>
          </p>
        </div>
      )}

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

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {showNew && !viewAll && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write your note…"
              rows={3}
              className="w-full text-sm bg-transparent border-none focus:outline-none resize-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
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

        {allNotes.length === 0 && !showNew && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            {viewAll
              ? (filterTag ? `No notes with tag "${filterTag}"` : 'No notes yet. Right-click any verse to add one.')
              : 'No notes for this passage yet.'}
          </p>
        )}

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
          />
        ))}
      </div>
    </div>
  )
}

function NoteCard({ note, editing, editTags, onEditTagsChange, onEdit, onDelete, onSave, onCancelEdit }) {
  const [content, setContent] = useState(note.content)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const tags = note.tags ? note.tags.split(',').map((s) => s.trim()).filter(Boolean) : []

  // Auto-cancel confirm after 3s
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
      {editing ? (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full text-sm bg-transparent border-none focus:outline-none resize-none text-gray-700 dark:text-gray-200"
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
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
            {note.content}
          </p>
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
