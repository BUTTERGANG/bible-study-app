import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, StickyNote, Edit2, Check, X } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'

export default function NotesPanel() {
  const { book, chapter, verse } = useStudyStore()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [newNote, setNewNote] = useState('')
  const [showNew, setShowNew] = useState(false)

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`

  const { data } = useQuery({
    queryKey: ['notes', reference],
    queryFn: () => api.getNotes(reference),
    enabled: !!book,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.createNote({
        reference,
        book,
        chapter,
        verse: verse || null,
        content: newNote,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', reference] })
      setNewNote('')
      setShowNew(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, content }) => api.updateNote(id, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', reference] })
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', reference] }),
  })

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <StickyNote size={13} />
          Notes
        </span>
        <button
          onClick={() => setShowNew(!showNew)}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Plus size={12} />
          New
        </button>
      </div>

      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
        <p className="text-xs text-gray-500 dark:text-gray-400">Notes for <strong>{reference}</strong></p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* New note form */}
        {showNew && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write your note…"
              rows={3}
              className="w-full text-sm bg-transparent border-none focus:outline-none resize-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => { setShowNew(false); setNewNote('') }}
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

        {/* Existing notes */}
        {data?.notes?.length === 0 && !showNew && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            No notes for this passage yet.
          </p>
        )}

        {data?.notes?.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            editing={editing === note.id}
            onEdit={() => setEditing(note.id)}
            onDelete={() => deleteMutation.mutate(note.id)}
            onSave={(content) => updateMutation.mutate({ id: note.id, content })}
            onCancelEdit={() => setEditing(null)}
          />
        ))}
      </div>
    </div>
  )
}

function NoteCard({ note, editing, onEdit, onDelete, onSave, onCancelEdit }) {
  const [content, setContent] = useState(note.content)

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
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onCancelEdit} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={13} />
            </button>
            <button onClick={() => onSave(content)} className="p-1 text-green-600 hover:text-green-700">
              <Check size={13} />
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
            {note.content}
          </p>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(note.created_at).toLocaleDateString()}
            </span>
            <div className="flex gap-2">
              <button onClick={onEdit} className="p-1 text-gray-400 hover:text-blue-500">
                <Edit2 size={12} />
              </button>
              <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
