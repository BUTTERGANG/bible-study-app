import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { OT_BOOKS, NT_BOOKS } from '../../api/bibleData'
import { useStudyStore } from '../../stores/studyStore'
import clsx from 'clsx'

export default function Sidebar() {
  const { book: activeBook, chapter: activeChapter, setReference } = useStudyStore()
  const [expanded, setExpanded] = useState({ OT: true, NT: true })
  const [selectedBook, setSelectedBook] = useState(activeBook)

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

  return (
    <div className="text-sm">
      <BookSection
        label="Old Testament"
        books={OT_BOOKS}
        expanded={expanded.OT}
        onToggle={() => toggleSection('OT')}
        selectedBook={selectedBook}
        activeBook={activeBook}
        activeChapter={activeChapter}
        onSelectBook={selectBook}
        onSelectChapter={selectChapter}
      />
      <BookSection
        label="New Testament"
        books={NT_BOOKS}
        expanded={expanded.NT}
        onToggle={() => toggleSection('NT')}
        selectedBook={selectedBook}
        activeBook={activeBook}
        activeChapter={activeChapter}
        onSelectBook={selectBook}
        onSelectChapter={selectChapter}
      />
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
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 hover:bg-gray-100"
      >
        {label}
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && books.map((book) => (
        <div key={book.name}>
          <button
            onClick={() => onSelectBook(book.name)}
            className={clsx(
              'w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 flex items-center justify-between',
              activeBook === book.name
                ? 'text-blue-700 font-semibold bg-blue-50'
                : 'text-gray-700'
            )}
          >
            {book.name}
            {selectedBook === book.name
              ? <ChevronDown size={12} className="text-gray-400" />
              : <ChevronRight size={12} className="text-gray-300" />
            }
          </button>

          {selectedBook === book.name && (
            <div className="grid grid-cols-6 gap-0.5 px-2 pb-2 bg-gray-50">
              {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => (
                <button
                  key={ch}
                  onClick={() => onSelectChapter(book.name, ch)}
                  className={clsx(
                    'text-xs py-1 rounded text-center hover:bg-blue-100 transition-colors',
                    activeBook === book.name && activeChapter === ch
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-gray-600'
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
