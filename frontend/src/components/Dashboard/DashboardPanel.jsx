import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Calendar, ChevronRight, Sparkles } from 'lucide-react'
import { api, authHeaders } from '../../api/client'
import { useStudyStore } from '../../stores/studyStore'

function VerseCard({ votd, reflection, onReflect, reflecting }) {
  if (!votd) return null
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Verse of the Day
        </span>
        <button
          onClick={onReflect}
          disabled={reflecting}
          className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 disabled:opacity-40"
        >
          <Sparkles size={12} />
          Reflect
        </button>
      </div>

      <blockquote className="text-sm leading-relaxed text-gray-800 dark:text-gray-100 italic">
        "{votd.text}"
      </blockquote>
      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
        — {votd.reference} ({votd.translation})
      </p>

      {(reflection || reflecting) && (
        <div className="pt-2 border-t border-amber-200 dark:border-amber-700">
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
            {reflection || <span className="opacity-50">Reflecting…</span>}
            {reflecting && <span className="inline-block w-1 h-3 ml-0.5 bg-current animate-pulse" />}
          </p>
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan, onNavigate }) {
  if (!plan) return null
  const pct = plan.overall_progress
  const todayDone = plan.today_completed >= plan.today_total && plan.today_total > 0

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
          Reading Plan
        </span>
        {todayDone && (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Today done</span>
        )}
      </div>

      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{plan.plan_name}</p>

      {plan.today_readings.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">Today's readings:</p>
          {plan.today_readings.map((ref) => (
            <button
              key={ref}
              onClick={() => onNavigate(ref)}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <BookOpen size={10} />
              {ref}
              <ChevronRight size={10} />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Overall progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function QuickActions({ onAction }) {
  const actions = [
    { id: 'reading', label: 'Reading Plans', icon: Calendar, color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
    { id: 'ai', label: 'AI Study', icon: Sparkles, color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
    { id: 'sermon', label: 'Sermon Builder', icon: BookOpen, color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
    { id: 'study', label: 'Bible Study', icon: BookOpen, color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' },
  ]

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
        Quick Access
      </p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => onAction(id)}
            className={`flex items-center gap-2 rounded-lg p-3 text-xs font-medium ${color} hover:opacity-80 transition-opacity text-left`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPanel() {
  const { setRightPanel, setBook, setChapter } = useStudyStore()
  const [reflection, setReflection] = useState(null)
  const [reflecting, setReflecting] = useState(false)
  const stopRef = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    staleTime: 5 * 60 * 1000,
  })

  // Seed reflection from cache on load
  useEffect(() => {
    if (data?.reflection && !reflection) {
      setReflection(data.reflection)
    }
  }, [data])

  async function handleReflect() {
    if (reflecting) {
      stopRef.current?.abort()
      return
    }
    setReflection('')
    setReflecting(true)
    const controller = new AbortController()
    stopRef.current = controller
    try {
      const res = await fetch('/api/dashboard/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setReflection((prev) => (prev || '') + chunk)
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('reflection error', e)
    } finally {
      setReflecting(false)
    }
  }

  function handleNavigate(ref) {
    // ref is like "Genesis 1" or "John 3"
    const parts = ref.split(' ')
    const chapter = parseInt(parts[parts.length - 1])
    const book = parts.slice(0, parts.length - 1).join(' ')
    if (book && chapter) {
      setBook(book)
      setChapter(chapter)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  const votd = data?.verse_of_day
  const plan = data?.active_plan

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Home</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      <VerseCard
        votd={votd}
        reflection={reflection}
        onReflect={handleReflect}
        reflecting={reflecting}
      />

      {plan ? (
        <PlanCard plan={plan} onNavigate={handleNavigate} />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4 text-center">
          <Calendar size={20} className="mx-auto text-gray-400 mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400">No active reading plan</p>
          <button
            onClick={() => setRightPanel('reading')}
            className="mt-1 text-xs text-blue-500 hover:underline"
          >
            Browse plans →
          </button>
        </div>
      )}

      <QuickActions onAction={setRightPanel} />
    </div>
  )
}
