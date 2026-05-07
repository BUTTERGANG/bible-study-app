import { useState, useEffect } from 'react'
import { useStudyStore } from './stores/studyStore'
import Sidebar from './components/Sidebar/Sidebar'
import BibleReader from './components/BibleReader/BibleReader'
import RightPanel from './components/layout/RightPanel'
import SearchModal from './components/Search/SearchModal'
import TopBar from './components/layout/TopBar'

export default function App() {
  const { sidebarOpen } = useStudyStore()
  const [searchOpen, setSearchOpen] = useState(false)

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
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      <TopBar onSearch={() => setSearchOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — book/chapter navigation */}
        {sidebarOpen && (
          <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
            <Sidebar />
          </div>
        )}

        {/* Center — Bible text */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <BibleReader />
        </div>

        {/* Right panel — commentary / AI / notes */}
        <div className="w-96 flex-shrink-0 border-l border-gray-200 bg-white overflow-hidden flex flex-col">
          <RightPanel />
        </div>
      </div>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
