// Bootstrap fallback for the book list. The backend is the source of truth
// (see /api/bible/books and /api/bible/translations/{t}/books) — this static
// list exists only so the sidebar and chapter-navigation arrows have something
// to render before the API call resolves, or if the DB is unavailable.
//
// If you change the canonical 66-book list, update backend/bible_data.py — the
// API will then propagate to the UI naturally.

const C = (n, t, chapters) => ({ name: n, num: 0, testament: t, chapters })

export const BOOKS = [
  C('Genesis', 'OT', 50), C('Exodus', 'OT', 40), C('Leviticus', 'OT', 27),
  C('Numbers', 'OT', 36), C('Deuteronomy', 'OT', 34), C('Joshua', 'OT', 24),
  C('Judges', 'OT', 21), C('Ruth', 'OT', 4), C('1 Samuel', 'OT', 31),
  C('2 Samuel', 'OT', 24), C('1 Kings', 'OT', 22), C('2 Kings', 'OT', 25),
  C('1 Chronicles', 'OT', 29), C('2 Chronicles', 'OT', 36), C('Ezra', 'OT', 10),
  C('Nehemiah', 'OT', 13), C('Esther', 'OT', 10), C('Job', 'OT', 42),
  C('Psalms', 'OT', 150), C('Proverbs', 'OT', 31), C('Ecclesiastes', 'OT', 12),
  C('Song of Solomon', 'OT', 8), C('Isaiah', 'OT', 66), C('Jeremiah', 'OT', 52),
  C('Lamentations', 'OT', 5), C('Ezekiel', 'OT', 48), C('Daniel', 'OT', 12),
  C('Hosea', 'OT', 14), C('Joel', 'OT', 3), C('Amos', 'OT', 9),
  C('Obadiah', 'OT', 1), C('Jonah', 'OT', 4), C('Micah', 'OT', 7),
  C('Nahum', 'OT', 3), C('Habakkuk', 'OT', 3), C('Zephaniah', 'OT', 3),
  C('Haggai', 'OT', 2), C('Zechariah', 'OT', 14), C('Malachi', 'OT', 4),
  C('Matthew', 'NT', 28), C('Mark', 'NT', 16), C('Luke', 'NT', 24),
  C('John', 'NT', 21), C('Acts', 'NT', 28), C('Romans', 'NT', 16),
  C('1 Corinthians', 'NT', 16), C('2 Corinthians', 'NT', 13),
  C('Galatians', 'NT', 6), C('Ephesians', 'NT', 6), C('Philippians', 'NT', 4),
  C('Colossians', 'NT', 4), C('1 Thessalonians', 'NT', 5),
  C('2 Thessalonians', 'NT', 3), C('1 Timothy', 'NT', 6),
  C('2 Timothy', 'NT', 4), C('Titus', 'NT', 3), C('Philemon', 'NT', 1),
  C('Hebrews', 'NT', 13), C('James', 'NT', 5), C('1 Peter', 'NT', 5),
  C('2 Peter', 'NT', 3), C('1 John', 'NT', 5), C('2 John', 'NT', 1),
  C('3 John', 'NT', 1), C('Jude', 'NT', 1), C('Revelation', 'NT', 22),
].map((b, i) => ({ ...b, num: i + 1 }))

export const OT_BOOKS = BOOKS.filter((b) => b.testament === 'OT')
export const NT_BOOKS = BOOKS.filter((b) => b.testament === 'NT')

export function getBook(name) {
  return BOOKS.find((b) => b.name.toLowerCase() === name.toLowerCase())
}

export function getChapterCount(bookName) {
  return getBook(bookName)?.chapters ?? 0
}
