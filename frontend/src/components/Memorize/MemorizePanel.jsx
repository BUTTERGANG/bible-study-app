import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Brain, Plus, Trash2, CheckCircle, XCircle, Eye, EyeOff, Star } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

const MASTERY_LABELS = ['Not started', 'Learning', 'Familiar', 'Mastered']
const MASTERY_COLORS = [
  'text-gray-400',
  'text-amber-500',
  'text-blue-500',
  'text-green-600',
]

function MasteryBadge({ level }) {
  return (
    <span className={clsx('text-[10px] font-medium', MASTERY_COLORS[level] || MASTERY_COLORS[0])}>
      {MASTERY_LABELS[level] ?? 'Unknown'}
    </span>
  )
}

function QuizCard({ verse, onResult, onClose }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {verse.book} {verse.chapter}:{verse.verse} ({verse.translation})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">
            Skip
          </button>
        </div>

        {!revealed ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-400 mb-4">Can you recite this verse from memory?</p>
            <button
              onClick={() => setRevealed(true)}
              className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              <Eye size={14} /> Reveal verse
            </button>
          </div>
        ) : (
          <>
            <blockquote className="border-l-4 border-blue-300 dark:border-blue-700 pl-4 py-2 my-4 text-sm text-gray-700 dark:text-gray-200 leading-relaxed italic">
              {verse.verse_text}
            </blockquote>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
              Did you recall it correctly?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => onResult(false)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 rounded-lg text-sm transition-colors"
              >
                <XCircle size={14} /> Not yet
              </button>
              <button
                onClick={() => onResult(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400 rounded-lg text-sm transition-colors"
              >
                <CheckCircle size={14} /> Got it!
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function MemorizePanel() {
  const { book, chapter, verse, translation } = useStudyStore()
  const [quizVerse, setQuizVerse] = useState(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['memory-verses'],
    queryFn: api.listMemoryVerses,
  })

  const { data: verseData } = useQuery({
    queryKey: ['words', book, chapter, verse],
    queryFn: () => api.getVerseWords(book, chapter, verse),
    enabled: !!book && !!chapter && !!verse,
    select: (d) => d,
  })

  const { data: currentVerseText } = useQuery({
    queryKey: ['verse-text', book, chapter, verse, translation],
    queryFn: async () => {
      const data = await api.search(`${book} ${chapter}:${verse}`, 'bible', translation)
      return data?.results?.[0]?.text ?? ''
    },
    enabled: !!book && !!chapter && !!verse,
  })

  const addMutation = useMutation({
    mutationFn: api.addMemoryVerse,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memory-verses'] }),
  })

  const removeMutation = useMutation({
    mutationFn: api.removeMemoryVerse,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memory-verses'] }),
  })

  const quizMutation = useMutation({
    mutationFn: ({ id, correct }) => api.recordQuizResult(id, correct),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memory-verses'] }),
  })

  const verses = data?.verses ?? []
  const currentRef = verse ? `${book} ${chapter}:${verse}` : null
  const alreadyAdded = verses.some(
    (v) => v.book === book && v.chapter === chapter && v.verse === verse && v.translation === translation
  )

  function handleAdd() {
    if (!book || !chapter || !verse || !currentVerseText) return
    addMutation.mutate({
      book,
      chapter,
      verse,
      translation: translation || 'KJV',
      verse_text: currentVerseText,
    })
  }

  function handleQuizResult(correct) {
    if (!quizVerse) return
    quizMutation.mutate({ id: quizVerse.id, correct })
    setQuizVerse(null)
  }

  const dueForReview = verses.filter((v) => v.mastery_level < 3)

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Brain size={13} />
          Memorize
        </span>
        {dueForReview.length > 0 && (
          <button
            onClick={() => setQuizVerse(dueForReview[Math.floor(Math.random() * dueForReview.length)])}
            className="text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 rounded-full transition-colors"
          >
            Quiz me ({dueForReview.length})
          </button>
        )}
      </div>

      {/* Add current verse */}
      {currentRef && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-300">{currentRef}</span>
            {alreadyAdded ? (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle size={11} /> Added
              </span>
            ) : (
              <button
                onClick={handleAdd}
                disabled={addMutation.isPending || !currentVerseText}
                className="flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded transition-colors"
              >
                <Plus size={10} /> Add to memory
              </button>
            )}
          </div>
        </div>
      )}

      {/* Verse list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-xs text-gray-400 text-center">Loading…</div>
        )}

        {!isLoading && verses.length === 0 && (
          <div className="p-6 text-center">
            <Brain size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No verses yet.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Navigate to a verse and click "Add to memory" above.
            </p>
          </div>
        )}

        {verses.length > 0 && (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {verses.map((v) => (
              <div key={v.id} className="px-3 py-2.5 flex gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                      {v.book} {v.chapter}:{v.verse}
                    </span>
                    <span className="text-[10px] text-gray-400">{v.translation}</span>
                    <MasteryBadge level={v.mastery_level} />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-snug">
                    {v.verse_text}
                  </p>
                  {v.attempts > 0 && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {v.correct_count}/{v.attempts} correct
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => setQuizVerse(v)}
                    title="Quiz this verse"
                    className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                  >
                    <Star size={13} />
                  </button>
                  <button
                    onClick={() => removeMutation.mutate(v.id)}
                    title="Remove"
                    className="text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {quizVerse && (
        <QuizCard
          verse={quizVerse}
          onResult={handleQuizResult}
          onClose={() => setQuizVerse(null)}
        />
      )}
    </div>
  )
}
