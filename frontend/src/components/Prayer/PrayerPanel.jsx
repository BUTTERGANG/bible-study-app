import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, Plus, Check, Archive, Trash2, Link, ChevronDown, ChevronRight, X } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

const STATUS_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'answered', label: 'Answered' },
  { value: 'archived', label: 'Archived' },
]

const STATUS_STYLES = {
  active: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400',
  answered: 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400',
  archived: 'text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400',
}

function NewPrayerForm({ linkedRef, onSubmit, onCancel }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    onSubmit({ title: title.trim(), content: content.trim(), category: category.trim() || null })
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
      {linkedRef && (
        <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
          <Link size={9} /> Linked to {linkedRef}
        </div>
      )}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Prayer title…"
        className="w-full text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5 focus:outline-none focus:border-rose-400"
        required
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your prayer…"
        rows={3}
        className="w-full text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5 focus:outline-none focus:border-rose-400 resize-none"
        required
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category (optional: family, health, work…)"
        className="w-full text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5 focus:outline-none focus:border-rose-400"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="text-xs px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded transition-colors"
        >
          Save prayer
        </button>
      </div>
    </form>
  )
}

function PrayerCard({ prayer, onMarkAnswered, onArchive, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [answeredNote, setAnsweredNote] = useState('')
  const [showAnswerInput, setShowAnswerInput] = useState(false)

  return (
    <div className="border-b border-gray-100 dark:border-gray-700">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-gray-800 dark:text-gray-100">{prayer.title}</span>
              {prayer.category && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {prayer.category}
                </span>
              )}
              {prayer.book && (
                <span className="text-[10px] text-blue-500 dark:text-blue-400 flex items-center gap-0.5">
                  <Link size={8} /> {prayer.book} {prayer.chapter}:{prayer.verse}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{prayer.content}</p>
          </div>
          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0', STATUS_STYLES[prayer.status])}>
            {prayer.status}
          </span>
          {expanded ? <ChevronDown size={12} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed mb-2 whitespace-pre-wrap">
            {prayer.content}
          </p>

          {prayer.answered_note && (
            <div className="mb-2 border-l-2 border-green-300 dark:border-green-700 pl-2">
              <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 mb-0.5">Answered</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">{prayer.answered_note}</p>
            </div>
          )}

          {showAnswerInput && prayer.status === 'active' && (
            <div className="mb-2 space-y-1">
              <textarea
                value={answeredNote}
                onChange={(e) => setAnsweredNote(e.target.value)}
                placeholder="How was this prayer answered?"
                rows={2}
                className="w-full text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5 focus:outline-none focus:border-green-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { onMarkAnswered(prayer.id, answeredNote); setShowAnswerInput(false) }}
                  className="text-xs px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                >
                  Mark answered
                </button>
                <button
                  onClick={() => setShowAnswerInput(false)}
                  className="text-xs px-2 py-0.5 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {prayer.status === 'active' && !showAnswerInput && (
              <button
                onClick={() => setShowAnswerInput(true)}
                className="flex items-center gap-1 text-[10px] text-green-600 hover:text-green-700 dark:text-green-400"
              >
                <Check size={10} /> Mark answered
              </button>
            )}
            {prayer.status !== 'archived' && (
              <button
                onClick={() => onArchive(prayer.id)}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Archive size={10} /> Archive
              </button>
            )}
            <button
              onClick={() => onDelete(prayer.id)}
              className="flex items-center gap-1 text-[10px] text-gray-300 hover:text-red-500 dark:hover:text-red-400 ml-auto"
            >
              <Trash2 size={10} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PrayerPanel() {
  const { book, chapter, verse } = useStudyStore()
  const [activeTab, setActiveTab] = useState('active')
  const [showNew, setShowNew] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['prayers', activeTab],
    queryFn: () => api.listPrayers(activeTab),
  })

  const createMutation = useMutation({
    mutationFn: api.createPrayer,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prayers'] }); setShowNew(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.updatePrayer(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prayers'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: api.deletePrayer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prayers'] }),
  })

  const prayers = data?.prayers ?? []
  const currentRef = verse ? `${book} ${chapter}:${verse}` : null

  function handleCreate(formData) {
    createMutation.mutate({
      ...formData,
      book: verse ? book : null,
      chapter: verse ? chapter : null,
      verse: verse ? verse : null,
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Heart size={13} />
          Prayer Journal
        </span>
        <button
          onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-1 text-xs px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/60 rounded-full transition-colors"
        >
          {showNew ? <X size={10} /> : <Plus size={10} />}
          {showNew ? 'Cancel' : 'New'}
        </button>
      </div>

      {showNew && (
        <NewPrayerForm
          linkedRef={currentRef}
          onSubmit={handleCreate}
          onCancel={() => setShowNew(false)}
        />
      )}

      {/* Status tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={clsx(
              'flex-1 py-1.5 text-xs font-medium transition-colors',
              activeTab === value
                ? 'text-rose-600 border-b-2 border-rose-600 bg-white dark:bg-gray-800'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <div className="p-4 text-xs text-gray-400 text-center">Loading…</div>}

        {!isLoading && prayers.length === 0 && (
          <div className="p-6 text-center">
            <Heart size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeTab === 'active' ? 'No active prayers.' : `No ${activeTab} prayers.`}
            </p>
            {activeTab === 'active' && (
              <button
                onClick={() => setShowNew(true)}
                className="mt-2 text-xs text-rose-600 hover:underline"
              >
                Add your first prayer →
              </button>
            )}
          </div>
        )}

        {prayers.map((p) => (
          <PrayerCard
            key={p.id}
            prayer={p}
            onMarkAnswered={(id, note) => updateMutation.mutate({ id, status: 'answered', answered_note: note })}
            onArchive={(id) => updateMutation.mutate({ id, status: 'archived' })}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        ))}
      </div>
    </div>
  )
}
