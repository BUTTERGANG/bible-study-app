import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronUp, Clock, Loader2, Plus, Trash2, Users } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../api/client'
import useGroupsStore from '../../stores/groupsStore'
import CreateGroupModal from './CreateGroupModal'

/**
 * Main Groups tab shown in the right panel.
 * Lists pending invites, the user's groups, and provides a create button.
 * Clicking a group sets it as active and shows GroupDetail.
 */
export default function GroupsPanel() {
  const qc = useQueryClient()
  const { setActiveGroup } = useGroupsStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInvites, setShowInvites] = useState(true)
  const [activeDetailId, setActiveDetailId] = useState(null)

  // Fetch my groups
  const {
    data: groups,
    isLoading: groupsLoading,
  } = useQuery({
    queryKey: ['my-groups'],
    queryFn: async () => {
      const data = await api.getMyGroups()
      return Array.isArray(data) ? data : []
    },
  })

  // Fetch my invites
  const {
    data: invites,
    isLoading: invitesLoading,
  } = useQuery({
    queryKey: ['my-invites'],
    queryFn: async () => {
      const data = await api.getMyInvites()
      return Array.isArray(data) ? data : []
    },
  })

  const myGroups = useMemo(() => groups ?? [], [groups])
  const myInvites = useMemo(() => invites ?? [], [invites])

  // Accept invite mutation
  const acceptMutation = useMutation({
    mutationFn: (groupId) => api.acceptInvite(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-invites'] })
      qc.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })

  // Decline invite mutation
  const declineMutation = useMutation({
    mutationFn: (groupId) => api.declineInvite(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-invites'] })
    },
  })

  // Sort groups: most recently active first
  const sortedGroups = useMemo(() => {
    return [...myGroups].sort((a, b) => {
      const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0
      const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0
      return bTime - aTime
    })
  }, [myGroups])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Users size={13} />
          Groups
        </span>
        <button
          onClick={() => setShowCreateModal(true)}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          title="Create a new group"
        >
          <Plus size={13} />
          New
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Pending invites section */}
        {invitesLoading ? (
          <div className="flex items-center justify-center py-4 text-xs text-gray-400">
            <Loader2 size={14} className="animate-spin mr-1" /> Loading invites...
          </div>
        ) : myInvites.length > 0 ? (
          <div className="border border-yellow-200 dark:border-yellow-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowInvites(!showInvites)}
              className="w-full flex items-center justify-between px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-xs font-medium text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                Invites ({myInvites.length})
              </span>
              {showInvites ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showInvites && (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {myInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-800"
                  >
                    <div className="min-w-0 mr-3">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {invite.group_name || invite.group?.name || 'Unknown Group'}
                      </p>
                      {invite.invited_at && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                          <Clock size={9} />
                          {new Date(invite.invited_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => acceptMutation.mutate(invite.group_id || invite.group?.id)}
                        disabled={acceptMutation.isPending}
                        className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-md disabled:opacity-40 hover:bg-green-700 flex items-center gap-1"
                      >
                        {acceptMutation.isPending ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Check size={10} />
                        )}
                        Accept
                      </button>
                      <button
                        onClick={() => declineMutation.mutate(invite.group_id || invite.group?.id)}
                        disabled={declineMutation.isPending}
                        className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md disabled:opacity-40 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 flex items-center gap-1"
                      >
                        {declineMutation.isPending ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Trash2 size={10} />
                        )}
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Loading state for groups */}
        {groupsLoading && (
          <div className="flex items-center justify-center py-4 text-xs text-gray-400">
            <Loader2 size={14} className="animate-spin mr-1" /> Loading groups...
          </div>
        )}

        {/* Empty state */}
        {!groupsLoading && !invitesLoading && myGroups.length === 0 && myInvites.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <Users size={32} className="mx-auto text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400 dark:text-gray-500">
              You are not in any groups yet.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first group
            </button>
          </div>
        )}

        {/* My Groups list */}
        {sortedGroups.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
              My Groups ({sortedGroups.length})
            </p>

            {sortedGroups.map((group) => {
              const isActive = activeDetailId === group.id

              if (isActive) {
                return (
                  <GroupDetailCard
                    key={group.id}
                    group={group}
                    onBack={() => setActiveDetailId(null)}
                  />
                )
              }

              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setActiveGroup(group)
                    setActiveDetailId(group.id)
                  }}
                  className={clsx(
                    'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                    'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50',
                    'dark:bg-gray-800 dark:border-gray-700 dark:hover:border-blue-600 dark:hover:bg-gray-750'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {group.name}
                      </p>
                      {group.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {group.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                        <Users size={11} />
                        {group.member_count ?? group.members?.length ?? 0}
                      </span>
                      <ChevronDown size={12} className="text-gray-300 dark:text-gray-600 -rotate-90" />
                    </div>
                  </div>
                  {group.last_activity_at && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5 mt-1">
                      <Clock size={9} />
                      Last activity {formatRelativeTime(group.last_activity_at)}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}

/**
 * Expanded detail view for a single group shown inline in the panel.
 */
function GroupDetailCard({ group, onBack }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          &larr; Back
        </button>
        <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
          {group.name}
        </span>
      </div>
      <div className="p-3 space-y-2">
        {group.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{group.description}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Users size={12} />
            {group.member_count ?? group.members?.length ?? 0} members
          </span>
          {group.last_activity_at && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              Active {formatRelativeTime(group.last_activity_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Format an ISO timestamp into a human-readable relative time string.
 */
function formatRelativeTime(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
