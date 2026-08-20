import { describe, it, expect } from 'vitest'
import { computeWordDiff } from './diff'

describe('computeWordDiff', () => {
  it('marks unchanged words as same (incl. space tokens)', () => {
    const out = computeWordDiff('the quick brown fox', 'the quick brown fox')
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((w) => w.type === 'same')).toBe(true)
    const words = out.filter((w) => !/^\s+$/.test(w.text)).map((w) => w.text)
    expect(words).toEqual(['the', 'quick', 'brown', 'fox'])
  })

  it('marks a single changed word as diff', () => {
    const out = computeWordDiff('the quick brown fox', 'the slow brown fox')
    const diffs = out.filter((w) => w.type === 'diff')
    expect(diffs.length).toBe(1)
    expect(diffs[0].text).toBe('slow')
  })

  it('is case-insensitive for matching', () => {
    const out = computeWordDiff('The Quick', 'the quick')
    expect(out.every((w) => w.type === 'same')).toBe(true)
  })

  it('keeps non-whitespace punctuation as same tokens', () => {
    const out = computeWordDiff('Hello, world!', 'Hello there, world!')
    // Comma and exclamation are structural punctuation → same
    const solidPunct = out.filter((w) => /^[.,:;!?]+$/.test(w.text))
    expect(solidPunct.length).toBeGreaterThan(0)
    expect(solidPunct.every((w) => w.type === 'same')).toBe(true)
  })

  it('handles empty base (every token is a diff)', () => {
    const out = computeWordDiff('', 'hello world')
    const diffs = out.filter((w) => w.type === 'diff')
    // Words + the space between them are all new → diff
    expect(diffs.some((w) => w.text === 'hello')).toBe(true)
    expect(diffs.some((w) => w.text === 'world')).toBe(true)
  })

  it('returns empty for two empty strings', () => {
    expect(computeWordDiff('', '')).toEqual([])
  })
})