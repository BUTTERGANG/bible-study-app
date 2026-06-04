import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, RotateCcw, Save, FolderOpen, HelpCircle } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { api } from '../../api/client'
import clsx from 'clsx'

const GREEK_POS_OPTIONS = [
  { value: '', label: 'Any part of speech' },
  { value: 'verb', label: 'Verb' },
  { value: 'noun', label: 'Noun' },
  { value: 'adjective', label: 'Adjective' },
  { value: 'pronoun', label: 'Pronoun' },
  { value: 'preposition', label: 'Preposition' },
  { value: 'conjunction', label: 'Conjunction' },
  { value: 'adverb', label: 'Adverb' },
  { value: 'article', label: 'Article' },
]

const HEBREW_POS_OPTIONS = [
  { value: '', label: 'Any part of speech' },
  { value: 'verb', label: 'Verb' },
  { value: 'noun', label: 'Noun' },
  { value: 'adjective', label: 'Adjective' },
  { value: 'pronoun', label: 'Pronoun' },
  { value: 'preposition', label: 'Preposition' },
  { value: 'conjunction', label: 'Conjunction' },
  { value: 'adverb', label: 'Adverb' },
  { value: 'article', label: 'Article' },
  { value: 'proper-noun', label: 'Proper Noun' },
]

const TENSE_OPTIONS = [
  { value: '', label: 'Any tense/stem' },
  { value: 'present', label: 'Present / Qal' },
  { value: 'imperfect', label: 'Imperfect / Niphal' },
  { value: 'future', label: 'Future / Piel' },
  { value: 'aorist', label: 'Aorist / Pual' },
  { value: 'perfect', label: 'Perfect / Hiphil' },
  { value: 'pluperfect', label: 'Pluperfect / Hophal' },
]

const VOICE_OPTIONS = [
  { value: '', label: 'Any voice' },
  { value: 'active', label: 'Active' },
  { value: 'middle', label: 'Middle' },
  { value: 'passive', label: 'Passive' },
  { value: 'middle-passive', label: 'Middle/Passive' },
  { value: 'deponent', label: 'Deponent' },
]

const MOOD_OPTIONS = [
  { value: '', label: 'Any mood' },
  { value: 'indicative', label: 'Indicative' },
  { value: 'subjunctive', label: 'Subjunctive' },
  { value: 'optative', label: 'Optative' },
  { value: 'imperative', label: 'Imperative' },
  { value: 'infinitive', label: 'Infinitive' },
  { value: 'participle', label: 'Participle' },
]

const PERSON_OPTIONS = [
  { value: '', label: 'Any person' },
  { value: '1st', label: '1st person' },
  { value: '2nd', label: '2nd person' },
  { value: '3rd', label: '3rd person' },
]

const NUMBER_OPTIONS = [
  { value: '', label: 'Any number' },
  { value: 'singular', label: 'Singular' },
  { value: 'plural', label: 'Plural' },
]

const GENDER_OPTIONS = [
  { value: '', label: 'Any gender' },
  { value: 'masculine', label: 'Masculine' },
  { value: 'feminine', label: 'Feminine' },
  { value: 'neuter', label: 'Neuter' },
]

const CASE_OPTIONS = [
  { value: '', label: 'Any case' },
  { value: 'nominative', label: 'Nominative' },
  { value: 'genitive', label: 'Genitive' },
  { value: 'dative', label: 'Dative' },
  { value: 'accusative', label: 'Accusative' },
  { value: 'vocative', label: 'Vocative' },
]

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Entire Bible' },
  { value: 'nt', label: 'New Testament' },
  { value: 'ot', label: 'Old Testament' },
  { value: 'book', label: 'Current book' },
]

const LANGUAGE_OPTIONS = [
  { value: 'greek', label: 'Greek (NT)' },
  { value: 'hebrew', label: 'Hebrew (OT)' },
]

function SelectField({ label, value, onChange, options, disabled }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-400 disabled:opacity-40"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

function MorphHelpPanel({ language }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200 space-y-2">
      <p className="font-semibold">Morphology 101 — {language === 'greek' ? 'Greek (Robinson)' : 'Hebrew (Westminster)'}</p>
      {language === 'greek' ? (
        <>
          <p>Greek morphology codes have the form <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">POS-TVM-PN-CG</code>:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li><strong>POS</strong> — Part of speech (V=verb, N=noun, A=adj, etc.)</li>
            <li><strong>T</strong> — Tense (P=present, A=aorist, F=future, R=perfect)</li>
            <li><strong>V</strong> — Voice (A=active, M=middle, P=passive)</li>
            <li><strong>M</strong> — Mood (I=indicative, S=subjunctive, M=imperative, P=participle)</li>
            <li><strong>PN</strong> — Person & Number (1S=1st singular, 3P=3rd plural)</li>
            <li><strong>CG</strong> — Case & Gender (NPM=nominative plural masculine)</li>
          </ul>
          <p className="text-blue-600 dark:text-blue-300">Example: "V-PAI-3S" = Verb, Present Active Indicative, 3rd Singular</p>
        </>
      ) : (
        <>
          <p>Hebrew morphology codes have the form <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">POS-STEM-PGN</code>:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li><strong>POS</strong> — Part of speech (V=verb, N=noun, etc.)</li>
            <li><strong>STEM</strong> — Stem/binyan (Q=qal, N=niphal, P=piel, H=hiphil)</li>
            <li><strong>PGN</strong> — Person, Gender, Number (3ms=3rd masc. singular)</li>
          </ul>
          <p className="text-blue-600 dark:text-blue-300">Example: "V-Qal-3ms" = Verb, Qal stem, 3rd masculine singular</p>
        </>
      )}
    </div>
  )
}

export default function MorphSearchModal({ onClose }) {
  const { book, setReference } = useStudyStore()

  // Query state
  const [language, setLanguage] = useState('greek')
  const [pos, setPos] = useState('')
  const [tense, setTense] = useState('')
  const [voice, setVoice] = useState('')
  const [mood, setMood] = useState('')
  const [person, setPerson] = useState('')
  const [number, setNumber] = useState('')
  const [gender, setGender] = useState('')
  const [case_, setCase] = useState('')
  const [scope, setScope] = useState('all')

  // Results state
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeIdx, setActiveIdx] = useState(-1)

  // UI state
  const [showHelp, setShowHelp] = useState(false)
  const [savedQueries, setSavedQueries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('morph-saved-queries') || '[]')
    } catch { return [] }
  })
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [saveName, setSaveName] = useState('')

  const listRef = useRef(null)
  const saveInputRef = useRef(null)

  const posOptions = language === 'greek' ? GREEK_POS_OPTIONS : HEBREW_POS_OPTIONS
  const isVerbSelected = pos === 'verb'

  // Reset dependent fields when language or POS changes
  useEffect(() => {
    setTense(''); setVoice(''); setMood('')
    setPerson(''); setNumber(''); setGender(''); setCase('')
  }, [language, pos])

  const buildQuery = useCallback(() => {
    const q = { language, scope }
    if (pos) q.part_of_speech = pos
    if (tense) q.tense = tense
    if (voice && isVerbSelected) q.voice = voice
    if (mood && isVerbSelected) q.mood = mood
    if (person && isVerbSelected) q.person = person
    if (number) q.number = number
    if (gender) q.gender = gender
    if (case_) q.case = case_
    if (scope === 'book' && book) q.book = book
    return q
  }, [language, pos, tense, voice, mood, person, number, gender, case_, scope, book, isVerbSelected])

  async function executeSearch() {
    setLoading(true)
    setError(null)
    setResults(null)
    setActiveIdx(-1)
    try {
      const data = await api.morphSearch(buildQuery())
      setResults(data)
    } catch (err) {
      setError(err.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  function handleSave() {
    if (!saveName.trim()) return
    const query = buildQuery()
    const entry = { name: saveName.trim(), query, savedAt: new Date().toISOString() }
    const updated = [...savedQueries.filter((q) => q.name !== entry.name), entry]
    setSavedQueries(updated)
    localStorage.setItem('morph-saved-queries', JSON.stringify(updated))
    setSaveName('')
    setShowSaveDialog(false)
  }

  function handleLoad(query) {
    setLanguage(query.language || 'greek')
    setPos(query.part_of_speech || '')
    setTense(query.tense || '')
    setVoice(query.voice || '')
    setMood(query.mood || '')
    setPerson(query.person || '')
    setNumber(query.number || '')
    setGender(query.gender || '')
    setCase(query.case || '')
    setScope(query.scope || 'all')
    setShowLoadDialog(false)
  }

  function handleDeleteSaved(index) {
    const updated = savedQueries.filter((_, i) => i !== index)
    setSavedQueries(updated)
    localStorage.setItem('morph-saved-queries', JSON.stringify(updated))
  }

  function handleReset() {
    setPos(''); setTense(''); setVoice(''); setMood('')
    setPerson(''); setNumber(''); setGender(''); setCase('')
    setScope('all')
    setResults(null)
    setError(null)
    setActiveIdx(-1)
  }

  function navigate(result) {
    setReference(result.book, result.chapter, result.verse)
    onClose()
  }

  const resultList = results?.results ?? []

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      if (showSaveDialog) { setShowSaveDialog(false); return }
      if (showLoadDialog) { setShowLoadDialog(false); return }
      onClose()
      return
    }
    if (resultList.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((prev) => {
        const next = prev < resultList.length - 1 ? prev + 1 : 0
        const list = listRef.current
        if (list) list.children[next]?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((prev) => {
        const next = prev > 0 ? prev - 1 : resultList.length - 1
        const list = listRef.current
        if (list) list.children[next]?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      navigate(resultList[activeIdx])
    }
  }, [resultList, activeIdx, onClose, showSaveDialog, showLoadDialog])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Focus save input when dialog opens
  useEffect(() => {
    if (showSaveDialog) saveInputRef.current?.focus()
  }, [showSaveDialog])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-12 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="morph-search-title"
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <Search size={18} className="text-purple-500 flex-shrink-0" />
          <h2 id="morph-search-title" className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1">Morphological Search</h2>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-gray-400 hover:text-blue-500 p-1 rounded"
            title="Morphology help"
          >
            <HelpCircle size={16} />
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={18} />
          </button>
        </div>

        {/* Help panel */}
        {showHelp && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <MorphHelpPanel language={language} />
          </div>
        )}

        {/* Query builder */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-3">
          {/* Row 1: Language + Scope */}
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Language" value={language} onChange={setLanguage} options={LANGUAGE_OPTIONS} />
            <SelectField label="Scope" value={scope} onChange={setScope} options={SCOPE_OPTIONS} />
          </div>

          {/* Row 2: Part of Speech */}
          <SelectField label="Part of Speech" value={pos} onChange={setPos} options={posOptions} />

          {/* Row 3: Verb-specific fields */}
          {isVerbSelected && (
            <div className="grid grid-cols-3 gap-3">
              <SelectField label="Tense" value={tense} onChange={setTense} options={TENSE_OPTIONS} />
              <SelectField label="Voice" value={voice} onChange={setVoice} options={VOICE_OPTIONS} />
              <SelectField label="Mood" value={mood} onChange={setMood} options={MOOD_OPTIONS} />
            </div>
          )}

          {/* Row 4: Person, Number, Gender, Case */}
          <div className="grid grid-cols-4 gap-3">
            <SelectField label="Person" value={person} onChange={setPerson} options={PERSON_OPTIONS} disabled={!isVerbSelected} />
            <SelectField label="Number" value={number} onChange={setNumber} options={NUMBER_OPTIONS} />
            <SelectField label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} />
            <SelectField label="Case" value={case_} onChange={setCase} options={CASE_OPTIONS} />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={executeSearch}
              disabled={loading}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
            >
              <Search size={14} />
              {loading ? 'Searching…' : 'Search'}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1.5 rounded text-sm transition-colors"
              title="Reset all filters"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setShowSaveDialog(true)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1.5 rounded text-sm transition-colors"
              title="Save this query"
            >
              <Save size={14} />
              Save
            </button>
            <button
              onClick={() => setShowLoadDialog(true)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1.5 rounded text-sm transition-colors"
              title="Load a saved query"
            >
              <FolderOpen size={14} />
              Load
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto" ref={listRef}>
          {loading && (
            <div className="p-4 text-sm text-gray-400 text-center">Searching morphology…</div>
          )}

          {error && (
            <div className="p-4 text-sm text-red-500 text-center">{error}</div>
          )}

          {!loading && !error && results?.results?.length === 0 && (
            <div className="p-4 text-sm text-gray-400 text-center">
              No matches found. Try broadening your search criteria.
            </div>
          )}

          {resultList.map((result, i) => (
            <button
              key={`${result.book}-${result.chapter}-${result.verse}-${result.word_position}-${i}`}
              onClick={() => navigate(result)}
              className={clsx(
                'w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-700 transition-colors',
                activeIdx === i
                  ? 'bg-purple-50 dark:bg-purple-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                  {result.reference}
                </span>
                <div className="flex items-center gap-2">
                  {result.morphology && (
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                      {result.morphology}
                    </code>
                  )}
                  {result.strongs_num && (
                    <span className="text-xs text-gray-400">G{result.strongs_num}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{result.word}</span>
                {result.english_gloss && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">({result.english_gloss})</span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-snug">
                {result.verse_text}
              </p>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-400 flex-shrink-0">
          <span>↑↓ to navigate · Enter to go · Esc to close</span>
          {results && <span>{results.count} result{results.count !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/30 z-60 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-80 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Save Query</h3>
            <input
              ref={saveInputRef}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Query name…"
              className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowSaveDialog(false); setSaveName('') }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load dialog */}
      {showLoadDialog && (
        <div className="fixed inset-0 bg-black/30 z-60 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-96 max-h-80 flex flex-col space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Load Saved Query</h3>
            {savedQueries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No saved queries yet.</p>
            ) : (
              <div className="overflow-y-auto space-y-1 flex-1">
                {savedQueries.map((sq, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 group"
                  >
                    <button
                      onClick={() => handleLoad(sq.query)}
                      className="flex-1 text-left"
                    >
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{sq.name}</div>
                      <div className="text-xs text-gray-400">
                        {sq.query.part_of_speech || 'Any POS'}
                        {sq.query.tense ? ` · ${sq.query.tense}` : ''}
                        {sq.query.mood ? ` · ${sq.query.mood}` : ''}
                        {sq.query.language === 'hebrew' ? ' (Hebrew)' : ' (Greek)'}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(i)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="Delete"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setShowLoadDialog(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
