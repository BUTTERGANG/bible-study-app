import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Send, Square, Copy, Download, BookOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useStudyStore } from '../../stores/studyStore'
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

const MARKDOWN_COMPONENTS = {
  h1: (p) => <h3 className="text-base font-semibold mt-2 mb-1" {...p} />,
  h2: (p) => <h4 className="text-sm font-semibold mt-2 mb-1" {...p} />,
  h3: (p) => <h5 className="text-sm font-semibold mt-1.5 mb-0.5" {...p} />,
  p: (p) => <p className="my-1 leading-relaxed" {...p} />,
  ul: (p) => <ul className="list-disc ml-5 my-1 space-y-0.5" {...p} />,
  ol: (p) => <ol className="list-decimal ml-5 my-1 space-y-0.5" {...p} />,
  blockquote: (p) => (
    <blockquote
      className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 my-1 italic text-gray-600 dark:text-gray-300"
      {...p}
    />
  ),
  code: ({ inline, ...rest }) =>
    inline ? (
      <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-[0.85em] font-mono" {...rest} />
    ) : (
      <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded my-2 text-xs overflow-x-auto">
        <code {...rest} />
      </pre>
    ),
  a: (p) => <a className="text-blue-600 dark:text-blue-400 underline" {...p} />,
}

export default function SermonAssistant() {
  const { book, chapter, verse, selectedVerseText, translation } = useStudyStore()
  const qc = useQueryClient()
  const [audience, setAudience] = useState('general')
  const [keyThemes, setKeyThemes] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef(null)
  const stopRef = useRef(null)

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`

  const chapterText = useMemo(() => {
    const cache = qc.getQueryData(['chapter', translation, book, chapter])
    return cache?.verses?.map((v) => `${v.verse}. ${v.text}`).join('\n') || ''
  }, [qc, translation, book, chapter])

  const themesList = useMemo(
    () => keyThemes.split(',').map((t) => t.trim()).filter(Boolean),
    [keyThemes]
  )

  const doStream = useCallback(() => {
    setGeneratedContent('')
    setStreaming(true)

    const body = {
      passage: reference,
      audience,
      translation,
      key_themes: themesList.length > 0 ? themesList : undefined,
      verse_text: selectedVerseText || undefined,
      chapter_text: chapterText || undefined,
    }

    stopRef.current = streamAI(
      'sermon',
      body,
      (chunk) => setGeneratedContent((prev) => prev + chunk),
      (err) => {
        if (err) {
          setGeneratedContent((prev) => prev + `\n\n[Error: ${err.message}]`)
        }
        setStreaming(false)
      }
    )
  }, [reference, audience, translation, themesList, selectedVerseText, chapterText])

  const handleStop = useCallback(() => {
    stopRef.current?.()
    setStreaming(false)
  }, [])

  useEffect(() => () => stopRef.current?.(), [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [generatedContent])

  const handleCopy = useCallback(async () => {
    if (!generatedContent) return
    await navigator.clipboard.writeText(generatedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generatedContent])

  const handleExportMarkdown = useCallback(() => {
    if (!generatedContent) return
    const blob = new Blob([generatedContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sermon-${reference.replace(/[:\s]+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [generatedContent, reference])

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <BookOpen size={13} />
          Sermon Assistant
        </span>
      </div>

      <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/40 space-y-2">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Passage: <strong>{reference}</strong> ({translation})
        </p>

        <div className="flex gap-2 items-center">
          <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Audience:</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            disabled={streaming}
            className="text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 flex-1"
          >
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 items-center">
          <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Themes:</label>
          <input
            value={keyThemes}
            onChange={(e) => setKeyThemes(e.target.value)}
            placeholder="comma-separated (optional)"
            disabled={streaming}
            className="text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded px-2 py-1 flex-1"
          />
        </div>

        <button
          onClick={streaming ? handleStop : doStream}
          className={clsx(
            'w-full flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 transition-colors',
            streaming
              ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
              : 'bg-amber-600 hover:bg-amber-700 text-white'
          )}
        >
          {streaming ? <Square size={12} /> : <Send size={12} />}
          {streaming ? 'Stop Generating' : 'Generate Sermon'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!generatedContent && !streaming && (
          <div className="text-center py-8">
            <BookOpen size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Generate a complete sermon from Scripture
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Includes outline, illustrations, discussion questions, and more
            </p>
          </div>
        )}

        {generatedContent && (
          <div className="relative">
            <div className="flex gap-2 mb-3 sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm py-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <Copy size={11} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <Download size={11} />
                Export .md
              </button>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={MARKDOWN_COMPONENTS}
              >
                {generatedContent}
              </ReactMarkdown>
              {streaming && <span className="animate-pulse">▌</span>}
            </div>
          </div>
        )}

        {streaming && !generatedContent && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-3" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Generating sermon…</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
