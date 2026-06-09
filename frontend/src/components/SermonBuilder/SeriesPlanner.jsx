/**
 * SeriesPlanner — multi-sermon preaching series management with calendar grid.
 *
 * Views:
 *  list    — all series for the user
 *  new     — create a new series (title, theme, date range)
 *  detail  — calendar grid for a single series + summary bar
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, Calendar, ChevronLeft, ChevronRight, Download,
  Layers, PlusCircle, Trash2, X,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '../../api/client'

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_CYCLE = { planned: 'drafted', drafted: 'preached', preached: 'planned' }

const STATUS_STYLES = {
  planned: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  drafted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  preached: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

const STATUS_LABELS = { planned: 'Planned', drafted: 'Drafted', preached: 'Preached' }

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const dt = new Date(Number(y), Number(m) - 1, Number(d))
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtShort(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const dt = new Date(Number(y), Number(m) - 1, Number(d))
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Series List ────────────────────────────────────────────────────────────

function SeriesList({ onSelect, onNew, onBack }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sermon-series'],
    queryFn: api.listSermonSeries,
  })

  const qc = useQueryClient()
  const { mutate: deleteSeries } = useMutation({
    mutationFn: (id) => api.deleteSermonSeries(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sermon-series'] }),
  })

  const list = data?.series ?? []

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ChevronLeft size={12} /> Sermons
        </button>
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
          <Layers size={13} /> Preaching Series
        </span>
        <button
          onClick={onNew}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          <PlusCircle size={12} /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-sm text-gray-400 text-center">Loading…</div>
        )}
        {!isLoading && list.length === 0 && (
          <div className="p-6 text-center">
            <Layers size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No preaching series yet</p>
            <p className="text-xs text-gray-400 mb-4">Plan a multi-week series and track each sermon's progress.</p>
            <button
              onClick={onNew}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg"
            >
              Create First Series
            </button>
          </div>
        )}

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {list.map((s) => {
            const { total, drafted, preached } = s.summary
            return (
              <div key={s.id} className="flex items-center group">
                <button
                  onClick={() => onSelect(s)}
                  className="flex-1 text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{s.title}</p>
                  {s.theme && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 truncate mt-0.5">{s.theme}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtShort(s.start_date)} – {fmtShort(s.end_date)} · {total} week{total !== 1 ? 's' : ''}
                  </p>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                      {preached} preached
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {drafted} drafted
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => window.confirm(`Delete "${s.title}"?`) && deleteSeries(s.id)}
                  className="px-3 text-gray-300 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete series"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── New Series Form ────────────────────────────────────────────────────────

function NewSeriesForm({ onCreated, onCancel }) {
  const today = new Date().toISOString().slice(0, 10)
  const eightWeeks = new Date(Date.now() + 7 * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const [title, setTitle] = useState('')
  const [theme, setTheme] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(eightWeeks)

  const qc = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api.createSermonSeries({
        title: title.trim(),
        theme: theme.trim() || null,
        start_date: startDate,
        end_date: endDate,
        generate_weekly_slots: true,
      }),
    onSuccess: (series) => {
      qc.invalidateQueries({ queryKey: ['sermon-series'] })
      onCreated(series)
    },
  })

  const weeksCount = (() => {
    try {
      const diff = (new Date(endDate) - new Date(startDate)) / (7 * 24 * 3600 * 1000)
      return Math.max(0, Math.floor(diff) + 1)
    } catch {
      return 0
    }
  })()

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <button onClick={onCancel} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <ChevronLeft size={12} /> Back
        </button>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">New Preaching Series</span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Series Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Sermon on the Mount"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Theme / Description</label>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="e.g. Kingdom living for ordinary people"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {weeksCount > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This will create <strong>{weeksCount}</strong> weekly slot{weeksCount !== 1 ? 's' : ''}.
          </p>
        )}

        <button
          onClick={() => mutate()}
          disabled={!title.trim() || !startDate || !endDate || isPending}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg py-2 transition-colors"
        >
          {isPending ? 'Creating…' : 'Create Series'}
        </button>
      </div>
    </div>
  )
}

// ── Entry Cell (calendar grid slot) ───────────────────────────────────────

function EntryCell({ entry, seriesId, sermons, onUpdated }) {
  const [showAssign, setShowAssign] = useState(false)
  const qc = useQueryClient()

  const { mutate: updateEntry } = useMutation({
    mutationFn: (data) => api.updateSeriesEntry(seriesId, entry.id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['sermon-series', seriesId] })
      onUpdated?.(updated)
    },
  })

  const { mutate: removeEntry } = useMutation({
    mutationFn: () => api.deleteSeriesEntry(seriesId, entry.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sermon-series', seriesId] }),
  })

  function cycleStatus() {
    updateEntry({ status: STATUS_CYCLE[entry.status] })
  }

  function assignSermon(sermonId) {
    updateEntry({ sermon_id: sermonId })
    setShowAssign(false)
  }

  function unassign() {
    updateEntry({ sermon_id: null })
    setShowAssign(false)
  }

  const hasSermon = !!entry.sermon

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 flex flex-col gap-1 min-h-[80px] relative">
      {/* Date header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
          {fmtShort(entry.scheduled_date)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={cycleStatus}
            className={clsx(
              'text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-colors cursor-pointer',
              STATUS_STYLES[entry.status]
            )}
            title={`Click to advance status (${entry.status} → ${STATUS_CYCLE[entry.status]})`}
          >
            {STATUS_LABELS[entry.status]}
          </button>
          <button
            onClick={() => removeEntry()}
            className="text-gray-300 hover:text-red-400 dark:hover:text-red-500"
            title="Remove slot"
          >
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Sermon assignment */}
      {hasSermon ? (
        <button
          onClick={() => setShowAssign(true)}
          className="text-left"
        >
          <p className="text-xs font-medium text-gray-800 dark:text-gray-100 leading-tight truncate">
            {entry.sermon.title}
          </p>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 truncate mt-0.5">
            {entry.sermon.passage_ref}
          </p>
        </button>
      ) : (
        <button
          onClick={() => setShowAssign(true)}
          className="text-[10px] text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 text-left mt-auto flex items-center gap-0.5"
        >
          <PlusCircle size={10} /> Assign sermon
        </button>
      )}

      {/* Assign dropdown */}
      {showAssign && (
        <div className="absolute top-0 left-0 z-20 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl p-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Assign Sermon</span>
            <button onClick={() => setShowAssign(false)} className="text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {hasSermon && (
              <button
                onClick={unassign}
                className="w-full text-left px-2 py-1.5 text-xs text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
              >
                Remove assignment
              </button>
            )}
            {(sermons ?? []).map((s) => (
              <button
                key={s.id}
                onClick={() => assignSermon(s.id)}
                className={clsx(
                  'w-full text-left px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded',
                  entry.sermon_id === s.id && 'bg-amber-50 dark:bg-amber-900/20'
                )}
              >
                <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{s.title}</p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400">{s.passage_ref}</p>
              </button>
            ))}
            {(sermons ?? []).length === 0 && (
              <p className="px-2 py-2 text-xs text-gray-400">No sermon projects yet. Create one in Sermon Builder.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Series Detail (calendar grid + summary) ────────────────────────────────

function SeriesDetail({ series: initialSeries, onBack }) {
  const qc = useQueryClient()

  // Keep fresh data from cache
  const { data: seriesData } = useQuery({
    queryKey: ['sermon-series', initialSeries.id],
    queryFn: () => api.getSermonSeries(initialSeries.id),
    initialData: initialSeries,
  })
  const series = seriesData ?? initialSeries

  // All user sermons for the assign dropdown
  const { data: sermonsData } = useQuery({
    queryKey: ['sermons'],
    queryFn: api.listSermons,
  })
  const sermons = sermonsData?.projects ?? []

  const { mutate: addEntry } = useMutation({
    mutationFn: (data) => api.addSeriesEntry(series.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sermon-series', series.id] }),
  })

  const { mutate: deleteSeries } = useMutation({
    mutationFn: () => api.deleteSermonSeries(series.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sermon-series'] })
      onBack()
    },
  })

  const entries = series.entries ?? []
  const { total, drafted, preached, planned } = series.summary ?? { total: 0, drafted: 0, preached: 0, planned: 0 }

  function exportOutline() {
    const lines = [
      `# ${series.title}`,
      '',
      series.theme ? `*${series.theme}*` : '',
      '',
      `**${fmtDate(series.start_date)} – ${fmtDate(series.end_date)}**`,
      '',
      '---',
      '',
    ]

    entries.forEach((e, i) => {
      const statusLabel = STATUS_LABELS[e.status] ?? e.status
      lines.push(`## Week ${i + 1} — ${fmtDate(e.scheduled_date)} [${statusLabel}]`)
      if (e.sermon) {
        lines.push(`**${e.sermon.title}**`)
        lines.push(`Passage: ${e.sermon.passage_ref}`)
      } else {
        lines.push('*(Unassigned)*')
      }
      if (e.notes) lines.push(`Notes: ${e.notes}`)
      lines.push('')
    })

    lines.push('---')
    lines.push(`*Exported from LOGOS on ${new Date().toLocaleDateString()}*`)

    const blob = new Blob([lines.filter(Boolean).join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${series.title.replace(/[^a-z0-9]/gi, '-')}-series.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function addSlot() {
    // Add a slot one week after the last entry (or series start if empty)
    let nextDate
    if (entries.length > 0) {
      const lastDate = new Date(entries[entries.length - 1].scheduled_date)
      lastDate.setDate(lastDate.getDate() + 7)
      nextDate = lastDate.toISOString().slice(0, 10)
    } else {
      nextDate = series.start_date
    }
    addEntry({ scheduled_date: nextDate, status: 'planned' })
  }

  const draftedPct = total ? Math.round((drafted / total) * 100) : 0
  const preachedPct = total ? Math.round((preached / total) * 100) : 0

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ChevronLeft size={12} /> All Series
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={exportOutline}
            className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
            title="Export series outline"
          >
            <Download size={13} />
          </button>
          <button
            onClick={() => window.confirm(`Delete "${series.title}"?`) && deleteSeries()}
            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
            title="Delete series"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Series header */}
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/40">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{series.title}</h2>
        {series.theme && (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 italic">{series.theme}</p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
          <Calendar size={10} />
          {fmtDate(series.start_date)} – {fmtDate(series.end_date)}
        </p>
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3 text-xs mb-1.5">
          <span className="text-gray-500 dark:text-gray-400">{total} weeks</span>
          <span className="text-green-700 dark:text-green-400 font-medium">{preached} preached ({preachedPct}%)</span>
          <span className="text-amber-700 dark:text-amber-400 font-medium">{drafted} drafted ({draftedPct}%)</span>
          <span className="text-gray-400">{planned} planned</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
          <div
            className="bg-green-500 h-full transition-all"
            style={{ width: `${preachedPct}%` }}
          />
          <div
            className="bg-amber-400 h-full transition-all"
            style={{ width: `${draftedPct}%` }}
          />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {entries.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">
            No slots yet.
            <button onClick={addSlot} className="ml-1 text-blue-500 hover:underline">Add one.</button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {entries.map((entry, idx) => (
            <div key={entry.id} className="flex items-start gap-2">
              <div className="text-[10px] text-gray-400 dark:text-gray-500 w-12 shrink-0 pt-2 text-right">
                Wk {idx + 1}
              </div>
              <div className="flex-1">
                <EntryCell
                  entry={entry}
                  seriesId={series.id}
                  sermons={sermons}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addSlot}
          className="mt-3 w-full text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-2 flex items-center justify-center gap-1 transition-colors"
        >
          <PlusCircle size={11} /> Add week
        </button>
      </div>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────

export default function SeriesPlanner({ onBack }) {
  const [view, setView] = useState('list')   // list | new | detail
  const [selectedSeries, setSelectedSeries] = useState(null)

  if (view === 'new') {
    return (
      <NewSeriesForm
        onCreated={(s) => { setSelectedSeries(s); setView('detail') }}
        onCancel={() => setView('list')}
      />
    )
  }

  if (view === 'detail' && selectedSeries) {
    return (
      <SeriesDetail
        series={selectedSeries}
        onBack={() => { setSelectedSeries(null); setView('list') }}
      />
    )
  }

  return (
    <SeriesList
      onSelect={(s) => { setSelectedSeries(s); setView('detail') }}
      onNew={() => setView('new')}
      onBack={onBack}
    />
  )
}
