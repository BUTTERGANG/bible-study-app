import { getAppPassword } from './auth'

const BASE = '/api'

function authHeaders() {
  const pw = getAppPassword()
  return pw ? { Authorization: `Bearer ${pw}` } : {}
}

async function request(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
      ...authHeaders(),
    },
  })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const j = await res.json()
      if (j?.detail) detail = j.detail
    } catch {}
    const err = new Error(detail)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

const get = (path) => request(path)
const del = (path) => request(path, { method: 'DELETE' })
const post = (path, body) =>
  request(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
const put = (path, body) =>
  request(path, { method: 'PUT', body: JSON.stringify(body ?? {}) })

export const api = {
  // Health / auth
  getHealth: () => get('/health'),
  getAuthStatus: () => get('/auth/status'),

  // Bible
  getBooks: () => get('/bible/books'),
  getTranslations: () => get('/bible/translations'),
  getTranslationBooks: (translation) =>
    get(`/bible/translations/${encodeURIComponent(translation)}/books`),
  getChapter: (translation, book, chapter) =>
    get(`/bible/${encodeURIComponent(translation)}/${encodeURIComponent(book)}/${chapter}`),
  getVerse: (translation, book, chapter, verse) =>
    get(`/bible/${encodeURIComponent(translation)}/${encodeURIComponent(book)}/${chapter}/${verse}`),
  compareTranslations: (book, chapter, verse, translations) =>
    get(
      `/bible/compare-translations/${encodeURIComponent(book)}/${chapter}/${verse}` +
        `?translations=${encodeURIComponent(translations)}`
    ),

  // Commentary
  getCommentarySources: () => get('/commentary/sources'),
  getVerseCommentary: (book, chapter, verse, sources) => {
    const params = new URLSearchParams()
    if (sources) params.set('sources', sources)
    const qs = params.toString()
    return get(`/commentary/${encodeURIComponent(book)}/${chapter}/${verse}${qs ? '?' + qs : ''}`)
  },

  // Notes — verse is optional (chapter-level notes have no verse).
  // Omit book/chapter to get all notes. Pass tag to filter by tag.
  getNotes: (book, chapter, verse, tag) => {
    const params = new URLSearchParams()
    if (book != null) params.set('book', book)
    if (chapter != null) params.set('chapter', String(chapter))
    if (verse != null) params.set('verse', String(verse))
    if (tag != null) params.set('tag', tag)
    return get(`/notes?${params}`)
  },
  getAllNotes: (tag) => {
    const params = new URLSearchParams()
    if (tag != null) params.set('tag', tag)
    return get(`/notes?${params}`)
  },
  createNote: (data) => post('/notes', data),
  updateNote: (id, data) => put(`/notes/${id}`, data),
  deleteNote: (id) => del(`/notes/${id}`),

  // Highlights
  getHighlights: (book, chapter, translation) =>
    get(
      `/highlights/${encodeURIComponent(book)}/${chapter}` +
        `?translation=${encodeURIComponent(translation)}`
    ),
  createHighlight: (data) => post('/highlights', data),
  deleteHighlight: (id) => del(`/highlights/${id}`),

  // Bookmarks
  getBookmarks: () => get('/bookmarks'),
  createBookmark: (data) => post('/bookmarks', data),
  deleteBookmark: (id) => del(`/bookmarks/${id}`),

  // Search
  search: (q, scope = 'bible', translation = 'KJV') => {
    const params = new URLSearchParams({ q, scope, translation })
    return get(`/search?${params}`)
  },

  // Word study
  getVerseWords: (book, chapter, verse) =>
    get(`/word-study/${encodeURIComponent(book)}/${chapter}/${verse}`),
  getStrongsEntry: (num) => get(`/lexicon/strongs/${num}`),
  getStrongsOccurrences: (num) => get(`/lexicon/occurrences/${num}`),

  // Reading plans
  getBuiltInPlans: () => get('/reading-plans/built-in'),
  getPlans: () => get('/reading-plans'),
  startPlan: (data) => post('/reading-plans/start', data),
  getTodayReadings: () => get('/reading-plans/today'),
  completeReading: (planId, reference) =>
    post(`/reading-plans/${planId}/complete?reference=${encodeURIComponent(reference)}`),

  // Library
  getLibraryBooks: (category) =>
    get(`/library/books${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  getBookPage: (id, page) => get(`/library/books/${id}/page/${page}`),
  getBookToc: (id) => get(`/library/books/${id}/toc`),

  // Interlinear
  getChapterInterlinear: (translation, book, chapter) =>
    get(`/bible/${encodeURIComponent(translation)}/${encodeURIComponent(book)}/${chapter}/interlinear`),

  // Dictionary
  searchDictionary: (q, source) => {
    const params = new URLSearchParams({ q })
    if (source) params.set('source', source)
    return get(`/dictionary/search?${params}`)
  },
  getDictionaryEntry: (source, term) =>
    get(`/dictionary/${source}/${encodeURIComponent(term)}`),
}

export { authHeaders }
