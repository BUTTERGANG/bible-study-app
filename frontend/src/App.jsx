import { Suspense, lazy, useEffect, useState } from 'react'
import { useStudyStore } from './stores/studyStore'
import { useUrlSync } from './hooks/useUrlSync'
import Sidebar from './components/Sidebar/Sidebar'
import BibleReader from './components/BibleReader/BibleReader'
import RightPanel from './components/layout/RightPanel'
import TopBar from './components/layout/TopBar'
import ErrorBoundary from './components/common/ErrorBoundary'
import AuthGate from './components/common/AuthGate'

const SearchModal = lazy(() => import('./components/Search/SearchModal'))

export default function App() {
  const { sidebarOpen, rightPanelOpen, darkMode } = useStudyStore()
  const [searchOpen, setSearchOpen] = useState(false)
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
        <TopBar onSearch={() => setSearchOpen(true)} />

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
      </div>
    </AuthGate>
  )
}
