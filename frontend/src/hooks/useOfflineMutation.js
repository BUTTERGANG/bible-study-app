import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useOfflineSync } from './useOfflineSync'

/**
 * Drop-in wrapper around useMutation that queues failed mutations
 * (network errors / offline) in IndexedDB for automatic replay
 * when the connection is restored.
 *
 * Usage: identical to useMutation.
 *   const { mutate } = useOfflineMutation({
 *     mutationFn: (data) => api.createNote(data),
 *     onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
 *   })
 *
 * The mutationFn receives the same variables as useMutation.
 * The `offlineOptions` object specifies how to record the mutation
 * for replay when offline.
 */
export function useOfflineMutation({
  mutationFn,
  offlineOptions,
  ...reactQueryOptions
}) {
  const queryClient = useQueryClient()
  const { enqueue } = useOfflineSync()

  const wrappedMutationFn = useCallback(async (variables) => {
    try {
      return await mutationFn(variables)
    } catch (err) {
      // Network error (offline) — enqueue for later replay
      if (offlineOptions && (!err?.status || err.status === 0 || err.name === 'TypeError')) {
        const { method, getPath, getBody } = offlineOptions
        const path = typeof getPath === 'function' ? getPath(variables) : getPath
        const body = typeof getBody === 'function' ? getBody(variables) : getBody
        await enqueue({ method: method || 'POST', path, body })
        // Re-throw so ReactQuery marks it as errored (UI shows failure)
        throw err
      }
      // API errors (4xx, 5xx) — don't queue, just throw
      throw err
    }
  }, [mutationFn, offlineOptions, enqueue])

  return useMutation({
    ...reactQueryOptions,
    mutationFn: wrappedMutationFn,
  })
}
