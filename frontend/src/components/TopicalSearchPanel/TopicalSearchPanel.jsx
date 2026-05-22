import { useCallback, useRef, useState } from 'react'
import { BookMarked, Search, Square, TrendingUp, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useStudyStore } from '../../stores/studyStore'
import { streamAI } from '../../api/streamAI'
import clsx from 'clsx'

const TOPIC_CATEGORIES = [
  {
    label: 'Salvation',
    color: 'blue',
    topics: ['Grace', 'Faith', 'Redemption', 'Forgiveness', 'Atonement', 'Justification', 'Repentance'],
  },
  {
    label: 'Christian Life',
    color: 'green',
    topics: ['Prayer', 'Worship', 'Love', 'Hope', 'Peace', 'Joy', 'Obedience', 'Discipleship'],
  },
  {
    label: 'Theology',
    color: 'purple',
    topics: ['Trinity', 'Covenant', 'Prophecy', 'Resurrection', 'Holy Spirit', 'Kingdom of God'],
  },
  {
    label: 'Ethics',
    color: 'amber',
    topics: ['Justice', 'Humility', 'Wisdom', 'Stewardship', 'Marriage', 'Suffering', 'Forgiveness'],
  },
]

const RELATED_MAP = {
  Grace: ['Faith', 'Forgiveness', 'Justification', 'Redemption'],
  Faith: ['Grace', 'Hope', 'Trust', 'Salvation'],
  Forgiveness: ['Grace', 'Repentance', 'Atonement', 'Love'],
  Redemption: ['Atonement', 'Grace', 'Salvation', 'Covenant'],
  Prayer: ['Worship', 'Faith', 'Holy Spirit', 'Obedience'],
  Love: ['Grace', 'Forgiveness', 'Joy', 'Obedience'],
  Hope: ['Faith', 'Resurrection', 'Peace', 'Joy'],
  Resurrection: ['Hope', 'Kingdom of God', 'Atonement', 'Salvation'],
  Covenant: ['Redemption', 'Kingdom of God', 'Prophecy', 'Grace'],
  Wisdom: ['Humility', 'Prayer', 'Obedience', 'Stewardship'],
}

const DEPTHS = [
  { value: 'overview', label: 'Overview' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'comprehensive', label: 'Full' },
]

const FACTBOOK_THEMES = new Set([
  'grace', 'faith', 'love', 'hope', 'prayer', 'worship', 'covenant',
  'resurrection', 'holy spirit', 'trinity', 'kingdom of god', 'atonement',
  'forgiveness', 'redemption', 'salvation', 'prophecy', 'wisdom', 'justice',
])

const MARKDOWN_COMPONENTS = {
  h1: (p) => <h3 className="text-base font-semibold mt-3 mb-1 text-indigo-700 dark:text-indigo-300" {...p} />,
  h2: (p) => <h4 className="text-sm font-semibold mt-3 mb-1 text-indigo-600 dark:text-indigo-400 border-b border-indigo-100 dark:border-indigo-900 pb-0.5" {...p} />,
  h3: (p) => <h5 className="text-sm font-semibold mt-2 mb-0.5" {...p} />,
  p: (p) => <p className="my-1 leading-relaxed" {...p} />,
  ul: (p) => <ul className="list-disc ml-5 my-1 space-y-0.5" {...p} />,
  ol: (p) => <ol className="list-decimal ml-5 my-1 space-y-0.5" {...p} />,
  blockquote: (p) => (
    <blockquote
      className="border-l-2 border-indigo-300 dark:border-indigo-700 pl-3 my-1 italic text-gray-600 dark:text-gray-300"
      {...p}
    />
  ),
  strong: (p) => <strong className="font-semibold text-gray-900 dark:text-gray-100" {...p} />,
  code: ({ inline, ...rest }) =>
    inline ? (
      <code className="px-1 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 text-[0.85em] font-mono" {...rest} />
    ) : (
      <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded my-2 text-xs overflow-x-auto">
        <code {...rest} />
      </pre>
    ),
  a: (p) => <a className="text-blue-600 dark:text-blue-400 underline" {...p} />,
}

function categoryColorClasses(color) {
  const map = {
    blue: {
      badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      chip: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 border-blue-200 dark:border-blue-800',
    },
    green: {
      badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      chip: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800',
    },
    purple: {
      badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      chip: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 border-purple-200 dark:border-purple-800',
    },
    amber: {
      badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      chip: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 border-amber-200 dark:border-amber-800',
    },
  }
  return map[color] || map.blue
}

export default function TopicalSearchPanel() {
  const { setRightPanel } = useStudyStore()
  const [searchInput, setSearchInput] = useState('')
  const [activeTopic, setActiveTopic] = useState(null)
  const [depth, setDepth] = useState('overview')
  const [content, setContent] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const stopRef = useRef(null)
  const bottomRef = useRef(null)

  const startStudy = useCallback((topic, studyDepth = depth) => {
    if (!topic.trim()) return
    stopRef.current?.()
    setActiveTopic(topic)
    setContent('')
    setError(null)
    setStreaming(true)

    stopRef.current = streamAI(
      'topic-study',
      { topic, depth: studyDepth },
      (chunk) => {
        setContent((prev) => prev + chunk)
        // Scroll to bottom as content arrives
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        })
      },
      (err) => {
        if (err) setError(err.message || String(err))
        setStreaming(false)
      }
    )
  }, [depth])

  function handleSearch(e) {
    e.preventDefault()
    if (searchInput.trim()) startStudy(searchInput.trim())
  }

  function handleStop() {
    stopRef.current?.()
    setStreaming(false)
  }

  function handleClear() {
    stopRef.current?.()
    setActiveTopic(null)
    setContent('')
    setError(null)
    setStreaming(false)
    setSearchInput('')
  }

  function handleRelatedTopic(topic) {
    setSearchInput(topic)
    startStudy(topic)
  }

  function handleViewFactbook() {
    setRightPanel('factbook')
  }

  const hasFactbookEntry = activeTopic && FACTBOOK_THEMES.has(activeTopic.toLowerCase())
  const relatedTopics = activeTopic
    ? (RELATED_MAP[activeTopic] || RELATED_MAP[activeTopic?.charAt(0).toUpperCase() + activeTopic?.slice(1).toLowerCase()] || [])
    : []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <TrendingUp size={13} />
          Topical Study
        </span>
        {activeTopic && (
          <button
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSearch} className="flex gap-1.5">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="What does the Bible say about…"
            disabled={streaming}
            className="flex-1 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400 disabled:bg-gray-50 dark:disabled:bg-gray-900"
          />
          {streaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded px-2 py-1.5 transition-colors"
              title="Stop"
            >
              <Square size={12} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!searchInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded px-2 py-1.5 transition-colors"
            >
              <Search size={12} />
            </button>
          )}
        </form>

        {/* Depth selector */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Depth:</span>
          <div className="flex gap-1">
            {DEPTHS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDepth(value)}
                disabled={streaming}
                className={clsx(
                  'text-[10px] px-2 py-0.5 rounded-full transition-colors',
                  depth === value
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Browse categories when no active topic */}
        {!activeTopic && (
          <div className="p-3 space-y-4">
            {TOPIC_CATEGORIES.map(({ label, color, topics }) => {
              const colors = categoryColorClasses(color)
              return (
                <div key={label}>
                  <span className={clsx('text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full', colors.badge)}>
                    {label}
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {topics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => { setSearchInput(topic); startStudy(topic) }}
                        className={clsx(
                          'text-xs px-2.5 py-1 rounded-full border transition-colors',
                          colors.chip
                        )}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Active topic study */}
        {activeTopic && (
          <div className="p-3">
            {/* Topic header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {activeTopic}
                </h3>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">
                  {depth} study
                  {streaming && <span className="ml-1.5 text-indigo-500">• generating…</span>}
                </span>
              </div>
              {hasFactbookEntry && !streaming && (
                <button
                  onClick={handleViewFactbook}
                  className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors border border-amber-200 dark:border-amber-800 rounded px-1.5 py-0.5"
                  title="View Factbook entry"
                >
                  <BookMarked size={10} />
                  Factbook
                </button>
              )}
            </div>

            {/* Error state */}
            {error && (
              <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Streaming content */}
            {content && (
              <div className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  components={MARKDOWN_COMPONENTS}
                >
                  {content}
                </ReactMarkdown>
                {streaming && <span className="animate-pulse text-indigo-500">▌</span>}
              </div>
            )}

            {/* Related topics (shown after streaming completes) */}
            {!streaming && relatedTopics.length > 0 && (
              <div className="mt-5 pt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-2">Related topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {relatedTopics.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => handleRelatedTopic(topic)}
                      className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 transition-colors"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
