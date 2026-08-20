import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, Calendar, Check, ChevronDown, ChevronRight,
  Clock, Loader2, Plus, Sparkles, Trash2, X,
} from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

const EXAMPLE_GOALS = [
  'Read Psalms in 30 days',
  'New Testament overview in 90 days',
  'Follow the life of David',
  'Read all of Jesus\' parables',
  'Bible in a year',
  'Read through Paul\'s letters in 14 days',
  'Old Testament prophets in 30 days',
  'Messianic prophecies and their fulfillment',
]

function GenPlanPreview({ plan, onStart, onCancel, loading }) {
  const [expandedDays, setExpandedDays] = useState({})

  const toggleDay = (idx) => {
    setExpandedDays((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="border border-purple-200 dark:border-purple-800/40 rounded-lg overflow-hidden">
      <div className="bg-purple-50 dark:bg-purple-900/20 px-3 py-2.5 border-b border-purple-200 dark:border-purple-800/40">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-500" />
              {plan.plan_name}
            </p>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
              {plan.duration_days} days * {plan.days.reduce((n, d) => n + d.passages.length, 0)} passages
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={() => onStart(plan)}
              disabled={loading}
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 disabled:opacity-40 flex items-center gap-1"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Start Plan
            </button>
          </div>
        </div>
        <p className="text-xs text-purple-700 dark:text-purple-300 mt-1.5">{plan.goal}</p>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
        {plan.days.slice(0, 30).map((day, idx) => (
          <div key={idx}>
            <button
              onClick={() => toggleDay(idx)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              {expandedDays[idx] ? (
                <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
              )}
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-16 flex-shrink-0">
                {day.day_label || `Day ${day.day}`}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">
                {day.passages.join(', ')}
              </span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">
                {day.passages.length} passage{day.passages.length !== 1 ? 's' : ''}
              </span>
            </button>
            {expandedDays[idx] && day.description && (
              <div className="px-3 pb-2 pl-8">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                  {day.description}
                </p>
              </div>
            )}
          </div>
        ))}
        {plan.days.length > 30 && (
          <div className="px-3 py-2 text-xs text-gray-400 text-center">
            +{plan.days.length - 30} more days
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReadingPlansPanel() {
  const qc = useQueryClient()
  const setReference = useStudyStore((s) => s.setReference)
  const [showBrowse, setShowBrowse] = useState(false)
  const [showAiGen, setShowAiGen] = useState(false)
  const [goal, setGoal] = useState('')
  const [planName, setPlanName] = useState('')
  const [planDuration, setPlanDuration] = useState('')
  const [aiPlanJson, setAiPlanJson] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const { data: plansData } = useQuery({
    queryKey: ['reading-plans'],
    queryFn: api.getPlans,
  })

  const { data: todayData } = useQuery({
    queryKey: ['reading-plans', 'today'],
    queryFn: api.getTodayPlanReadings,
  })

  const { data: builtInData } = useQuery({
    queryKey: ['reading-plans', 'built-in'],
    queryFn: api.getBuiltInPlans,
    enabled: showBrowse,
  })

  const startMutation = useMutation({
    mutationFn: api.startPlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reading-plans'] })
      setShowBrowse(false)
    },
  })

  const startAiMutation = useMutation({
    mutationFn: api.startAiPlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reading-plans'] })
      setShowAiGen(false)
      setAiPlanJson(null)
      setGoal('')
      setPlanName('')
      setPlanDuration('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.deletePlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reading-plans'] })
      qc.invalidateQueries({ queryKey: ['reading-plans', 'today'] })
    },
  })

  const completeMutation = useMutation({
    mutationFn: ({ planId, reference }) => api.completeReading(planId, reference),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reading-plans', 'today'] })
    },
  })

  const plans = plansData?.plans ?? []
  const todayReadings = todayData?.readings ?? []
  const builtInPlans = builtInData?.plans ?? []

  const handleGeneratePlan = () => {
    if (!goal.trim() || isGenerating) return
    setAiPlanJson(null)
    setIsGenerating(true)
    setGenerateError('')

    const params = { goal: goal.trim() }
    if (planName.trim()) params.plan_name = planName.trim()
    if (planDuration) params.duration_days = parseInt(planDuration, 10)

    const url = '/api/ai/reading-plan'
    const token = localStorage.getItem('accessToken') || localStorage.getItem('appPassword') || ''
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('Response not streamable')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const process = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') return
            try {
              const event = JSON.parse(raw)
              if (event.stage === 'plan' && event.plan) {
                setAiPlanJson(event.plan)
              }
              if (event.error) {
                console.error('AI plan error:', event.error)
              }
            } catch {
              // skip malformed
            }
          }
        }
      }
      await process()
    }).catch((err) => {
      setGenerateError(err.message?.includes('503') ? 'AI key not configured.' : 'Generation failed — try again.')
    }).finally(() => {
      setIsGenerating(false)
    })
  }

  const handleStartAiPlan = (plan) => {
    startAiMutation.mutate({
      plan_name: plan.plan_name,
      goal: plan.goal,
      days: plan.days,
    })
  }

  const parseReference = (ref) => {
    const refMatch = ref.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/)
    if (refMatch) {
      const [, bookName, ch, ver] = refMatch
      setReference(bookName, parseInt(ch), ver ? parseInt(ver) : null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Calendar size={13} />
          Reading Plans
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowAiGen(!showAiGen); setShowBrowse(false); setAiPlanJson(null) }}
            className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1"
            title="AI Generate Plan"
          >
            <Sparkles size={12} />
            AI
          </button>
          <button
            onClick={() => { setShowBrowse(!showBrowse); setShowAiGen(false); setAiPlanJson(null) }}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus size={12} />
            Browse
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* AI Plan Generator */}
        {showAiGen && (
          <div className="border-b border-purple-200 dark:border-purple-800/40">
            <div className="px-3 py-2.5 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800/40">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                  <Sparkles size={12} />
                  AI Plan Generator
                </p>
                <button onClick={() => { setShowAiGen(false); setAiPlanJson(null) }} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
            </div>

            {!aiPlanJson ? (
              <div className="p-3 space-y-2.5">
                <div>
                  <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    What do you want to read? <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="e.g. Read Psalms in 30 days, or follow the life of David..."
                    className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2.5 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                      Plan name (optional)
                    </label>
                    <input
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      placeholder="My Custom Plan"
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                      Days (optional)
                    </label>
                    <input
                      value={planDuration}
                      onChange={(e) => setPlanDuration(e.target.value)}
                      placeholder="e.g. 30"
                      type="number"
                      min="1"
                      max="365"
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                </div>

                <button
                  onClick={handleGeneratePlan}
                  disabled={!goal.trim() || isGenerating}
                  className="w-full text-xs bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center gap-1.5 font-medium"
                >
                  {isGenerating ? (
                    <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>
                  ) : (
                    <><Sparkles size={12} />Generate Plan</>
                  )}
                </button>
                {generateError && (
                  <p className="text-xs text-red-500 text-center">{generateError}</p>
                )}

                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">Try an example:</p>
                  <div className="flex flex-wrap gap-1">
                    {EXAMPLE_GOALS.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGoal(g)}
                        className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3">
                <GenPlanPreview
                  plan={aiPlanJson}
                  onStart={handleStartAiPlan}
                  onCancel={() => setAiPlanJson(null)}
                  loading={startAiMutation.isPending}
                />
              </div>
            )}
          </div>
        )}

        {/* Browse built-in plans */}
        {showBrowse && (
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Browse Plans</p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">{builtInPlans.length} plan templates available</p>
                </div>
                <button onClick={() => setShowBrowse(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto p-3 space-y-2">
              {builtInPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{plan.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{plan.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                          {plan.category}
                        </span>
                        <span className="text-[10px] text-gray-400">{plan.duration} days</span>
                      </div>
                    </div>
                    <button
                      onClick={() => startMutation.mutate({ plan_type: plan.id })}
                      disabled={startMutation.isPending}
                      className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-md hover:bg-blue-700 disabled:opacity-40 flex-shrink-0"
                    >
                      Start
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active plans */}
        {plans.length > 0 && !showBrowse && !showAiGen && (
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Active Plans ({plans.length})</p>
            </div>
            {plans.map((plan) => (
              <div key={plan.id} className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 group">
                <div className="flex items-center gap-3">
                  {plan.plan_type === 'ai-generated' ? (
                    <Sparkles size={14} className="text-purple-500 flex-shrink-0" />
                  ) : (
                    <BookOpen size={14} className="text-blue-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{plan.name}</p>
                    <div className="flex items-center gap-2">
                      {plan.start_date && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">Started {plan.start_date}</p>
                      )}
                      {plan.plan_type === 'ai-generated' && (
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
                          AI
                        </span>
                      )}
                    </div>
                  </div>
                  {confirmDeleteId === plan.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { deleteMutation.mutate(plan.id); setConfirmDeleteId(null) }}
                        className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                      >Delete</button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[10px] px-1.5 py-0.5 text-gray-500 hover:text-gray-700"
                      >Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(plan.id)}
                      className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete plan"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {plans.length === 0 && !showBrowse && !showAiGen && (
          <div className="p-6 text-center">
            <Calendar size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No reading plans yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Browse templates or generate a custom plan with AI
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => { setShowBrowse(true); setShowAiGen(false) }}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1"
              >
                <BookOpen size={12} />
                Browse Plans
              </button>
              <button
                onClick={() => { setShowAiGen(true); setShowBrowse(false) }}
                className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 flex items-center gap-1"
              >
                <Sparkles size={12} />
                AI Generate
              </button>
            </div>
          </div>
        )}

        {/* Today's readings */}
        {!showBrowse && !showAiGen && (
          <div>
            <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-800/40">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 flex items-center gap-1">
                <Clock size={11} />
                Today's Readings
              </p>
              <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {todayReadings.length === 0 && (
              <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
                <Calendar size={24} className="mx-auto mb-2 opacity-30" />
                <p>No readings scheduled for today.</p>
                <p className="text-xs mt-1">Start a reading plan to see daily readings here.</p>
              </div>
            )}

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {todayReadings.map((reading, i) => (
                <div
                  key={i}
                  className={clsx(
                    'group flex items-center gap-3 px-4 py-3 transition-colors',
                    reading.completed ? 'bg-green-50/50 dark:bg-green-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  <button
                    onClick={() => parseReference(reading.reference)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-1.5">
                      {reading.completed ? (
                        <Check size={13} className="text-green-500 flex-shrink-0" />
                      ) : (
                        <ChevronRight size={13} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                      )}
                      <span className={clsx(
                        'text-sm font-medium',
                        reading.completed
                          ? 'text-green-700 dark:text-green-400 line-through'
                          : 'text-blue-700 dark:text-blue-400'
                      )}>
                        {reading.reference}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 ml-5">{reading.plan_name}</p>
                  </button>
                  {!reading.completed && (
                    <button
                      onClick={() => completeMutation.mutate({
                        planId: reading.plan_id,
                        reference: reading.reference,
                      })}
                      disabled={completeMutation.isPending}
                      className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-0.5"
                      title="Mark as complete"
                    >
                      <Check size={12} />
                      Done
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
