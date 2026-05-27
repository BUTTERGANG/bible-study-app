import { useState, useRef, useEffect } from 'react'
import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { useOfflineSync } from '../../hooks/useOfflineSync'

export default function SyncStatus() {
  const { syncStatus, queueLength, queueItems, flushQueue } = useOfflineSync()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [dropdownOpen])

  // Status icon
  function renderIcon() {
    switch (syncStatus) {
      case 'syncing':
        return <Loader2 size={14} className="animate-spin text-blue-400" />
      case 'offline':
        return <CloudOff size={14} className="text-slate-400" />
      case 'conflict':
        return <RefreshCw size={14} className="text-amber-400" />
      default:
        return <Cloud size={14} className="text-green-400" />
    }
  }

  function statusLabel() {
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing…'
      case 'offline':
        return 'Offline'
      case 'conflict':
        return 'Sync conflict'
      default:
        return 'Synced'
    }
  }

  const hasPending = queueLength > 0

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setDropdownOpen((o) => !o)}
        className={clsx(
          'relative flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
          syncStatus === 'offline'
            ? 'bg-slate-700 text-slate-400 hover:text-slate-300'
            : syncStatus === 'syncing'
            ? 'bg-slate-700 text-blue-400'
            : syncStatus === 'conflict'
            ? 'bg-slate-700 text-amber-400'
            : 'text-slate-400 hover:text-slate-300'
        )}
        title={`${statusLabel()}${hasPending ? ` (${queueLength} pending)` : ''}`}
      >
        {renderIcon()}
        {hasPending && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-blue-500 text-[10px] text-white font-bold px-1">
            {queueLength > 99 ? '99+' : queueLength}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div className="absolute top-full right-0 mt-1 w-72 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-2">
          <div className="px-3 py-1.5 text-xs text-slate-400 font-semibold border-b border-slate-700 flex items-center justify-between">
            <span>{statusLabel()}</span>
            <button
              onClick={() => setDropdownOpen(false)}
              className="text-slate-500 hover:text-white text-[10px]"
            >
              Close
            </button>
          </div>

          <div className="px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              {renderIcon()}
              <span className="text-slate-300">
                {syncStatus === 'offline'
                  ? 'You are offline. Changes will sync when connected.'
                  : hasPending
                  ? `${queueLength} item${queueLength !== 1 ? 's' : ''} pending sync`
                  : 'All changes synced'}
              </span>
            </div>

            {hasPending && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {queueItems
                  .sort((a, b) => a.timestamp - b.timestamp)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-700/50 rounded px-2 py-1"
                    >
                      <span className="font-mono text-[10px] text-slate-500 uppercase">
                        {item.method}
                      </span>
                      <span className="truncate flex-1">{item.path}</span>
                    </div>
                  ))}
              </div>
            )}

            {hasPending && syncStatus !== 'offline' && syncStatus !== 'syncing' && (
              <button
                onClick={() => flushQueue()}
                className="mt-2 w-full text-xs bg-blue-600 hover:bg-blue-700 text-white rounded py-1.5 transition-colors"
              >
                Retry sync now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
