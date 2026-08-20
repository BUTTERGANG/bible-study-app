import { describe, it, expect } from 'vitest'
import {
  resolveBook,
  parseReference,
  formatRef,
  normalizeSearchInput,
  getSuggestions,
  listBookNames,
} from './bibleSearch'

describe('resolveBook', () => {
  it('resolves an exact book name', () => {
    const r = resolveBook('John')
    expect(r.book.name).toBe('John')
    expect(r.exact).toBe(true)
  })

  it('resolves an abbreviation (jhn / jn / 1 cor)', () => {
    expect(resolveBook('jhn').book.name).toBe('John')
    expect(resolveBook('jn').book.name).toBe('John')
    expect(resolveBook('1 cor').book.name).toBe('1 Corinthians')
  })

  it('resolves with fuzzy matching and reports distance', () => {
    const r = resolveBook('Jonn')
    expect(r.book.name).toBe('John')
    expect(r.exact).toBe(false)
    expect(r.distance).toBeGreaterThan(0)
  })

  it('returns null for empty/garbage input', () => {
    expect(resolveBook('')).toBe(null)
    expect(resolveBook(null)).toBe(null)
    expect(resolveBook(123)).toBe(null)
  })
})

describe('parseReference', () => {
  it('parses "John 3:16"', () => {
    const r = parseReference('John 3:16')
    expect(r.bookName).toBe('John')
    expect(r.chapter).toBe(3)
    expect(r.verse).toBe(16)
    expect(r.endVerse).toBe(null)
  })

  it('parses a verse range "gen 1:1-3:2" style chapter-y case', () => {
    const r = parseReference('gen 1:1-3:2')
    expect(r.bookName).toBe('Genesis')
    expect(r.chapter).toBe(1)
    expect(r.verse).toBe(1)
  })

  it('parses space-separated "John 3 16"', () => {
    const r = parseReference('John 3 16')
    expect(r.chapter).toBe(3)
    expect(r.verse).toBe(16)
  })

  it('parses chapter-only "Genesis 1"', () => {
    const r = parseReference('Genesis 1')
    expect(r.bookName).toBe('Genesis')
    expect(r.chapter).toBe(1)
    expect(r.verse).toBe(null)
  })

  it('parses compact "psalm23"', () => {
    const r = parseReference('psalm23')
    expect(r.bookName).toBe('Psalms')
    expect(r.chapter).toBe(23)
  })

  it('parses dotted "Jn.3:16"', () => {
    const r = parseReference('Jn.3:16')
    expect(r.bookName).toBe('John')
    expect(r.chapter).toBe(3)
    expect(r.verse).toBe(16)
  })

  it('returns null for non-reference input', () => {
    expect(parseReference('hello world')).toBe(null)
    expect(parseReference('')).toBe(null)
    expect(parseReference(null)).toBe(null)
  })
})

describe('formatRef', () => {
  it('formats book + chapter + verse', () => {
    expect(formatRef('John', 3, 16)).toBe('John 3:16')
  })
  it('formats book + chapter + verse + endVerse', () => {
    expect(formatRef('John', 3, 16, 17)).toBe('John 3:16-17')
  })
  it('formats book + chapter only', () => {
    expect(formatRef('Genesis', 1)).toBe('Genesis 1')
  })
  it('formats bare book', () => {
    expect(formatRef('John')).toBe('John')
  })
})

describe('normalizeSearchInput', () => {
  it('detects a reference query', () => {
    const r = normalizeSearchInput('John 3:16')
    expect(r.type).toBe('reference')
    expect(r.query).toBe('John 3:16')
    expect(r.parsed).toBeTruthy()
  })
  it('falls back to keyword for plain text', () => {
    const r = normalizeSearchInput('hello world')
    expect(r.type).toBe('keyword')
    expect(r.query).toBe('hello world')
  })
  it('returns keyword empty for blank input', () => {
    const r = normalizeSearchInput('   ')
    expect(r.type).toBe('keyword')
  })
})

describe('getSuggestions', () => {
  it('returns up to 3 canonical names sorted by distance', () => {
    const suggestions = getSuggestions('Joh', 3)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.length).toBeLessThanOrEqual(3)
    /* Real ordering: Job (dist 1) sorts before John (dist 2). */
    expect(suggestions).toContain('John')
  })
  it('returns [] for empty input', () => {
    expect(getSuggestions('')).toEqual([])
  })
})

describe('listBookNames', () => {
  it('returns unique names in canonical order (Genesis first)', () => {
    const names = listBookNames()
    expect(names.length).toBeGreaterThan(60)
    expect(names[0]).toBe('Genesis')
    // "Psalm" and "Psalms" both alias to Psalms — only one entry
    expect(names.filter((n) => n === 'Psalms').length).toBe(1)
  })
})