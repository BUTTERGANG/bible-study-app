import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Calendar, Check, ChevronRight, Clock, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

export default function ReadingPlansPanel() {
  const qc = useQueryClient()
  const setReference = useStudyStore((s) => s.setReference)
  const [showBrowse, setShowBrowse] = useState(false)

  const { data: plansData } = useQuery({
    queryKey: ['reading-plans'],
    queryFn: api.getPlans,
  })

  const { data: todayData } = useQuery({
    queryKey: ['reading-plans', 'today'],
    queryFn: api.getTodayReadings,
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

  const completeMutation = useMutation({
    mutationFn: ({ planId, reference }) => api.completeReading(planId, reference),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reading-plans', 'today'] })
    },
  })

  const plans = plansData?.plans ?? []
  const todayReadings = todayData?.readings ?? []
  const builtInPlans = builtInData?.plans ?? []

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Calendar size={13} />
          Reading Plans
        </span>
        <button
          onClick={() => setShowBrowse(!showBrowse)}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Plus size={12} />
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Browse built-in plans */}
        {showBrowse && (
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/40">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Start a Reading Plan</p>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">Choose a plan to begin today</p>
            </div>
            <div className="p-3 space-y-2">
              {builtInPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{plan.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{plan.description}</p>
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
        {plans.length > 0 && !showBrowse && (
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Active Plans</p>
            </div>
            {plans.map((plan) => (
              <div key={plan.id} className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                <BookOpen size={14} className="text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{plan.name}</p>
                  {plan.start_date && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">Started {plan.start_date}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Today's readings */}
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
                  onClick={() => {
                    // Parse reference like "John 3", "Genesis 1:1", "1 Corinthians 13"
                    // Find the last token that looks like "chapter" or "chapter:verse"
                    const refMatch = reading.reference.match(/^(.+?)\s+(\d+)(?::(\d+))?$/)
                    if (refMatch) {
                      const [, bookName, ch, ver] = refMatch
                      setReference(bookName, parseInt(ch), ver ? parseInt(ver) : null)
                    }
                  }}
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
      </div>
    </div>
  )
}
