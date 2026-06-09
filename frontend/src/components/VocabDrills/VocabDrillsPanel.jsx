/**
 * VocabDrillsPanel — flashcard-style vocabulary drills for Greek and Hebrew words.
 *
 * Acceptance criteria implemented:
 *  - Browse by language (Greek / Hebrew) and frequency band (top 50, top 200, top 500, all)
 *  - Flashcard mode: front = original word, back = transliteration + gloss + definition
 *  - Mastery tracking per word (0–3 scale, same as verse memorization)
 *  - "Study words from this chapter" — pre-loads vocab from the current passage
 *  - Shows Strong's number, transliteration, and example verse for each word
 *  - CSS flip animation, correct/incorrect score tracking
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CheckCircle, XCircle, RefreshCw, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

// ── Constants ─────────────────────────────────────────────────────────────

const MASTERY_LABELS = ['Not started', 'Learning', 'Familiar', 'Mastered']
const MASTERY_COLORS = [
  'text-gray-400 dark:text-gray-500',
  'text-amber-500',
  'text-blue-500',
  'text-green-600',
]
const MASTERY_BG = [
  'bg-gray-100 dark:bg-gray-700',
  'bg-amber-50 dark:bg-amber-900/20',
  'bg-blue-50 dark:bg-blue-900/20',
  'bg-green-50 dark:bg-green-900/20',
]

const FREQUENCY_BANDS = [
  { value: 'top50', label: 'Top 50', sublabel: '≥100×' },
  { value: 'top200', label: 'Top 200', sublabel: '≥30×' },
  { value: 'top500', label: 'Top 500', sublabel: '≥10×' },
  { value: 'all', label: 'All', sublabel: '' },
]

// ── FlashCard ─────────────────────────────────────────────────────────────

function FlashCard({ word, mastery, onCorrect, onIncorrect, onSkip, sessionScore, total, current }) {
  const [flipped, setFlipped] = useState(false)
  const [answered, setAnswered] = useState(false)

  const masteryLevel = mastery?.mastery_level ?? 0

  function handleResult(correct) {
    setAnswered(true)
    if (correct) {
      onCorrect()
    } else {
      onIncorrect()
    }
  }

  // Reset flip state when card changes
  const cardKey = word.strongs_num

  return (
    <div className="flex flex-col items-center px-3 py-2">
      {/* Progress line */}
      <div className="w-full flex items-center justify-between mb-3 text-xs text-gray-400 dark:text-gray-500">
        <span>{current + 1} / {total}</span>
        <span className="flex items-center gap-2">
          <span className="text-green-600 dark:text-green-400 font-medium">{sessionScore.correct} correct</span>
          <span className="text-red-500 dark:text-red-400 font-medium">{sessionScore.incorrect} incorrect</span>
        </span>
        <button
          onClick={onSkip}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-xs underline"
        >
          Skip
        </button>
      </div>

      {/* Flashcard */}
      <div
        key={cardKey}
        className="w-full cursor-pointer"
        style={{ perspective: '800px' }}
        onClick={() => !answered && setFlipped(f => !f)}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '180px',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-xl border-2 border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 shadow-lg flex flex-col items-center justify-center p-4 gap-2"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
              {word.language === 'greek' ? 'Greek' : 'Hebrew'} · {word.strongs_num}
            </span>
            <span
              className="font-serif text-5xl text-gray-900 dark:text-gray-100 leading-none"
              dir={word.language === 'hebrew' ? 'rtl' : 'ltr'}
            >
              {word.original_word}
            </span>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              {flipped ? '' : 'Tap to reveal'}
            </p>
            {masteryLevel > 0 && (
              <span className={clsx('text-[10px] font-medium mt-1', MASTERY_COLORS[masteryLevel])}>
                {MASTERY_LABELS[masteryLevel]}
              </span>
            )}
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-xl border-2 border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 shadow-lg flex flex-col items-start justify-center p-5 gap-2"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="w-full">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-purple-500 dark:text-purple-400 uppercase tracking-wider">
                  {word.strongs_num}
                </span>
                {word.example_verse && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                    <BookOpen size={9} /> {word.example_verse}
                  </span>
                )}
              </div>

              {word.transliteration && (
                <p className="text-sm text-purple-700 dark:text-purple-300 font-medium mb-1 italic">
                  {word.transliteration}
                </p>
              )}

              <p className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">
                {word.gloss || word.definition}
              </p>

              {word.definition && word.definition !== word.gloss && (
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
                  {word.definition}
                </p>
              )}

              {word.frequency > 0 && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                  Occurs {word.frequency}× in corpus
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons — only show after flipping */}
      {flipped && !answered && (
        <div className="flex gap-3 mt-4 w-full justify-center">
          <button
            onClick={() => handleResult(false)}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 rounded-lg text-sm font-medium transition-colors"
          >
            <XCircle size={14} /> Missed it
          </button>
          <button
            onClick={() => handleResult(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400 rounded-lg text-sm font-medium transition-colors"
          >
            <CheckCircle size={14} /> Got it!
          </button>
        </div>
      )}

      {answered && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          Loading next card…
        </p>
      )}
    </div>
  )
}

// ── Word List (browse mode) ───────────────────────────────────────────────

function WordList({ words, masteryMap, onStartDrill }) {
  if (!words || words.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">
        No words found for this filter. Try a different frequency band.
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {words.map((w) => {
        const key = `${w.language}:${w.strongs_num}`
        const mastery = masteryMap?.[key]
        const level = mastery?.mastery_level ?? 0
        return (
          <div
            key={w.strongs_num}
            className={clsx('px-3 py-2 flex items-start gap-2', MASTERY_BG[level])}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className="font-serif text-xl text-gray-800 dark:text-gray-100"
                  dir={w.language === 'hebrew' ? 'rtl' : 'ltr'}
                >
                  {w.original_word}
                </span>
                <span className="text-xs text-purple-600 dark:text-purple-400">{w.strongs_num}</span>
                <span className="text-xs text-blue-600 dark:text-blue-300 italic">{w.transliteration}</span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-200 mt-0.5">{w.gloss}</p>
              {w.example_verse && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-0.5">
                  <BookOpen size={8} /> {w.example_verse}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <span className={clsx('text-[10px] font-medium', MASTERY_COLORS[level])}>
                {MASTERY_LABELS[level]}
              </span>
              {mastery && mastery.attempts > 0 && (
                <span className="text-[10px] text-gray-400">
                  {mastery.correct_count}/{mastery.attempts}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Summary ───────────────────────────────────────────────────────────────

function DrillSummary({ score, total, onRestart, onClose }) {
  const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8 gap-4">
      <GraduationCap size={40} className="text-blue-500" />
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Drill complete!</h2>
      <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{pct}%</p>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {score.correct} correct out of {total} cards
      </p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={onRestart}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} /> Drill again
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
        >
          Browse list
        </button>
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────

export default function VocabDrillsPanel() {
  const { book, chapter } = useStudyStore()
  const qc = useQueryClient()

  const [language, setLanguage] = useState('greek')
  const [frequencyBand, setFrequencyBand] = useState('top50')
  const [passageMode, setPassageMode] = useState(false)
  const [mode, setMode] = useState('list') // 'list' | 'drill' | 'summary'
  const [cardIndex, setCardIndex] = useState(0)
  const [sessionScore, setSessionScore] = useState({ correct: 0, incorrect: 0 })
  const [drillQueue, setDrillQueue] = useState([])

  // Determine query params based on mode
  const drillBook = passageMode && book ? book : null
  const drillChapter = passageMode && chapter ? chapter : null
  const drillLanguage = passageMode
    ? (book && ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy',
        'Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings',
        '1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job',
        'Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah',
        'Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
        'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai',
        'Zechariah','Malachi'].includes(book)
        ? 'hebrew' : 'greek')
    : language

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vocab-drill', drillLanguage, frequencyBand, drillBook, drillChapter],
    queryFn: () => api.getVocabDrill(drillLanguage, 50, frequencyBand, drillBook, drillChapter),
    staleTime: 5 * 60 * 1000,
  })

  const { data: masteryData } = useQuery({
    queryKey: ['vocab-mastery'],
    queryFn: api.getVocabMastery,
    staleTime: 30 * 1000,
  })

  const quizMutation = useMutation({
    mutationFn: ({ strongs_num, lang, correct }) =>
      api.recordVocabQuiz(strongs_num, lang, correct),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vocab-mastery'] }),
  })

  const words = data?.words ?? []
  const masteryMap = masteryData?.mastery ?? {}

  // Shuffle for drills and remove already-mastered words first
  function startDrill() {
    const queue = [...words].sort((a, b) => {
      const ma = masteryMap[`${a.language}:${a.strongs_num}`]?.mastery_level ?? 0
      const mb = masteryMap[`${b.language}:${b.strongs_num}`]?.mastery_level ?? 0
      // Prioritize lower-mastery words; shuffle among equal
      return (ma - mb) || (Math.random() - 0.5)
    })
    setDrillQueue(queue)
    setCardIndex(0)
    setSessionScore({ correct: 0, incorrect: 0 })
    setMode('drill')
  }

  function handleCorrect() {
    const card = drillQueue[cardIndex]
    quizMutation.mutate({ strongs_num: card.strongs_num, lang: card.language, correct: true })
    setSessionScore(s => ({ ...s, correct: s.correct + 1 }))
    advance()
  }

  function handleIncorrect() {
    const card = drillQueue[cardIndex]
    quizMutation.mutate({ strongs_num: card.strongs_num, lang: card.language, correct: false })
    setSessionScore(s => ({ ...s, incorrect: s.incorrect + 1 }))
    advance()
  }

  function advance() {
    const next = cardIndex + 1
    if (next >= drillQueue.length) {
      setMode('summary')
    } else {
      setCardIndex(next)
    }
  }

  const currentCard = drillQueue[cardIndex]
  const currentMastery = currentCard
    ? masteryMap[`${currentCard.language}:${currentCard.strongs_num}`]
    : null

  // Stats for header
  const masteredCount = useMemo(
    () => words.filter(w => (masteryMap[`${w.language}:${w.strongs_num}`]?.mastery_level ?? 0) >= 3).length,
    [words, masteryMap]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <GraduationCap size={13} />
          Vocab Drills
        </span>
        {words.length > 0 && mode === 'list' && (
          <button
            onClick={startDrill}
            className="text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 rounded-full transition-colors"
          >
            Drill ({words.length})
          </button>
        )}
        {mode === 'drill' && (
          <button
            onClick={() => setMode('list')}
            className="text-xs px-2 py-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            Exit drill
          </button>
        )}
      </div>

      {/* Controls — only in list mode */}
      {mode === 'list' && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 space-y-2">
          {/* Language toggle */}
          <div className="flex gap-1">
            {['greek', 'hebrew'].map(lang => (
              <button
                key={lang}
                onClick={() => { setLanguage(lang); setPassageMode(false) }}
                className={clsx(
                  'flex-1 text-xs py-1 rounded transition-colors capitalize',
                  !passageMode && language === lang
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400'
                )}
              >
                {lang === 'greek' ? 'Greek (NT)' : 'Hebrew (OT)'}
              </button>
            ))}
            {book && chapter && (
              <button
                onClick={() => setPassageMode(p => !p)}
                className={clsx(
                  'flex-1 text-xs py-1 rounded transition-colors',
                  passageMode
                    ? 'bg-purple-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-400'
                )}
                title={`Drill words from ${book} ${chapter}`}
              >
                This chapter
              </button>
            )}
          </div>

          {/* Frequency band */}
          {!passageMode && (
            <div className="flex gap-1">
              {FREQUENCY_BANDS.map(band => (
                <button
                  key={band.value}
                  onClick={() => setFrequencyBand(band.value)}
                  className={clsx(
                    'flex-1 text-[10px] py-0.5 rounded transition-colors text-center',
                    frequencyBand === band.value
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  )}
                >
                  {band.label}
                  {band.sublabel && (
                    <span className="block text-[9px] text-gray-400 dark:text-gray-500">{band.sublabel}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Quick stats */}
          {words.length > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {words.length} words · {masteredCount} mastered
              {passageMode && book && chapter ? ` · ${book} ${chapter}` : ''}
            </p>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading */}
        {isLoading && (
          <div className="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">Loading words…</div>
        )}

        {/* Error */}
        {isError && (
          <div className="p-4 text-xs text-red-500 dark:text-red-400 text-center">
            Failed to load vocabulary. Check your connection.
          </div>
        )}

        {/* Drill mode */}
        {mode === 'drill' && !isLoading && currentCard && (
          <FlashCard
            word={currentCard}
            mastery={currentMastery}
            onCorrect={handleCorrect}
            onIncorrect={handleIncorrect}
            onSkip={advance}
            sessionScore={sessionScore}
            total={drillQueue.length}
            current={cardIndex}
          />
        )}

        {/* Summary */}
        {mode === 'summary' && (
          <DrillSummary
            score={sessionScore}
            total={drillQueue.length}
            onRestart={startDrill}
            onClose={() => setMode('list')}
          />
        )}

        {/* List mode */}
        {mode === 'list' && !isLoading && !isError && (
          words.length === 0 ? (
            <div className="p-6 text-center">
              <GraduationCap size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No vocabulary found.</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {passageMode
                  ? 'Original language data may not be loaded for this chapter.'
                  : 'Try a different frequency band.'}
              </p>
            </div>
          ) : (
            <WordList words={words} masteryMap={masteryMap} onStartDrill={startDrill} />
          )
        )}
      </div>
    </div>
  )
}
