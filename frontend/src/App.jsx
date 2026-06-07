import { Suspense, lazy, useEffect, useState } from 'react'
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

function App() {
  const sidebarOpen = useStudyStore((s) => s.sidebarOpen)
  const rightPanelOpen = useStudyStore((s) => s.rightPanelOpen)
  const toggleSidebar = useStudyStore((s) => s.toggleSidebar)
  const toggleRightPanel = useStudyStore((s) => s.toggleRightPanel)
  const darkMode = useStudyStore((s) => s.darkMode)
  const book = useStudyStore((s) => s.book)
  const chapter = useStudyStore((s) => s.chapter)
  const translation = useStudyStore((s) => s.translation)
  const [searchOpen, setSearchOpen] = useState(false)
  const [morphSearchOpen, setMorphSearchOpen] = useState(false)
  const [audioOpen, setAudioOpen] = useState(false)
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
              {/* ── Sidebar — mobile: slide-in drawer overlay ── */}
              {sidebarOpen && (
                <>
                  {/* Backdrop: only visible on mobile, closes drawer on click */}
                  <div
                    className="fixed inset-0 z-40 bg-black/40 md:hidden"
                    onClick={toggleSidebar}
                    aria-hidden="true"
                  />
                  {/* Drawer panel */}
                  <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 shadow-xl overflow-y-auto md:hidden">
                    <ErrorBoundary fallback="Sidebar failed to render.">
                      <Sidebar />
                    </ErrorBoundary>
                  </div>
                </>
              )}

              {/* ── Sidebar — desktop: inline column ── */}
              {sidebarOpen && (
                <div className="hidden md:block md:w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
                  <ErrorBoundary fallback="Sidebar failed to render.">
                    <Sidebar />
                  </ErrorBoundary>
                </div>
              )}

              {/* ── Main reader — always full-width on mobile ── */}
              <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                <ErrorBoundary fallback="Bible reader failed to render.">
                  <BibleReader />
                </ErrorBoundary>
              </div>

              {/* ── Right panel — desktop: inline column ── */}
              {rightPanelOpen && (
                <div className="hidden md:flex md:w-96 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden flex-col">
                  <ErrorBoundary fallback="Right panel failed to render.">
                    <RightPanel />
                  </ErrorBoundary>
                </div>
              )}

              {/* ── Right panel — mobile: slide-up bottom sheet ── */}
              {rightPanelOpen && (
                <>
                  {/* Backdrop: only visible on mobile, closes sheet on click */}
                  <div
                    className="fixed inset-0 z-30 bg-black/40 md:hidden"
                    onClick={toggleRightPanel}
                    aria-hidden="true"
                  />
                  {/* Bottom sheet panel */}
                  <div className="fixed bottom-0 left-0 right-0 z-40 h-[80vh] bg-white dark:bg-gray-800 rounded-t-xl shadow-xl overflow-hidden flex flex-col md:hidden">
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
