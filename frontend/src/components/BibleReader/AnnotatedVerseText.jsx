/**
 * AnnotatedVerseText — renders a verse's plain text with word-level annotation overlays.
 *
 * Responsibilities:
 *   1. Split verse text into word tokens (preserving punctuation attachment).
 *   2. For each token, check whether any annotation's [start, end] range covers it.
 *   3. Render annotated runs with a colored underline + background tint.
 *   4. On hover of an annotated run → show tooltip preview.
 *   5. On click of an annotated run → open AnnotationEditor to edit/delete.
 *   6. On mouseup/touchend over the verse → detect selection, compute word offsets,
 *      show "Add Note" affordance, open AnnotationEditor to create.
 *
 * Props:
 *   text             {string}  — raw verse text
 *   verse            {number}  — verse number (1-based)
 *   book             {string}
 *   chapter          {number}
 *   verseAnnotations {Array}   — annotations for this verse from useAnnotations
 *   onCreateAnnotation(data)   — called with create payload
 *   onUpdateAnnotation(data)   — called with { id, content, color }
 *   onDeleteAnnotation(id)     — called with annotation id
 */

import { useCallback, useRef, useState } from 'react'
import clsx from 'clsx'
import AnnotationEditor from './AnnotationEditor'

// ── Color mapping ────────────────────────────────────────────────────────────

const COLOR_CLASSES = {
  yellow:
    'border-b-2 border-amber-400 bg-amber-50/40 dark:border-amber-500 dark:bg-amber-900/15',
  blue: 'border-b-2 border-blue-400 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-900/15',
  green:
    'border-b-2 border-green-400 bg-green-50/40 dark:border-green-500 dark:bg-green-900/15',
  pink: 'border-b-2 border-pink-400 bg-pink-50/40 dark:border-pink-500 dark:bg-pink-900/15',
}

const COLOR_DOT = {
  yellow: 'bg-amber-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  pink: 'bg-pink-400',
}

// ── Token helpers ────────────────────────────────────────────────────────────

/**
 * Tokenise a verse string into word tokens preserving trailing punctuation.
 * Returns an array of { token: string, index: number }.
 * Spaces between words are kept as null separators so we can re-join them.
 *
 * Strategy: split on whitespace, keep each chunk (word + any trailing punctuation)
 * as one token. Index is the 0-based word position.
 */
function tokenise(text) {
  if (!text) return []
  const raw = text.split(/(\s+)/)
  const tokens = []
  let wordIdx = 0
  for (const chunk of raw) {
    if (/^\s+$/.test(chunk)) {
      tokens.push({ type: 'space', value: chunk })
    } else {
      tokens.push({ type: 'word', value: chunk, index: wordIdx })
      wordIdx++
    }
  }
  return tokens
}

/**
 * Given a list of annotations and a word index, return the annotation that
 * covers this index (first one wins if overlapping).
 */
function annotationForWord(annotations, idx) {
  if (!annotations) return null
  for (const ann of annotations) {
    if (idx >= ann.word_start && idx <= ann.word_end) return ann
  }
  return null
}

/**
 * Given a Selection object and the verse container element, compute
 * { start, end, anchorText } word offsets.
 * Returns null if no valid selection spans only word-span children.
 */
function computeWordOffsets(selection, containerEl) {
  if (!selection || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  if (!range || range.collapsed) return null

  // Walk span children to find first and last spanned words
  const spans = Array.from(containerEl.querySelectorAll('[data-word-idx]'))
  if (!spans.length) return null

  let start = null
  let end = null
  for (const span of spans) {
    if (selection.containsNode(span, true)) {
      const idx = parseInt(span.dataset.wordIdx, 10)
      if (start === null || idx < start) start = idx
      if (end === null || idx > end) end = idx
    }
  }
  if (start === null) return null

  // Collect anchor text from the spanned words
  const anchorText = spans
    .filter((s) => {
      const i = parseInt(s.dataset.wordIdx, 10)
      return i >= start && i <= end
    })
    .map((s) => s.textContent)
    .join(' ')
    .slice(0, 200)

  return { start, end, anchorText }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AnnotatedVerseText({
  text,
  verse,
  book,
  chapter,
  verseAnnotations,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
}) {
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState(null) // { ann, x, y }
  const [editor, setEditor] = useState(null)   // { annotation|null, anchorText, x, y, start, end }

  const tokens = tokenise(text)

  // ── Selection handler ──────────────────────────────────────────────────
  const handleMouseUp = useCallback(
    (e) => {
      // If clicking on an already-annotated span, let that handler take over
      if (e.target.dataset.annotationId) return

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !containerRef.current) return

      const offsets = computeWordOffsets(sel, containerRef.current)
      if (!offsets) return

      // Clear the browser selection so it doesn't linger
      sel.removeAllRanges()

      setEditor({
        annotation: null,
        anchorText: offsets.anchorText,
        position: { x: e.clientX, y: e.clientY },
        verse,
        wordStart: offsets.start,
        wordEnd: offsets.end,
      })
    },
    [verse]
  )

  // ── Annotated span click ───────────────────────────────────────────────
  const handleAnnotationClick = useCallback(
    (e, ann) => {
      e.stopPropagation()
      setTooltip(null)
      setEditor({
        annotation: ann,
        anchorText: ann.anchor_text,
        position: { x: e.clientX, y: e.clientY },
        verse,
        wordStart: ann.word_start,
        wordEnd: ann.word_end,
      })
    },
    [verse]
  )

  // ── Render ────────────────────────────────────────────────────────────

  // Group consecutive annotated words into runs so we don't wrap each
  // word in a separate interactive element — better UX for multi-word annotations.
  // We render token by token; when multiple adjacent words share the same annotation
  // id, they are wrapped together.

  // First: build rendered token spans
  let i = 0
  const rendered = []
  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok.type === 'space') {
      rendered.push(<span key={`sp-${i}`}>{tok.value}</span>)
      i++
      continue
    }

    const ann = annotationForWord(verseAnnotations, tok.index)
    if (!ann) {
      // Plain word
      rendered.push(
        <span key={`w-${i}`} data-word-idx={tok.index}>
          {tok.value}
        </span>
      )
      i++
      continue
    }

    // Collect all tokens belonging to this annotation run
    const runStart = i
    const runTokens = []
    while (i < tokens.length) {
      const t = tokens[i]
      if (t.type === 'space') {
        // Include the space if the next word token is also in this annotation
        const next = tokens[i + 1]
        if (
          next &&
          next.type === 'word' &&
          annotationForWord(verseAnnotations, next.index)?.id === ann.id
        ) {
          runTokens.push(t)
          i++
        } else {
          break
        }
      } else if (t.type === 'word') {
        const a2 = annotationForWord(verseAnnotations, t.index)
        if (a2?.id === ann.id) {
          runTokens.push(t)
          i++
        } else {
          break
        }
      }
    }

    // Build the run element
    const colorClass = COLOR_CLASSES[ann.color] ?? COLOR_CLASSES.yellow
    rendered.push(
      <span
        key={`ann-run-${runStart}`}
        data-annotation-id={ann.id}
        role="button"
        tabIndex={0}
        onClick={(e) => handleAnnotationClick(e, ann)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleAnnotationClick(e, ann)
          }
        }}
        onMouseEnter={(e) => {
          setTooltip({
            ann,
            x: e.clientX,
            y: e.clientY,
          })
        }}
        onMouseLeave={() => setTooltip(null)}
        className={clsx(
          'cursor-pointer rounded-sm transition-colors',
          colorClass
        )}
      >
        {runTokens.map((t, ri) =>
          t.type === 'space' ? (
            <span key={ri}>{t.value}</span>
          ) : (
            <span key={ri} data-word-idx={t.index}>
              {t.value}
            </span>
          )
        )}
      </span>
    )
  }

  return (
    <>
      <span
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="select-text"
      >
        {rendered}
        {' '}
      </span>

      {/* Tooltip preview */}
      {tooltip && !editor && (
        <AnnotationTooltip ann={tooltip.ann} x={tooltip.x} y={tooltip.y} />
      )}

      {/* Editor popover */}
      {editor && (
        <AnnotationEditor
          annotation={editor.annotation}
          anchorText={editor.anchorText}
          position={editor.position}
          book={book}
          chapter={chapter}
          verse={editor.verse}
          wordStart={editor.wordStart}
          wordEnd={editor.wordEnd}
          onSave={editor.annotation ? onUpdateAnnotation : onCreateAnnotation}
          onDelete={onDeleteAnnotation}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function AnnotationTooltip({ ann, x, y }) {
  const TOOLTIP_W = 220
  const vw = window.innerWidth
  let left = x + 8
  if (left + TOOLTIP_W > vw - 8) left = x - TOOLTIP_W - 8

  const dotCls = COLOR_DOT[ann.color] ?? COLOR_DOT.yellow

  return (
    <div
      style={{ left, top: y + 14 }}
      className={clsx(
        'fixed z-40 pointer-events-none max-w-[220px]',
        'rounded-lg shadow-lg border px-3 py-2',
        'bg-white dark:bg-gray-800',
        'border-gray-200 dark:border-gray-700'
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={clsx('inline-block w-2 h-2 rounded-full', dotCls)} />
        <span className="text-xs text-gray-500 dark:text-gray-400 italic truncate max-w-[180px]">
          &ldquo;{ann.anchor_text}&rdquo;
        </span>
      </div>
      {ann.content && (
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug line-clamp-3">
          {ann.content}
        </p>
      )}
      {!ann.content && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          Click to add note…
        </p>
      )}
    </div>
  )
}
