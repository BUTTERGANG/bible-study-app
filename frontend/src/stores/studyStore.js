import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FILTER_CATEGORIES } from '../utils/morphology'

export const FONT_SIZES = ['0.9rem', '1.05rem', '1.2rem', '1.4rem']

/** Build the default visual-filters map from FILTER_CATEGORIES. */
function defaultFilterState() {
  const map = {}
  for (const [key, cfg] of Object.entries(FILTER_CATEGORIES)) {
    map[key] = cfg.defaultOn
  }
  return map
}

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
      rightPanel: 'home',
      sidebarOpen: true,
      rightPanelOpen: true,
      interlinearMode: false,
      reverseInterlinear: false,
      showLemmas: false,
      lemmaPosition: 'below', // 'below' | 'inline'
      focusedStrongs: null,
      darkMode: false,
      fontSizeIdx: 1,

      // Compare mode state
      compareMode: false,
      comparePickerOpen: false,
      compareTranslations: [],

      // Commentary source filter preferences
      commentarySources: [],
      setCommentarySources: (sources) => set({ commentarySources: sources }),

      // AI Conversation history
      aiHistory: {},
      setAiHistory: (key, messages) => set((s) => ({
        aiHistory: { ...s.aiHistory, [key]: messages }
      })),
      clearAiHistory: (key) => set((s) => {
        const newHistory = { ...s.aiHistory }
        delete newHistory[key]
        return { aiHistory: newHistory }
      }),

      // Audio player state
      audioPlaying: false,
      audioSpeed: 1.0,
      currentVerseIdx: null,
      currentVerses: [],

      // Visual filters state
      visualFiltersEnabled: false,
      visualFilters: defaultFilterState(),

      // Verse selection (transient — never persisted).
      selectedVerse: null,
      selectedVerseText: '',

      setReference: (book, chapter, verse = null) =>
        set({ book, chapter, verse, selectedVerse: null }),
      setTranslation: (translation) => set({ translation }),
      setVerse: (verse) => set({ verse }),
      selectVerse: (verse, text) =>
        set({ selectedVerse: verse, selectedVerseText: text }),

      setRightPanel: (panel) => set({ rightPanel: panel }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
      toggleInterlinear: () => set((s) => ({ interlinearMode: !s.interlinearMode })),
      toggleReverseInterlinear: () => set((s) => ({ reverseInterlinear: !s.reverseInterlinear })),
      toggleShowLemmas: () => set((s) => ({ showLemmas: !s.showLemmas })),
      setLemmaPosition: (position) => set({ lemmaPosition: position }),
      openWordStudy: (strongsNum) =>
        set({ rightPanel: 'word-study', rightPanelOpen: true, focusedStrongs: strongsNum }),
      clearFocusedStrongs: () => set({ focusedStrongs: null }),
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setFontSizeIdx: (idx) =>
        set({ fontSizeIdx: Math.max(0, Math.min(FONT_SIZES.length - 1, idx)) }),
      toggleCompareMode: () => set((s) => ({ compareMode: !s.compareMode })),
      setComparePickerOpen: (open) => set({ comparePickerOpen: open }),
      setCompareTranslations: (translations) => set({ compareTranslations: translations }),

      // Visual filters actions
      toggleVisualFilters: () => set((s) => ({ visualFiltersEnabled: !s.visualFiltersEnabled })),
      setVisualFiltersEnabled: (enabled) => set({ visualFiltersEnabled: enabled }),
      toggleVisualFilter: (category) =>
        set((s) => ({
          visualFilters: { ...s.visualFilters, [category]: !s.visualFilters[category] },
        })),
      setVisualFilter: (category, enabled) =>
        set((s) => ({
          visualFilters: { ...s.visualFilters, [category]: enabled },
        })),

      // Audio actions
      setAudioPlaying: (playing) => set({ audioPlaying: playing }),
      setAudioSpeed: (speed) => set({ audioSpeed: speed }),
      setCurrentVerseIdx: (idx) => set({ currentVerseIdx: idx }),
      setCurrentVerses: (verses) => set({ currentVerses: verses }),
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
        reverseInterlinear: s.reverseInterlinear,
        showLemmas: s.showLemmas,
        lemmaPosition: s.lemmaPosition,
        darkMode: s.darkMode,
        fontSizeIdx: s.fontSizeIdx,
        compareMode: s.compareMode,
        comparePickerOpen: s.comparePickerOpen,
        compareTranslations: s.compareTranslations,
        commentarySources: s.commentarySources,
        // Cap to most-recent 10 chapter conversations to limit localStorage size.
        aiHistory: Object.fromEntries(
          Object.entries(s.aiHistory)
            .sort(([, a], [, b]) => {
              const lastA = a.at?.(-1)?.id ?? ''
              const lastB = b.at?.(-1)?.id ?? ''
              return lastB.localeCompare(lastA)
            })
            .slice(0, 10)
        ),
        visualFiltersEnabled: s.visualFiltersEnabled,
        visualFilters: s.visualFilters,
      }),
    }
  )
)

export function selectReference(s) {
  return s.verse ? `${s.book} ${s.chapter}:${s.verse}` : `${s.book} ${s.chapter}`
}
