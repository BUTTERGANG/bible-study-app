import { create } from 'zustand'

/**
 * Groups state management.
 *
 * Server is source of truth — no persistence middleware.
 * Components pull fresh data via React Query, then push results here
 * so sibling components (feed, member list, invites) share the same cache.
 */
const useGroupsStore = create((set, _get) => ({
  // Group summaries (from getMyGroups)
  groups: [],
  setGroups: (groups) => set({ groups }),

  // Pending invites for current user
  invites: [],
  setInvites: (invites) => set({ invites }),
  removeInvite: (inviteId) =>
    set((s) => ({ invites: s.invites.filter((i) => i.id !== inviteId) })),

  // Currently viewed group detail (from getGroup)
  activeGroup: null,
  setActiveGroup: (group) =>
    set({ activeGroup: group, feed: [], feedOffset: 0, feedHasMore: true }),

  // Feed items for active group
  feed: [],
  feedOffset: 0,
  feedHasMore: true,
  feedLoading: false,
  setFeedLoading: (loading) => set({ feedLoading: loading }),
  appendFeed: (items) =>
    set((s) => ({
      feed: [...s.feed, ...items],
      feedOffset: s.feedOffset + items.length,
      feedHasMore: items.length > 0,
    })),
  prependFeed: (item) =>
    set((s) => ({ feed: [item, ...s.feed] })),
  removeFeedItem: (feedType, itemId) =>
    set((s) => ({
      feed: s.feed.filter(
        (f) => !(f.id === itemId && f.feed_type === feedType)
      ),
    })),

  // Optimistic helpers
  addGroup: (group) => set((s) => ({ groups: [group, ...s.groups] })),
  removeGroup: (groupId) =>
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== groupId),
      activeGroup: s.activeGroup?.id === groupId ? null : s.activeGroup,
    })),
  updateGroup: (groupId, updates) =>
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, ...updates } : g
      ),
      activeGroup:
        s.activeGroup?.id === groupId
          ? { ...s.activeGroup, ...updates }
          : s.activeGroup,
    })),
  updateMember: (groupId, userId, updates) =>
    set((s) => {
      if (s.activeGroup?.id !== groupId) return s
      return {
        activeGroup: {
          ...s.activeGroup,
          members: s.activeGroup.members.map((m) =>
            m.user_id === userId ? { ...m, ...updates } : m
          ),
        },
      }
    }),
  removeMember: (groupId, userId) =>
    set((s) => {
      if (s.activeGroup?.id !== groupId) return s
      return {
        activeGroup: {
          ...s.activeGroup,
          members: s.activeGroup.members.filter((m) => m.user_id !== userId),
        },
      }
    }),

  // Clear when leaving group view or logging out
  clearActiveGroup: () =>
    set({ activeGroup: null, feed: [], feedOffset: 0, feedHasMore: true }),
}))

export { useGroupsStore }
export default useGroupsStore
