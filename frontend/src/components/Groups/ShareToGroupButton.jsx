import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Share2, Check, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../api/client'
import useGroupsStore from '../../stores/groupsStore'

/**
 * ShareToGroupButton
 *
 * Dropdown button that lets the user share a personal note or highlight
 * into one of their groups, with an optional annotation.
 */
export default function ShareToGroupButton({ itemType, itemId, onShared }) {
  const [open, setOpen] = useState(false)
  const [annotation, setAnnotation] = useState('')
  const [sharedGroupId, setSharedGroupId] = useState(null)
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)

  const queryClient = useQueryClient()
  const setGroups = useGroupsStore((s) => s.setGroups)

  // Fetch user's groups
  const {
    data: groups,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['my-groups'],
    queryFn: async () => {
      const data = await api.getMyGroups()
      // Push into the shared store so sibling components stay in sync
      if (Array.isArray(data)) setGroups(data)
      return data
    },
    staleTime: 60_000,
  })

  // Share mutation
  const shareMutation = useMutation({
    mutationFn: ({ groupId, annotation: note }) =>
      api.shareToGroup(groupId, {
        item_type: itemType,
        item_id: itemId,
        annotation: note,
      }),
    onSuccess: (_data, variables) => {
      setSharedGroupId(variables.groupId)
      // Invalidate group feed so the new share appears immediately
      queryClient.invalidateQueries({
        queryKey: ['group-feed', variables.groupId],
      })
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      setAnnotation('')
      onShared?.()
      // Clear the "Shared ✓" indicator after a short delay
      setTimeout(() => setSharedGroupId(null), 1800)
    },
  })

  // Close popover when clicking outside
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleToggle() {
    setOpen((prev) => !prev)
    setSharedGroupId(null)
  }

  function handleShare(groupId) {
    shareMutation.mutate({ groupId, annotation })
  }

  const hasGroups = Array.isArray(groups) && groups.length > 0

  return (
    <div className="relative inline-block">
      {/* Trigger button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={shareMutation.isLoading}
        title={`Share ${itemType} to a group`}
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium',
          'border transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
          open
            ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-300'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
          'dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700',
          shareMutation.isLoading && 'opacity-60 cursor-wait'
        )}
      >
        {shareMutation.isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Share2 className="w-3.5 h-3.5" />
        )}
        Share
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          className={clsx(
            'absolute z-50 top-full left-0 mt-1 w-72',
            'rounded-lg border shadow-lg',
            'bg-white border-gray-200',
            'dark:bg-gray-800 dark:border-gray-700'
          )}
          role="dialog"
          aria-label="Share to group"
        >
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
              Share to Group
            </p>
          </div>

          {/* Annotation textarea */}
          <div className="px-3 pt-2">
            <textarea
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value)}
              placeholder="Add a note about why you're sharing this... (optional)"
              rows={2}
              className={clsx(
                'w-full resize-none rounded-md border px-2 py-1.5 text-xs',
                'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'bg-gray-50 border-gray-300 text-gray-800',
                'dark:bg-gray-900 dark:border-gray-600 dark:text-gray-200',
                'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
              )}
            />
          </div>

          {/* Group list */}
          <div className="px-3 pb-2">
            {isLoading && (
              <div className="flex items-center gap-2 py-3 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading groups…
              </div>
            )}

            {error && (
              <p className="py-3 text-xs text-red-600 dark:text-red-400">
                Could not load groups: {error.message}
              </p>
            )}

            {!isLoading && !error && !hasGroups && (
              <p className="py-3 text-xs text-gray-500 dark:text-gray-400">
                Create a group first to share this {itemType}.
              </p>
            )}

            {hasGroups && (
              <ul className="mt-1 max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {groups.map((group) => (
                  <li
                    key={group.id}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="flex-1 min-w-0 mr-2 text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                      {group.name}
                    </span>
                    {sharedGroupId === group.id ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                        <Check className="w-3.5 h-3.5" />
                        Shared
                      </span>
                    ) : (
                      <button
                        onClick={() => handleShare(group.id)}
                        disabled={shareMutation.isLoading}
                        className={clsx(
                          'shrink-0 px-2.5 py-1 rounded text-xs font-medium',
                          'bg-blue-600 text-white hover:bg-blue-700',
                          'dark:bg-blue-500 dark:hover:bg-blue-400',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          'transition-colors duration-150'
                        )}
                      >
                        Share
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
