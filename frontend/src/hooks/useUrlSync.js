import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useStudyStore } from '../stores/studyStore'

// Bidirectionally sync the URL `/:translation/:book/:chapter/:verse?` with the
// Zustand store. The URL is canonical for navigation state — refresh, share,
// browser-back all work. UI-only state (font size, dark mode, open panel)
// stays in Zustand's persisted slice.

const DEFAULT = { translation: 'KJV', book: 'John', chapter: '3' }

function parsePath(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return null
  const [translation, ...rest] = parts
  if (!translation || rest.length === 0) return null
  // Allow multi-word books like "1 Corinthians" — encode in URL as "1-Corinthians".
  const book = decodeURIComponent(rest[0]).replace(/-/g, ' ')
  const chapter = rest[1] ? parseInt(rest[1], 10) : NaN
  const verse = rest[2] ? parseInt(rest[2], 10) : null
  if (!book || Number.isNaN(chapter)) return null
  return { translation, book, chapter, verse: Number.isNaN(verse) ? null : verse }
}

function buildPath({ translation, book, chapter, verse }) {
  const bookSlug = encodeURIComponent(book.replace(/ /g, '-'))
  const base = `/${encodeURIComponent(translation)}/${bookSlug}/${chapter}`
  return verse ? `${base}/${verse}` : base
}

export function useUrlSync() {
  const navigate = useNavigate()
  const location = useLocation()
  const { translation, book, chapter, verse, setReference, setTranslation } = useStudyStore()
  const lastUrl = useRef('')

  // URL → store. Runs whenever the path changes (including initial load).
  useEffect(() => {
    const parsed = parsePath(location.pathname)
    if (!parsed) {
      // Empty path — write current store state into the URL so deep links work.
      const path = buildPath({ translation, book, chapter, verse })
      navigate(path, { replace: true })
      lastUrl.current = path
      return
    }
    if (parsed.translation !== translation) setTranslation(parsed.translation)
    if (
      parsed.book !== book ||
      parsed.chapter !== chapter ||
      parsed.verse !== verse
    ) {
      setReference(parsed.book, parsed.chapter, parsed.verse)
    }
    lastUrl.current = location.pathname
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Store → URL. Only push a new history entry when the user actually changed
  // a reference (the URL → store effect mutates the store, and we don't want
  // to loop). We compare against lastUrl rather than the previous render.
  useEffect(() => {
    const next = buildPath({ translation, book, chapter, verse })
    if (next === lastUrl.current) return
    lastUrl.current = next
    navigate(next, { replace: false })
  }, [translation, book, chapter, verse, navigate])
}
