import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, CheckCircle2, GraduationCap, Loader2, Play, RotateCcw } from 'lucide-react'
import { api } from '../../api/client'
import clsx from 'clsx'

function Instruction({ text }) {
  return (
    <div className="space-y-2 text-sm text-gray-700 dark:text-slate-200 leading-relaxed">
      {(text || '').split(/\n\n+/).map((block, idx) => (
        <p key={idx} className="whitespace-pre-line">{block.replace(/\*\*/g, '')}</p>
      ))}
    </div>
  )
}

function ParadigmTable({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key))
    return set
  }, new Set()))

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-xs">
        <thead className="bg-gray-50 dark:bg-slate-800/80">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-slate-300 capitalize">
                {column.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5 bg-white dark:bg-slate-900">
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 text-gray-700 dark:text-slate-200 whitespace-nowrap">
                  {row?.[column] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExerciseCard({ exercise, onAnswered }) {
  const [flipped, setFlipped] = useState(false)
  const [selected, setSelected] = useState(null)
  const options = useMemo(() => {
    if (exercise.exercise_type !== 'multiple_choice') return []
    return [exercise.answer, ...(exercise.distractors || [])].sort()
  }, [exercise])
  const correct = selected && selected === exercise.answer

  if (exercise.exercise_type === 'multiple_choice') {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 space-y-3">
        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{exercise.prompt}</p>
        <div className="space-y-2">
          {options.map((option) => {
            const chosen = selected === option
            const isAnswer = selected && option === exercise.answer
            return (
              <button
                key={option}
                type="button"
                onClick={() => { setSelected(option); onAnswered?.(option === exercise.answer) }}
                className={clsx(
                  'w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors',
                  chosen && correct && 'border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950/30 dark:text-green-200',
                  chosen && !correct && 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/30 dark:text-red-200',
                  isAnswer && 'border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950/30 dark:text-green-200',
                  !chosen && !isAnswer && 'border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                )}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setFlipped((v) => !v); if (!flipped) onAnswered?.(true) }}
      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 text-left hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
    >
      <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1">Flashcard</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{flipped ? exercise.answer : exercise.prompt}</p>
      {flipped && exercise.hint && <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">{exercise.hint}</p>}
      {!flipped && <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">Tap to reveal answer</p>}
    </button>
  )
}

function ProgressBar({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
      <div className="h-full rounded-full bg-blue-600 dark:bg-blue-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function OriginalLanguageCoursesPanel() {
  const queryClient = useQueryClient()
  const [language, setLanguage] = useState('greek')
  const [activeLesson, setActiveLesson] = useState({ unit: 1, lesson: 1 })

  const coursesQuery = useQuery({ queryKey: ['language-courses'], queryFn: api.listCourses, staleTime: Infinity })
  const courseQuery = useQuery({ queryKey: ['language-course', language], queryFn: () => api.getCourse(language), staleTime: Infinity })
  const progressQuery = useQuery({ queryKey: ['language-course-progress', language], queryFn: () => api.getCourseProgress(language) })
  const lessonQuery = useQuery({
    queryKey: ['language-course-lesson', language, activeLesson.unit, activeLesson.lesson],
    queryFn: () => api.getCourseLesson(language, activeLesson.unit, activeLesson.lesson),
    enabled: Boolean(language && activeLesson.unit && activeLesson.lesson),
    staleTime: Infinity,
  })

  const course = courseQuery.data
  const progress = progressQuery.data
  const lesson = lessonQuery.data
  const totalLessons = useMemo(() => course?.units?.reduce((sum, unit) => sum + (unit.lessons?.length || 0), 0) || 0, [course])
  const completedIds = new Set(progress?.completed_lesson_ids || [])

  const completeMutation = useMutation({
    mutationFn: (payload) => api.updateCourseProgress(language, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['language-course-progress', language], data)
      queryClient.invalidateQueries({ queryKey: ['language-course-progress', language] })
    },
  })

  function selectLanguage(nextLanguage) {
    setLanguage(nextLanguage)
    setActiveLesson({ unit: 1, lesson: 1 })
  }

  function resume() {
    setActiveLesson({ unit: progress?.current_unit || 1, lesson: progress?.current_lesson || 1 })
  }

  function completeLesson() {
    if (!lesson || !course) return
    const units = course.units || []
    const unitIdx = units.findIndex((u) => u.unit_number === activeLesson.unit)
    const currentUnit = units[unitIdx]
    const lessons = currentUnit?.lessons || []
    const lessonIdx = lessons.findIndex((l) => l.lesson_number === activeLesson.lesson)
    const nextLesson = lessons[lessonIdx + 1]
    const nextUnit = !nextLesson ? units[unitIdx + 1] : null
    const next = nextLesson
      ? { unit: activeLesson.unit, lesson: nextLesson.lesson_number }
      : nextUnit?.lessons?.[0]
        ? { unit: nextUnit.unit_number, lesson: nextUnit.lessons[0].lesson_number }
        : { unit: activeLesson.unit, lesson: activeLesson.lesson }

    completeMutation.mutate({
      current_unit: next.unit,
      current_lesson: next.lesson,
      completed_lesson_id: lesson.id,
      total_lessons: totalLessons,
    })
    setActiveLesson(next)
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-950">
      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap size={18} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Original Languages</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">Guided Greek and Hebrew courses with paradigms, vocabulary practice, and saved progress.</p>
        </div>

        {coursesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Loading courses…</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(coursesQuery.data?.courses || []).map((c) => (
              <button
                key={c.language}
                type="button"
                onClick={() => selectLanguage(c.language)}
                className={clsx(
                  'rounded-xl border p-3 text-left transition-colors',
                  language === c.language
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                    : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800'
                )}
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{c.title}</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">{c.description}</p>
              </button>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">{course?.title || 'Course'}</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Resume Unit {progress?.current_unit || 1}, Lesson {progress?.current_lesson || 1}</p>
            </div>
            <button onClick={resume} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
              <Play size={12} /> Resume
            </button>
          </div>
          <ProgressBar value={progress?.percent_complete || 0} />
          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400">
            <span>{progress?.percent_complete || 0}% complete</span>
            <span>{progress?.current_streak || 0} lesson streak</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Units & Lessons</h3>
          {(course?.units || []).map((unit) => (
            <div key={unit.id} className="space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Unit {unit.unit_number}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{unit.title}</p>
              </div>
              <div className="space-y-1">
                {(unit.lessons || []).map((item) => {
                  const active = activeLesson.unit === unit.unit_number && activeLesson.lesson === item.lesson_number
                  const done = completedIds.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveLesson({ unit: unit.unit_number, lesson: item.lesson_number })}
                      className={clsx(
                        'w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors',
                        active ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200' : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                      )}
                    >
                      <span>Lesson {item.lesson_number}: {item.title}</span>
                      {done && <CheckCircle2 size={14} className="text-green-500" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 space-y-4">
          {lessonQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Loading lesson…</div>
          ) : lesson ? (
            <>
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold text-blue-600 dark:text-blue-300">Unit {activeLesson.unit} · Lesson {lesson.lesson_number}</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{lesson.title}</h3>
              </div>
              <Instruction text={lesson.instruction} />
              <ParadigmTable rows={lesson.paradigm_table} />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2"><BookOpenCheck size={15} /> Exercises</h4>
                {(lesson.exercises || []).slice(0, 8).map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} />)}
                {(lesson.exercises || []).length > 8 && (
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">Showing the first 8 of {lesson.exercises.length} exercises for this lesson.</p>
                )}
              </div>
              <button
                type="button"
                onClick={completeLesson}
                disabled={completeMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {completeMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Mark lesson complete
              </button>
            </>
          ) : (
            <div className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-2"><RotateCcw size={16} /> Choose a lesson to begin.</div>
          )}
        </div>
      </div>
    </div>
  )
}
