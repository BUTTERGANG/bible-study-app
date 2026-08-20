import { useState } from 'react'
import { Pause, Play, Square, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import { useAudioBible } from './useAudioBible'
import clsx from 'clsx'

export default function AudioPlayer({ onClose }) {
  const { book, chapter, translation, currentVerses } = useStudyStore()
  const verses = currentVerses || []
  const {
    isSupported,
    isSpeaking,
    audioSpeed,
    currentVerseIdx,
    playFrom,
    pause,
    resume,
    stop,
    skipToVerse,
    cycleSpeed,
  } = useAudioBible(verses)

  const [collapsed, setCollapsed] = useState(false)

  if (!isSupported) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 shadow-lg max-w-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-red-600 dark:text-red-400">Audio not supported in this browser</span>
          <button onClick={onClose} className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      </div>
    )
  }

  const totalVerses = verses?.length || 0

  function handlePlayPause() {
    if (isSpeaking) {
      pause()
    } else if (currentVerseIdx !== null) {
      resume()
    } else {
      playFrom(0)
    }
  }

  function handlePrev() {
    const prev = Math.max(0, (currentVerseIdx ?? 0) - 1)
    skipToVerse(prev)
  }

  function handleNext() {
    const next = Math.min(totalVerses - 1, (currentVerseIdx ?? -1) + 1)
    skipToVerse(next)
  }

  return (
    <div className={clsx(
      'fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl transition-all',
      collapsed ? 'w-auto' : 'w-80'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 min-w-0">
          {isSpeaking ? (
            <Volume2 size={14} className="text-blue-500 animate-pulse flex-shrink-0" />
          ) : (
            <VolumeX size={14} className="text-gray-400 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
            {book} {chapter}
          </span>
          <span className="text-[10px] text-gray-400">{translation}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
          >
            {collapsed ? '▢' : '▁'}
          </button>
          <button
            onClick={() => { stop(); onClose?.(); }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Now playing */}
          {currentVerseIdx !== null && verses?.[currentVerseIdx] && (
            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900">
              <p className="text-[10px] text-blue-500 dark:text-blue-400 font-medium mb-0.5">
                Verse {verses[currentVerseIdx].verse}
              </p>
              <p className="text-xs text-gray-700 dark:text-gray-200 line-clamp-2 leading-relaxed">
                {verses[currentVerseIdx].text}
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="px-3 py-3 space-y-3">
            {/* Progress */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-8 text-right">
                {currentVerseIdx !== null ? currentVerseIdx + 1 : '-'}
              </span>
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${totalVerses > 0 ? ((currentVerseIdx ?? 0) / totalVerses) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 w-8">{totalVerses}</span>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handlePrev}
                disabled={currentVerseIdx === null || currentVerseIdx === 0}
                className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                <SkipBack size={16} />
              </button>

              <button
                onClick={handlePlayPause}
                className={clsx(
                  'p-2.5 rounded-full transition-colors',
                  isSpeaking
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60'
                )}
              >
                {isSpeaking ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <button
                onClick={() => { stop(); }}
                className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Square size={14} />
              </button>

              <button
                onClick={handleNext}
                disabled={currentVerseIdx === null || currentVerseIdx >= totalVerses - 1}
                className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                <SkipForward size={16} />
              </button>
            </div>

            {/* Speed */}
            <div className="flex items-center justify-center">
              <button
                onClick={cycleSpeed}
                className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {audioSpeed}x
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
