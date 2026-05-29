import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Edit2,
  FileText,
  Loader2,
  MessageSquare,
  Settings,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import clsx from 'clsx'
import { useGroupsStore } from '../../stores/groupsStore'
import { api } from '../../api/client'
import GroupNoteEditor from './GroupNoteEditor'
import InviteManager from './InviteManager'

// ── Feed item renderer ──────────────────────────────────────────────────────
function FeedItem({ item, groupId, currentUserId, isOwner, onRefresh }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (item.feed_type === 'group_note') {
        return api.deleteGroupNote(groupId, item.id)
      }
      if (item.feed_type === 'shared_note' || item.feed_type === 'shared_highlight') {
        return api.unshareFromGroup(groupId, item.id)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-feed', groupId] })
      qc.invalidateQueries({ queryKey: ['group-notes', groupId] })
      onRefresh?.()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => api.updateGroupNote(groupId, item.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-feed', groupId] })
      qc.invalidateQueries({ queryKey: ['group-notes', groupId] })
      setEditing(false)
    },
  })

  const isAuthor = currentUserId && item.author_id === currentUserId
  const canModify = isAuthor || isOwner

  const reference =
    item.book && item.chapter
      ? item.verse
        ? `${item.book} ${item.chapter}:${item.verse}`
        : `${item.book} ${item.chapter}`
      : ''

  const timestamp = item.created_at
    ? new Date(item.created_at).toLocaleString()
    : ''

  if (editing && item.feed_type === 'group_note') {
    return (
      <GroupNoteEditor
        note={{
          id: item.id,
          content: item.content,
          tags: item.tags,
          book: item.book,
          chapter: item.chapter,
          verse: item.verse,
        }}
        onSave={() => {
          updateMutation.mutate({
            content: item.content,
            tags: item.tags,
            book: item.book,
            chapter: item.chapter,
            verse: item.verse,
          })
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Author / sharer info */}
          {item.feed_type === 'group_note' && (
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
              {item.author_email || 'Unknown'}
            </span>
          )}
          {item.feed_type === 'shared_note' && (
            <span className="text-xs text-gray-600 dark:text-gray-300">
              Shared by <strong>{item.sharer_email || 'Unknown'}</strong>
            </span>
          )}
          {item.feed_type === 'shared_highlight' && (
            <span className="text-xs text-gray-600 dark:text-gray-300">
              Shared by <strong>{item.sharer_email || 'Unknown'}</strong>
            </span>
          )}

          {/* Reference badge */}
          {reference && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
              {reference}
            </span>
          )}

          {/* Feed type badge */}
          <span
            className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded',
              item.feed_type === 'group_note'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                : item.feed_type === 'shared_note'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
            )}
          >
            {item.feed_type === 'group_note'
              ? 'Note'
              : item.feed_type === 'shared_note'
              ? 'Shared Note'
              : 'Highlight'}
          </span>

          {/* Highlight color indicator */}
          {item.feed_type === 'shared_highlight' && item.highlight_color && (
            <span
              className="inline-block w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600"
              style={{ backgroundColor: item.highlight_color }}
            />
          )}
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">{timestamp}</span>
      </div>

      {/* Annotation for shared items */}
      {item.annotation && (
        <p className="text-xs italic text-gray-500 dark:text-gray-400 border-l-2 border-blue-300 dark:border-blue-600 pl-2">
          {item.annotation}
        </p>
      )}

      {/* Content — rendered as markdown */}
      {item.content && (
        <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="notes-markdown"
          >
            {item.content}
          </ReactMarkdown>
        </div>
      )}

      {/* Actions */}
      {canModify && (
        <div className="flex justify-end gap-1">
          {item.feed_type === 'group_note' && isAuthor && (
            <button
              onClick={() => setEditing(true)}
              className="p-1 text-gray-400 hover:text-blue-500"
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
          )}
          {item.feed_type !== 'group_note' && (
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="p-1 text-gray-400 hover:text-orange-500 flex items-center gap-0.5 text-[10px]"
              title="Remove from group"
            >
              {deleteMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                'Unshare'
              )}
            </button>
          )}
          {confirmDelete ? (
            <button
              onClick={() => { deleteMutation.mutate(); setConfirmDelete(false) }}
              className="p-1 text-red-500 hover:text-red-600 text-[10px] font-medium"
              title="Click again to confirm"
            >
              Confirm delete?
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1 text-gray-400 hover:text-red-500"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Feed ────────────────────────────────────────────────────────────────
function FeedTab({ group }) {
  const qc = useQueryClient()
  const [showEditor, setShowEditor] = useState(false)
  const [loadMoreOffset, setLoadMoreOffset] = useState(0)
  const limit = 20

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['group-feed', group.id, loadMoreOffset],
    queryFn: () => api.getGroupFeed(group.id, loadMoreOffset, limit),
    enabled: !!group.id,
  })

  const feedItems = data?.items ?? []
  const hasMore = feedItems.length >= limit

  return (
    <div className="space-y-3">
      {/* New note button */}
      <button
        onClick={() => setShowEditor(!showEditor)}
        className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1 py-1"
      >
        <MessageSquare size={14} />
        New Note
      </button>

      {/* Inline editor */}
      {showEditor && (
        <div className="px-1">
          <GroupNoteEditor
            onSave={() => {
              setShowEditor(false)
              qc.invalidateQueries({ queryKey: ['group-feed', group.id] })
              qc.invalidateQueries({ queryKey: ['group-notes', group.id] })
            }}
            onCancel={() => setShowEditor(false)}
          />
        </div>
      )}

      {/* Feed list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : feedItems.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          No feed items yet. Be the first to share a note!
        </p>
      ) : (
        <div className="space-y-2">
          {feedItems.map((item, i) => (
            <FeedItem
              key={`${item.feed_type}-${item.id}-${i}`}
              item={item}
              groupId={group.id}
              currentUserId={group.current_user_id}
              isOwner={group.current_user_role === 'owner'}
              onRefresh={() => {
                qc.invalidateQueries({ queryKey: ['group-feed', group.id] })
              }}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => setLoadMoreOffset((o) => o + limit)}
          disabled={isFetching}
          className="w-full text-xs text-gray-500 dark:text-gray-400 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
        >
          {isFetching ? (
            <Loader2 size={14} className="animate-spin mx-auto" />
          ) : (
            'Load more'
          )}
        </button>
      )}
    </div>
  )
}

// ── Tab: Notes ───────────────────────────────────────────────────────────────
function NotesTab({ group }) {
  const { data, isLoading } = useQuery({
    queryKey: ['group-notes', group.id],
    queryFn: () => api.getGroupNotes(group.id),
    enabled: !!group.id,
  })

  const notes = data?.notes || data || []
  const isOwner = group.current_user_role === 'owner'

  return (
    <div className="space-y-2">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
          No notes in this group yet.
        </p>
      ) : (
        notes.map((note) => {
          const reference =
            note.book && note.chapter
              ? note.verse
                ? `${note.book} ${note.chapter}:${note.verse}`
                : `${note.book} ${note.chapter}`
              : ''

          const timestamp = note.created_at
            ? new Date(note.created_at).toLocaleDateString()
            : ''

          const canModify =
            group.current_user_id && note.author_id === group.current_user_id || isOwner

          return (
            <div
              key={note.id}
              className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3"
            >
              <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed mb-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]} className="notes-markdown">
                  {note.content}
                </ReactMarkdown>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {note.author_email || 'Unknown'}
                  </span>
                  {reference && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {reference}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">{timestamp}</span>
                </div>
                {canModify && (
                  <div className="flex gap-1">
                    <button className="p-1 text-gray-400 hover:text-blue-500" title="Edit">
                      <Edit2 size={12} />
                    </button>
                    <button className="p-1 text-gray-400 hover:text-red-500" title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Tab: Members ─────────────────────────────────────────────────────────────
function MembersTab({ group }) {
  const qc = useQueryClient()

  const members = group.members || []
  const isOwner = group.current_user_role === 'owner'

  const removeMutation = useMutation({
    mutationFn: (userId) => api.removeMember(group.id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', group.id] })
    },
  })

  return (
    <div className="space-y-4">
      {/* Invite manager (owner only) */}
      <InviteManager groupId={group.id} />

      {/* Member list */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Members ({members.filter((m) => m.role !== 'pending').length})
        </p>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {members
            .filter((m) => m.role !== 'pending')
            .map((member) => (
              <div
                key={member.user_id || member.email}
                className="flex items-center justify-between py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                    {member.email || 'Unknown'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={clsx(
                        'text-[10px] px-1.5 py-0.5 rounded',
                        member.role === 'owner'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      )}
                    >
                      {member.role === 'owner' ? 'Owner' : 'Member'}
                    </span>
                    {member.joined_at && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {isOwner && member.role !== 'owner' && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Remove ${member.email} from this group?`)) {
                        removeMutation.mutate(member.user_id)
                      }
                    }}
                    disabled={removeMutation.isPending}
                    className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0 ml-2"
                    title="Remove member"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Settings ─────────────────────────────────────────────────────────────
function SettingsTab({ group }) {
  const qc = useQueryClient()
  const { updateGroup, removeGroup } = useGroupsStore()

  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (data) => api.updateGroup(group.id, data),
    onSuccess: (updatedGroup) => {
      updateGroup(group.id, updatedGroup)
      qc.invalidateQueries({ queryKey: ['group', group.id] })
      qc.invalidateQueries({ queryKey: ['groups'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteGroup(group.id),
    onSuccess: () => {
      removeGroup(group.id)
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })

  const handleSave = () => {
    if (!name.trim()) return
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    })
  }

  return (
    <div className="space-y-4">
      {/* Edit form */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Group Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        {updateMutation.isError && (
          <p className="text-xs text-red-500">
            {updateMutation.error?.message || 'Failed to update group'}
          </p>
        )}
        {saved && (
          <p className="text-xs text-green-600 dark:text-green-400">Group updated successfully</p>
        )}
        <button
          onClick={handleSave}
          disabled={!name.trim() || updateMutation.isPending}
          className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-md disabled:opacity-40 hover:bg-blue-700 flex items-center gap-1"
        >
          {updateMutation.isPending && <Loader2 size={12} className="animate-spin" />}
          Save Changes
        </button>
      </div>

      {/* Danger zone */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-xs font-medium text-red-500 mb-2">Danger Zone</p>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-xs bg-red-600 text-white px-4 py-1.5 rounded-md hover:bg-red-700 flex items-center gap-1"
            >
              {deleteMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
              Confirm Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-red-500 hover:text-red-600 border border-red-200 dark:border-red-800 px-4 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 size={12} className="inline mr-1" />
            Delete Group
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main GroupDetail ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'feed', label: 'Feed', icon: MessageSquare },
  { key: 'notes', label: 'Notes', icon: FileText },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'settings', label: 'Settings', icon: Settings },
]

export default function GroupDetail({ group, onBack }) {
  const [activeTab, setActiveTab] = useState('feed')

  const isOwner = group?.current_user_role === 'owner'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1 mx-3">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
            {group?.name}
          </span>
          <span
            className={clsx(
              'text-[10px] px-2 py-0.5 rounded-full flex-shrink-0',
              isOwner
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            )}
          >
            {isOwner ? 'Owner' : 'Member'}
          </span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {TABS.filter((t) => t.key !== 'settings' || isOwner).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors relative',
              activeTab === tab.key
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            <tab.icon size={13} />
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'feed' && <FeedTab group={group} />}
        {activeTab === 'notes' && <NotesTab group={group} />}
        {activeTab === 'members' && <MembersTab group={group} />}
        {activeTab === 'settings' && isOwner && <SettingsTab group={group} />}
      </div>
    </div>
  )
}
