import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const FONT_SIZES = ['0.9rem', '1.05rem', '1.2rem', '1.4rem']

// Convention: state lives as plain values, never as getter properties.
// Zustand's `set()` does an Object.assign copy that evaluates getters at copy
// time, freezing them and producing stale values after the next set. Derived
// fields belong in selectors below (or in components), not in state.

export const useStudyStore = create(
  persist(
    (set) => ({
      // Navigation state — also reflected in the URL via useUrlSync.
      book: 'John',
      chapter: 3,
      verse: null,
      translation: 'KJV',

      // UI state
      rightPanel: 'commentary', // 'commentary' | 'ai' | 'notes' | 'word-study'
      sidebarOpen: true,
      rightPanelOpen: true,
      interlinearMode: false,
      darkMode: false,
      fontSizeIdx: 1,

      // Verse selection (transient — never persisted).
      selectedVerse: null,
      selectedVerseText: '',

      setReference: (book, chapter, verse = null) =>
        set({ book, chapter, verse, selectedVerse: null }),
      setTranslation: (translation) => set({ translation }),
      setVerse: (verse) => set({ verse }),
      selectVerse: (verse, text) =>
        set({ selectedVerse: verse, selectedVerseText: text, verse }),

      setRightPanel: (panel) => set({ rightPanel: panel }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
      toggleInterlinear: () => set((s) => ({ interlinearMode: !s.interlinearMode })),
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setFontSizeIdx: (idx) =>
        set({ fontSizeIdx: Math.max(0, Math.min(FONT_SIZES.length - 1, idx)) }),
    }),
    {
      name: 'bible-study-state',
      // Only UI preferences persist. Navigation (book/chapter/verse/translation)
      // is owned by the URL — `useUrlSync` hydrates the store on load.
      partialize: (s) => ({
        rightPanel: s.rightPanel,
        sidebarOpen: s.sidebarOpen,
        rightPanelOpen: s.rightPanelOpen,
        interlinearMode: s.interlinearMode,
        darkMode: s.darkMode,
        fontSizeIdx: s.fontSizeIdx,
      }),
    }
  )
)

export function selectReference(s) {
  return s.verse ? `${s.book} ${s.chapter}:${s.verse}` : `${s.book} ${s.chapter}`
}
