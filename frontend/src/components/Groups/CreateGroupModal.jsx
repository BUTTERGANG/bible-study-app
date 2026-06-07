import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Users, X } from 'lucide-react'
import { api } from '../../api/client'
import useGroupsStore from '../../stores/groupsStore'

/**
 * Modal overlay for creating a new group.
 * Click outside (on backdrop) to close.
 */
export default function CreateGroupModal({ onClose }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const qc = useQueryClient()
  const addGroup = useGroupsStore((s) => s.addGroup)
  const firstInputRef = useRef(null)

  const mutation = useMutation({
    mutationFn: () => api.createGroup({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: (data) => {
      // Optimistically add to the local store
      addGroup(data)
      // Invalidate the groups query list
      qc.invalidateQueries({ queryKey: ['my-groups'] })
      onClose()
    },
  })

  // Move focus to the first input when the modal opens
  useEffect(() => { firstInputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleBackdropMouseDown = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || mutation.isPending) return
    mutation.mutate()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-5 space-y-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3
            id="create-group-title"
            className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2"
          >
            <Users size={16} />
            Create a Group
          </h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={firstInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunday School Class"
              className="w-full text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-200 placeholder-gray-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              rows={3}
              className="w-full text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-200 placeholder-gray-400 resize-none"
            />
          </div>

          {/* Error */}
          {mutation.isError && (
            <p className="text-xs text-red-500">
              {mutation.error?.message || 'Failed to create group'}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || mutation.isPending}
              className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-md disabled:opacity-40 hover:bg-blue-700 flex items-center gap-1"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Creating...
                </>
              ) : (
                'Create'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
