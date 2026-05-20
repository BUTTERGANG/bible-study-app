// Morphology parser for Greek (Robinson) and Hebrew (Westminster) tags.
// Maps raw morphology codes → grammatical categories for visual filtering.

// ── Greek (Robinson) part-of-speech prefixes ──────────────────────────────
// Source: https://www.robinsonbooks.com/greek/
const GREEK_POS = {
  V: 'verb',
  N: 'noun',
  A: 'adjective',
  P: 'pronoun',
  R: 'preposition',
  C: 'conjunction',
  D: 'adverb',
  T: 'article',
  I: 'interjection',
  X: 'particle',
  S: 'numeral',       // sometimes shown as "Ar" for Aramaic, etc.
}

// Greek verb tense (2nd char when POS = V)
const GREEK_TENSE = {
  P: 'present',
  I: 'imperfect',
  F: 'future',
  A: 'aorist',
  R: 'perfect',
  L: 'pluperfect',
  X: 'no-tense',     // infinitive/participle carry tense in 5th slot
}

// Greek verb voice (3rd char when POS = V)
const GREEK_VOICE = {
  A: 'active',
  M: 'middle',
  P: 'passive',
  E: 'middle-passive',
  D: 'deponent',
  O: 'passive',       // aorist passive
}

// Greek verb mood (4th char when POS = V)
const GREEK_MOOD = {
  I: 'indicative',
  S: 'subjunctive',
  O: 'optative',
  M: 'imperative',
  N: 'infinitive',
  P: 'participle',
}

// Greek noun/adjective case
const GREEK_CASE = {
  N: 'nominative',
  G: 'genitive',
  D: 'dative',
  A: 'accusative',
  V: 'vocative',
}

// Greek person
const GREEK_PERSON = {
  1: '1st',
  2: '2nd',
  3: '3rd',
}

// Greek number
const GREEK_NUMBER = {
  S: 'singular',
  P: 'plural',
}

// Greek gender
const GREEK_GENDER = {
  M: 'masculine',
  F: 'feminine',
  N: 'neuter',
}

// ── Hebrew (Westminster) part-of-speech prefixes ──────────────────────────
const HEBREW_POS = {
  V: 'verb',
  N: 'noun',
  A: 'adjective',
  P: 'pronoun',
  R: 'preposition',
  C: 'conjunction',
  D: 'adverb',
  T: 'article',
  S: 'proper-noun',
  I: 'interjection',
  X: 'particle',
}

// Hebrew verb stems (binyanim)
const HEBREW_STEM = {
  Q: 'qal',
  N: 'niphal',
  P: 'piel',
  I: 'pual',
  H: 'hiphil',
  O: 'hophal',
  T: 'hithpael',
  R: 'polel',
  L: 'polal',
  M: 'hithpolel',
  S: 'hishtaphel',
}

// ── Category mapping for visual filters ───────────────────────────────────
// Each category maps to a CSS class and display label.
export const FILTER_CATEGORIES = {
  verb:          { label: 'Verbs',         css: 'vf-verb',         defaultOn: true },
  noun:          { label: 'Nouns',         css: 'vf-noun',         defaultOn: true },
  adjective:     { label: 'Adjectives',    css: 'vf-adjective',    defaultOn: false },
  participle:    { label: 'Participles',   css: 'vf-participle',   defaultOn: true },
  imperative:    { label: 'Imperatives',   css: 'vf-imperative',   defaultOn: true },
  pronoun:       { label: 'Pronouns',      css: 'vf-pronoun',      defaultOn: false },
  preposition:   { label: 'Prepositions',  css: 'vf-preposition',  defaultOn: false },
  conjunction:   { label: 'Conjunctions',  css: 'vf-conjunction',  defaultOn: false },
  adverb:        { label: 'Adverbs',       css: 'vf-adverb',       defaultOn: false },
  article:       { label: 'Articles',      css: 'vf-article',      defaultOn: false },
  infinitive:    { label: 'Infinitives',   css: 'vf-infinitive',   defaultOn: false },
  properNoun:    { label: 'Proper Nouns',  css: 'vf-proper-noun',  defaultOn: false },
  numeral:       { label: 'Numerals',      css: 'vf-numeral',      defaultOn: false },
  interjection:  { label: 'Interjections', css: 'vf-interjection', defaultOn: false },
  particle:      { label: 'Particles',     css: 'vf-particle',     defaultOn: false },
}

// Default color scheme (Tailwind-compatible)
export const DEFAULT_COLORS = {
  verb:         'rgba(239, 68, 68, 0.25)',    // red
  noun:         'rgba(59, 130, 246, 0.25)',   // blue
  adjective:    'rgba(168, 85, 247, 0.25)',   // purple
  participle:   'rgba(34, 197, 94, 0.25)',    // green
  imperative:   'rgba(249, 115, 22, 0.30)',   // orange
  pronoun:      'rgba(168, 85, 247, 0.20)',   // purple (lighter)
  preposition:  'rgba(107, 114, 128, 0.20)',  // gray
  conjunction:  'rgba(107, 114, 128, 0.15)',  // gray (lighter)
  adverb:       'rgba(234, 179, 8, 0.20)',    // yellow
  article:      'rgba(107, 114, 128, 0.10)',  // gray (lightest)
  infinitive:   'rgba(239, 68, 68, 0.15)',    // red (lighter)
  properNoun:   'rgba(236, 72, 153, 0.25)',   // pink
  numeral:      'rgba(20, 184, 166, 0.25)',   // teal
  interjection: 'rgba(251, 146, 60, 0.25)',   // orange-light
  particle:     'rgba(107, 114, 128, 0.10)',  // gray (lightest)
}

// ── Greek parser ──────────────────────────────────────────────────────────
/**
 * Parse a Greek Robinson morphology code into an array of category strings.
 * E.g. "V-PAI-3S" → ["verb", "present", "active", "indicative", "3rd", "singular"]
 *      "V-AAP-NPM" → ["verb", "aorist", "active", "participle", "nominative", "plural", "masculine"]
 *
 * @param {string} code  Raw morphology code (e.g. "V-PAI-3S")
 * @returns {string[]}   Array of category tokens
 */
export function parseGreekMorphology(code) {
  if (!code || typeof code !== 'string') return []
  const parts = code.trim().split('-')
  if (parts.length < 2) return []

  const categories = []

  // Part of speech
  const pos = parts[0]
  const posCategory = GREEK_POS[pos]
  if (posCategory) categories.push(posCategory)

  if (pos === 'V' && parts.length >= 2) {
    // Verb: tense-voice-mood-personNumber
    const tv = parts[1]
    if (tv.length >= 1) {
      const tense = GREEK_TENSE[tv[0]]
      if (tense && tense !== 'no-tense') categories.push(tense)
    }
    if (tv.length >= 2) {
      const voice = GREEK_VOICE[tv[1]]
      if (voice) categories.push(voice)
    }
    if (tv.length >= 3) {
      const mood = GREEK_MOOD[tv[2]]
      if (mood) {
        categories.push(mood)
        // Derive participle/imperative as top-level categories
        if (mood === 'participle') categories.push('participle')
        if (mood === 'imperative') categories.push('imperative')
        if (mood === 'infinitive') categories.push('infinitive')
      }
    }
    // Person + number (e.g. "3S" → 3rd singular)
    if (parts.length >= 3) {
      const pn = parts[2]
      if (pn.length >= 1) {
        const person = GREEK_PERSON[pn[0]]
        if (person) categories.push(person)
      }
      if (pn.length >= 2) {
        const number = GREEK_NUMBER[pn[1]]
        if (number) categories.push(number)
      }
    }
    // Gender for participles (e.g. "V-AAP-NPM" → NPM = nominative plural masculine)
    if (parts.length >= 4) {
      const caseGender = parts[3]
      if (caseGender.length >= 1) {
        const case_ = GREEK_CASE[caseGender[0]]
        if (case_) categories.push(case_)
      }
      if (caseGender.length >= 3) {
        const gender = GREEK_GENDER[caseGender[2]]
        if (gender) categories.push(gender)
      }
    }
  } else if (parts.length >= 3) {
    // Noun/adjective: POS-case-number-gender
    const case_ = GREEK_CASE[parts[1]]
    if (case_) categories.push(case_)
    const number = GREEK_NUMBER[parts[2]]
    if (number) categories.push(number)
    if (parts.length >= 4) {
      const gender = GREEK_GENDER[parts[3]]
      if (gender) categories.push(gender)
    }
  }

  return categories
}

// ── Hebrew parser ─────────────────────────────────────────────────────────
/**
 * Parse a Hebrew Westminster morphology code into an array of category strings.
 * E.g. "V-Qal-3ms" → ["verb", "qal", "3rd", "masculine", "singular"]
 *
 * @param {string} code  Raw morphology code
 * @returns {string[]}   Array of category tokens
 */
export function parseHebrewMorphology(code) {
  if (!code || typeof code !== 'string') return []
  const parts = code.trim().split('-')
  if (parts.length < 1) return []

  const categories = []

  const pos = parts[0]
  const posCategory = HEBREW_POS[pos]
  if (posCategory) {
    categories.push(posCategory)
    if (posCategory === 'proper-noun') categories.push('properNoun')
  }

  if (pos === 'V' && parts.length >= 2) {
    const stem = HEBREW_STEM[parts[1]]
    if (stem) categories.push(stem)
  }

  // Person-gender-number suffix (e.g. "3ms", "2fp")
  if (parts.length >= 3) {
    const pgn = parts[2]
    if (pgn.length >= 1) {
      const person = GREEK_PERSON[pgn[0]]  // same 1/2/3 scheme
      if (person) categories.push(person)
    }
    if (pgn.length >= 2) {
      const gender = { m: 'masculine', f: 'feminine' }[pgn[1]]
      if (gender) categories.push(gender)
    }
    if (pgn.length >= 3) {
      const number = { s: 'singular', p: 'plural', d: 'dual' }[pgn[2]]
      if (number) categories.push(number)
    }
  }

  return categories
}

// ── Unified parser ────────────────────────────────────────────────────────
/**
 * Parse a morphology code and return the set of visual filter categories
 * that this word belongs to.
 *
 * @param {string} code     Raw morphology code
 * @param {string} language 'greek' | 'hebrew'
 * @returns {string[]}      Filter category keys (subset of FILTER_CATEGORIES keys)
 */
export function getFilterCategories(code, language = 'greek') {
  if (!code) return []

  const raw = language === 'hebrew'
    ? parseHebrewMorphology(code)
    : parseGreekMorphology(code)

  // Deduplicate
  return [...new Set(raw)]
}

/**
 * Get the CSS highlight class for a word based on its morphology and
 * the currently active filter categories.
 *
 * @param {string} code       Raw morphology code
 * @param {string} language   'greek' | 'hebrew'
 * @param {Set<string>} activeFilters  Set of active filter category keys
 * @returns {string}          CSS class name or empty string
 */
export function getHighlightClass(code, language, activeFilters) {
  if (!code || !activeFilters || activeFilters.size === 0) return ''

  const categories = getFilterCategories(code, language)
  for (const cat of categories) {
    if (activeFilters.has(cat)) {
      const config = FILTER_CATEGORIES[cat]
      return config ? config.css : ''
    }
  }
  return ''
}
