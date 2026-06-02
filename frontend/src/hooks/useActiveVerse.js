import { useStudyStore } from '../stores/studyStore'

/**
 * Returns the currently active verse number: the clicked/selected verse
 * takes priority over the navigation verse.
 */
export function useActiveVerse() {
  return useStudyStore((s) => s.selectedVerse || s.verse)
}
