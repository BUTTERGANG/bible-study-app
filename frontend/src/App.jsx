import { Suspense, lazy, useEffect, useState } from 'react'
import { useStudyStore } from './stores/studyStore'
import { useUrlSync } from './hooks/useUrlSync'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import Sidebar from './components/Sidebar/Sidebar'
import BibleReader from './components/BibleReader/BibleReader'
import RightPanel from './components/layout/RightPanel'
import TopBar from './components/layout/TopBar'
import AudioPlayer from './components/AudioPlayer/AudioPlayer'
import ErrorBoundary from './components/common/ErrorBoundary'
import AuthGate from './components/common/AuthGate'

const SearchModal = lazy(() => import('./components/Search/SearchModal'))
const MorphSearchModal = lazy(() => import('./components/Search/MorphSearchModal'))

export default function App() {
  const { sidebarOpen, rightPanelOpen, darkMode, book, chapter, translation } = useStudyStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [morphSearchOpen, setMorphSearchOpen] = useState(false)
  const [audioOpen, setAudioOpen] = useState(false)
  const online = useOnlineStatus()
  useUrlSync()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <AuthGate>
      <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 overflow-hidden">
        {!online && (
          <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-500 text-white text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80 animate-pulse" />
            Offline — showing cached content
          </div>
        )}
        <TopBar
          onSearch={() => setSearchOpen(true)}
          onMorphSearch={() => setMorphSearchOpen(true)}
          onToggleAudio={() => setAudioOpen((o) => !o)}
        />

        <div className="flex flex-1 overflow-hidden">
          {sidebarOpen && (
            <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
              <ErrorBoundary fallback="Sidebar failed to render.">
                <Sidebar />
              </ErrorBoundary>
            </div>
          )}

          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            <ErrorBoundary fallback="Bible reader failed to render.">
              <BibleReader />
            </ErrorBoundary>
          </div>

          {rightPanelOpen && (
            <div className="w-96 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden flex flex-col">
              <ErrorBoundary fallback="Right panel failed to render.">
                <RightPanel />
              </ErrorBoundary>
            </div>
          )}
        </div>

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

        {audioOpen && (
          <AudioPlayer
            key={`${translation}-${book}-${chapter}`}
            onClose={() => setAudioOpen(false)}
          />
        )}
      </div>
    </AuthGate>
  )
}
