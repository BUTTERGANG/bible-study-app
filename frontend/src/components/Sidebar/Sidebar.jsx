import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Compass, Library, MessageSquare, Search as SearchIcon, StickyNote, Trash2, Users, X } from 'lucide-react'
import { OT_BOOKS, NT_BOOKS } from '../../api/bibleData'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

function useConversations() {
  return useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => api.listConversations(50, 0),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

export default function Sidebar() {
  const { book: activeBook, chapter: activeChapter, translation, setReference, setRightPanel, rightPanel, rightPanelOpen } = useStudyStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [expanded, setExpanded] = useState({ OT: true, NT: true, APO: false, conversations: false })
  const [selectedBook, setSelectedBook] = useState(activeBook)
  const convQuery = useConversations()


  useEffect(() => {
    setSelectedBook(activeBook)
  }, [activeBook])

  const { data: transData } = useQuery({
    queryKey: ['translation-books', translation],
    queryFn: () => api.getTranslationBooks(translation),
    staleTime: Infinity,
  })

  const availableBooks = transData?.books
  const otBooks = availableBooks
    ? availableBooks.filter((b) => b.testament === 'OT')
    : OT_BOOKS
  const ntBooks = availableBooks
    ? availableBooks.filter((b) => b.testament === 'NT')
    : NT_BOOKS
  const apoBooks = availableBooks
    ? availableBooks.filter((b) => b.testament === 'APO')
    : []

  function toggleSection(sect) {
    setExpanded((e) => ({ ...e, [sect]: !e[sect] }))
  }

  function selectBook(bookName) {
    setSelectedBook(bookName === selectedBook ? null : bookName)
  }

  function selectChapter(bookName, ch) {
    setReference(bookName, ch)
    setSelectedBook(bookName)
  }

  const navigateToConversation = useCallback((conv) => {
    setReference(conv.book, conv.chapter)
    setRightPanel('ai')
  }, [setReference, setRightPanel])

  const handleDeleteConversation = useCallback(async (e, ref) => {
    e.stopPropagation()
    try {
      await api.deleteConversation(ref)
      convQuery.refetch()
    } catch {}
  }, [convQuery])

  const conversations = convQuery.data?.conversations?.filter((c) => c.message_count > 0) || []

  function QuickAction({ icon: Icon, label, panel, onClick, active }) {
    const handleClick = onClick || (() => setRightPanel(panel))
    return (
      <button
        onClick={handleClick}
        className={clsx(
          'w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors',
          active
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-slate-300'
        )}
      >
        <Icon size={14} className={active ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'} />
        <span className="font-medium">{label}</span>
      </button>
    )
  }

  return (
    <div className="text-sm">
      {/* Quick Actions */}
      <div>
        <div className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider bg-gray-50 dark:bg-slate-900">
          Quick Actions
        </div>
        <QuickAction icon={StickyNote} label="Notes" panel="notes" active={rightPanelOpen && rightPanel === 'notes'} />
        <QuickAction icon={Library} label="Library" panel="library" active={rightPanelOpen && rightPanel === 'library'} />
        <QuickAction icon={Users} label="Groups" panel="groups" active={rightPanelOpen && rightPanel === 'groups'} />
        <QuickAction
          icon={Compass}
          label="Browse"
          onClick={() => navigate('/browse')}
          active={location.pathname.startsWith('/browse')}
        />
      </div>
      <div className="h-px bg-gray-200 dark:bg-white/10 mx-2" />

      <BookSection
        label="Old Testament"
        books={otBooks}
        expanded={expanded.OT}
        onToggle={() => toggleSection('OT')}
        selectedBook={selectedBook}
        activeBook={activeBook}
        activeChapter={activeChapter}
        onSelectBook={selectBook}
        onSelectChapter={selectChapter}
      />
      {apoBooks.length > 0 && (
        <BookSection
          label="Apocrypha"
          books={apoBooks}
          expanded={expanded.APO}
          onToggle={() => toggleSection('APO')}
          selectedBook={selectedBook}
          activeBook={activeBook}
          activeChapter={activeChapter}
          onSelectBook={selectBook}
          onSelectChapter={selectChapter}
        />
      )}
      <BookSection
        label="New Testament"
        books={ntBooks}
        expanded={expanded.NT}
        onToggle={() => toggleSection('NT')}
        selectedBook={selectedBook}
        activeBook={activeBook}
        activeChapter={activeChapter}
        onSelectBook={selectBook}
        onSelectChapter={selectChapter}
      />

      {/* AI Conversations section */}
      <div>
        <button
          onClick={() => toggleSection('conversations')}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800"
        >
          <span className="flex items-center gap-1.5">
            <MessageSquare size={12} />
            AI History
          </span>
          {expanded.conversations ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {expanded.conversations && (
          <div className="max-h-60 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-400 dark:text-slate-500 text-center italic">
                No saved conversations
              </p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.reference}
                onClick={() => navigateToConversation(conv)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-between gap-1 group"
              >
                <span className="truncate flex-1">
                  <span className="text-gray-700 dark:text-slate-300">
                    {conv.title
                      ? conv.title.length > 30
                        ? conv.title.slice(0, 30) + '…'
                        : conv.title
                      : conv.reference}
                  </span>
                  <span className="text-gray-400 dark:text-slate-500 ml-1">
                    ({conv.message_count})
                  </span>
                </span>
                <Trash2
                  size={12}
                  onClick={(e) => handleDeleteConversation(e, conv.reference)}
                  className="text-gray-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BookSection({
  label, books, expanded, onToggle,
  selectedBook, activeBook, activeChapter,
  onSelectBook, onSelectChapter,
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800"
      >
        {label}
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && books.map((book) => (
        <div key={book.name}>
          <button
            onClick={() => onSelectBook(book.name)}
            className={clsx(
              'w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-between',
              activeBook === book.name
                ? 'text-blue-700 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-700 dark:text-slate-300'
            )}
          >
            {book.name}
            {selectedBook === book.name
              ? <ChevronDown size={12} className="text-gray-400" />
              : <ChevronRight size={12} className="text-gray-300 dark:text-slate-500" />
            }
          </button>

          {selectedBook === book.name && (
            <div className="grid grid-cols-6 gap-0.5 px-2 pb-2 bg-gray-50 dark:bg-slate-800/60">
              {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => (
                <button
                  key={ch}
                  onClick={() => onSelectChapter(book.name, ch)}
                  className={clsx(
                    'text-xs py-1 rounded text-center hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors',
                    activeBook === book.name && activeChapter === ch
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-gray-600 dark:text-slate-400'
                  )}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
