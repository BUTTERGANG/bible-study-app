import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, MapPin, Tag, X } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { useGroupsStore } from '../../stores/groupsStore'
import { api } from '../../api/client'

/**
 * Inline editor for creating or editing group notes.
 * Can be pre-filled from the current reading context via useStudyStore.
 */
export default function GroupNoteEditor({ note, onSave, onCancel }) {
  const { book, chapter, verse } = useStudyStore()
  const { activeGroup } = useGroupsStore()
  const qc = useQueryClient()

  const isEditing = !!note

  const [content, setContent] = useState(note?.content ?? '')
  const [tags, setTags] = useState(note?.tags ?? '')
  const [noteBook, setBook] = useState(note?.book ?? '')
  const [noteChapter, setChapter] = useState(note?.chapter ?? '')
  const [noteVerse, setVerse] = useState(note?.verse ?? '')

  // Sync from study store when "Use current passage" is clicked
  const useCurrentPassage = () => {
    if (book) setBook(book)
    if (chapter) setChapter(String(chapter))
    if (verse) setVerse(String(verse))
  }

  // Auto-fill from current reading context on mount for new notes
  useEffect(() => {
    if (!isEditing) {
      if (book) setBook(book)
      if (chapter) setChapter(String(chapter))
      if (verse != null) setVerse(String(verse))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const reference =
    noteBook && noteChapter
      ? noteVerse
        ? `${noteBook} ${noteChapter}:${noteVerse}`
        : `${noteBook} ${noteChapter}`
      : ''

  const mutation = useMutation({
    mutationFn: (data) => {
      const groupId = activeGroup.id
      if (isEditing) {
        return api.updateGroupNote(groupId, note.id, data)
      }
      return api.createGroupNote(groupId, data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-feed', activeGroup.id] })
      qc.invalidateQueries({ queryKey: ['group-notes', activeGroup.id] })
      onSave?.()
    },
  })

  const handleSubmit = () => {
    if (!content.trim()) return
    const payload = {
      content: content.trim(),
      tags: tags.trim() || undefined,
      ...(noteBook && noteChapter
        ? {
            book: noteBook,
            chapter: parseInt(noteChapter, 10),
            verse: noteVerse ? parseInt(noteVerse, 10) : undefined,
          }
        : {}),
    }
    mutation.mutate(payload)
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 space-y-3">
      {/* Reference fields */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <MapPin size={10} />
          Reference
        </label>
        <input
          type="text"
          value={noteBook}
          onChange={(e) => setBook(e.target.value)}
          placeholder="Book"
          className="w-24 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-200 placeholder-gray-400"
        />
        <input
          type="number"
          value={noteChapter}
          onChange={(e) => setChapter(e.target.value)}
          placeholder="Ch"
          min={1}
          className="w-14 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-200 placeholder-gray-400"
        />
        <input
          type="number"
          value={noteVerse}
          onChange={(e) => setVerse(e.target.value)}
          placeholder="V"
          min={1}
          className="w-14 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-200 placeholder-gray-400"
        />
        <button
          type="button"
          onClick={useCurrentPassage}
          disabled={!book}
          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:no-underline"
          title="Use current reading position"
        >
          Use current
        </button>
        {reference && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
            {reference}
          </span>
        )}
      </div>

      {/* Content */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={isEditing ? 'Edit your note...' : 'Write a note for the group...'}
        rows={4}
        className="w-full text-sm bg-transparent border-none focus:outline-none resize-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
        autoFocus
      />

      {/* Tags */}
      <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1">
        <Tag size={11} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (comma-separated)"
          className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
        />
      </div>

      {/* Error */}
      {mutation.isError && (
        <p className="text-xs text-red-500">
          {mutation.error?.message || 'Failed to save note'}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 flex items-center gap-1"
          >
            <X size={12} /> Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || mutation.isPending}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md disabled:opacity-40 hover:bg-blue-700 flex items-center gap-1"
        >
          {mutation.isPending ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Saving...
            </>
          ) : isEditing ? (
            <>
              <Check size={12} /> Update
            </>
          ) : (
            <>
              <Check size={12} /> Save
            </>
          )}
        </button>
      </div>
    </div>
  )
}
