const BASE = '/api'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function del(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function put(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  // Bible
  getBooks: () => get('/bible/books'),
  getTranslations: () => get('/bible/translations'),
  getTranslationBooks: (translation) => get(`/bible/${encodeURIComponent(translation)}/books`),
  getChapter: (translation, book, chapter) =>
    get(`/bible/${encodeURIComponent(translation)}/${encodeURIComponent(book)}/${chapter}`),
  getVerse: (translation, book, chapter, verse) =>
    get(`/bible/${encodeURIComponent(translation)}/${encodeURIComponent(book)}/${chapter}/${verse}`),
  compareTranslations: (book, chapter, verse, translations) =>
    get(`/bible/compare/${encodeURIComponent(book)}/${chapter}/${verse}?translations=${translations}`),

  // Commentary
  getCommentarySources: () => get('/commentary/sources'),
  getVerseCommentary: (book, chapter, verse) =>
    get(`/commentary/${encodeURIComponent(book)}/${chapter}/${verse}`),

  // Notes
  getNotes: (reference) => get(`/notes/${encodeURIComponent(reference)}`),
  createNote: (data) => post('/notes', data),
  updateNote: (id, data) => put(`/notes/${id}`, data),
  deleteNote: (id) => del(`/notes/${id}`),

  // Highlights
  getHighlights: (book, chapter, translation) =>
    get(`/highlights/${encodeURIComponent(book)}/${chapter}?translation=${encodeURIComponent(translation)}`),
  createHighlight: (data) => post('/highlights', data),
  deleteHighlight: (id) => del(`/highlights/${id}`),

  // Bookmarks
  getBookmarks: () => get('/bookmarks'),
  createBookmark: (data) => post('/bookmarks', data),
  deleteBookmark: (id) => del(`/bookmarks/${id}`),

  // Search
  search: (q, scope = 'bible', translation = 'KJV') =>
    get(`/search?q=${encodeURIComponent(q)}&scope=${scope}&translation=${translation}`),

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
    post(`/reading-plans/${planId}/complete?reference=${encodeURIComponent(reference)}`, {}),

  // Library
  getLibraryBooks: (category) =>
    get(`/library/books${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  getBookPage: (id, page) => get(`/library/books/${id}/page/${page}`),
  getBookToc: (id) => get(`/library/books/${id}/toc`),

  // Dictionary
  searchDictionary: (q) => get(`/dictionary/search?q=${encodeURIComponent(q)}`),
  getDictionaryEntry: (source, term) =>
    get(`/dictionary/${source}/${encodeURIComponent(term)}`),
}

// Streaming AI calls
export function streamAI(endpoint, body, onChunk, onDone) {
  const controller = new AbortController()

  fetch(`/api/ai/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`${res.status}`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            onDone?.()
            return
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) onChunk(parsed.text)
          } catch {}
        }
      }
    }
    onDone?.()
  }).catch((err) => {
    if (err.name !== 'AbortError') onDone?.(err)
  })

  return () => controller.abort()
}
