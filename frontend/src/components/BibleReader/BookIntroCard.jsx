import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { api } from '../../api/client'

export default function BookIntroCard({ book }) {
  const [open, setOpen] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['book-intro', book, refreshKey],
    queryFn: () => api.getBookIntroduction(book, refreshKey > 0),
    staleTime: Infinity,
  })

  return (
    <div className="mb-8 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
      >
        <span className="font-semibold text-amber-800 dark:text-amber-200 text-sm">
          Introduction to {book}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setRefreshKey((k) => k + 1) }}
            className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 p-0.5"
            title="Regenerate"
          >
            <RefreshCw size={12} />
          </button>
          {open ? <ChevronDown size={14} className="text-amber-600" /> : <ChevronRight size={14} className="text-amber-600" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-3 bg-amber-200/60 dark:bg-amber-800/40 rounded animate-pulse" style={{ width: `${70 + i * 10}%` }} />
              ))}
            </div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {data.author && (
                  <div>
                    <span className="font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[10px]">Author</span>
                    <p className="text-gray-700 dark:text-gray-300 mt-0.5">{data.author}</p>
                  </div>
                )}
                {data.date && (
                  <div>
                    <span className="font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[10px]">Date</span>
                    <p className="text-gray-700 dark:text-gray-300 mt-0.5">{data.date}</p>
                  </div>
                )}
              </div>

              {data.context && (
                <div>
                  <span className="font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[10px]">Historical Context</span>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">{data.context}</p>
                </div>
              )}

              {data.themes?.length > 0 && (
                <div>
                  <span className="font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[10px]">Key Themes</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {data.themes.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.structure && (
                <div>
                  <span className="font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[10px]">Structure</span>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">{data.structure}</p>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
