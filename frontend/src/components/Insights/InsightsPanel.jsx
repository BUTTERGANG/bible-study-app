import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lightbulb, MapPin, User, Tag, ExternalLink, BookOpen, RefreshCw, Globe, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useStudyStore } from '../../stores/studyStore'
import { useActiveVerse } from '../../hooks/useActiveVerse'
import { api } from '../../api/client'
import clsx from 'clsx'
import TextualNotesCard from './TextualNotesCard'
import VideoOverviewCard from './VideoOverviewCard'

const REF_RE = /\b([A-Z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*)*)\s+(\d+):(\d+)(?:-(\d+))?/g

function parseTopRefs(entries, max = 5) {
  const seen = new Set()
  const refs = []
  for (const entry of (entries || [])) {
    const text = entry.commentary_text || ''
    let m
    REF_RE.lastIndex = 0
    while ((m = REF_RE.exec(text)) !== null && refs.length < max) {
      const key = `${m[1]} ${m[2]}:${m[3]}`
      if (!seen.has(key)) {
        seen.add(key)
        refs.push({ book: m[1], chapter: parseInt(m[2]), verse: parseInt(m[3]), label: key })
      }
    }
    if (refs.length >= max) break
  }
  return refs
}

function Pill({ children, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  }
  return (
    <span className={clsx('inline-block text-xs px-2 py-0.5 rounded-full', colors[color])}>
      {children}
    </span>
  )
}

export default function InsightsPanel() {
  const book = useStudyStore((s) => s.book)
  const chapter = useStudyStore((s) => s.chapter)
  const verse = useActiveVerse()
  const translation = useStudyStore((s) => s.translation)
  const setRightPanel = useStudyStore((s) => s.setRightPanel)
  const setReference = useStudyStore((s) => s.setReference)
  const [insightKey, setInsightKey] = useState(0)

  const enabled = !!book && !!chapter && !!verse

  const {
    data: insights,
    isLoading: insightsLoading,
    isFetching: insightsFetching,
  } = useQuery({
    queryKey: ['insights', book, chapter, verse, translation, insightKey],
    queryFn: () => api.getPassageInsights(book, chapter, verse, translation),
    enabled,
    staleTime: 1000 * 60 * 10,
  })

  const { data: tskData } = useQuery({
    queryKey: ['commentary', book, chapter, verse, 'TSK'],
    queryFn: () => api.getVerseCommentary(book, chapter, verse, 'TSK'),
    enabled,
    staleTime: Infinity,
  })

  const { data: commentaryData } = useQuery({
    queryKey: ['commentary', book, chapter, verse],
    queryFn: () => api.getVerseCommentary(book, chapter, verse),
    enabled,
    staleTime: Infinity,
  })

  const crossRefs = parseTopRefs(tskData?.entries)
  const firstCommentary = commentaryData?.entries?.find(e => e.source !== 'TSK')

  function navigateTo(b, c, v) {
    setReference(b, c, v)
  }

  function openFactbook(_name) {
    useStudyStore.getState().setRightPanel('factbook')
  }

  if (!enabled) {
    return (
      <div className="flex flex-col h-full">
        <div className="panel-header">
          <span className="flex items-center gap-1.5"><Lightbulb size={13} />Insights</span>
        </div>
        <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
          Click any verse to see passage insights.
        </div>
      </div>
    )
  }

  const reference = `${book} ${chapter}:${verse}`

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Lightbulb size={13} />
          Insights — {reference}
        </span>
        <button
          onClick={() => { setInsightKey(k => k + 1) }}
          title="Refresh AI insights"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <RefreshCw size={13} className={insightsFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* AI Summary Card */}
        <div className="rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 p-3">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1.5 flex items-center gap-1">
            <Lightbulb size={11} /> Quick Context
          </p>
          {insightsLoading ? (
            <div className="space-y-1.5">
              <div className="h-3 bg-blue-100 dark:bg-blue-900/30 rounded animate-pulse w-full" />
              <div className="h-3 bg-blue-100 dark:bg-blue-900/30 rounded animate-pulse w-4/5" />
            </div>
          ) : insights?.summary ? (
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{insights.summary}</p>
          ) : (
            <p className="text-xs text-gray-400">No summary available.</p>
          )}
        </div>

        {/* Cultural Context Card */}
        <CulturalContextCard />

        {/* Key Themes */}
        {(insightsLoading || insights?.key_themes?.length > 0) && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
              <Tag size={11} /> Key Themes
            </p>
            {insightsLoading ? (
              <div className="flex gap-1 flex-wrap">
                {[80, 60, 90].map(w => (
                  <div key={w} className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" style={{ width: w }} />
                ))}
              </div>
            ) : (
              <div className="flex gap-1 flex-wrap">
                {insights.key_themes.map(t => <Pill key={t} color="green">{t}</Pill>)}
              </div>
            )}
          </div>
        )}

        {/* People */}
        {(insightsLoading || insights?.key_people?.length > 0) && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
              <User size={11} /> People
            </p>
            {insightsLoading ? (
              <div className="flex gap-1 flex-wrap">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse w-16" />
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse w-20" />
              </div>
            ) : (
              <div className="flex gap-1 flex-wrap">
                {insights.key_people.map(p => (
                  <button
                    key={p}
                    onClick={() => openFactbook(p)}
                    className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
                    title={`Open ${p} in Factbook`}
                  >
                    {p}
                    <ExternalLink size={8} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Places */}
        {(insightsLoading || insights?.key_places?.length > 0) && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
              <MapPin size={11} /> Places
            </p>
            {insightsLoading ? (
              <div className="flex gap-1 flex-wrap">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse w-14" />
              </div>
            ) : (
              <div className="flex gap-1 flex-wrap">
                {insights.key_places.map(pl => (
                  <button
                    key={pl}
                    onClick={() => openFactbook(pl)}
                    className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                    title={`Open ${pl} in Factbook`}
                  >
                    {pl}
                    <ExternalLink size={8} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cross-References */}
        {crossRefs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
              <ExternalLink size={11} /> Cross-References
            </p>
            <div className="space-y-0.5">
              {crossRefs.map(ref => (
                <button
                  key={ref.label}
                  onClick={() => navigateTo(ref.book, ref.chapter, ref.verse)}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 flex items-center gap-1"
                >
                  <ExternalLink size={9} />
                  {ref.label}
                </button>
              ))}
              <button
                onClick={() => setRightPanel('cross-ref')}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-0.5"
              >
                View all →
              </button>
            </div>
          </div>
        )}

        {/* Commentary Snippet */}
        {firstCommentary && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1"><BookOpen size={11} /> {firstCommentary.source}</span>
              <button
                onClick={() => setRightPanel('commentary')}
                className="text-blue-500 dark:text-blue-400 hover:underline"
              >
                Full →
              </button>
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed line-clamp-4">
              {firstCommentary.commentary_text?.slice(0, 300)}
              {firstCommentary.commentary_text?.length > 300 ? '…' : ''}
            </p>
          </div>
        )}

        {/* Book overview video — shown for chapter 1 of any book */}
        <VideoOverviewCard />

        {/* Textual Notes — only appears when variants exist for this verse */}
        <TextualNotesCard />

      </div>
    </div>
  )
}

/** Embedded cultural context shown inside the InsightsPanel for the active verse. */
function CulturalContextCard() {
  const book = useStudyStore((s) => s.book)
  const chapter = useStudyStore((s) => s.chapter)
  const activeVerse = useActiveVerse()
  const [expanded, setExpanded] = useState(false)

  const { data: notes, isLoading } = useQuery({
    queryKey: ['cultural-notes', book, chapter],
    queryFn: () => api.getCulturalNotes(book, chapter),
    enabled: !!book && !!chapter && !!activeVerse,
    staleTime: 1000 * 60 * 30,
  })

  if (!activeVerse || (!isLoading && (!notes || notes.length === 0))) return null

  const verseNotes = (notes || []).filter(n => n.verse === activeVerse)

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center justify-between"
      >
        <span className="flex items-center gap-1">
          <Globe size={11} /> Cultural Context — {book} {chapter}:{activeVerse}
          {verseNotes.length > 0 && (
            <span className="bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 text-[10px] rounded-full px-1.5 py-0.5 ml-1">
              {verseNotes.length}
            </span>
          )}
        </span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {isLoading && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Loader2 size={10} className="animate-spin" /> Loading cultural notes…
        </div>
      )}
      {!isLoading && expanded && verseNotes.map((n, i) => (
        <div key={i} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed mt-1">
          <div dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(
              n.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
              { ALLOWED_TAGS: ['strong', 'br', 'p', 'em'], ALLOWED_ATTR: [] }
          )}} />
        </div>
      ))}
    </div>
  )
}
