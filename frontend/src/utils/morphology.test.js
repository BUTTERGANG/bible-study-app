import { describe, it, expect } from 'vitest'
import {
  parseGreekMorphology,
  parseHebrewMorphology,
  getFilterCategories,
  getHighlightClass,
  FILTER_CATEGORIES,
} from './morphology'

describe('parseGreekMorphology', () => {
  it('returns [] for falsy or non-string input', () => {
    expect(parseGreekMorphology(null)).toEqual([])
    expect(parseGreekMorphology(undefined)).toEqual([])
    expect(parseGreekMorphology('')).toEqual([])
    expect(parseGreekMorphology(42)).toEqual([])
  })

  it('parses an indicative verb: V-PAI-3S', () => {
    const cats = parseGreekMorphology('V-PAI-3S')
    expect(cats).toContain('verb')
    expect(cats).toContain('present')
    expect(cats).toContain('active')
    expect(cats).toContain('indicative')
    expect(cats).toContain('3rd')
    expect(cats).toContain('singular')
  })

  it('parses an aorist active participle with case/number/gender: V-AAP-NPM', () => {
    const cats = parseGreekMorphology('V-AAP-NPM')
    expect(cats).toContain('verb')
    expect(cats).toContain('aorist')
    expect(cats).toContain('active')
    expect(cats).toContain('participle')
    expect(cats).toContain('nominative')
    expect(cats).toContain('plural')
    expect(cats).toContain('masculine')
  })

  it('derives top-level participle/imperative/infinitive categories from mood', () => {
    expect(parseGreekMorphology('V-PAP-NPM')).toContain('participle')
    expect(parseGreekMorphology('V-AAM-2S')).toContain('imperative')
    expect(parseGreekMorphology('V-PAN')).toContain('infinitive')
  })

  it('parses a noun in 4-part form: N-G-S-M (genitive singular masculine)', () => {
    const cats = parseGreekMorphology('N-G-S-M')
    expect(cats).toContain('noun')
    expect(cats).toContain('genitive')
    expect(cats).toContain('singular')
    expect(cats).toContain('masculine')
  })

  it('parses a preposition POS (R, ≥2 parts)', () => {
    expect(parseGreekMorphology('R-A')).toContain('preposition')
  })
})

describe('parseHebrewMorphology', () => {
  it('parses a qal verb with person/gender/number: V-Qal-3ms', () => {
    const cats = parseHebrewMorphology('V-Qal-3ms')
    expect(cats).toContain('verb')
    expect(cats).toContain('qal')
    expect(cats).toContain('3rd')
    expect(cats).toContain('masculine')
    expect(cats).toContain('singular')
  })

  it('accepts the short stem code for the same form: V-Q-3ms', () => {
    const cats = parseHebrewMorphology('V-Q-3ms')
    expect(cats).toContain('qal')
  })

  it('parses a hiphil stem (full word and short code)', () => {
    expect(parseHebrewMorphology('V-Hiphil-1cs')).toContain('hiphil')
    expect(parseHebrewMorphology('V-H-1cs')).toContain('hiphil')
  })

  it('maps a proper noun to properNoun category', () => {
    const cats = parseHebrewMorphology('S-NP')
    expect(cats).toContain('proper-noun')
    expect(cats).toContain('properNoun')
  })

  it('parses a noun POS', () => {
    expect(parseHebrewMorphology('N-NMS')).toContain('noun')
  })

  it('returns [] for empty input', () => {
    expect(parseHebrewMorphology('')).toEqual([])
    expect(parseHebrewMorphology(null)).toEqual([])
  })
})

describe('getFilterCategories', () => {
  it('returns a de-duplicated category set for a verb', () => {
    const cats = getFilterCategories('V-PAI-3S')
    expect(new Set(cats).size).toBe(cats.length)
    expect(cats).toContain('verb')
  })

  it('routes to Hebrew parser for language=hebrew', () => {
    const cats = getFilterCategories('V-Qal-3ms', 'hebrew')
    expect(cats).toContain('qal')
  })

  it('returns [] for falsy input', () => {
    expect(getFilterCategories('')).toEqual([])
    expect(getFilterCategories(null)).toEqual([])
  })
})

describe('getHighlightClass', () => {
  it('returns the CSS class for an active category', () => {
    const cls = getHighlightClass('V-PAI-3S', 'greek', new Set(['verb']))
    expect(cls).toBe(FILTER_CATEGORIES.verb.css)
  })

  it('returns "" when no filter matches', () => {
    expect(getHighlightClass('V-PAI-3S', 'greek', new Set(['noun']))).toBe('')
  })

  it('returns "" when filters are empty', () => {
    expect(getHighlightClass('V-PAI-3S', 'greek', new Set())).toBe('')
    expect(getHighlightClass('V-PAI-3S', 'greek', null)).toBe('')
  })

  it('returns "" when code is empty', () => {
    expect(getHighlightClass('', 'greek', new Set(['verb']))).toBe('')
  })
})