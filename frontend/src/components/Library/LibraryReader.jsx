import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ChevronLeft, ChevronRight, Library, Search, X } from 'lucide-react'
import { api } from '../../api/client'
import clsx from 'clsx'

const TABS = [
  { id: 'browse', label: 'Browse' },
  { id: 'search', label: 'Search' },
]

export default function LibraryReader() {
  const [tab, setTab] = useState('browse')
  const [selectedBook, setSelectedBook] = useState(null)
  const [pageNum, setPageNum] = useState(1)
  const [jumpInput, setJumpInput] = useState('')
  const [browseQ, setBrowseQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const { data: booksData, isLoading: loadingBooks } = useQuery({
    queryKey: ['library-books', categoryFilter],
    queryFn: () => api.getLibraryBooks(categoryFilter || undefined),
  })

  const { data: pageData, isLoading: loadingPage } = useQuery({
    queryKey: ['library-page', selectedBook?.id, pageNum],
    queryFn: () => api.getBookPage(selectedBook.id, pageNum),
    enabled: !!selectedBook,
  })

  const { data: tocData } = useQuery({
    queryKey: ['library-toc', selectedBook?.id],
    queryFn: () => api.getBookToc(selectedBook.id),
    enabled: !!selectedBook,
  })

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['library-search', searchQ],
    queryFn: () => api.searchLibrary(searchQ),
    enabled: searchQ.length >= 2,
  })

  const books = booksData?.books ?? []
  const categories = [...new Set(books.map((b) => b.category).filter(Boolean))]

  const filteredBooks = browseQ
    ? books.filter(
        (b) =>
          b.title.toLowerCase().includes(browseQ.toLowerCase()) ||
          (b.author && b.author.toLowerCase().includes(browseQ.toLowerCase()))
      )
    : books

  function openBook(book, page = 1) {
    setSelectedBook(book)
    setPageNum(page)
    setJumpInput('')
  }

  function closeBook() {
    setSelectedBook(null)
    setPageNum(1)
    setJumpInput('')
  }

  function handleJump(e) {
    e.preventDefault()
    const n = parseInt(jumpInput, 10)
    const max = selectedBook?.pages || 9999
    if (n >= 1 && n <= max) setPageNum(n)
    setJumpInput('')
  }

  const handleSearch = useCallback(
    (e) => {
      e.preventDefault()
      if (searchInput.trim().length >= 2) setSearchQ(searchInput.trim())
    },
    [searchInput]
  )

  // — Reader view —
  if (selectedBook) {
    return (
      <div className="flex flex-col h-full">
        <div className="panel-header">
          <button
            onClick={closeBook}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1"
          >
            <ChevronLeft size={12} />
            Back
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1 text-center mx-2">
            {selectedBook.title}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">
            {pageNum} / {selectedBook.pages || '—'}
          </span>
        </div>

        {/* TOC */}
        {tocData?.toc && tocData.toc.length > 0 && (
          <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                Table of Contents
              </summary>
              <div className="mt-1.5 space-y-0.5 max-h-40 overflow-y-auto">
                {tocData.toc.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => setPageNum(item.page)}
                    className={clsx(
                      'block w-full text-left px-2 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600',
                      item.page === pageNum && 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    )}
                    style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                  >
                    {item.title}
                    <span className="text-gray-400 ml-1">p.{item.page}</span>
                  </button>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* Page text */}
        <div className="flex-1 overflow-y-auto">
          {loadingPage ? (
            <div className="p-4 text-sm text-gray-400 text-center">Loading page…</div>
          ) : pageData ? (
            <div className="p-4">
              <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {pageData.text}
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-gray-400 text-center">Page not available</div>
          )}
        </div>

        {/* Navigation bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={() => setPageNum(Math.max(1, pageNum - 1))}
            disabled={pageNum <= 1}
            className="flex items-center gap-0.5 text-xs text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ChevronLeft size={14} />
            Prev
          </button>

          {/* Jump to page */}
          <form onSubmit={handleJump} className="flex-1 flex items-center justify-center">
            <input
              type="number"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder={String(pageNum)}
              min={1}
              max={selectedBook.pages || undefined}
              className="w-16 text-center text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-400"
            />
          </form>

          <button
            onClick={() => setPageNum(pageNum + 1)}
            disabled={!!(selectedBook.pages && pageNum >= selectedBook.pages)}
            className="flex items-center gap-0.5 text-xs text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  // — Browse / Search view —
  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex items-center gap-1.5">
          <Library size={13} />
          Library
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
          {books.length} books
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex-1 text-xs py-1.5 font-medium transition-colors',
              tab === id
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Browse tab */}
      {tab === 'browse' && (
        <>
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 space-y-2">
            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1">
              <Search size={12} className="text-gray-400 flex-shrink-0" />
              <input
                value={browseQ}
                onChange={(e) => setBrowseQ(e.target.value)}
                placeholder="Filter by title or author…"
                className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
              />
              {browseQ && (
                <button onClick={() => setBrowseQ('')}>
                  <X size={10} className="text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCategoryFilter('')}
                  className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded-full border transition-colors',
                    !categoryFilter
                      ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                      : 'text-gray-500 border-gray-300 hover:border-gray-400 dark:border-gray-600'
                  )}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                    className={clsx(
                      'text-[10px] px-1.5 py-0.5 rounded-full border transition-colors',
                      categoryFilter === cat
                        ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
                        : 'text-gray-500 border-gray-300 hover:border-gray-400 dark:border-gray-600'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingBooks && (
              <div className="p-4 text-sm text-gray-400 text-center">Loading…</div>
            )}
            {!loadingBooks && filteredBooks.length === 0 && (
              <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
                <Library size={24} className="mx-auto mb-2 opacity-30" />
                <p>{browseQ ? 'No books match your search.' : 'No books in the library yet.'}</p>
              </div>
            )}
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredBooks.map((book) => (
                <button
                  key={book.id}
                  onClick={() => book.available && openBook(book)}
                  disabled={!book.available}
                  className={clsx(
                    'w-full text-left px-4 py-3 transition-colors',
                    book.available
                      ? 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <BookOpen size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {book.title}
                      </p>
                      {book.author && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{book.author}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {book.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                            {book.category}
                          </span>
                        )}
                        {book.pages && (
                          <span className="text-[10px] text-gray-400">{book.pages} pages</span>
                        )}
                        {!book.available && (
                          <span className="text-[10px] text-orange-500">Unavailable</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Search tab */}
      {tab === 'search' && (
        <>
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <form onSubmit={handleSearch} className="flex gap-1.5">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search across all 97 books…"
                className="flex-1 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
              />
              <button
                type="submit"
                disabled={searchInput.trim().length < 2}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded px-2 py-1.5 transition-colors"
              >
                <Search size={12} />
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!searchQ && (
              <div className="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">
                Search across all pre-extracted library content — commentaries, theology, devotionals, and more.
              </div>
            )}
            {searchLoading && (
              <div className="p-4 text-sm text-gray-400 text-center">Searching…</div>
            )}
            {searchData && searchData.results.length === 0 && (
              <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
                No results for "{searchQ}"
              </div>
            )}
            {searchData?.results && searchData.results.length > 0 && (
              <div>
                <p className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  {searchData.count} result{searchData.count !== 1 ? 's' : ''} for "{searchData.query}"
                </p>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {searchData.results.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const book = books.find((b) => b.id === result.book_id)
                        if (book) openBook(book, result.page_num)
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <BookOpen size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
                            {result.title}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">
                            {result.category} · p.{result.page_num}
                          </p>
                          <p
                            className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: result.snippet }}
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
