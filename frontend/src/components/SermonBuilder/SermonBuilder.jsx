import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, ChevronLeft, Download, HelpCircle, Import, Lightbulb, List,
  PlusCircle, Send, Square, Trash2, Upload, Wand2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import { streamAI } from '../../api/streamAI'
import clsx from 'clsx'

const AUDIENCES = [
  { value: 'general', label: 'General' },
  { value: 'youth', label: 'Youth' },
  { value: 'men', label: "Men's" },
  { value: 'women', label: "Women's" },
  { value: 'seniors', label: 'Seniors' },
  { value: 'seekers', label: 'Seekers' },
]

const SECTIONS = [
  { key: 'full_sermon', label: 'Full Sermon', icon: BookOpen, aiEndpoint: 'sermon' },
  { key: 'outline', label: 'Outline', icon: List, aiEndpoint: 'outline' },
  { key: 'illustrations', label: 'Illustrations', icon: Lightbulb, aiEndpoint: 'illustrations' },
  { key: 'questions', label: 'Questions', icon: HelpCircle, aiEndpoint: 'discussion-questions' },
  { key: 'applications', label: 'Applications', icon: Wand2, aiEndpoint: 'applications' },
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
    queryKey: ['sermons'],
    queryFn: api.listSermons,
  })

  const projects = data?.projects ?? []
  const fileInputRef = useRef(null)

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    // Parse markdown: first heading = title, ## headings = sections
    const lines = text.split('\n')
    let title = file.name.replace(/\.(md|docx?|txt)$/i, '')
    const sections = {}
    let currentSection = null
    let currentContent = []

    for (const line of lines) {
      const h1Match = line.match(/^#\s+(.+)/)
      const h2Match = line.match(/^##\s+(.+)/)
      if (h1Match && !title.startsWith(file.name)) {
        // First # heading is title
        title = h1Match[1]
      } else if (h2Match) {
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim()
        }
        const heading = h2Match[1].toLowerCase()
        if (heading.includes('sermon') || heading.includes('full')) currentSection = 'full_sermon'
        else if (heading.includes('outline')) currentSection = 'outline'
        else if (heading.includes('illustration')) currentSection = 'illustrations'
        else if (heading.includes('question')) currentSection = 'questions'
        else if (heading.includes('applic')) currentSection = 'applications'
        else currentSection = null
        currentContent = []
      } else if (currentSection) {
        currentContent.push(line)
      }
    }
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim()
    }

    // Create project via API
    try {
      const project = await api.createSermon({ title, passage_ref: '', audience: 'general' })
      // Upsert each parsed section
      for (const [sectionType, content] of Object.entries(sections)) {
        if (content) {
          await api.upsertSermonSection(project.id, sectionType, content)
        }
      }
      // Refresh list
      const qc = useQueryClient()
      qc.invalidateQueries({ queryKey: ['sermons'] })
      onSelect({ ...project, sections: Object.entries(sections).map(([section_type, content]) => ({ section_type, content })) })
    } catch (err) {
      console.error('Import failed:', err)
      alert('Failed to import sermon: ' + (err.message || 'Unknown error'))
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <BookOpen size={13} />
          Sermon Builder
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline"
            title="Import from Markdown"
          >
            <Import size={12} />
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={onNew}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <PlusCircle size={12} />
            New
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-sm text-gray-400 text-center">Loading…</div>
        )}
        {!isLoading && projects.length === 0 && (
          <div className="p-6 text-center">
            <BookOpen size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No sermon projects yet</p>
            <p className="text-xs text-gray-400 mb-4">Create a project to organize your sermon preparation.</p>
            <button
              onClick={onNew}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg"
            >
              Create First Sermon
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
                {p.audience} · {p.sections.length} section{p.sections.length !== 1 ? 's' : ''}
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
  const [audience, setAudience] = useState('general')

  const qc = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: () => api.createSermon({ title: title.trim(), passage_ref: passageRef.trim(), audience }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['sermons'] })
      onCreated(project)
    },
  })

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <button onClick={onCancel} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <ChevronLeft size={12} /> Back
        </button>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">New Sermon Project</span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Good Shepherd — John 10"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Passage</label>
          <input
            value={passageRef}
            onChange={(e) => setPassageRef(e.target.value)}
            placeholder="e.g. John 10:1-18"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Audience</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2"
          >
            {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <button
          onClick={() => mutate()}
          disabled={!title.trim() || !passageRef.trim() || isPending}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg py-2 transition-colors"
        >
          {isPending ? 'Creating…' : 'Create Project'}
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
  const [preview, setPreview] = useState(!!existingContent)
  const stopRef = useRef(null)

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (text) => api.upsertSermonSection(project.id, sectionKey, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sermons'] }),
  })

  const generate = useCallback(() => {
    setContent('')
    setPreview(false)
    setStreaming(true)

    const outlineContent = project.sections.find((s) => s.section_type === 'outline')?.content

    const endpoint = section.aiEndpoint
    const body = endpoint === 'sermon'
      ? {
          passage: project.passage_ref,
          audience: project.audience,
          translation: 'KJV',
        }
      : endpoint === 'outline'
      ? { reference: project.passage_ref, translation: 'KJV' }
      : {
          passage: project.passage_ref,
          translation: 'KJV',
          audience: project.audience,
          outline: outlineContent || undefined,
        }

    let accumulated = ''
    stopRef.current = streamAI(
      endpoint,
      body,
      (chunk) => {
        accumulated += chunk
        setContent(accumulated)
      },
      (err) => {
        if (err) setContent((prev) => prev + `\n\n[Error: ${err.message}]`)
        setStreaming(false)
        setPreview(true)
        save(accumulated)
      }
    )
  }, [project, sectionKey, section, save])

  const handleStop = () => { stopRef.current?.(); setStreaming(false); setPreview(true) }

  const handleExport = () => {
    if (!content) return
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.title.replace(/[^a-z0-9]/gi, '-')}-${sectionKey}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ChevronLeft size={12} /> {project.title.length > 20 ? project.title.slice(0, 20) + '…' : project.title}
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400">{section.label}</span>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 flex-wrap">
        <button
          onClick={streaming ? handleStop : generate}
          className={clsx(
            'flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
            streaming
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300'
              : 'bg-amber-600 hover:bg-amber-700 text-white'
          )}
        >
          {streaming ? <Square size={11} /> : <Send size={11} />}
          {streaming ? 'Stop' : content ? 'Regenerate' : 'Generate with AI'}
        </button>
        {content && (
          <>
            <button
              onClick={() => setPreview((v) => !v)}
              className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {preview ? 'Edit' : 'Preview'}
            </button>
            <button
              onClick={() => save(content)}
              disabled={saving}
              className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={handleExport} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <Download size={13} />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!content && !streaming && (
          <div className="p-6 text-center">
            <section.icon size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{section.label} for {project.passage_ref}</p>
            <p className="text-xs text-gray-400">Click "Generate with AI" to create this section, or start typing below.</p>
          </div>
        )}

        {(content || streaming) && (
          <div className="p-3">
            {preview ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={MD_COMPONENTS}>
                  {content}
                </ReactMarkdown>
                {streaming && <span className="animate-pulse">▌</span>}
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={() => content && save(content)}
                className="w-full h-full min-h-[300px] text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg p-3 focus:outline-none focus:border-blue-400 resize-none font-mono"
                placeholder="Start writing or generate with AI…"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Project Detail ─────────────────────────────────────────────
function ProjectDetail({ project, onBack }) {
  const [activeSection, setActiveSection] = useState(null)
  const qc = useQueryClient()

  const { mutate: deleteProject } = useMutation({
    mutationFn: () => api.deleteSermon(project.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sermons'] }); onBack() },
  })

  if (activeSection) {
    return <SectionEditor project={project} sectionKey={activeSection} onBack={() => setActiveSection(null)} />
  }

  const hasContent = (key) => project.sections.some((s) => s.section_type === key && s.content)

  function exportSermon() {
    const lines = [`# ${project.title}`, '', `> ${project.passage_ref} · ${project.audience}`, '']
    const sectionLabels = { full_sermon: 'Full Sermon', outline: 'Outline', illustrations: 'Illustrations', questions: 'Discussion Questions', applications: 'Applications' }
    for (const { section_type, content } of project.sections) {
      if (content) {
        lines.push(`## ${sectionLabels[section_type] || section_type}`, '', content, '')
      }
    }
    lines.push('---', `*Exported from LOGOS Sermon Builder on ${new Date().toLocaleDateString()}*`)
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.title.replace(/[^a-z0-9]/gi, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ChevronLeft size={12} /> All Sermons
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={exportSermon}
            className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
            title="Export as Markdown"
          >
            <Download size={13} />
          </button>
          <button
            onClick={() => window.confirm('Delete this sermon project?') && deleteProject()}
            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/40">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{project.title}</h2>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
          {project.passage_ref} · <span className="capitalize">{project.audience}</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="px-4 pt-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sections</p>
        <div className="divide-y divide-gray-100 dark:divide-gray-700 mt-1">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
            >
              <span className="flex items-center gap-2">
                <Icon size={14} className="text-amber-600 dark:text-amber-400" />
                <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
              </span>
              <span className={clsx(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                hasContent(key)
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
              )}>
                {hasContent(key) ? 'Done' : 'Empty'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────
export default function SermonBuilder() {
  const [view, setView] = useState('list') // list | new | detail
  const [selectedProject, setSelectedProject] = useState(null)

  if (view === 'new') {
    return (
      <NewProjectForm
        onCreated={(p) => { setSelectedProject(p); setView('detail') }}
        onCancel={() => setView('list')}
      />
    )
  }

  if (view === 'detail' && selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => { setSelectedProject(null); setView('list') }}
      />
    )
  }

  return (
    <ProjectList
      onSelect={(p) => { setSelectedProject(p); setView('detail') }}
      onNew={() => setView('new')}
    />
  )
}
