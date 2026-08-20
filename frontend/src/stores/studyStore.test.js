import { describe, it, expect, beforeEach } from 'vitest'
import { useStudyStore, selectReference, FONT_SIZES } from './studyStore'

// Reset store state between tests so assertions are deterministic.
function resetStore() {
  useStudyStore.setState({
    book: 'John',
    chapter: 3,
    verse: null,
    translation: 'KJV',
    rightPanel: 'home',
    sidebarOpen: true,
    rightPanelOpen: true,
    interlinearMode: false,
    reverseInterlinear: false,
    showLemmas: false,
    lemmaPosition: 'below',
    focusedStrongs: null,
    darkMode: true,
    fontSizeIdx: 1,
    compareMode: false,
    comparePickerOpen: false,
    compareTranslations: [],
    commentarySources: [],
    audioPlaying: false,
    audioSpeed: 1.0,
    currentVerseIdx: null,
    currentVerses: [],
    visualFiltersEnabled: false,
    visualFilters: null, // repopulated lazily via toggleVisualFilters test where needed
    selectedVerse: null,
    selectedVerseText: '',
  })
}

beforeEach(() => resetStore())

describe('studyStore state + actions', () => {
  it('startswith KJV John 3', () => {
    resetStore()
    const s = useStudyStore.getState()
    expect(s.translation).toBe('KJV')
    expect(s.book).toBe('John')
    expect(s.chapter).toBe(3)
    expect(s.verse).toBe(null)
  })

  it('setTranslation updates translation', () => {
    useStudyStore.getState().setTranslation('NHEB')
    expect(useStudyStore.getState().translation).toBe('NHEB')
  })

  it('setReference sets book/chapter/verse and clears selectedVerse', () => {
    useStudyStore.getState().selectVerse(5, 'text')
    useStudyStore.getState().setReference('Psalms', 23, 4)
    const s = useStudyStore.getState()
    expect(s.book).toBe('Psalms')
    expect(s.chapter).toBe(23)
    expect(s.verse).toBe(4)
    expect(s.selectedVerse).toBe(null)
  })

  it('toggleSidebar flips sidebarOpen', () => {
    useStudyStore.getState().toggleSidebar()
    expect(useStudyStore.getState().sidebarOpen).toBe(false)
    useStudyStore.getState().toggleSidebar()
    expect(useStudyStore.getState().sidebarOpen).toBe(true)
  })

  it('toggleDarkMode flips darkMode', () => {
    useStudyStore.getState().toggleDarkMode()
    expect(useStudyStore.getState().darkMode).toBe(false)
  })

  it('setFontSizeIdx clamps to FONT_SIZES bounds', () => {
    useStudyStore.getState().setFontSizeIdx(99)
    expect(useStudyStore.getState().fontSizeIdx).toBe(FONT_SIZES.length - 1)
    useStudyStore.getState().setFontSizeIdx(-5)
    expect(useStudyStore.getState().fontSizeIdx).toBe(0)
    useStudyStore.getState().setFontSizeIdx(2)
    expect(useStudyStore.getState().fontSizeIdx).toBe(2)
  })

  it('openWordStudy switches to word-study panel and sets focus', () => {
    useStudyStore.getState().openWordStudy('G3056')
    const s = useStudyStore.getState()
    expect(s.rightPanel).toBe('word-study')
    expect(s.rightPanelOpen).toBe(true)
    expect(s.focusedStrongs).toBe('G3056')
  })

  it('setVisualFilter toggles an individual category on', () => {
    useStudyStore.getState().setVisualFilter('noun', true)
    expect(useStudyStore.getState().visualFilters.noun).toBe(true)
  })

  it('toggleVisualFilter flips a category', () => {
    useStudyStore.getState().setVisualFilter('verb', false)
    useStudyStore.getState().toggleVisualFilter('verb')
    expect(useStudyStore.getState().visualFilters.verb).toBe(true)
  })

  it('setAiHistory writes per-key history and clearAiHistory removes it', () => {
    useStudyStore.getState().setAiHistory('John 3', [{ id: 'a' }])
    expect(useStudyStore.getState().aiHistory['John 3']).toHaveLength(1)
    useStudyStore.getState().clearAiHistory('John 3')
    expect(useStudyStore.getState().aiHistory['John 3']).toBeUndefined()
  })

  it('audio actions update playing/speed/verse state', () => {
    useStudyStore.getState().setAudioPlaying(true)
    useStudyStore.getState().setAudioSpeed(1.25)
    useStudyStore.getState().setCurrentVerses([{ verse: 1 }, { verse: 2 }])
    useStudyStore.getState().setCurrentVerseIdx(1)
    const s = useStudyStore.getState()
    expect(s.audioPlaying).toBe(true)
    expect(s.audioSpeed).toBe(1.25)
    expect(s.currentVerses).toHaveLength(2)
    expect(s.currentVerseIdx).toBe(1)
  })
})

describe('selectReference', () => {
  it('formats book chapter when no verse', () => {
    resetStore()
    expect(selectReference(useStudyStore.getState())).toBe('John 3')
  })
  it('formats book chapter:verse when verse set', () => {
    useStudyStore.getState().setReference('John', 3, 16)
    expect(selectReference(useStudyStore.getState())).toBe('John 3:16')
  })
})