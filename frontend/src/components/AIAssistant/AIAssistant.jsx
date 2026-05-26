import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Library, MessageSquare, Send, Square } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useStudyStore } from '../../stores/studyStore'
import { useStreamingAI } from '../../hooks/useStreamingAI'
import { api } from '../../api/client'
import clsx from 'clsx'

const SUGGESTED_PROMPTS = [
  'What is the main theme of this chapter?',
  'Explain the historical context of this passage.',
  'What are the key theological truths here?',
  'How does this connect to the rest of Scripture?',
  'What practical lessons can I apply today?',
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

/** Serialize messages to what the API stores (strip transient state like error flags). */
function serializeMessages(msgs) {
  return msgs.map((m) => ({ role: m.role, content: m.content }))
}

export default function AIAssistant() {
  const { book, chapter, verse, selectedVerseText, translation, aiHistory, setAiHistory, clearAiHistory } = useStudyStore()
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [includeLibrary, setIncludeLibrary] = useState(true)
  const bottomRef = useRef(null)
  const saveTimer = useRef(null)
  const restoringRef = useRef(null)

  const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`
  const chapterKey = useMemo(() => `${translation}/${book}/${chapter}`, [translation, book, chapter])

  const messages = aiHistory[chapterKey] || []
  const setMessages = useCallback((updater) => {
    setAiHistory(chapterKey, typeof updater === 'function' ? updater(aiHistory[chapterKey] || []) : updater)
  }, [chapterKey, aiHistory, setAiHistory])

  // Restore conversation from backend on chapter change
  useEffect(() => {
    let cancelled = false
    restoringRef.current = true

    api.getConversation(chapterKey)
      .then((conv) => {
        if (cancelled) return
        if (conv?.messages?.length > 0) {
          setAiHistory(chapterKey, conv.messages)
        }
      })
      .catch(() => {
        // 404 = no conversation saved yet — that's fine
      })
      .finally(() => {
        if (!cancelled) restoringRef.current = false
      })

    return () => { cancelled = true }
  }, [chapterKey, setAiHistory])

  // Debounced auto-save to backend whenever messages change
  useEffect(() => {
    if (restoringRef.current) return
    if (messages.length === 0) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      api.saveConversation(chapterKey, {
        translation,
        book,
        chapter,
        messages: serializeMessages(messages),
        title: messages[0]?.role === 'user' ? messages[0].content.slice(0, 100) : undefined,
      }).catch(() => {}) // silent fail — localStorage fallback covers it
    }, 2000)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [messages, chapterKey, translation, book, chapter])

  // Build a single context-aware payload factory for the streaming hook.
  const bodyFor = useCallback(
    (prompt, history) => {
      const chapterCache = qc.getQueryData(['chapter', translation, book, chapter])
      const chapterText = chapterCache?.verses
        ?.map((v) => `${v.verse}. ${v.text}`)
        .join('\n') || ''
      return {
        question: prompt,
        reference,
        translation,
        verse_text: selectedVerseText || undefined,
        chapter_text: chapterText || undefined,
        conversation_history: history,
        include_library_context: includeLibrary,
      }
    },
    [qc, translation, book, chapter, reference, selectedVerseText, includeLibrary]
  )

  const { streaming, send, stop, clear } = useStreamingAI('ask', bodyFor, messages, setMessages)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleClear() {
    clear()
    clearAiHistory(chapterKey)
    api.deleteConversation(chapterKey).catch(() => {})
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!input.trim() || streaming) return
    send(input)
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <MessageSquare size={13} />
          AI Study Assistant
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIncludeLibrary((v) => !v)}
            title={includeLibrary ? 'Library context on — click to disable' : 'Library context off — click to enable'}
            className={clsx(
              'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border transition-colors',
              includeLibrary
                ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700'
                : 'text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400'
            )}
          >
            <Library size={9} />
            {includeLibrary ? 'Library on' : 'Library off'}
          </button>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/40">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Studying: <strong>{reference}</strong> ({translation})
        </p>
        {selectedVerseText && (
          <p className="text-xs text-blue-600 dark:text-blue-300/80 mt-0.5 italic line-clamp-2">
            &ldquo;{selectedVerseText}&rdquo;
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
              Ask anything about {reference}
            </p>
            <div className="space-y-1.5">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 transition-colors border border-gray-200 hover:border-blue-200 dark:bg-gray-700 dark:hover:bg-blue-900/30 dark:text-gray-300 dark:hover:text-blue-300 dark:border-gray-600 dark:hover:border-blue-700"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={clsx(
              'text-sm rounded-lg px-3 py-2',
              msg.role === 'user'
                ? 'bg-blue-600 text-white ml-4'
                : msg.error
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 mr-2 border border-red-200 dark:border-red-800'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 mr-2'
            )}
          >
            {msg.role === 'assistant' && !msg.error ? (
              <>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={MARKDOWN_COMPONENTS}>
                  {msg.content}
                </ReactMarkdown>
                {streaming && i === messages.length - 1 && (
                  <span className="animate-pulse">&boxv;</span>
                )}
              </>
            ) : msg.error ? (
              <>
                <p className="font-medium mb-0.5">AI request failed</p>
                <p className="text-xs">{msg.error}</p>
              </>
            ) : (
              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={streaming}
            className="flex-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 disabled:bg-gray-50 dark:disabled:bg-gray-900"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg p-2 transition-colors"
              title="Stop"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg p-2 transition-colors"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}