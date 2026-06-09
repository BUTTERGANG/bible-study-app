import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookMarked, ChevronDown, ChevronRight } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

const SIGNIFICANCE_BADGE = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  high:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  medium:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

function VariantCard({ variant }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
      >
        <span className="flex-1 font-medium text-gray-800 dark:text-gray-100 leading-snug">
          {variant.short_title}
        </span>
        <span className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <span
            className={clsx(
              'inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize',
              SIGNIFICANCE_BADGE[variant.significance] ?? SIGNIFICANCE_BADGE.medium
            )}
          >
            {variant.significance}
          </span>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-700/60 pt-2">
          {/* Manuscript support */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
              Manuscript Support
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {variant.manuscript_support}
            </p>
          </div>

          {/* Explanation */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">
              Significance
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {variant.explanation}
            </p>
          </div>

          {/* External reference */}
          {variant.external_ref && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
              {variant.external_ref}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * TextualNotesCard — collapsible section shown inside InsightsPanel when
 * the active verse has known manuscript variants.
 *
 * Renders nothing when there are no variants for the verse.
 */
export default function TextualNotesCard() {
  const book    = useStudyStore((s) => s.book)
  const chapter = useStudyStore((s) => s.chapter)
  const verse   = useStudyStore((s) => s.verse)
  const selectedVerse = useStudyStore((s) => s.selectedVerse)
  const activeVerse = selectedVerse || verse

  const [sectionOpen, setSectionOpen] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['textual', book, chapter, activeVerse],
    queryFn: () => api.getTextualVariants(book, chapter, activeVerse),
    enabled: !!book && !!chapter && !!activeVerse,
    staleTime: Infinity,   // static seed data — never changes at runtime
  })

  const variants = data?.variants ?? []

  // Don't render the section at all when there's nothing to show and we're not loading.
  if (!isLoading && variants.length === 0) return null
  // Don't render while loading either — avoids a flash of the section header.
  if (isLoading) return null

  return (
    <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/40 dark:bg-indigo-900/10 p-3">
      {/* Section header */}
      <button
        onClick={() => setSectionOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1.5"
      >
        <span className="flex items-center gap-1">
          <BookMarked size={11} />
          Textual Notes
          <span className="bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] rounded-full px-1.5 py-0.5 ml-1">
            {variants.length}
          </span>
        </span>
        {sectionOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {sectionOpen && (
        <div className="space-y-1.5">
          {variants.map((v) => (
            <VariantCard key={v.id} variant={v} />
          ))}
        </div>
      )}
    </div>
  )
}
