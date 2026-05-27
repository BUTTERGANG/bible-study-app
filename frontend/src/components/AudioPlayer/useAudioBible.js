import { useCallback, useEffect, useRef, useState } from 'react'
import { useStudyStore } from '../../stores/studyStore'

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5]

/**
 * Hook managing Web Speech API (speechSynthesis) for Bible audio playback.
 * Provides verse-by-verse playback with approximate verse boundary tracking.
 */
export function useAudioBible(verses) {
  const { audioPlaying, setAudioPlaying, audioSpeed, setAudioSpeed, currentVerseIdx, setCurrentVerseIdx } = useStudyStore()

  const [isSupported, setIsSupported] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)

  const verseIndexRef = useRef(0)
  const utteranceRef = useRef(null)
  const onEndCallbackRef = useRef(null)

  // Check support
  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
    setIsSupported(supported)
  }, [])

  // Load voices
  useEffect(() => {
    if (!isSupported) return

    function loadVoices() {
      const availableVoices = window.speechSynthesis.getVoices()
      if (availableVoices.length > 0) {
        setVoices(availableVoices)
        // Prefer an English voice with good quality
        const english = availableVoices.find(v => v.lang.startsWith('en') && v.localService) ||
                        availableVoices.find(v => v.lang.startsWith('en')) ||
                        availableVoices[0]
        setSelectedVoice(english)
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [isSupported])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel()
      }
    }
  }, [isSupported])

  // Sync store state -> actual speaking
  useEffect(() => {
    if (audioPlaying && !isSpeaking) {
      // Auto-start if store says playing but we're not speaking
      // This shouldn't normally happen; the controls call play/pause directly.
    }
  }, [audioPlaying, isSpeaking])

  function speakVerse(verseText, verseNum) {
    return new Promise((resolve) => {
      if (!isSupported) { resolve(); return }

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(verseText)
      utterance.rate = audioSpeed
      utterance.voice = selectedVoice
      utterance.pitch = 1

      utterance.onend = () => {
        resolve()
      }

      utterance.onerror = (e) => {
        console.warn('Speech error:', e)
        resolve()
      }

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    })
  }

  async function playFrom(startVerseIndex = 0) {
    if (!isSupported || !verses?.length) return

    setIsSpeaking(true)
    setAudioPlaying(true)
    verseIndexRef.current = startVerseIndex

    for (let i = startVerseIndex; i < verses.length; i++) {
      verseIndexRef.current = i
      setCurrentVerseIdx(i)

      const verse = verses[i]
      // Speak verse number + text
      const textToSpeak = `Verse ${verse.verse}. ${verse.text}`
      await speakVerse(textToSpeak, verse.verse)

      // Check if we were paused between verses
      if (!useStudyStore.getState().audioPlaying) {
        break
      }
    }

    setIsSpeaking(false)
    setAudioPlaying(false)
    setCurrentVerseIdx(null)
  }

  function pause() {
    if (!isSupported) return
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setAudioPlaying(false)
  }

  function resume() {
    if (!isSupported) return
    playFrom(verseIndexRef.current)
  }

  function stop() {
    if (!isSupported) return
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setAudioPlaying(false)
    setCurrentVerseIdx(null)
    verseIndexRef.current = 0
  }

  function skipToVerse(verseIndex) {
    const wasPlaying = isSpeaking || audioPlaying
    if (wasPlaying) {
      window.speechSynthesis.cancel()
    }
    pause()
    if (wasPlaying) {
      // Small delay to let cancel finish
      setTimeout(() => playFrom(verseIndex), 50)
    } else {
      verseIndexRef.current = verseIndex
      setCurrentVerseIdx(verseIndex)
    }
  }

  function cycleSpeed() {
    const currentIdx = SPEEDS.indexOf(audioSpeed)
    const nextIdx = (currentIdx + 1) % SPEEDS.length
    const newSpeed = SPEEDS[nextIdx]
    setAudioSpeed(newSpeed)

    // If currently speaking, restart current verse at new speed
    if (isSpeaking) {
      const current = verseIndexRef.current
      window.speechSynthesis.cancel()
      setTimeout(() => playFrom(current), 50)
    }
  }

  return {
    isSupported,
    isSpeaking,
    audioSpeed,
    currentVerseIdx,
    voices,
    selectedVoice,
    setSelectedVoice,
    playFrom,
    pause,
    resume,
    stop,
    skipToVerse,
    cycleSpeed,
    speeds: SPEEDS,
  }
}
