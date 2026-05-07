import { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare, Lightbulb, BookOpen, Layers } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { streamAI } from '../../api/client'
import clsx from 'clsx'

const SUGGESTED_PROMPTS = [
  'What is the main theme of this chapter?',
  'Explain the historical context of this passage.',
  'What are the key theological truths here?',
  'How does this connect to the rest of Scripture?',
  'What practical lessons can I apply today?',
]

export default function AIAssistant() {
  const { book, chapter, verse, selectedVerseText, translation } = useStudyStore()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)
  const stopRef = useRef(null)

  const reference = verse
    ? `${book} ${chapter}:${verse}`
    : `${book} ${chapter}`

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function sendMessage(text) {
    if (!text.trim() || streaming) return

    const userMsg = { role: 'user', content: text }
    const aiMsg = { role: 'assistant', content: '' }
    setMessages((prev) => [...prev, userMsg, aiMsg])
    setInput('')
    setStreaming(true)

    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    stopRef.current = streamAI(
      'ask',
      {
        question: text,
        reference,
        translation,
        verse_text: selectedVerseText || undefined,
        conversation_history: history,
      },
      (chunk) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
        })
      },
      () => setStreaming(false)
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    sendMessage(input)
  }

  function clearChat() {
    setMessages([])
    if (stopRef.current) stopRef.current()
    setStreaming(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <MessageSquare size={13} />
          AI Study Assistant
        </span>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Context badge */}
      <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
        <p className="text-xs text-blue-700">
          📖 Studying: <strong>{reference}</strong> ({translation})
        </p>
        {selectedVerseText && (
          <p className="text-xs text-blue-600 mt-0.5 italic line-clamp-2">
            "{selectedVerseText}"
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div>
            <p className="text-xs text-gray-500 text-center mb-3">
              Ask anything about {reference}
            </p>
            <div className="space-y-1.5">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 transition-colors border border-gray-200 hover:border-blue-200"
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
                : 'bg-gray-100 text-gray-800 mr-2'
            )}
          >
            <div className="whitespace-pre-wrap leading-relaxed">
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                <span className="animate-pulse">▌</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={streaming}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg p-2 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}
