import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useStudyStore } from './stores/studyStore'
import { getChapterCount } from './api/bibleData'
import { useUrlSync } from './hooks/useUrlSync'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useOfflineSync } from './hooks/useOfflineSync'
import Sidebar from './components/Sidebar/Sidebar'
import BibleReader from './components/BibleReader/BibleReader'
import BibleBrowser from './components/BibleBrowser/BibleBrowser'
import RightPanel from './components/layout/RightPanel'
import TopBar from './components/layout/TopBar'
import MobileBottomNav from './components/layout/MobileBottomNav'
import AudioPlayer from './components/AudioPlayer/AudioPlayer'
import ErrorBoundary from './components/common/ErrorBoundary'
import AuthGate from './components/common/AuthGate'
import LandingPage from './components/Landing/LandingPage'

const SearchModal = lazy(() => import('./components/Search/SearchModal'))
const MorphSearchModal = lazy(() => import('./components/Search/MorphSearchModal'))

function useResizeHandle(initialWidth, min, max, direction = 'right') {
  const [width, setWidth] = useState(initialWidth)
  const widthRef = useRef(initialWidth)

  const startDrag = useCallback((startX) => {
    const startW = widthRef.current

    const onMove = (clientX) => {
      const delta = direction === 'right' ? clientX - startX : startX - clientX
      const next = Math.min(max, Math.max(min, startW + delta))
      widthRef.current = next
      setWidth(next)
    }
    const onMouseMove = (me) => onMove(me.clientX)
    const onTouchMove = (te) => onMove(te.touches[0].clientX)

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', cleanup)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', cleanup)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', cleanup)
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', cleanup)
  }, [direction, min, max])

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    startDrag(e.clientX)
  }, [startDrag])

  const onTouchStart = useCallback((e) => {
    startDrag(e.touches[0].clientX)
  }, [startDrag])

  return [width, onMouseDown, onTouchStart]
}

function App() {
  const sidebarOpen = useStudyStore((s) => s.sidebarOpen)
  const rightPanelOpen = useStudyStore((s) => s.rightPanelOpen)
  const darkMode = useStudyStore((s) => s.darkMode)
  const book = useStudyStore((s) => s.book)
  const chapter = useStudyStore((s) => s.chapter)
  const translation = useStudyStore((s) => s.translation)
  const [searchOpen, setSearchOpen] = useState(false)
  const [morphSearchOpen, setMorphSearchOpen] = useState(false)
  const [audioOpen, setAudioOpen] = useState(false)
  const [sidebarWidth, onSidebarMouseDown, onSidebarTouchStart] = useResizeHandle(224, 140, 400, 'right')
  const [rightWidth, onRightMouseDown, onRightTouchStart] = useResizeHandle(384, 240, 600, 'left')
  const online = useOnlineStatus()
  const { syncStatus, queueLength } = useOfflineSync()
  useUrlSync()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const setReference = useStudyStore((s) => s.setReference)

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
        return
      }
      // Chapter navigation — [ / ] when no input is focused. (Arrow keys are
      // intentionally not bound: they'd hijack caret movement and horizontal
      // scrolling everywhere outside form fields.)
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (document.activeElement?.isContentEditable) return
      const maxChapter = getChapterCount(book)
      if (e.key === '[') {
        if (chapter > 1) { e.preventDefault(); setReference(book, chapter - 1) }
      } else if (e.key === ']') {
        if (chapter < maxChapter) { e.preventDefault(); setReference(book, chapter + 1) }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [book, chapter, setReference])

  const location = useLocation()
  const isBrowse = location.pathname === '/browse'

  return (
    <AuthGate>
      <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 overflow-hidden">
        {!online && (
          <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-500 text-white text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80 animate-pulse" />
            Offline — showing cached content
            {queueLength > 0 && (
              <span className="ml-1 bg-white/20 rounded px-1.5 py-0.5 text-[10px]">
                {queueLength} change{queueLength !== 1 ? 's' : ''} queued
              </span>
            )}
          </div>
        )}
        {online && syncStatus === 'conflict' && queueLength === 0 && (
          <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium">
            Sync conflicts resolved — some changes were skipped
          </div>
        )}

        {isBrowse ? (
          /* ── Full-screen Bible Browser ── */
          <div className="flex-1 overflow-hidden">
            <ErrorBoundary fallback="Bible browser failed to render.">
              <BibleBrowser />
            </ErrorBoundary>
          </div>
        ) : (
          /* ── Standard Reader Layout ── */
          <>
            <TopBar
              onSearch={() => setSearchOpen(true)}
              onMorphSearch={() => setMorphSearchOpen(true)}
              onToggleAudio={() => setAudioOpen((o) => !o)}
            />

            <div className="flex flex-1 overflow-hidden">
              {sidebarOpen && (
                <>
                  <div
                    className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto"
                    style={{ width: sidebarWidth }}
                  >
                    <ErrorBoundary fallback="Sidebar failed to render.">
                      <Sidebar />
                    </ErrorBoundary>
                  </div>
                  <div
                    className="w-1 flex-shrink-0 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 active:bg-blue-500 transition-colors"
                    onMouseDown={onSidebarMouseDown}
                    onTouchStart={onSidebarTouchStart}
                  />
                </>
              )}

              <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                <ErrorBoundary fallback="Bible reader failed to render.">
                  <BibleReader />
                </ErrorBoundary>
              </div>

              {rightPanelOpen && (
                <>
                  <div
                    className="w-1 flex-shrink-0 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 active:bg-blue-500 transition-colors"
                    onMouseDown={onRightMouseDown}
                    onTouchStart={onRightTouchStart}
                  />
                  <div
                    className="flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden flex flex-col"
                    style={{ width: rightWidth }}
                  >
                    <ErrorBoundary fallback="Right panel failed to render.">
                      <RightPanel />
                    </ErrorBoundary>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {searchOpen && (
          <Suspense fallback={null}>
            <SearchModal onClose={() => setSearchOpen(false)} />
          </Suspense>
        )}

        {morphSearchOpen && (
          <Suspense fallback={null}>
            <MorphSearchModal onClose={() => setMorphSearchOpen(false)} />
          </Suspense>
        )}

        {audioOpen && !isBrowse && (
          <AudioPlayer
            key={`${translation}-${book}-${chapter}`}
            onClose={() => setAudioOpen(false)}
          />
        )}

        {/* Mobile bottom nav — hidden on sm+ screens */}
        {!isBrowse && (
          <MobileBottomNav onSearch={() => setSearchOpen(true)} />
        )}
      </div>
    </AuthGate>
  )
}

// ── Top-level router with landing page ─────────────────────────────────────
export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/read/*" element={<App />} />
      <Route path="/browse" element={<App />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
