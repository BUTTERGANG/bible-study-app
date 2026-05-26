import { api } from '../api/client'

/**
 * Fetch notes and highlights for a specific verse and format as markdown
 */
export async function getVerseExportData(book, chapter, verse, text, translation) {
  let notes = []
  let highlight = null
  
  try {
    // Try to fetch notes for this specific verse
    const notesRes = await api.getNotes(book, chapter, verse)
    if (notesRes && notesRes.notes) {
      notes = notesRes.notes
    }
  } catch (err) {
    console.error('Failed to fetch notes for export', err)
  }
  
  try {
    // Try to fetch highlights for this chapter
    const highlightsRes = await api.getHighlights(book, chapter, translation)
    if (highlightsRes && highlightsRes.highlights && highlightsRes.highlights[String(verse)]) {
      highlight = highlightsRes.highlights[String(verse)]
    }
  } catch (err) {
    console.error('Failed to fetch highlights for export', err)
  }

  // Format as markdown
  const lines = [
    `# ${book} ${chapter}:${verse} (${translation})`,
    '',
    `> ${text}`,
    ''
  ]
  
  if (highlight) {
    lines.push(`*Highlighted: ${highlight.color}*`)
    lines.push('')
  }
  
  if (notes.length > 0) {
    lines.push('## My Notes')
    lines.push('')
    
    notes.forEach(note => {
      if (note.title) {
        lines.push(`### ${note.title}`)
      }
      lines.push(note.content)
      lines.push('')
    })
  }
  
  lines.push('---')
  lines.push(`*Exported from LOGOS Bible Study on ${new Date().toLocaleDateString()}*`)
  
  return lines.join('\n')
}
