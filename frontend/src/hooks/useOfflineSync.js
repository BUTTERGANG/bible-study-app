import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOnlineStatus } from './useOnlineStatus'

const DB_NAME = 'logos-offline-queue'
const STORE_NAME = 'mutations'
const DB_VERSION = 1
const MAX_RETRIES = 3

// Module-level singletons shared across all hook instances.
let _dbPromise = null
let _flushing = false  // guards against concurrent flush from multiple hook instances

function openDB() {
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        _dbPromise = null  // allow retry on next call
        reject(req.error)
      }
    })
  }
  return _dbPromise
}

async function getAllQueued() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

async function addQueued(entry) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function removeQueued(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Replay a single queued mutation using fetch (same pattern as api/client.js)
async function replayMutation(entry) {
  const { method, path, body } = entry
  const BASE = '/api'

  // Import auth headers dynamically to avoid circular deps
  const { getAccessToken, getAppPassword } = await import('../api/auth')
  const jwt = getAccessToken()
  const headers = jwt
    ? { Authorization: `Bearer ${jwt}` }
    : (() => { const pw = getAppPassword(); return pw ? { Authorization: `Bearer ${pw}` } : {} })()

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const j = await res.json()
      if (j?.detail) detail = j.detail
    } catch { /* ignore */ }
    const err = new Error(detail)
    err.status = res.status
    throw err
  }

  if (res.status === 204) return null
  return res.json()
}

// Map offline mutation paths to React Query cache keys to invalidate after sync.
// Format: path prefix → query key prefix array
const INVALIDATION_MAP = [
  { prefix: '/notes', queryKey: ['notes'] },
  { prefix: '/highlights', queryKey: ['highlights'] },
  { prefix: '/bookmarks', queryKey: ['bookmarks'] },
  { prefix: '/annotations', queryKey: ['annotations'] },
  { prefix: '/prayer', queryKey: ['prayer'] },
  { prefix: '/memorize', queryKey: ['memorize'] },
  { prefix: '/reading-plans', queryKey: ['reading-plans'] },
  { prefix: '/groups', queryKey: ['my-groups'] },
]

export function useOfflineSync() {
  const online = useOnlineStatus()
  const qc = useQueryClient()
  const [syncStatus, setSyncStatus] = useState('online')
  const [queueLength, setQueueLength] = useState(0)
  const [queueItems, setQueueItems] = useState([])

  const refreshQueue = useCallback(async () => {
    try {
      const items = await getAllQueued()
      setQueueItems(items)
      setQueueLength(items.length)
      return items
    } catch {
      return []
    }
  }, [])

  const enqueue = useCallback(async ({ method, path, body }) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      method,
      path,
      body,
      retries: 0,
    }
    await addQueued(entry)
    await refreshQueue()
    return entry.id
  }, [refreshQueue])

  const flushQueue = useCallback(async () => {
    if (_flushing) return
    _flushing = true
    setSyncStatus('syncing')

    try {
      const items = await getAllQueued()
      if (items.length === 0) {
        setSyncStatus('online')
        return
      }

      let hadConflict = false
      const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp)

      for (const entry of sorted) {
        try {
          await replayMutation(entry)
          await removeQueued(entry.id)
          // Invalidate React Query cache so UI reflects the synced state.
          const match = INVALIDATION_MAP.find((m) => entry.path.startsWith(m.prefix))
          if (match) qc.invalidateQueries({ queryKey: match.queryKey })
        } catch (err) {
          if (err?.status === 409) {
            hadConflict = true
            await removeQueued(entry.id)
            console.warn('[offline-sync] Conflict on', entry.method, entry.path, '- skipped')
          } else if ((entry.retries || 0) >= MAX_RETRIES) {
            console.warn('[offline-sync] Max retries exceeded for', entry.method, entry.path, '- dropping')
            await removeQueued(entry.id)
          } else {
            // Increment retry count and stop processing — will retry next flush
            entry.retries = (entry.retries || 0) + 1
            await addQueued(entry)  // reuses cached connection via addQueued
            break
          }
        }
      }

      await refreshQueue()
      setSyncStatus(hadConflict ? 'conflict' : 'online')
    } catch (err) {
      console.error('[offline-sync] Flush error:', err)
      setSyncStatus('offline')
    } finally {
      _flushing = false
    }
  }, [refreshQueue])

  useEffect(() => {
    refreshQueue()
  }, [refreshQueue])

  useEffect(() => {
    if (online) {
      setSyncStatus((prev) => (prev === 'offline' ? prev : 'online'))
      flushQueue()
    } else {
      setSyncStatus('offline')
    }
  }, [online, flushQueue])

  return {
    syncStatus,
    queueLength,
    queueItems,
    enqueue,
    flushQueue,
    refreshQueue,
  }
}
