/**
 * TextualNotesCard
 *
 * Displays AI-generated textual criticism notes for a biblical verse when that
 * verse falls within a known textually disputed passage.  Shows nothing at all
 * when the verse has no associated textual dispute.
 *
 * Props:
 *   book    {string}  — canonical book name, e.g. "Mark"
 *   chapter {number}
 *   verse   {number}
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Scroll,
  ChevronDown,
  ChevronRight,
  BookOpen,
  AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../api/client'

// ── Consensus badge colours ────────────────────────────────────────────────
const CONSENSUS_STYLES = {
  'Likely original': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'Likely scribal addition': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'Early scribal addition': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'Almost certainly secondary': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'Widely regarded as authentic': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'Disputed among scholars': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}

function ConsensusBadge({ label }) {
  const style = CONSENSUS_STYLES[label] ?? CONSENSUS_STYLES.default
  return (
    <span
      className={clsx(
        'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
        style
      )}
    >
      {label}
    </span>
  )
}

function ManuscriptRow({ label, value }) {
  return (
    <tr className="border-b border-stone-100 dark:border-stone-700 last:border-0">
      <td className="py-1 pr-3 text-[10px] font-semibold text-stone-500 dark:text-stone-400 whitespace-nowrap align-top w-24">
        {label}
      </td>
      <td className="py-1 text-[11px] text-stone-700 dark:text-stone-300 leading-relaxed align-top">
        {value}
      </td>
    </tr>
  )
}

export default function TextualNotesCard({ book, chapter, verse }) {
  const [expanded, setExpanded] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['textual-notes', book, chapter, verse],
    queryFn: () => api.getTextualNotes(book, chapter, verse),
    enabled: !!book && !!chapter && !!verse,
    staleTime: Infinity, // textual criticism data is stable — never goes stale
    retry: 1,
  })

  // Nothing to show while loading (we don't want a spinner for every verse)
  if (isLoading) return null

  // If the API errored or returns no notes, render nothing
  if (isError || !data || !data.has_notes) return null

  const {
    passage_name,
    summary,
    scholarly_consensus,
    practical_note,
    manuscripts_include,
    manuscripts_omit,
    chapter_start,
    verse_start,
    chapter_end,
    verse_end,
  } = data

  // Format the passage reference span
  const refStart = `${chapter_start}:${verse_start}`
  const refEnd   = `${chapter_end}:${verse_end}`
  const refSpan  = refStart === refEnd ? refStart : `${refStart}–${refEnd}`

  // Split summary paragraphs for better typography
  const paragraphs = (summary || '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800/30 overflow-hidden">
      {/* ── Header / Toggle ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-stone-100 dark:hover:bg-stone-700/40 transition-colors"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Scroll
            size={12}
            className="shrink-0 text-stone-500 dark:text-stone-400"
          />
          <span className="text-xs font-semibold text-stone-700 dark:text-stone-200 truncate">
            Textual Note
          </span>
          {scholarly_consensus && !expanded && (
            <ConsensusBadge label={scholarly_consensus} />
          )}
        </span>
        {expanded ? (
          <ChevronDown size={13} className="shrink-0 text-stone-400" />
        ) : (
          <ChevronRight size={13} className="shrink-0 text-stone-400" />
        )}
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-stone-200 dark:border-stone-700 pt-2.5">

          {/* Passage title + reference */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-stone-800 dark:text-stone-100 leading-tight">
                {passage_name}
              </p>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                {book} {refSpan}
              </p>
            </div>
            {scholarly_consensus && (
              <ConsensusBadge label={scholarly_consensus} />
            )}
          </div>

          {/* Manuscript evidence table */}
          <div className="rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/40 px-2 py-1">
            <p className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-1 flex items-center gap-1">
              <BookOpen size={9} />
              Manuscript Evidence
            </p>
            <table className="w-full">
              <tbody>
                {manuscripts_include && (
                  <ManuscriptRow label="Include" value={manuscripts_include} />
                )}
                {manuscripts_omit && (
                  <ManuscriptRow label="Omit / Alt" value={manuscripts_omit} />
                )}
              </tbody>
            </table>
          </div>

          {/* Scholarly summary */}
          {paragraphs.length > 0 && (
            <div className="space-y-2">
              {paragraphs.map((para, i) => (
                <p
                  key={i}
                  className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed"
                >
                  {para}
                </p>
              ))}
            </div>
          )}

          {/* Practical note */}
          {practical_note && (
            <div className="flex gap-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-2.5 py-2">
              <AlertTriangle
                size={11}
                className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
              />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                {practical_note}
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
