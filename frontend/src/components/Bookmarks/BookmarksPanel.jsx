import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, ChevronRight, Trash2 } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'

export default function BookmarksPanel() {
  const qc = useQueryClient()
  const setReference = useStudyStore((s) => s.setReference)

  const { data, isLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: api.getBookmarks,
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteBookmark,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks'] }),
  })

  const bookmarks = data?.bookmarks ?? []

  function goToBookmark(bm) {
    setReference(bm.book, bm.chapter, bm.verse)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Bookmark size={13} />
          Bookmarks
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
          {bookmarks.length} saved
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-sm text-gray-400 text-center">Loading…</div>
        )}

        {!isLoading && bookmarks.length === 0 && (
          <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
            <Bookmark size={24} className="mx-auto mb-2 opacity-30" />
            <p>No bookmarks yet.</p>
            <p className="text-xs mt-1">Right-click any verse and select "Bookmark" to save it here.</p>
          </div>
        )}

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {bookmarks.map((bm) => (
            <BookmarkRow
              key={bm.id}
              bm={bm}
              onGo={() => goToBookmark(bm)}
              onDelete={() => deleteMutation.mutate(bm.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BookmarkRow({ bm, onGo, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Auto-cancel confirm after 3s (matches NotesPanel behaviour)
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  return (
    <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <button
        onClick={onGo}
        aria-label={`Go to ${bm.reference}`}
        className="flex-1 text-left min-w-0"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
            {bm.reference}
          </span>
          <ChevronRight size={12} className="text-gray-300 dark:text-gray-600" />
        </div>
        {bm.preview_text && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
            "{bm.preview_text}"
          </p>
        )}
        {bm.note && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 truncate">
            {bm.note}
          </p>
        )}
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
          {new Date(bm.created_at).toLocaleDateString()}
        </p>
      </button>
      {confirmDelete ? (
        <button
          onClick={() => { onDelete(); setConfirmDelete(false) }}
          className="text-[10px] font-medium text-red-500 hover:text-red-600 px-2 py-1.5 rounded"
          title="Tap again to confirm deletion"
        >
          Delete?
        </button>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
          title="Remove bookmark"
          aria-label={`Remove bookmark for ${bm.reference}`}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
