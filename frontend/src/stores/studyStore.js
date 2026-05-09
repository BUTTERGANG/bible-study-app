import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const FONT_SIZES = ['0.9rem', '1.05rem', '1.2rem', '1.4rem']

export const useStudyStore = create(
  persist(
    (set, get) => ({
      // Current passage
      book: 'John',
      chapter: 3,
      verse: null,
      translation: 'KJV',

      // UI state
      rightPanel: 'commentary', // 'commentary' | 'ai' | 'notes' | 'word-study'
      sidebarOpen: true,
      interlinearMode: false,
      darkMode: false,
      fontSizeIdx: 1, // index into FONT_SIZES

      // Selected verse (for context menu)
      selectedVerse: null,
      selectedVerseText: '',

      // Actions
      setReference: (book, chapter, verse = null) =>
        set({ book, chapter, verse, selectedVerse: null }),

      setTranslation: (translation) => set({ translation }),

      setVerse: (verse) => set({ verse }),

      selectVerse: (verse, text) =>
        set({ selectedVerse: verse, selectedVerseText: text, verse }),

      setRightPanel: (panel) => set({ rightPanel: panel }),

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      toggleInterlinear: () => set((s) => ({ interlinearMode: !s.interlinearMode })),

      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

      setFontSizeIdx: (idx) => set({ fontSizeIdx: Math.max(0, Math.min(FONT_SIZES.length - 1, idx)) }),

      navigate: (direction) => {
        // Will be wired up with book data from API
        const { chapter } = get()
        if (direction === 'next') set({ chapter: chapter + 1, verse: null })
        if (direction === 'prev' && chapter > 1) set({ chapter: chapter - 1, verse: null })
      },

      // Reference string helper
      get reference() {
        const { book, chapter, verse } = get()
        return verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`
      },
    }),
    {
      name: 'bible-study-state',
      partialize: (s) => ({
        book: s.book,
        chapter: s.chapter,
        translation: s.translation,
        rightPanel: s.rightPanel,
        sidebarOpen: s.sidebarOpen,
        interlinearMode: s.interlinearMode,
        darkMode: s.darkMode,
        fontSizeIdx: s.fontSizeIdx,
      }),
    }
  )
)
