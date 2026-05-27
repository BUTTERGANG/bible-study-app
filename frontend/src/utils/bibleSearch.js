/**
 * Fuzzy Bible reference parser and resolver.
 *
 * Handles typos, abbreviations, and various reference formats:
 *   "jhn 3 16", "gen.1:1", "psalm23", "1 Corinthians 3:16-17"
 *
 * All matching is client-side (no server round-trip for fuzzy logic).
 */

// ── Canonical book data ──────────────────────────────────────────
const BOOKS = [
  // Old Testament
  { name: "Genesis", num: 1, chapters: 50 },
  { name: "Exodus", num: 2, chapters: 40 },
  { name: "Leviticus", num: 3, chapters: 27 },
  { name: "Numbers", num: 4, chapters: 36 },
  { name: "Deuteronomy", num: 5, chapters: 34 },
  { name: "Joshua", num: 6, chapters: 24 },
  { name: "Judges", num: 7, chapters: 21 },
  { name: "Ruth", num: 8, chapters: 4 },
  { name: "1 Samuel", num: 9, chapters: 31 },
  { name: "2 Samuel", num: 10, chapters: 24 },
  { name: "1 Kings", num: 11, chapters: 22 },
  { name: "2 Kings", num: 12, chapters: 25 },
  { name: "1 Chronicles", num: 13, chapters: 29 },
  { name: "2 Chronicles", num: 14, chapters: 36 },
  { name: "Ezra", num: 15, chapters: 10 },
  { name: "Nehemiah", num: 16, chapters: 13 },
  { name: "Esther", num: 17, chapters: 10 },
  { name: "Job", num: 18, chapters: 42 },
  { name: "Psalms", num: 19, chapters: 150 },
  { name: "Psalm", num: 19, chapters: 150 },
  { name: "Proverbs", num: 20, chapters: 31 },
  { name: "Ecclesiastes", num: 21, chapters: 12 },
  { name: "Song of Solomon", num: 22, chapters: 8 },
  { name: "Isaiah", num: 23, chapters: 66 },
  { name: "Jeremiah", num: 24, chapters: 52 },
  { name: "Lamentations", num: 25, chapters: 5 },
  { name: "Ezekiel", num: 26, chapters: 48 },
  { name: "Daniel", num: 27, chapters: 12 },
  { name: "Hosea", num: 28, chapters: 14 },
  { name: "Joel", num: 29, chapters: 3 },
  { name: "Amos", num: 30, chapters: 9 },
  { name: "Obadiah", num: 31, chapters: 1 },
  { name: "Jonah", num: 32, chapters: 4 },
  { name: "Micah", num: 33, chapters: 7 },
  { name: "Nahum", num: 34, chapters: 3 },
  { name: "Habakkuk", num: 35, chapters: 3 },
  { name: "Zephaniah", num: 36, chapters: 3 },
  { name: "Haggai", num: 37, chapters: 2 },
  { name: "Zechariah", num: 38, chapters: 14 },
  { name: "Malachi", num: 39, chapters: 4 },
  // New Testament
  { name: "Matthew", num: 40, chapters: 28 },
  { name: "Mark", num: 41, chapters: 16 },
  { name: "Luke", num: 42, chapters: 24 },
  { name: "John", num: 43, chapters: 21 },
  { name: "Acts", num: 44, chapters: 28 },
  { name: "Romans", num: 45, chapters: 16 },
  { name: "1 Corinthians", num: 46, chapters: 16 },
  { name: "2 Corinthians", num: 47, chapters: 13 },
  { name: "Galatians", num: 48, chapters: 6 },
  { name: "Ephesians", num: 49, chapters: 6 },
  { name: "Philippians", num: 50, chapters: 4 },
  { name: "Colossians", num: 51, chapters: 4 },
  { name: "1 Thessalonians", num: 52, chapters: 5 },
  { name: "2 Thessalonians", num: 53, chapters: 3 },
  { name: "1 Timothy", num: 54, chapters: 6 },
  { name: "2 Timothy", num: 55, chapters: 4 },
  { name: "Titus", num: 56, chapters: 3 },
  { name: "Philemon", num: 57, chapters: 1 },
  { name: "Hebrews", num: 58, chapters: 13 },
  { name: "James", num: 59, chapters: 5 },
  { name: "1 Peter", num: 60, chapters: 5 },
  { name: "2 Peter", num: 61, chapters: 3 },
  { name: "1 John", num: 62, chapters: 5 },
  { name: "2 John", num: 63, chapters: 1 },
  { name: "3 John", num: 64, chapters: 1 },
  { name: "Jude", num: 65, chapters: 1 },
  { name: "Revelation", num: 66, chapters: 22 },
]

// ── Alias map ───────────────────────────────────────────────────
// Comprehensive abbreviation coverage including OSIS, Antwerp, and common shorthands.
const ALIASES = {
  // OT — Genesis through Malachi
  gen: "Genesis", gn: "Genesis", genesis: "Genesis",
  ex: "Exodus", exo: "Exodus", exodus: "Exodus",
  lev: "Leviticus", lv: "Leviticus", leviticus: "Leviticus",
  num: "Numbers", nm: "Numbers", numbers: "Numbers",
  deu: "Deuteronomy", deut: "Deuteronomy", dt: "Deuteronomy", deuteronomy: "Deuteronomy",
  jos: "Joshua", josh: "Joshua", joshua: "Joshua",
  jdg: "Judges", judg: "Judges", judges: "Judges",
  rut: "Ruth", ruth: "Ruth",
  "1sa": "1 Samuel", "1sam": "1 Samuel", "1 sm": "1 Samuel", "1 samuel": "1 Samuel",
  "2sa": "2 Samuel", "2sam": "2 Samuel", "2 sm": "2 Samuel", "2 samuel": "2 Samuel",
  "1ki": "1 Kings", "1kgs": "1 Kings", "1 kings": "1 Kings",
  "2ki": "2 Kings", "2kgs": "2 Kings", "2 kings": "2 Kings",
  "1ch": "1 Chronicles", "1chr": "1 Chronicles", "1 chron": "1 Chronicles", "1 chronicles": "1 Chronicles",
  "2ch": "2 Chronicles", "2chr": "2 Chronicles", "2 chron": "2 Chronicles", "2 chronicles": "2 Chronicles",
  ezr: "Ezra", ezra: "Ezra",
  neh: "Nehemiah", nehemiah: "Nehemiah",
  est: "Esther", esth: "Esther", esther: "Esther",
  job: "Job", jb: "Job",
  psa: "Psalms", ps: "Psalms", pss: "Psalms", psalm: "Psalms", psalms: "Psalms",
  pro: "Proverbs", prov: "Proverbs", prv: "Proverbs", proverbs: "Proverbs",
  ecc: "Ecclesiastes", eccl: "Ecclesiastes", qoh: "Ecclesiastes", ecclesiastes: "Ecclesiastes",
  sng: "Song of Solomon", song: "Song of Solomon", sos: "Song of Solomon",
  "song of songs": "Song of Solomon", canticles: "Song of Solomon", cant: "Song of Solomon",
  isa: "Isaiah", is: "Isaiah", isaiah: "Isaiah",
  jer: "Jeremiah", jr: "Jeremiah", jeremiah: "Jeremiah",
  lam: "Lamentations", lamentations: "Lamentations",
  eze: "Ezekiel", ezek: "Ezekiel", ezekiel: "Ezekiel",
  dan: "Daniel", dn: "Daniel", daniel: "Daniel",
  hos: "Hosea", ho: "Hosea", hosea: "Hosea",
  joel: "Joel", jl: "Joel",
  amos: "Amos", am: "Amos",
  oba: "Obadiah", obad: "Obadiah", obadiah: "Obadiah",
  jon: "Jonah", jonah: "Jonah",
  mic: "Micah", micah: "Micah",
  nah: "Nahum", nahum: "Nahum",
  hab: "Habakkuk", habakkuk: "Habakkuk",
  zep: "Zephaniah", zeph: "Zephaniah", zephaniah: "Zephaniah",
  hag: "Haggai", haggai: "Haggai",
  zec: "Zechariah", zech: "Zechariah", zechariah: "Zechariah",
  mal: "Malachi", malachi: "Malachi",
  // NT — Matthew through Revelation
  mat: "Matthew", matt: "Matthew", mt: "Matthew", matthew: "Matthew",
  mar: "Mark", mk: "Mark", mark: "Mark",
  luk: "Luke", lk: "Luke", luke: "Luke",
  joh: "John", jn: "John", john: "John",
  act: "Acts", acts: "Acts", "acts of the apostles": "Acts",
  rom: "Romans", ro: "Romans", romans: "Romans",
  "1co": "1 Corinthians", "1cor": "1 Corinthians", "1 cor": "1 Corinthians", "1 corinthians": "1 Corinthians",
  "2co": "2 Corinthians", "2cor": "2 Corinthians", "2 cor": "2 Corinthians", "2 corinthians": "2 Corinthians",
  gal: "Galatians", ga: "Galatians", galatians: "Galatians",
  eph: "Ephesians", ephes: "Ephesians", ephesians: "Ephesians",
  php: "Philippians", phil: "Philippians", philippians: "Philippians",
  col: "Colossians", colossians: "Colossians",
  "1th": "1 Thessalonians", "1thess": "1 Thessalonians", "1 thess": "1 Thessalonians", "1 thessalonians": "1 Thessalonians",
  "2th": "2 Thessalonians", "2thess": "2 Thessalonians", "2 thess": "2 Thessalonians", "2 thessalonians": "2 Thessalonians",
  "1ti": "1 Timothy", "1tim": "1 Timothy", "1 tim": "1 Timothy", "1 timothy": "1 Timothy",
  "2ti": "2 Timothy", "2tim": "2 Timothy", "2 tim": "2 Timothy", "2 timothy": "2 Timothy",
  tit: "Titus", titus: "Titus",
  phm: "Philemon", philem: "Philemon", philemon: "Philemon",
  heb: "Hebrews", hebrews: "Hebrews",
  jas: "James", jm: "James", james: "James",
  "1pe": "1 Peter", "1pet": "1 Peter", "1 pet": "1 Peter", "1 peter": "1 Peter",
  "2pe": "2 Peter", "2pet": "2 Peter", "2 pet": "2 Peter", "2 peter": "2 Peter",
  "1jo": "1 John", "1john": "1 John", "1 jn": "1 John", "1 john": "1 John",
  "2jo": "2 John", "2john": "2 John", "2 jn": "2 John", "2 john": "2 John",
  "3jo": "3 John", "3john": "3 John", "3 jn": "3 John", "3 john": "3 John",
  jud: "Jude", jude: "Jude",
  rev: "Revelation", rv: "Revelation", revelation: "Revelation", "revelation of john": "Revelation", apocalypse: "Revelation",
}

// Build a lookup keyed by lower-case alias
const ALIAS_MAP = new Map()
for (const [alias, canonical] of Object.entries(ALIASES)) {
  ALIAS_MAP.set(alias.toLowerCase(), canonical)
 // Also store without spaces/dots/dashes for flex matching
  const compact = alias.toLowerCase().replace(/[\s.\-']/g, "")
  if (!ALIAS_MAP.has(compact)) {
    ALIAS_MAP.set(compact, canonical)
  }
}

// ── Levenshtein distance ────────────────────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i])
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }
  return matrix[b.length][a.length]
}

// ── Book lookup ─────────────────────────────────────────────────
function findBookExact(key) {
  const lower = key.toLowerCase().trim()
  const compact = lower.replace(/[\s.\-']/g, "")

  // Try alias map first
  const fromAlias = ALIAS_MAP.get(compact) || ALIAS_MAP.get(lower)
  if (fromAlias) return BOOKS.find(b => b.name === fromAlias) || null

  // Try direct name match
  const direct = BOOKS.find(b => b.name.toLowerCase() === lower)
  if (direct) return direct

  return null
}

function findBookFuzzy(input, maxDistance = 2) {
  const lower = input.toLowerCase().trim()
  const compact = lower.replace(/[\s.\-']/g, "")

  let best = null
  let bestDist = Infinity

  // Check against all canonical names and aliases
  for (const book of BOOKS) {
    const nameCompact = book.name.toLowerCase().replace(/[\s.\-']/g, "")
    const dist = levenshtein(compact, nameCompact)
    if (dist < bestDist && dist <= maxDistance) {
      bestDist = dist
      best = book
    }
  }

  // Also check against alias compact forms
  for (const [alias, canonical] of ALIAS_MAP.entries()) {
    const aliasCompact = alias.replace(/[\s.\-']/g, "")
    const dist = levenshtein(compact, aliasCompact)
    if (dist < bestDist && dist <= maxDistance) {
      bestDist = dist
      const book = BOOKS.find(b => b.name === canonical)
      if (book) {
        best = book
      }
    }
  }

  return best ? { book: best, distance: bestDist } : null
}

/**
 * Resolve a book name/abbreviation to canonical book data.
 * Returns { book, exact: true } | { book, exact: false, suggestion } | null
 */
export function resolveBook(input) {
  if (!input || typeof input !== "string") return null

  const trimmed = input.trim()
  if (!trimmed) return null

  const exact = findBookExact(trimmed)
  if (exact) return { book: exact, exact: true }

  const fuzzy = findBookFuzzy(trimmed)
  if (fuzzy) {
    return { book: fuzzy.book, exact: false, distance: fuzzy.distance }
  }

  return null
}

/**
 * Parse a Bible reference string into structured data.
 * Handles formats:
 *   "John 3:16"
 *   "John 3 16"
 *   "Jn.3:16"
 *   "psalm23"
 *   "Genesis 1"
 *   "1 Cor 3:16-17"
 *   "gen 1:1-3:2"
 *
 * Returns { book, bookName, chapter, verse, endVerse, suggestion } | null
 */
export function parseReference(input) {
  if (!input || typeof input !== "string") return null

  let s = input.trim()
  if (!s) return null

  // Try to extract book name: greedily match the longest prefix that resolves to a book
  let book = null
  let bookEndIdx = 0

  // First try: split on space/number to find book boundary
  // Pattern: optional number prefix, then letters/spaces, then chapter:verse
  const bookPrefixMatch = s.match(/^(\d\s+)?([a-zA-Z\s.]+?)(?=\s*\d)/)
  if (bookPrefixMatch) {
    const rawBook = bookPrefixMatch[0].replace(/\s*\d.*$/, "").trim()
    const resolved = resolveBook(rawBook)
    if (resolved) {
      book = resolved.book
      bookEndIdx = bookPrefixMatch[0].length
    }
  }

  // If no match, try parsing the whole thing as book + reference (e.g., "psalm23")
  if (!book) {
    // Try splitting the compact form: all alpha prefix is book, rest is ref
    const compactMatch = s.match(/^([a-zA-Z]+)(\d.*)?$/)
    if (compactMatch) {
      const resolved = resolveBook(compactMatch[1])
      if (resolved) {
        book = resolved.book
        bookEndIdx = compactMatch[1].length
        if (compactMatch[2]) {
          s = book.name + " " + compactMatch[2]
          bookEndIdx = book.name.length + 1
        }
      }
    }
  }

  // If still no match, try progressively shorter prefixes
  if (!book) {
    const words = s.split(/\s+/)
    for (let i = words.length; i >= 1; i--) {
      const candidate = words.slice(0, i).join(" ")
      const resolved = resolveBook(candidate)
      if (resolved) {
        book = resolved.book
        bookEndIdx = candidate.length
        break
      }
    }
  }

  if (!book) {
    // Last resort: fuzzy match the first word(s)
    const words = s.split(/\s+/)
    for (let i = Math.min(3, words.length); i >= 1; i--) {
      const candidate = words.slice(0, i).join(" ")
      const fuzzy = findBookFuzzy(candidate.trim())
      if (fuzzy) {
        book = fuzzy.book
        bookEndIdx = candidate.length
        break
      }
    }
  }

  if (!book) return null

  // Parse the reference part (everything after book name)
  const refPart = s.slice(bookEndIdx).trim()

  let chapter = null
  let verse = null
  let endVerse = null

  if (refPart) {
    // Patterns: "3:16", "3:16-17", "3 16", "3", "1:1", "1"
    // Remove dots used as separators (e.g., "3.16" → "3 16")
    const cleaned = refPart.replace(/\./g, " ")
    const cvMatch = cleaned.match(/^(\d+)\s*:\s*(\d+)\s*(?:-\s*(\d+))?/)
    const SpaceMatch = cleaned.match(/^(\d+)\s+(\d+)/)
    const chapterOnly = cleaned.match(/^(\d+)\s*$/)

    if (cvMatch) {
      chapter = parseInt(cvMatch[1], 10)
      verse = parseInt(cvMatch[2], 10)
      if (cvMatch[3]) endVerse = parseInt(cvMatch[3], 10)
    } else if (SpaceMatch) {
      chapter = parseInt(SpaceMatch[1], 10)
      verse = parseInt(SpaceMatch[2], 10)
    } else if (chapterOnly) {
      chapter = parseInt(chapterOnly[1], 10)
    }
  }

  return {
    book,
    bookName: book.name,
    chapter,
    verse,
    endVerse,
    reference: formatRef(book.name, chapter, verse, endVerse),
    resolved: true,
  }
}

/**
 * Format a reference into canonical string: "Book 3:16" or "Book 3:16-17"
 */
export function formatRef(bookName, chapter, verse, endVerse) {
  let ref = bookName
  if (chapter != null) {
    ref += ` ${chapter}`
    if (verse != null) {
      ref += `:${verse}`
      if (endVerse != null) ref += `-${endVerse}`
    }
  }
  return ref
}

/**
 * Get "did you mean?" suggestions for a near-miss book name.
 * Returns array of up to 3 canonical book names sorted by closeness.
 */
export function getSuggestions(input, maxDistance = 3) {
  if (!input || typeof input !== "string") return []

  const lower = input.toLowerCase().trim()
  const compact = lower.replace(/[\s.\-']/g, "")
  const results = []

  for (const book of BOOKS) {
    const nameCompact = book.name.toLowerCase().replace(/[\s.\-']/g, "")
    const dist = levenshtein(compact, nameCompact)
    if (dist <= maxDistance) {
      results.push({ name: book.name, distance: dist })
    }
  }

  results.sort((a, b) => a.distance - b.distance)
  // Deduplicate (e.g., "Psalms" and "Psalm" both match)
  const seen = new Set()
  return results.filter(r => {
    if (seen.has(r.name)) return false
    seen.add(r.name)
    return true
  }).slice(0, 3).map(r => r.name)
}

/**
 * Generate a search query string suitable for the API from fuzzy input.
 * If it looks like a reference, format it properly.
 * Otherwise, return the raw text as a keyword search.
 */
export function normalizeSearchInput(input) {
  if (!input || typeof input !== "string") return { type: "keyword", query: "" }

  const trimmed = input.trim()
  if (!trimmed) return { type: "keyword", query: "" }

  // Try parsing as a Bible reference
  const parsed = parseReference(trimmed)
  if (parsed && parsed.reference) {
    return {
      type: "reference",
      query: parsed.reference,
      parsed,
    }
  }

  // Otherwise treat as keyword
  return { type: "keyword", query: trimmed }
}

/**
 * List all book names — useful for autocomplete/search.
 */
export function listBookNames() {
  const names = [...new Set(BOOKS.map(b => b.name))]
  names.sort((a, b) => {
    const aBook = BOOKS.find(x => x.name === a)
    const bBook = BOOKS.find(x => x.name === b)
    return (aBook?.num || 0) - (bBook?.num || 0)
  })
  return names
}
