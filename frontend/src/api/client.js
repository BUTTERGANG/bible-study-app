import { getAccessToken, getAppPassword } from './auth'

const BASE = '/api'

function authHeaders() {
  // Prefer JWT access token; fall back to legacy APP_PASSWORD.
  const jwt = getAccessToken()
  if (jwt) return { Authorization: `Bearer ${jwt}` }
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
const patch = (path, body) =>
  request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) })

export const api = {
  generateOutline: (reference, translation) => post('/ai/outline', { reference, translation }),
  topicStudy: (topic) => post('/ai/chat', { mode: 'topic', topic }),
  // Health / auth
  getHealth: () => get('/health'),
  getAuthStatus: () => get('/auth/status'),

  // User accounts
  register: (email, password) => post('/users/register', { email, password }),
  login: (email, password) => post('/users/login', { email, password }),
  refreshToken: (refresh_token) => post('/users/refresh', { refresh_token }),
  getMe: () => get('/users/me'),

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

  // Morphological search
  morphSearch: (params) => post('/search/morph', params),

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

  // Factbook
  getFactbookEntry: (entityName, entityType, refresh = false) => {
    const params = new URLSearchParams()
    if (entityType) params.set('entity_type', entityType)
    if (refresh) params.set('refresh', 'true')
    const qs = params.toString()
    return get(`/factbook/${encodeURIComponent(entityName)}${qs ? '?' + qs : ''}`)
  },
  listFactbookEntries: (entityType, search, limit = 50, offset = 0) => {
    const params = new URLSearchParams()
    if (entityType) params.set('entity_type', entityType)
    if (search) params.set('search', search)
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    return get(`/factbook?${params}`)
  },
  generateFactbookEntry: (entityName, entityType = 'person') =>
    post('/factbook/generate', { entity_name: entityName, entity_type: entityType }),

  // NT Use of OT
  getNtOtConnections: (params = {}) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v != null) qs.set(k, String(v))
    }
    return get(`/nt-ot?${qs}`)
  },
  getNtOtStats: () => get('/nt-ot/stats'),

  // Semantic search
  semanticSearch: (q, translation = 'KJV', limit = 25) => {
    const params = new URLSearchParams({ q, translation, limit: String(limit) })
    return get(`/search/semantic?${params}`)
  },

  // Dictionary
  searchDictionary: (q, source) => {
    const params = new URLSearchParams({ q })
    if (source) params.set('source', source)
    return get(`/dictionary/search?${params}`)
  },
  getDictionaryEntry: (source, term) =>
    get(`/dictionary/${source}/${encodeURIComponent(term)}`),

  // AI Conversations
  listConversations: (limit = 50, offset = 0) =>
    get(`/ai/conversations?limit=${limit}&offset=${offset}`),
  getConversation: (reference) =>
    get(`/ai/conversations/${encodeURIComponent(reference)}`),
  saveConversation: (reference, data) =>
    put(`/ai/conversations/${encodeURIComponent(reference)}`, { ...data, reference }),
  updateConversation: (reference, data) =>
    patch(`/ai/conversations/${encodeURIComponent(reference)}`, data),
  deleteConversation: (reference) =>
    del(`/ai/conversations/${encodeURIComponent(reference)}`),
}

export { authHeaders }
