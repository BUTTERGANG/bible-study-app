# UI/UX Audit — LOGOS Bible Study App

## Summary
| Area | Issues |
|------|--------|
| Accessibility | 18 |
| Consistency | 12 |
| UX | 14 |

**Total Findings: 44** | Files Audited: 25+ component files

---

## Accessibility

### A11Y-001: Zero ARIA attributes across all components
**Severity:** High  
**Category:** Accessibility  
**Location:** All component files  
**Issue:** No `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-expanded`, `aria-selected`, `role`, or any other ARIA attributes exist in the entire codebase. Grepping the entire component directory for `aria-` and `role=` returns zero results. Screen readers will have no semantic information to convey interactive element meaning, state, or purpose.
**Fix:** Add meaningful ARIA attributes to all interactive elements. At minimum:
- `aria-label` on icon-only buttons (`<button aria-label="Toggle sidebar"><Menu/>`)
- `aria-expanded` on dropdown toggles (TopBar compare picker, Sidebar sections)
- `aria-selected` on active RightPanel tabs
- `role="dialog"` and `aria-modal="true"` on modals
- `aria-label` on the search input

### A11Y-002: No keyboard-accessible focus management in modals
**Severity:** High  
**Category:** Accessibility  
**Location:** `frontend/src/components/BibleReader/ShareCardModal.jsx:108`, `frontend/src/components/Memorize/MemorizePanel.jsx:28`, `frontend/src/components/Notes/NotesPanel.jsx:119`
**Issue:** ShareCardModal, MemorizePanel QuizCard, and NotesPanel image viewer all render as fixed-position overlays but have NO focus trapping, NO ESC key handling (except the parent onClose via backdrop click), and NO programmatic focus to the dialog. When opened, focus stays on the underlying content. Screen reader users cannot perceive or navigate these modals.
**Fix:** Create a shared `useFocusTrap` hook or use a headless UI library pattern:
1. On open: move focus to the dialog container, trap Tab/Shift+Tab within it
2. On ESC: call `onClose` (only SearchModal and MorphSearchModal implement this)
3. Return focus to the trigger element on close

### A11Y-003: No ESC key handling in most modals
**Severity:** High  
**Category:** Accessibility  
**Location:** `ShareCardModal.jsx:108`, `MemorizePanel.jsx:28`, `NotesPanel.jsx:119,248`
**Issue:** Only SearchModal and MorphSearchModal handle ESC to close. ShareCardModal, MemorizePanel's QuizCard, and NotesPanel's image viewer/lightbox have no keyboard dismissal path — the only option is clicking the X button or the backdrop. This violates WCAG 2.1.1 (Keyboard).
**Fix:** Add `useEffect` with `keydown` listener for ESC key to every modal component. SearchModal's implementation (`SearchModal.jsx:157-160`) is a good pattern to replicate.

### A11Y-004: Clickable `<span>` elements instead of buttons in VerseText
**Severity:** Medium  
**Category:** Accessibility  
**Location:** `frontend/src/components/BibleReader/VerseText.jsx:50-56`
**Issue:** Each verse is rendered as a `<span>` with `onClick` and `onContextMenu` handlers. Spans are not focusable via keyboard Tab, have no button semantics, and cannot be activated by Enter/Space. This means keyboard-only users cannot interact with verses to select, highlight, bookmark, or study them.
**Fix:** Wrap verse content in a `<button>` element (styled with `appearance-none bg-transparent`) or add `tabIndex={0}`, `role="button"`, and an `onKeyDown` handler for Enter/Space to activate.

### A11Y-005: Clickable `<div>` and `<span>` elements with onClick throughout Sidebar
**Severity:** Medium  
**Category:** Accessibility  
**Location:** `frontend/src/components/Sidebar/Sidebar.jsx:50-52`, `BibleReader/BookIntroCard.jsx:19`
**Issue:** Sidebar uses `<div>` elements for book selection (wrapped via `onSelectBook`/`onSelectChapter`) that lack proper semantics. BookIntroCard uses a clickable `<div>` with onClick. These elements are not keyboard-focusable or screen-reader-announceable.
**Fix:** Use `<button>` elements for all clickable non-navigational items, or at minimum add `tabIndex={0}`, `role="button"`, and keyboard handlers.

### A11Y-006: Native `window.confirm()` dialogs lack accessibility
**Severity:** Medium  
**Category:** Accessibility  
**Location:** `SermonBuilder.jsx:344`, `StudyBuilder.jsx:383`, `ReadingPlansPanel.jsx:433`
**Issue:** Three components use `window.confirm('Delete...?')` for destructive action confirmation. Native `confirm()`:
- Cannot be styled for dark mode
- Pauses the JS event loop (poor UX)
- Cannot be tested in automated tests
- May not be accessible on all PWA contexts
**Fix:** Replace with a custom `ConfirmDialog` component that supports focus trapping, ESC to cancel, ARIA dialog semantics, and dark mode.

### A11Y-007: TopBar dark mode is entirely hardcoded -- no dark: classes
**Severity:** High  
**Category:** Accessibility / Dark Mode  
**Location:** `frontend/src/components/layout/TopBar.jsx:109-383` (entire file)
**Issue:** The TopBar uses hardcoded `bg-slate-800`, `text-slate-300`, `text-white`, `bg-slate-700` etc. throughout all 274 lines. Not a single `dark:` prefix exists. This means the TopBar is permanently dark regardless of the light/dark mode toggle state. If the user switches to light mode, the header stays dark creating a jarring visual inconsistency. While a permanently dark top bar might be intentional, it creates problems when users expect consistency and the toggle implies it should change.
**Fix:** If the dark header is by design, document this. If not, add `dark:` mode-aware background/text colors to all TopBar elements or wrap with explicit light/dark color tokens.

### A11Y-008: SyncStatus component has no dark mode support
**Severity:** Medium  
**Category:** Accessibility / Dark Mode  
**Location:** `frontend/src/components/layout/SyncStatus.jsx:52-131` (entire file)
**Issue:** SyncStatus uses only hardcoded `slate-` colors (`bg-slate-700`, `bg-slate-800`, `text-slate-400`, etc.) with zero `dark:` classes. The dropdown menu will look wrong in light mode.
**Fix:** Add `dark:` variants to background, text, and border colors in the dropdown.

### A11Y-009: Font size controls lack accessible labels
**Severity:** Medium  
**Category:** Accessibility  
**Location:** `frontend/src/components/layout/TopBar.jsx:291-311`
**Issue:** The font size buttons are just letter "A" in different sizes with `title` attributes. They have no `aria-label`, no visible text, and `title` is not reliably read by screen readers.
**Fix:** Add `aria-label="Decrease font size"` and `aria-label="Increase font size"` to the respective buttons. Consider adding a visual label like "A-" and "A+".

### A11Y-010: Toggle switches lack ARIA role and state
**Severity:** Medium  
**Category:** Accessibility  
**Location:** `NotificationSettings.jsx:49-60`, `NotificationSettings.jsx:119-130`
**Issue:** Notification toggles are `<button>` elements styled as toggle switches but lack `role="switch"` and `aria-checked`. Screen readers will announce them as "button" with no indication of on/off state.
**Fix:** Add `role="switch"` and `aria-checked={enabled}` to toggle button elements. Add `aria-label` describing what the toggle controls.

### A11Y-011: No skip-navigation link
**Severity:** Low  
**Category:** Accessibility  
**Location:** `frontend/src/App.jsx:42-111`, `frontend/index.html`
**Issue:** There is no "Skip to main content" link. Keyboard users must tab through the TopBar (30+ interactive elements), then the Sidebar (60+ book/chapter buttons) before reaching the actual Bible text.
**Fix:** Add a visually hidden skip link at the top of `<App>` that becomes visible on focus, targeting the BibleReader container.

### A11Y-012: RightPanel tab list lacks ARIA tab pattern
**Severity:** Medium  
**Category:** Accessibility  
**Location:** `frontend/src/components/layout/RightPanel.jsx:75-91`
**Issue:** The 28-tab bar uses plain `<button>` elements in a scrollable div. It should follow the WAI-ARIA Tabs Pattern with `role="tablist"`, `role="tab"`, `aria-selected`, and associated `role="tabpanel"`.
**Fix:** Add `role="tablist"` to the container, `role="tab"` + `aria-selected={rightPanel === id}` to each button, and `role="tabpanel"` to the content area below. Keyboard navigation with arrow keys per the ARIA tabs pattern.

### A11Y-013: Search results list lacks list semantics
**Severity:** Low  
**Category:** Accessibility  
**Location:** `SearchModal.jsx:282-325`
**Issue:** Search results are plain `<button>` elements with no list container semantics. A screen reader will announce them as individual buttons, not as a list of X items.
**Fix:** Wrap results in `<ul role="listbox">` with each item as `<li role="option">`. This also supports the arrow key navigation already implemented.

### A11Y-014: Color contrast concern on amber-500 offline banner
**Severity:** Low  
**Category:** Accessibility  
**Location:** `App.jsx:45-53`
**Issue:** The offline banner uses `bg-amber-500 text-white`. Amber-500 (#f59e0b) with white text has a contrast ratio of approximately 1.9:1, far below WCAG AA (4.5:1) requirements.
**Fix:** Change to `bg-amber-700 text-white` or use dark text (`text-amber-900`) on the amber-500 background.

### A11Y-015: Color contrast on verse-selected blue background
**Severity:** Low  
**Category:** Accessibility  
**Location:** `index.css:33-35` (verse-selected styles)
**Issue:** `.verse-selected` uses `bg-blue-50` with default text color. In dark mode, `dark:bg-blue-900/30` with `dark:text-gray-100`. The dark mode combination of blue-900/30 with white text may have insufficient contrast depending on the base gray-900 background.
**Fix:** Test actual computed contrast ratios and consider using a more opaque background or bolder text color.

### A11Y-016: Leaflet map markers and controls inaccessible
**Severity:** Medium  
**Category:** Accessibility  
**Location:** `Maps/MapPanel.jsx:183-238`
**Issue:** The Leaflet MapContainer renders complex interactive map elements. The custom markers use SVG injected via `L.divIcon` which screen readers cannot interpret. Map tiles themselves are images with no alt text. Users relying on keyboards/screen readers cannot interact with specific map locations.
**Fix:** Provide an alternative text-based list of places below/alongside the map. Add `aria-label` descriptions. Consider `aria-hidden="true"` on the map container and offering the list as the primary interface for accessibility.

### A11Y-017: Audio player controls lack accessible labels
**Severity:** Medium  
**Category:** Accessibility  
**Location:** `AudioPlayer.jsx:123-158`
**Issue:** Play/Pause, Stop, Skip buttons are only distinguishable by icon. The skip buttons lack `aria-label`. The speed button shows just "1x". The progress bar is a `<div>` with no `role="slider"` or ARIA value attributes.
**Fix:** Add `aria-label` to all icon buttons (`"Play audio"`, `"Pause"`, `"Stop"`, `"Previous verse"`, `"Next verse"`). Use `role="slider"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` on the progress bar.

### A11Y-018: No visible focus indicators on custom-styled buttons
**Severity:** Medium  
**Category:** Accessibility  
**Location:** Global pattern across all components
**Issue:** Many buttons use `focus:outline-none` without providing an alternative visible focus ring. For example: `Sidebar.jsx:207` (`focus:outline-none focus:border-blue-400` for inputs, but buttons often just use default Tailwind which does include `focus:outline`). Custom button styles like those in TopBar use `hover:text-white` without any `focus:` variant, meaning keyboard focus is visually invisible on many controls.
**Fix:** Audit all interactive elements for focus visibility. Add consistent `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` (or equivalent) as a global base style.

---

## Consistency

### CON-001: TopBar never uses dark: classes -- permanently dark
**Severity:** High  
**Category:** Consistency / Dark Mode  
**Location:** `frontend/src/components/layout/TopBar.jsx` (entire file, 0 occurrences of `dark:`)
**Issue:** While every other component in the app (Sidebar, RightPanel forms, modals, AudioPlayer, etc.) uses `dark:` Tailwind variants for dark mode support, the TopBar exclusively uses hardcoded `slate-` dark palette colors. This is the only layout component that lacks dark mode awareness, creating an inconsistent experience.
**Fix:** If the intent is a permanently dark header (common design pattern), this is acceptable but should be documented. Otherwise, add `dark:` variants or use color tokens.

### CON-002: SyncStatus also lacks dark mode classes
**Severity:** Medium  
**Category:** Consistency / Dark Mode  
**Location:** `frontend/src/components/layout/SyncStatus.jsx` (entire file, 0 `dark:` classes)
**Issue:** Same pattern as TopBar -- hardcoded slate colors with no dark mode variants. The dropdown will be unreadable if the app switches to light mode.
**Fix:** Add `dark:` variants to all `bg-slate-800`, `border-slate-600`, `text-slate-400`, and `bg-slate-700` classes.

### CON-003: Duplicate button patterns across SermonBuilder and StudyBuilder
**Severity:** Medium  
**Category:** Consistency / Component Reuse  
**Location:** `SermonBuilder.jsx`, `StudyBuilder.jsx`
**Issue:** Both builders share nearly identical structures: ProjectList, [Entity]View, NewProjectForm, SectionEditor, and the same empty state layout. The empty state pattern (icon, heading, description, CTA button) is duplicated. The section editor layout (toolbar, preview/edit toggle, export button) is duplicated. At 400+ lines each, these could be a shared builder framework.
**Fix:** Extract a generic `<ProjectBuilder>` component that accepts config for entity type, API endpoints, section definitions, and section-specific options. This is a refactoring priority rather than a bug, but it creates maintenance risk.

### CON-004: Fixed sidebar width (w-56) and right panel width (w-96) without responsive breakpoints
**Severity:** Medium  
**Category:** Consistency / Responsive Design  
**Location:** `App.jsx:68` (`w-56`), `App.jsx:82` (`w-96`)
**Issue:** The sidebar is always `w-56` (224px) and the right panel is always `w-96` (384px) regardless of viewport size. On a 1280px screen with both panels open, only ~640px remains for the Bible text. On smaller laptops or tablets, the reading area becomes very narrow. There are no responsive breakpoints.
**Fix:** Add responsive width classes (e.g., `w-48 md:w-56`, `w-72 lg:w-96`) and consider collapsing the sidebar below a breakpoint. Alternatively, make panel widths user-adjustable.

### CON-005: Sidebar is conditionally rendered but has no mobile-specific behavior
**Severity:** Medium  
**Category:** Consistency / Responsive Design  
**Location:** `App.jsx:67-73`
**Issue:** The sidebar is simply rendered/hidden via `sidebarOpen` state. There is no responsive CSS (like `sm:block` or `md:hidden`) to automatically hide it on small screens. The sidebar toggle button in TopBar works but provides no indication of available screen real estate.
**Fix:** Add mobile-first responsive behavior: hide sidebar by default on small screens, show as an overlay drawer on mobile. The existing `sidebarOpen` state can be combined with a breakpoint check or media query.

### CON-006: RightPanel tab bar uses horizontal scroll without visual cue
**Severity:** Low  
**Category:** Consistency / UX  
**Location:** `RightPanel.jsx:75-91`
**Issue:** The tab bar has `overflow-x-auto` and `scrollbar-hide` class (which is not a standard Tailwind class — it may rely on a custom plugin or utility). Users may not realize there are 28 tabs that extend beyond the visible area. There is no gradient fade or overflow indicator.
**Fix:** Add a visual overflow indicator (gradient fade at the right edge). Verify `scrollbar-hide` is properly configured, or add `::-webkit-scrollbar { display: none }` + `scrollbar-width: none` in CSS.

### CON-007: Inline styles used for dynamic values instead of CSS variables
**Severity:** Low  
**Category:** Consistency  
**Location:** `BibleReader.jsx:132`, `AudioPlayer.jsx:116`, `DashboardPanel.jsx:87`, `VerseContextMenu.jsx:134`
**Issue:** Several dynamic styles (font size, progress bar width, card aspect ratio, menu position clamping) use inline `style={{}}`. While this is acceptable for truly dynamic values, it bypasses Tailwind's design system and makes theming harder.
**Fix:** Consider using CSS custom properties for dynamic values where possible (e.g., `--font-size: ${FONT_SIZES[fontSizeIdx]}` on a container). For positioning math (VerseContextMenu), inline styles are appropriate.

### CON-008: Hardcoded color values in CrossReference graph SVG
**Severity:** Low  
**Category:** Consistency / Dark Mode  
**Location:** `CrossReference/CrossReferencePanel.jsx:227-228`
**Issue:** Uses inline `style={{ color: '#3b82f6' }}` and `style={{ color: '#8b5cf6' }}` for graph legend dots. These hardcoded hex values won't adapt to dark mode or any design token changes.
**Fix:** Use Tailwind classes on the spans instead, with `dark:` variants.

### CON-009: Mixed color strategies across the codebase
**Severity:** Low  
**Category:** Consistency  
**Location:** Global
**Issue:** The codebase uses multiple color application strategies:
1. Tailwind classes: `bg-blue-500 text-white` (most components)
2. Inline SVG injection with hardcoded colors: `MapPanel.jsx:27-39` (Leaflet marker SVGs)
3. Hex values in inline styles: `CrossReferencePanel.jsx:227-228`
4. Template literal color manipulation: `MapPanel.jsx:159` (`backgroundColor: color + '22'`)
**Fix:** Standardize where possible. At minimum, document which colors are "source of truth" and ensure all dark mode variants are covered.

### CON-010: MD_COMPONENTS duplicated between SermonBuilder and StudyBuilder
**Severity:** Low  
**Category:** Consistency / DRY  
**Location:** `SermonBuilder.jsx:32-41`, `StudyBuilder.jsx:41-49`
**Issue:** Identical markdown rendering component style overrides are defined in both files. Any change to markdown rendering must be made in two places.
**Fix:** Extract to a shared `utils/markdownStyles.js` or `components/common/MarkdownRenderer.jsx`.

### CON-011: TopBar and layout/NotificationSettings have inconsistent form input styling
**Severity:** Low  
**Category:** Consistency  
**Location:** `TopBar.jsx:154` vs `NotificationSettings.jsx:135`, `SermonBuilder.jsx:139`
**Issue:** The TopBar translation select uses `bg-slate-700 text-white text-xs border border-slate-600 rounded px-2 py-1`. NotificationSettings time input uses `text-[10px] border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5`. SermonBuilder inputs use `text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-lg px-3 py-2`. There are 3+ different input styles with no shared base class.
**Fix:** Define a shared `.form-input` class in index.css or create a reusable `<Input>` component with variant sizes.

### CON-012: Three different modal/dialog overlay patterns
**Severity:** Low  
**Category:** Consistency  
**Location:** Multiple files
**Issue:**
- SearchModal: `bg-black/50` backdrop + `items-start justify-center pt-20`
- ShareCardModal: `bg-black/60` backdrop + `items-center justify-center`
- MorphSearchModal: `bg-black/50` backdrop + `items-start justify-center pt-12`
- QuizCard: `bg-black/60` backdrop + `items-center justify-center`
- NotesPanel lightbox: `bg-black/80` backdrop

The opacity varies (50, 60, 80), alignment varies (top vs center), and none share a base Modal component.
**Fix:** Create a shared `<Modal>` component with configurable backdrop opacity and alignment, used consistently across all dialog instances.

---

## UX

### UX-001: No loading states on form submissions
**Severity:** High  
**Category:** UX / Loading States  
**Location:** `SermonBuilder.jsx:165` (Create Project), `StudyBuilder.jsx:155` (Create Study)
**Issue:** Both the SermonBuilder and StudyBuilder "Create Project/Study" buttons show disabled state with text change ("Creating...") but there's no spinner or progress indication. Given that these trigger AI generation operations that could take several seconds, users may click multiple times or think the app is frozen.
**Fix:** Add a spinner icon alongside the "Creating..." text. Show a more explicit "Generating content..." message to set expectations for AI operations.

### UX-002: MemorizePanel quiz has no confirmation or undo on "Not yet" / "Got it!"
**Severity:** Medium  
**Category:** UX / Error Prevention  
**Location:** `MemorizePanel.jsx:58-69`
**Issue:** The quiz buttons immediately trigger `onResult(false/true)` and close the modal. There is no way to undo a mistaken tap. If a user accidentally taps "Not yet" when they got the verse right, their progress is permanently affected.
**Issue:** Add a brief delay or undo snackbar. Alternatively, make the buttons require a long press or add a confirmation step for negative results.

### UX-003: No error state for SearchModal AI synopsis failures
**Severity:** Medium  
**Category:** UX / Error Handling  
**Location:** `SearchModal.jsx:74-90`
**Issue:** The AI synopsis (`streamAI` call) has no error handling. If the streaming endpoint fails, the user sees nothing — no error message, no retry option. The synopsis area simply remains absent.
**Fix:** Wrap the `streamAI` call in try/catch. Show an error message with a "Retry" button in the AI synthesis area.

### UX-004: RightPanel tabs may overflow without user awareness at min-w-[72px]
**Severity:** Medium  
**Category:** UX / Navigation  
**Location:** `RightPanel.jsx:75-91`
**Issue:** With 28 tabs at `min-w-[72px]` each = 2016px minimum tab bar width, but the panel itself is only 384px (w-96). Only ~5 tabs are visible at a time. There is no visual indication that more tabs exist to the right (no arrow indicators, no gradient fade). Users may not discover features like "Memorize", "Prayer", "Study" etc.
**Fix:** Add a scroll indicator (right-side gradient fade + chevron icon). Consider a dropdown menu for overflow tabs. Alternatively, group related tabs under category headings.

### UX-005: AudioPlayer skip-to-verse behavior is confusing
**Severity:** Medium  
**Category:** UX / Audio Feedback  
**Location:** `AudioPlayer.jsx:48-56`, `useAudioBible.js:139-152`
**Issue:** When clicking skip while audio is playing, it calls `pause()` then `playFrom()` after a 50ms timeout. This creates an audible gap/pop in the audio. When skipping while paused, it only updates the index without playing. The behavior differs from typical media players where skip always plays from the new position.
**Fix:** Consider a consistent behavior: skip always plays from the new verse. Smooth the transition by canceling speechSynthesis immediately rather than pausing.

### UX-006: Audio speed change interrupts current playback
**Severity:** Medium  
**Category:** UX / Audio Feedback  
**Location:** `useAudioBible.js:154-166`
**Issue:** Changing the speed cancels speech synthesis and restarts the current verse. This is jarring — the user hears the verse start over every time they adjust speed.
**Fix:** Ideally, change rate on the live utterance if the API supports it (SpeechSynthesisUtterance.rate can be adjusted). If not, document the restart behavior.

### UX-007: Delete actions use bare window.confirm() with no undo
**Severity:** Medium  
**Category:** UX / Error Prevention  
**Location:** `SermonBuilder.jsx:344`, `StudyBuilder.jsx:383`, `ReadingPlansPanel.jsx:433`
**Issue:** All destructive delete actions immediately execute after a confirm dialog. There is no undo. If a user accidentally confirms, the data is permanently lost. The delete button in SermonBuilder is a small trash icon with no text label — very easy to tap accidentally.
**Fix:** Add an undo snackbar that appears for 5-10 seconds after deletion, allowing the user to restore the item. Confirm the deletion in a properly-styled dialog instead of window.confirm.

### UX-008: Comparison picker has no empty state or validation feedback
**Severity:** Medium  
**Category:** UX / Form Validation  
**Location:** `TopBar.jsx:219-256`
**Issue:** The compare translation picker disables the "Compare" button when fewer than 2 translations are selected, but gives no error message explaining why. A user might not understand why the button is greyed out.
**Fix:** Add helper text: "Select at least 2 translations to compare" visible when fewer than 2 are selected.

### UX-009: No empty state when search returns zero references
**Severity:** Low  
**Category:** UX / Empty States  
**Location:** `SearchModal.jsx:287-290`
**Issue:** The empty search result just says 'No results for "query"' with no suggestions for alternative search strategies or checking spelling. This is minimal but acceptable; could be improved with search tips.
**Fix:** Add helpful guidance: "Try a different search term, or switch to Semantic search to find passages by theme."

### UX-010: Sidebar chapter grid lacks visual grouping
**Severity:** Low  
**Category:** UX / Visual Hierarchy  
**Location:** `Sidebar.jsx:221-236`
**Issue:** The chapter grid (`grid-cols-6`) shows numbers in a flat grid without visual separation between chapter groups. For long books like Psalms (150 chapters), this means ~25 rows of numbers with no grouping.
**Fix:** Add visual grouping (e.g., decade separators for Psalms). Consider a `grid-cols-5` or `grid-cols-8` layout depending on max chapter count.

### UX-011: Settings toggles in NotificationSettings don't disable their children
**Severity:** Medium  
**Category:** UX / Form Logic  
**Location:** `NotificationSettings.jsx:65-97`
**Issue:** When individual notification toggles are OFF, the time input below them is still visible and interactive even though the notification won't fire. This is misleading — users can set a time for a disabled notification.
**Fix:** Collapse/hide the time input when its parent notification toggle is disabled. Only show the time picker when the notification is enabled.

### UX-012: No indication of which RightPanel feature the user was last on
**Severity:** Low  
**Category:** UX / State Persistence  
**Location:** `RightPanel.jsx:71-125`, studyStore
**Issue:** The `rightPanel` state is not persisted. If a user has the "Notes" panel open, refreshes the page, they'll see the "Home" dashboard again. All panel state is lost.
**Fix:** Persist the active right panel tab to localStorage alongside other study state, or include it in the URL.

### UX-013: Print styles are minimal — only forced light colors
**Severity:** Low  
**Category:** UX / Print  
**Location:** `index.css:213-220`
**Issue:** The `@media print` rule only forces white backgrounds and black text. It does not hide non-essential UI (TopBar, Sidebar, RightPanel, AudioPlayer, modals), which means they'll appear in the print output blocking the Bible text.
**Fix:** Hide all navigation and utility elements during print:
```css
@media print {
  .no-print, nav, aside, .topbar, .sidebar, .rightpanel { display: none !important; }
  .bible-text { max-width: 100%; }
}
```

### UX-014: Distraction-free mode is mentioned but not implemented as a toggle
**Severity:** Low  
**Category:** UX / Feature Gap  
**Location:** Not in any component
**Issue:** A "distraction-free mode" is mentioned in the project objectives, but no toggle exists in TopBar or elsewhere. The closest feature is hiding sidebar and right panel, but there's no single action to enter a clean reading mode.
**Fix:** Add a "focus mode" button to TopBar that closes both panels and optionally hides the TopBar itself (showing it only on scroll-up), similar to a reading mode in apps like Medium or Kindle.
