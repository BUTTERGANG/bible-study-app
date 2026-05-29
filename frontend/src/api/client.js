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
  topicStudy: (topic, depth = 'overview') => post('/ai/topic-study', { topic, depth }),
  getPassageInsights: (book, chapter, verse, translation = 'KJV') =>
    post('/ai/insights', { book, chapter, verse, translation }),
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
  getPlanDetail: (id) => get(`/reading-plans/${id}`),
  startPlan: (data) => post('/reading-plans/start', data),
  startAiPlan: (data) => post('/reading-plans/start-ai', data),
  getTodayPlanReadings: () => get('/reading-plans/today'),
  completeReading: (planId, reference) =>
    post(`/reading-plans/${planId}/complete?reference=${encodeURIComponent(reference)}`),
  deletePlan: (id) => del(`/reading-plans/${id}`),

  // Library
  getLibraryBooks: (category) =>
    get(`/library/books${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  getBookPage: (id, page) => get(`/library/books/${id}/page/${page}`),
  getBookToc: (id) => get(`/library/books/${id}/toc`),
  searchLibrary: (q, limit = 20) =>
    get(`/library/search?q=${encodeURIComponent(q)}&limit=${limit}`),

  // Resource Summarizer
  summarizeResource: (resourceId, chunkSize = 0) =>
    post('/ai/summarize', { resource_id: resourceId, chunk_size: chunkSize }),

  // Interlinear
  getChapterInterlinear: (translation, book, chapter) =>
    get(`/bible/${encodeURIComponent(translation)}/${encodeURIComponent(book)}/${chapter}/interlinear`),

  // Lemma data for inline passage view
  getChapterLemmas: (translation, book, chapter) =>
    get(`/bible/${encodeURIComponent(translation)}/${encodeURIComponent(book)}/${chapter}/lemmas`),

  // Factbook
  // Bible Study Builder
  listStudies: () => get('/studies'),
  createStudy: (data) => post('/studies', data),
  updateStudy: (id, data) => patch(`/studies/${id}`, data),
  deleteStudy: (id) => del(`/studies/${id}`),
  upsertStudySection: (projectId, sectionType, content) =>
    put(`/studies/${projectId}/sections/${sectionType}`, { content }),

  // Prayer Journal
  listPrayers: (status) => get(`/prayer${status ? '?status=' + status : ''}`),
  createPrayer: (data) => post('/prayer', data),
  updatePrayer: (id, data) => patch(`/prayer/${id}`, data),
  deletePrayer: (id) => del(`/prayer/${id}`),

  // Verse Memorization
  listMemoryVerses: () => get('/memorize'),
  addMemoryVerse: (data) => post('/memorize', data),
  removeMemoryVerse: (id) => del(`/memorize/${id}`),
  recordQuizResult: (id, correct) => post(`/memorize/${id}/quiz`, { correct }),

  getFactbookQuestions: (entityName, entityType) => {
    const params = new URLSearchParams()
    if (entityType) params.set('entity_type', entityType)
    const qs = params.toString()
    return get(`/factbook/${encodeURIComponent(entityName)}/questions${qs ? '?' + qs : ''}`)
  },
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

  // Semantic Range Visualization
  getSemanticRange: (strongsNum, testament = 'all') =>
    get(`/lexicon/strongs/${encodeURIComponent(strongsNum)}/range?testament=${testament}`),

  // Doctrinal Topic Index
  listDoctrines: (category, q) => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (q) params.set('q', q)
    const qs = params.toString()
    return get(`/doctrine${qs ? '?' + qs : ''}`)
  },
  getDoctrine: (name, refresh = false) =>
    get(`/doctrine/${encodeURIComponent(name)}${refresh ? '?refresh=true' : ''}`),
  generateDoctrine: (name, category) =>
    post('/doctrine/generate', { name, category }),

  // Cultural context notes
  getCulturalNotes: (book, chapter) =>
    get(`/cultural/${encodeURIComponent(book)}/${chapter}`),
  getCulturalNote: (book, chapter, verse) =>
    get(`/cultural/${encodeURIComponent(book)}/${chapter}/${verse}`),

  // Dashboard
  getDashboard: () => get('/dashboard'),

  // Book introductions
  getBookIntroduction: (book, refresh = false) =>
    get(`/bible/books/${encodeURIComponent(book)}/introduction${refresh ? '?refresh=true' : ''}`),

  // Gospel Harmony
  getHarmonyList: () => get('/harmony'),
  getHarmonyPericope: (pericopeId, translation = 'KJV') =>
    get(`/harmony/${encodeURIComponent(pericopeId)}?translation=${encodeURIComponent(translation)}`),

  // Lectionary
  getTodayReadings: () => get('/lectionary/today'),
  getReadingsByDate: (date) =>
    get(`/lectionary/${encodeURIComponent(date)}`),

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

  // Sermon Builder
  listSermons: () => get('/sermons'),
  createSermon: (data) => post('/sermons', data),
  getSermon: (id) => get(`/sermons/${id}`),
  updateSermon: (id, data) => patch(`/sermons/${id}`, data),
  deleteSermon: (id) => del(`/sermons/${id}`),
  upsertSermonSection: (id, sectionType, content) =>
    put(`/sermons/${id}/sections/${sectionType}`, { content }),

  // Sermon Series (Preaching Series Planner)
  listSermonSeries: () => get('/sermons/series'),
  createSermonSeries: (data) => post('/sermons/series', data),
  getSermonSeries: (id) => get(`/sermons/series/${id}`),
  updateSermonSeries: (id, data) => put(`/sermons/series/${id}`, data),
  deleteSermonSeries: (id) => del(`/sermons/series/${id}`),
  addSeriesEntry: (seriesId, data) => post(`/sermons/series/${seriesId}/entries`, data),
  updateSeriesEntry: (seriesId, entryId, data) =>
    put(`/sermons/series/${seriesId}/entries/${entryId}`, data),
  deleteSeriesEntry: (seriesId, entryId) =>
    del(`/sermons/series/${seriesId}/entries/${entryId}`),

  // PreachingSeriesPanel aliases (same endpoints, panel-friendly names)
  listSeries: () => get('/sermons/series'),
  getSeries: (id) => get(`/sermons/series/${id}`),
  createSeries: (data) => post('/sermons/series', data),
  updateSeries: (id, data) => put(`/sermons/series/${id}`, data),
  deleteSeries: (id) => del(`/sermons/series/${id}`),
  addSeriesSlot: (seriesId, data) => post(`/sermons/series/${seriesId}/entries`, data),
  updateSeriesSlot: (seriesId, slotId, data) => put(`/sermons/series/${seriesId}/entries/${slotId}`, data),
  deleteSeriesSlot: (seriesId, slotId) => del(`/sermons/series/${seriesId}/entries/${slotId}`),

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

  // ── Vocabulary Drills ───────────────────────────────────────────────
  getVocabDrill: (language = 'greek', limit = 20, frequencyBand = 'top50', book = null, chapter = null) => {
    const params = new URLSearchParams({ language, limit: String(limit), frequency_band: frequencyBand })
    if (book) params.set('book', book)
    if (chapter != null) params.set('chapter', String(chapter))
    return get(`/vocab/drill?${params}`)
  },
  getVocabMastery: () => get('/vocab/mastery'),
  recordVocabQuiz: (strongs_num, language, correct) =>
    post('/vocab/quiz', { strongs_num, language, correct }),

  // ── Groups ──────────────────────────────────────────────────────────
  // My groups & invites
  getMyGroups: () => get('/groups'),
  getMyInvites: () => get('/groups/my-invites'),
  createGroup: (data) => post('/groups', data),
  getGroup: (groupId) => get(`/groups/${groupId}`),
  updateGroup: (groupId, data) => put(`/groups/${groupId}`, data),
  deleteGroup: (groupId) => del(`/groups/${groupId}`),

  // Members & invites
  inviteMember: (groupId, email) => post(`/groups/${groupId}/invites`, { email }),
  acceptInvite: (groupId) => post(`/groups/${groupId}/invites/accept`),
  declineInvite: (groupId) => post(`/groups/${groupId}/invites/decline`),
  removeMember: (groupId, userId) => del(`/groups/${groupId}/members/${userId}`),
  leaveGroup: (groupId) => post(`/groups/${groupId}/leave`),

  // Group notes
  getGroupNotes: (groupId, params = {}) => {
    const p = new URLSearchParams()
    if (params.book != null) p.set('book', params.book)
    if (params.chapter != null) p.set('chapter', String(params.chapter))
    if (params.verse != null) p.set('verse', String(params.verse))
    if (params.tag != null) p.set('tag', params.tag)
    return get(`/groups/${groupId}/notes?${p}`)
  },
  createGroupNote: (groupId, data) => post(`/groups/${groupId}/notes`, data),
  updateGroupNote: (groupId, noteId, data) => put(`/groups/${groupId}/notes/${noteId}`, data),
  deleteGroupNote: (groupId, noteId) => del(`/groups/${groupId}/notes/${noteId}`),

  // Sharing personal items
  shareToGroup: (groupId, data) => post(`/groups/${groupId}/share`, data),
  unshareFromGroup: (groupId, sharedItemId) => del(`/groups/${groupId}/share/${sharedItemId}`),

  // Group feed
  getGroupFeed: (groupId, offset = 0, limit = 50) =>
    get(`/groups/${groupId}/feed?offset=${offset}&limit=${limit}`),

  // Inline Annotations (word/phrase-level marginalia)
  getAnnotations: (book, chapter) =>
    get(`/annotations/${encodeURIComponent(book)}/${chapter}`),
  createAnnotation: (data) => post('/annotations', data),
  updateAnnotation: (id, data) => put(`/annotations/${id}`, data),
  deleteAnnotation: (id) => del(`/annotations/${id}`),

  // ── Textual Criticism Apparatus ─────────────────────────────────────
  getTextualVariants: (book, chapter, verse) =>
    get(`/textual/${encodeURIComponent(book)}/${chapter}/${verse}`),

  // AI-generated textual note summaries (separate from static variants)
  getTextualNotes: (book, chapter, verse) =>
    get(`/textual-notes/${encodeURIComponent(book)}/${chapter}/${verse}`),
  listTextualPassages: () => get('/textual-notes/passages'),

  // Counseling guides
  listCounselingGuides: (category, q) => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (q) params.set('q', q)
    const qs = params.toString()
    return get(`/counseling${qs ? '?' + qs : ''}`)
  },
  getCounselingGuide: (name, refresh = false) =>
    get(`/counseling/${encodeURIComponent(name)}${refresh ? '?refresh=true' : ''}`),
  generateCounselingGuide: (name, category) =>
    post('/counseling/generate', { name, category }),
}

export { authHeaders }
