import { useQuery } from '@tanstack/react-query'
import { BookOpen, Layers, Cross, MessageSquare, Loader2, Link2, BookMarked } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { useActiveVerse } from '../../hooks/useActiveVerse'
import { api } from '../../api/client'
import clsx from 'clsx'

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-gray-100 dark:border-gray-800">
      <Icon size={14} className="text-blue-500" />
      <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{title}</h3>
    </div>
  )
}

function SummarySection({ book, chapter, translation }) {
  const { data, isLoading } = useQuery({
    queryKey: ['passage-summary', book, chapter, translation],
    queryFn: () => api.generateOutline(`${book} ${chapter}`, translation),
    enabled: !!book && !!chapter,
    staleTime: 1000 * 60 * 60, // 1 hour
  })

  if (isLoading) return <div className="p-3 text-xs text-gray-400">Generating summary...</div>
  if (!data?.text) return null

  // Very simple parsing of the markdown output to render bullet points
  const lines = data.text.split('\n')
  
  return (
    <div className="mb-6">
      <SectionHeader icon={MessageSquare} title="Passage Summary" />
      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-1.5">
        {lines.map((line, i) => {
          if (line.startsWith('#')) return <strong key={i} className="block mt-2">{line.replace(/^#+\s/, '')}</strong>
          if (line.startsWith('-') || line.startsWith('*')) return <li key={i} className="ml-4">{line.replace(/^[-*]\s/, '')}</li>
          if (line.trim() === '') return null
          return <p key={i}>{line}</p>
        })}
      </div>
    </div>
  )
}

function CommentarySection({ book, chapter, verse }) {
  const targetVerse = verse || 1 // default to 1 if whole chapter
  
  const { data, isLoading } = useQuery({
    queryKey: ['passage-commentary', book, chapter, targetVerse],
    // Hardcode Matthew Henry as top source for passage guide
    queryFn: () => api.getVerseCommentary(book, chapter, targetVerse, 'MHC'),
    enabled: !!book && !!chapter,
  })

  if (isLoading) return <div className="p-3 text-xs text-gray-400">Loading commentary...</div>
  if (!data?.entries?.length) return null

  const entry = data.entries[0] // take the first (best) match

  return (
    <div className="mb-6">
      <SectionHeader icon={BookOpen} title="Top Commentary (Matthew Henry)" />
      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 mb-2">v.{entry.verse_start}{entry.verse_end !== entry.verse_start ? `-${entry.verse_end}` : ''}</p>
        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-6">
          {entry.text}
        </div>
      </div>
    </div>
  )
}

function WordStudySection({ book, chapter, verse }) {
  const targetVerse = verse || 1
  
  const { data, isLoading } = useQuery({
    queryKey: ['passage-words', book, chapter, targetVerse],
    queryFn: () => api.getVerseWords(book, chapter, targetVerse),
    enabled: !!book && !!chapter,
  })

  if (isLoading) return <div className="p-3 text-xs text-gray-400">Loading words...</div>
  if (!data?.words?.length) return null

  // Sort by strongs count, filter out common words
  const keyWords = [...data.words]
    .filter(w => w.strongs && !w.english?.match(/^(the|and|of|to|in|a|is|that|it|for)$/i))
    .slice(0, 5)

  if (keyWords.length === 0) return null

  return (
    <div className="mb-6">
      <SectionHeader icon={Layers} title="Key Words" />
      <div className="flex flex-wrap gap-2">
        {keyWords.map((word, i) => (
          <div key={i} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded px-2.5 py-1.5 text-xs">
            <div className="font-semibold text-blue-700 dark:text-blue-400">{word.lemma}</div>
            <div className="text-gray-600 dark:text-gray-400 mt-0.5">{word.english}</div>
            <div className="text-[10px] text-gray-400 mt-1">{word.strongs}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CrossRefSection({ book, chapter, verse }) {
  const targetVerse = verse || 1
  const setReference = useStudyStore(s => s.setReference)
  
  const { data, isLoading } = useQuery({
    queryKey: ['passage-crossref', book, chapter, targetVerse],
    queryFn: () => api.getVerseCommentary(book, chapter, targetVerse, 'TSK'),
    enabled: !!book && !!chapter,
  })

  if (isLoading) return <div className="p-3 text-xs text-gray-400">Loading cross-references...</div>
  if (!data?.entries?.length) return null

  // Get just the references from the TSK text
  const refs = []
  const entry = data.entries[0]
  const matches = entry.text.match(/([A-Z][\w\s.]+?\s+\d+:\d+(?:-\d+)?)/g)
  
  if (matches) {
    // Deduplicate and take top 5
    const uniqueRefs = [...new Set(matches.map(m => m.trim()))].slice(0, 5)
    refs.push(...uniqueRefs)
  }

  if (refs.length === 0) return null

  return (
    <div className="mb-6">
      <SectionHeader icon={Cross} title="Top Cross-References" />
      <div className="space-y-1.5">
        {refs.map((ref, i) => {
          const match = ref.match(/^([\w\s.]+?)\s+(\d+):(\d+)(?:-(\d+))?$/)
          return (
            <button 
              key={i}
              onClick={() => {
                if (match) {
                  const [, bk, ch, v] = match
                  setReference(bk.trim(), parseInt(ch), parseInt(v))
                }
              }}
              className="block w-full text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1.5 rounded transition-colors"
            >
              {ref}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function PassageGuidePanel() {
  const { book, chapter, translation } = useStudyStore()
  const verse = useActiveVerse()
  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <BookMarked size={13} />
          Passage Guide
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">{reference}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <SummarySection book={book} chapter={chapter} translation={translation} />
        <CommentarySection book={book} chapter={chapter} verse={verse} />
        <WordStudySection book={book} chapter={chapter} verse={verse} />
        <CrossRefSection book={book} chapter={chapter} verse={verse} />
      </div>
    </div>
  )
}
