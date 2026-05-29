import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Mail, UserPlus, X } from 'lucide-react'
import clsx from 'clsx'
import { useGroupsStore } from '../../stores/groupsStore'
import { api } from '../../api/client'

/**
 * Shown inside the Members tab of GroupDetail.
 * Provides an email input + invite button and lists pending invites.
 */
export default function InviteManager({ groupId }) {
  const { activeGroup } = useGroupsStore()
  const qc = useQueryClient()

  const [email, setEmail] = useState('')
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message: string }
  const [pendingInvites, setPendingInvites] = useState(
    (activeGroup?.members || []).filter((m) => m.role === 'pending')
  )

  const inviteMutation = useMutation({
    mutationFn: (inviteEmail) => api.inviteMember(groupId, inviteEmail),
    onMutate: (inviteEmail) => {
      // Optimistically add to pending list
      const optimistic = {
        id: `temp-${Date.now()}`,
        email: inviteEmail,
        role: 'pending',
        joined_at: new Date().toISOString(),
      }
      setPendingInvites((prev) => [...prev, optimistic])
      return { optimistic }
    },
    onSuccess: (result, _vars, context) => {
      setEmail('')
      setFeedback({ type: 'success', message: `Invite sent to ${result?.email || context?.optimistic?.email || 'member'}` })
      qc.invalidateQueries({ queryKey: ['group', groupId] })
      // Clear feedback after 4s
      setTimeout(() => setFeedback(null), 4000)
    },
    onError: (err, _vars, context) => {
      // Remove optimistic entry
      if (context?.optimistic) {
        setPendingInvites((prev) =>
          prev.filter((i) => i.id !== context.optimistic.id)
        )
      }
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to send invite',
      })
      setTimeout(() => setFeedback(null), 4000)
    },
  })

  const handleInvite = () => {
    const trimmed = email.trim()
    if (!trimmed) return
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFeedback({ type: 'error', message: 'Please enter a valid email address' })
      setTimeout(() => setFeedback(null), 4000)
      return
    }
    inviteMutation.mutate(trimmed)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleInvite()
    }
  }

  const isOwner = activeGroup?.current_user_role === 'owner'

  return (
    <div className="space-y-4">
      {/* Invite form — only for owners */}
      {isOwner && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <UserPlus size={12} />
            Invite by email
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5">
              <Mail size={13} className="text-gray-400 flex-shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="colleague@example.com"
                className="w-full text-sm bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
              />
            </div>
            <button
              onClick={handleInvite}
              disabled={!email.trim() || inviteMutation.isPending}
              className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-md disabled:opacity-40 hover:bg-blue-700 flex items-center gap-1 flex-shrink-0"
            >
              {inviteMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <UserPlus size={12} />
              )}
              Send Invite
            </button>
          </div>
        </div>
      )}

      {/* Feedback message */}
      {feedback && (
        <div
          className={clsx(
            'text-xs px-3 py-2 rounded-lg flex items-center gap-1.5',
            feedback.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700'
              : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
          )}
        >
          {feedback.type === 'success' ? (
            <Check size={12} className="flex-shrink-0" />
          ) : (
            <X size={12} className="flex-shrink-0" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Pending invites list */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Pending Invites ({pendingInvites.length})
          </p>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Mail size={13} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                    {invite.email}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 flex-shrink-0">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for pending */}
      {pendingInvites.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
          No pending invites
        </p>
      )}
    </div>
  )
}
