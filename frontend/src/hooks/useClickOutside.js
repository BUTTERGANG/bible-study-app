import { useEffect } from 'react'

/**
 * Calls `handler` when a mousedown event fires outside `ref`.
 * Only attaches the listener when `enabled` is true (default).
 */
export function useClickOutside(ref, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    function listener(e) {
      if (ref.current && !ref.current.contains(e.target)) handler(e)
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, handler, enabled])
}
