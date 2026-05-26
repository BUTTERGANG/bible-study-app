import { useState, useRef } from 'react'
import { Download, X, Copy, Check } from 'lucide-react'
import html2canvas from 'html2canvas'

const THEMES = [
  {
    id: 'plain',
    label: 'Plain',
    card: 'bg-white',
    quote: 'text-gray-900',
    ref: 'text-gray-500',
    border: 'border border-gray-200',
    dot: 'bg-gray-200',
  },
  {
    id: 'dark',
    label: 'Dark',
    card: 'bg-gray-900',
    quote: 'text-white',
    ref: 'text-gray-400',
    border: '',
    dot: 'bg-gray-700',
  },
  {
    id: 'nature',
    label: 'Nature',
    card: 'bg-gradient-to-br from-emerald-800 to-teal-900',
    quote: 'text-emerald-50',
    ref: 'text-emerald-300',
    border: '',
    dot: 'bg-emerald-700',
  },
  {
    id: 'classic',
    label: 'Classic',
    card: 'bg-gradient-to-br from-amber-50 to-orange-100',
    quote: 'text-amber-900',
    ref: 'text-amber-700',
    border: 'border border-amber-200',
    dot: 'bg-amber-200',
  },
]

export default function ShareCardModal({ verse, text, book, chapter, translation, note, onClose }) {
  const [theme, setTheme] = useState(THEMES[3])
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef(null)

  const reference = `${book} ${chapter}:${verse} (${translation})`

  async function capture() {
    if (!cardRef.current) return null
    return html2canvas(cardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false,
    })
  }

  async function handleDownload() {
    setExporting(true)
    try {
      const canvas = await capture()
      const link = document.createElement('a')
      link.download = `${book}-${chapter}-${verse}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setExporting(false)
    }
  }

  async function handleCopy() {
    try {
      const canvas = await capture()
      canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ])
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }, 'image/png')
    } catch {
      // Clipboard API may be blocked; fall back to download
      handleDownload()
    }
  }

  async function handleNativeShare() {
    try {
      const canvas = await capture()
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `${book}-${chapter}-${verse}.png`, { type: 'image/png' })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: reference })
        } else {
          handleDownload()
        }
      }, 'image/png')
    } catch {
      handleDownload()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Share as Card</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>

        {/* Card preview */}
        <div
          ref={cardRef}
          className={`relative rounded-xl p-8 flex flex-col justify-between ${theme.card} ${theme.border}`}
          style={{ aspectRatio: '16/9', minHeight: 200 }}
        >
          {/* Decorative quote mark */}
          <div className={`absolute top-4 left-6 text-6xl font-serif leading-none ${theme.quote} opacity-10`}>
            "
          </div>

          <div className="relative z-10 flex-1 flex items-center">
            <blockquote className={`text-base leading-relaxed font-medium ${theme.quote}`}>
              "{text}"
              {note && (
                <p className={`mt-3 text-xs opacity-75 not-italic font-normal ${theme.quote}`}>
                  {note}
                </p>
              )}
            </blockquote>
          </div>

          <p className={`text-xs font-semibold mt-4 text-right ${theme.ref}`}>
            — {reference}
          </p>
        </div>

        {/* Theme selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Theme:</span>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t)}
              title={t.label}
              className={`w-7 h-7 rounded-full ${t.dot} border-2 transition-all ${
                theme.id === t.id
                  ? 'border-blue-500 scale-110'
                  : 'border-transparent hover:border-gray-300'
              }`}
            />
          ))}
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">{theme.label}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            <Download size={14} />
            {exporting ? 'Generating…' : 'Download PNG'}
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>

          {(navigator.share || navigator.canShare) && (
            <button
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Share
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
