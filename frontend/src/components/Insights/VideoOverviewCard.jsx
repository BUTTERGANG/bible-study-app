import { useState } from 'react'
import { ChevronDown, ChevronRight, PlayCircle, ExternalLink } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'

/**
 * BibleProject YouTube video IDs for all 66 canonical Bible books.
 * These are the official BibleProject book overview videos.
 */
const BOOK_VIDEO_MAP = {
  // Torah / Pentateuch
  Genesis:     'GQI72THyO5I',
  Exodus:      'oNkXO-izPeg',
  Leviticus:   'IJ-FekWUZzE',
  Numbers:     '8xqx2kQd-jc',
  Deuteronomy: 'q5QEH9bH8AU',

  // Historical Books
  Joshua:         'JqOqJlFF_eU',
  Judges:         'kOYy8iCfIJ4',
  Ruth:           '0YmEbDG8CCA',
  '1 Samuel':     'QJOju5Dw0V0',
  '2 Samuel':     'YvoWDXNDJgs',
  '1 Kings':      'ZvOuM6GSKOE',
  '2 Kings':      'gkDzjN2nPaA',
  '1 Chronicles': 'HR7xzFnNTHU',
  '2 Chronicles': 'HR7xzFnNTHU',
  Ezra:           'MkETkRGFqzI',
  Nehemiah:       'MkETkRGFqzI',
  Esther:         'JydNSlufRIs',

  // Wisdom Literature
  Job:              'xQwnH8th-8I',
  Psalms:           'j9phNEaPrv8',
  Proverbs:         'AzmYV8GKGRM',
  Ecclesiastes:     'VeUiuSK81-0',
  'Song of Songs':  'ID_BkTIWFng',

  // Major Prophets
  Isaiah:      'd0A6Uchb1F8',
  Jeremiah:    'RSK36cHbrk0',
  Lamentations: 'p8GDFodzmCQ',
  Ezekiel:     'R-C6tVFBMCQ',
  Daniel:      'IJ0SBObQCNE',

  // Minor Prophets
  Hosea:     'kE6SZ1ogOVU',
  Joel:      'zQLazbgz90c',
  Amos:      'mGgWaPGpGz4',
  Obadiah:   'iICSEAet8GY',
  Jonah:     'dLIabZc0O4c',
  Micah:     'MFEUEcylwLc',
  Nahum:     'Y30DanA5EhU',
  Habakkuk:  'OPMaRqGJPSE',
  Zephaniah: 'oFZknKPNvz8',
  Haggai:    'juPvv_xcX-U',
  Zechariah: 'UFd6LGUCNoQ',
  Malachi:   'Tzy8tAzn4Ho',

  // Gospels & Acts
  Matthew: 'vbPyuO8dXiI',
  Mark:    'HGHqu9-DtXk',
  Luke:    'XIb_dCIxzr0',
  John:    'G-2e9mMf7E4',
  Acts:    'CGbNw855ksw',

  // Pauline Epistles
  Romans:            'uj-Y3MZTF04',
  '1 Corinthians':   'yb1tV6_RFEw',
  '2 Corinthians':   'QJvlMSEBQ8Y',
  Galatians:         '3lfPK2vfC54',
  Ephesians:         'Y71r-T98E2Q',
  Philippians:       'oE9qqW1-BkU',
  Colossians:        'pXTXlDxQsvc',
  '1 Thessalonians': 'No7Nq6IX23c',
  '2 Thessalonians': 'kbPBDKOn1cc',
  '1 Timothy':       'RGGe3e4e5oU',
  '2 Timothy':       'urlvnxCaL00',
  Titus:             'PUEYCVXJM3k',
  Philemon:          'aW9Q3Jt9TkY',

  // General Epistles
  Hebrews:  '1fNWTZZwgbs',
  James:    'qn-hLHWwRgY',
  '1 Peter': 'WhP7AScXdkU',
  '2 Peter': 'wWLv_ITyKYc',
  '1 John':  'l3QkE6nKylM',
  '2 John':  'VhanlxUMJ1M',
  '3 John':  'VhanlxUMJ1M',
  Jude:      'vF9RWwXRxjE',
  Revelation: 'ce4qnFnE4jo',
}

/**
 * VideoOverviewCard — renders a collapsible BibleProject book overview video
 * card inside the InsightsPanel. Always visible (book-level feature, not
 * chapter-gated) so readers can access the overview at any point while studying.
 */
export default function VideoOverviewCard() {
  const book = useStudyStore((s) => s.book)
  const [expanded, setExpanded] = useState(false)

  const videoId = BOOK_VIDEO_MAP[book]
  if (!videoId) return null

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`

  return (
    <div className="rounded-lg border border-rose-200 dark:border-rose-800/50 bg-rose-50/40 dark:bg-rose-900/10 overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
          <PlayCircle size={12} />
          Book Overview — {book}
        </span>
        {expanded ? (
          <ChevronDown size={12} className="text-rose-500 dark:text-rose-400 shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-rose-500 dark:text-rose-400 shrink-0" />
        )}
      </button>

      {/* Video embed — only mounted when expanded to avoid eager network load */}
      {expanded && (
        <div className="px-3 pb-3">
          {/* 16:9 aspect ratio via padding-top trick */}
          <div
            className="relative w-full rounded-md overflow-hidden bg-black"
            style={{ paddingTop: '56.25%' }}
          >
            <iframe
              className="absolute inset-0 w-full h-full"
              src={embedUrl}
              title={`BibleProject — ${book} Overview`}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          {/* Watch on YouTube link */}
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition-colors"
          >
            <ExternalLink size={10} />
            Watch on YouTube
          </a>
        </div>
      )}
    </div>
  )
}
