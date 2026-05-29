import { api } from '../api/client'

/**
 * Fetch notes and highlights for a specific verse and format as markdown
 */
export async function getVerseExportData(book, chapter, verse, text, translation) {
  let notes = []
  let highlight = null

  try {
    const notesRes = await api.getNotes(book, chapter, verse)
    if (notesRes && notesRes.notes) {
      notes = notesRes.notes
    }
  } catch (err) {
    console.error('Failed to fetch notes for export', err)
  }

  try {
    const highlightsRes = await api.getHighlights(book, chapter, translation)
    if (highlightsRes && highlightsRes.highlights && highlightsRes.highlights[String(verse)]) {
      highlight = highlightsRes.highlights[String(verse)]
    }
  } catch (err) {
    console.error('Failed to fetch highlights for export', err)
  }

  const lines = [
    `# ${book} ${chapter}:${verse} (${translation})`,
    '',
    `> ${text}`,
    '',
  ]

  if (highlight) {
    lines.push(`*Highlighted: ${highlight.color}*`)
    lines.push('')
  }

  if (notes.length > 0) {
    lines.push('## My Notes')
    lines.push('')
    notes.forEach((note) => {
      if (note.title) lines.push(`### ${note.title}`)
      lines.push(note.content)
      lines.push('')
    })
  }

  lines.push('---')
  lines.push(`*Exported from LOGOS Bible Study on ${new Date().toLocaleDateString()}*`)

  return lines.join('\n')
}

/**
 * Fetch export data for an entire chapter (passage export).
 * Returns structured data suitable for print/PDF rendering.
 */
export async function getPassageExportData(translation, book, chapter, options = {}) {
  const {
    includeNotes = true,
    includeHighlights = true,
    includeCommentary = false,
  } = options

  // Fetch chapter text
  const chapterData = await api.getChapter(translation, book, chapter)
  if (!chapterData?.verses) throw new Error('Failed to fetch chapter')

  // Fetch optional data in parallel
  const [notesRes, highlightsRes] = await Promise.allSettled([
    includeNotes ? api.getNotes(book, chapter) : Promise.resolve(null),
    includeHighlights ? api.getHighlights(book, chapter, translation) : Promise.resolve(null),
  ])

  const notes = notesRes.status === 'fulfilled' && notesRes.value?.notes ? notesRes.value.notes : []
  const highlights = highlightsRes.status === 'fulfilled' && highlightsRes.value?.highlights
    ? highlightsRes.value.highlights
    : {}

  return {
    book,
    chapter,
    translation,
    verses: chapterData.verses,
    notes,
    highlights,
    includes: { notes: includeNotes, highlights: includeHighlights, commentary: includeCommentary },
    exportedAt: new Date().toISOString(),
  }
}

/**
 * Trigger a browser print dialog for a passage.
 * Opens a new window with print-ready HTML and invokes window.print().
 */
export function printPassage(exportData) {
  const { book, chapter, translation, verses, notes, highlights, includes } = exportData

  const highlightColors = {
    yellow: '#fef9c3',
    blue: '#dbeafe',
    green: '#dcfce7',
    pink: '#fce7f3',
    orange: '#ffedd5',
  }

  const versesHtml = verses.map(({ verse, text }) => {
    const hl = highlights[String(verse)]
    const bgStyle = hl ? `background-color: ${highlightColors[hl.color] || 'transparent'};` : ''
    return `<p class="verse" style="${bgStyle}"><sup class="vnum">${verse}</sup> ${escapeHtml(text)}</p>`
  }).join('\n')

  const notesHtml = includes.notes && notes.length > 0
    ? `<div class="notes-section"><h2>Notes</h2>${notes.map((n) => `<div class="note">${n.title ? `<h3>${escapeHtml(n.title)}</h3>` : ''}<p>${escapeHtml(n.content).replace(/\n/g, '<br>')}</p></div>`).join('\n')}</div>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${book} ${chapter} (${translation})</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.7; color: #1a1a1a; max-width: 6in; margin: 0 auto; padding: 0.5in; }
    h1 { font-size: 18pt; text-align: center; margin-bottom: 0.15in; }
    .sub { text-align: center; font-size: 10pt; color: #555; margin-bottom: 0.3in; }
    .divider { border: none; border-top: 1px solid #ccc; margin-bottom: 0.3in; }
    .verse { margin-bottom: 0.08in; text-align: justify; orphans: 3; widows: 3; }
    .vnum { font-size: 8pt; color: #888; font-family: sans-serif; margin-right: 0.15in; }
    .notes-section { margin-top: 0.4in; border-top: 1px solid #ccc; padding-top: 0.2in; page-break-before: always; }
    .notes-section h2 { font-size: 14pt; margin-bottom: 0.15in; }
    .note { margin-bottom: 0.15in; padding: 0.1in; background: #fffde7; border-left: 3px solid #f0c040; }
    .note h3 { font-size: 11pt; margin-bottom: 0.05in; }
    .note p { font-size: 10pt; }
    .footer { text-align: center; font-size: 8pt; color: #999; margin-top: 0.3in; border-top: 1px solid #ddd; padding-top: 0.1in; }
    @media print { body { padding: 0; } .notes-section { page-break-before: auto; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(book)} ${chapter}</h1>
  <p class="sub">${escapeHtml(translation)}</p>
  <hr class="divider">
  ${versesHtml}
  ${notesHtml}
  <p class="footer">Exported from LOGOS Bible Study &mdash; ${new Date().toLocaleDateString()}</p>
</body>
</html>`

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Please allow pop-ups to print passages.')
    return
  }
  printWindow.document.write(html)
  printWindow.document.close()
  // Wait for content to render, then trigger print
  printWindow.onload = () => {
    printWindow.print()
  }
  // Fallback: print after a short delay for browsers that don't fire onload for document.write
  setTimeout(() => printWindow.print(), 500)
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
