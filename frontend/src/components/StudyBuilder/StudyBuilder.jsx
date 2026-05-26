import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, ChevronLeft, Download, HelpCircle, List, PlusCircle, Send, Square, StickyNote, Wand2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import { streamAI } from '../../api/streamAI'
import clsx from 'clsx'

const STUDY_TYPES = [
  { value: 'inductive', label: 'Inductive' },
  { value: 'topical', label: 'Topical' },
  { value: 'devotional', label: 'Devotional' },
  { value: 'word', label: 'Word Study' },
]

const SECTIONS = [
  { key: 'observations', label: 'Study Notes', icon: List, aiEndpoint: 'study-observations', aiLabel: 'Generate AI Study' },
  { key: 'cross_refs', label: 'Cross-References', icon: BookOpen, aiEndpoint: 'cross-references', aiLabel: 'Find Cross-References' },
  { key: 'application', label: 'Application', icon: Wand2, aiEndpoint: 'applications', aiLabel: 'Generate Applications' },
  { key: 'prayer', label: 'Response/Prayer', icon: HelpCircle, aiEndpoint: null, aiLabel: null },
  { key: 'notes', label: 'Personal Notes', icon: StickyNote, aiEndpoint: null, aiLabel: null },
]

const MD_COMPONENTS = {
  h1: (p) => <h3 className="text-base font-semibold mt-2 mb-1" {...p} />,
  h2: (p) => <h4 className="text-sm font-semibold mt-2 mb-1" {...p} />,
  h3: (p) => <h5 className="text-sm font-semibold mt-1.5 mb-0.5" {...p} />,
  p: (p) => <p className="my-1 leading-relaxed" {...p} />,
  ul: (p) => <ul className="list-disc ml-5 my-1 space-y-0.5" {...p} />,
  ol: (p) => <ol className="list-decimal ml-5 my-1 space-y-0.5" {...p} />,
  strong: (p) => <strong className="font-semibold" {...p} />,
  a: (p) => <a className="text-blue-600 underline" {...p} />,
}

// ── Project List ───────────────────────────────────────────────
function ProjectList({ onSelect, onNew }) {
  const { data, isLoading } = useQuery({
    queryKey: ['studies'],
    queryFn: api.listStudies,
  })

  const projects = data?.studies ?? []

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5"><BookOpen size={13} />Bible Study</span>
        <button onClick={onNew} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
          <PlusCircle size={12} /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <div className="p-4 text-sm text-gray-400 text-center">Loading…</div>}
        {!isLoading && projects.length === 0 && (
          <div className="p-6 text-center">
            <BookOpen size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No study projects yet</p>
            <p className="text-xs text-gray-400 mb-4">Create a project to organize your Bible study.</p>
            <button onClick={onNew} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
              Start First Study
            </button>
          </div>
        )}
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{p.title}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{p.passage_ref}</p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">
                {p.study_type} · {p.sections.length} section{p.sections.length !== 1 ? 's' : ''}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── New Project Form ───────────────────────────────────────────
function NewProjectForm({ onCreated, onCancel }) {
  const { book, chapter, verse } = useStudyStore()
  const defaultRef = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`
  const [title, setTitle] = useState('')
  const [passageRef, setPassageRef] = useState(defaultRef)
  const [studyType, setStudyType] = useState('inductive')
  const qc = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.createStudy({ title: title.trim(), passage_ref: passageRef.trim(), study_type: studyType }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['studies'] })
      onCreated(project)
    },
  })

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <button onClick={onCancel} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <ChevronLeft size={12} /> Back
        </button>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">New Study Project</span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Sermon on the Mount"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Passage</label>
          <input
            value={passageRef}
            onChange={(e) => setPassageRef(e.target.value)}
            placeholder="e.g. Matthew 5-7"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Study Type</label>
          <select
            value={studyType}
            onChange={(e) => setStudyType(e.target.value)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2"
          >
            {STUDY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <button
          onClick={() => mutate()}
          disabled={!title.trim() || !passageRef.trim() || isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg py-2 transition-colors"
        >
          {isPending ? 'Creating…' : 'Create Study'}
        </button>
      </div>
    </div>
  )
}

// ── Section Editor ─────────────────────────────────────────────
function SectionEditor({ project, sectionKey, onBack }) {
  const section = SECTIONS.find((s) => s.key === sectionKey)
  const qc = useQueryClient()

  const existingContent = project.sections.find((s) => s.section_type === sectionKey)?.content ?? ''
  const [content, setContent] = useState(existingContent)
  const [streaming, setStreaming] = useState(false)
  const [preview, setPreview] = useState(false)
  const stopRef = useRef(null)

  const saveMutation = useMutation({
    mutationFn: (text) => api.upsertStudySection(project.id, sectionKey, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studies'] }),
  })

  const handleGenerate = useCallback(() => {
    if (!section.aiEndpoint) return
    setContent('')
    setStreaming(true)
    setPreview(false)
    let accumulated = ''

    const body = sectionKey === 'observations'
      ? { reference: project.passage_ref, translation: 'KJV' }
      : sectionKey === 'cross_refs'
      ? { reference: project.passage_ref, verse_text: '' }
      : { passage: project.passage_ref, translation: 'KJV', audience: 'general' }

    stopRef.current = streamAI(
      section.aiEndpoint,
      body,
      (chunk) => { accumulated += chunk; setContent(accumulated) },
      () => {
        setStreaming(false)
        saveMutation.mutate(accumulated)
      },
    )
  }, [section, sectionKey, project])

  const handleStop = () => {
    stopRef.current?.()
    setStreaming(false)
  }

  const handleExport = () => {
    const blob = new Blob([`# ${project.title}\n## ${section.label}\n\n${content}`], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.title}-${sectionKey}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ChevronLeft size={12} /> Back
        </button>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{section?.label}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreview((v) => !v)}
            className={clsx('text-xs px-1.5 py-0.5 rounded transition-colors', preview ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200')}
            title="Toggle preview"
          >
            Preview
          </button>
          <button onClick={handleExport} title="Export markdown" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <Download size={13} />
          </button>
        </div>
      </div>

      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">{project.passage_ref}</p>
        {section.aiEndpoint && (
          streaming ? (
            <button onClick={handleStop} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600">
              <Square size={10} /> Stop
            </button>
          ) : (
            <button onClick={handleGenerate} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
              <Send size={10} /> {section.aiLabel}
            </button>
          )
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {preview ? (
          <div className="flex-1 overflow-y-auto p-3 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={MD_COMPONENTS}>
              {content || '*No content yet*'}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={() => { if (content !== existingContent) saveMutation.mutate(content) }}
            placeholder={streaming ? 'Generating…' : 'Write your notes or generate with AI above…'}
            className="flex-1 p-3 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none resize-none"
          />
        )}
      </div>

      {saveMutation.isPending && (
        <div className="px-3 py-1 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          <p className="text-[10px] text-gray-400">Saving…</p>
        </div>
      )}
    </div>
  )
}

// ── Project View ───────────────────────────────────────────────
function ProjectView({ project, onBack }) {
  const [activeSection, setActiveSection] = useState(null)
  const qc = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteStudy(project.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['studies'] }); onBack() },
  })

  if (activeSection) {
    return <SectionEditor project={project} sectionKey={activeSection} onBack={() => setActiveSection(null)} />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ChevronLeft size={12} /> All Studies
        </button>
        <button
          onClick={() => { if (confirm('Delete this study?')) deleteMutation.mutate() }}
          className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-400"
        >
          Delete
        </button>
      </div>

      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{project.title}</h3>
        <p className="text-xs text-blue-600 dark:text-blue-400">{project.passage_ref}</p>
        <span className="text-[10px] text-gray-400 capitalize">{project.study_type} study</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {SECTIONS.map(({ key, label, icon: Icon }) => {
            const saved = project.sections.find((s) => s.section_type === key)
            return (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <Icon size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</p>
                  {saved?.content ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{saved.content.slice(0, 60)}…</p>
                  ) : (
                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">Not started</p>
                  )}
                </div>
                {saved?.content && (
                  <span className="text-[10px] text-green-500 dark:text-green-400 flex-shrink-0">✓</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────
export default function StudyBuilder() {
  const [view, setView] = useState('list')
  const [currentProject, setCurrentProject] = useState(null)

  if (view === 'new') {
    return <NewProjectForm onCreated={(p) => { setCurrentProject(p); setView('project') }} onCancel={() => setView('list')} />
  }
  if (view === 'project' && currentProject) {
    return <ProjectView project={currentProject} onBack={() => setView('list')} />
  }
  return <ProjectList onSelect={(p) => { setCurrentProject(p); setView('project') }} onNew={() => setView('new')} />
}
