import { BookOpen, MessageSquare, Search, StickyNote, LayoutGrid } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import clsx from 'clsx'

const NAV_ITEMS = [
  { id: 'read',      icon: BookOpen,      label: 'Read',      action: 'reader' },
  { id: 'search',    icon: Search,        label: 'Search',    action: 'search' },
  { id: 'commentary',icon: BookOpen,      label: 'Commentary',action: 'panel', panel: 'commentary' },
  { id: 'notes',     icon: StickyNote,    label: 'Notes',     action: 'panel', panel: 'notes' },
  { id: 'panels',    icon: LayoutGrid,    label: 'Tools',     action: 'panel', panel: 'home' },
]

export default function MobileBottomNav({ onSearch }) {
  const rightPanel = useStudyStore((s) => s.rightPanel)
  const rightPanelOpen = useStudyStore((s) => s.rightPanelOpen)
  const setRightPanel = useStudyStore((s) => s.setRightPanel)
  const setRightPanelOpen = useStudyStore((s) => s.setRightPanelOpen)

  function handleItem(item) {
    if (item.action === 'search') {
      onSearch()
      return
    }
    if (item.action === 'reader') {
      setRightPanelOpen(false)
      return
    }
    if (item.action === 'panel') {
      setRightPanel(item.panel)
      setRightPanelOpen(true)
    }
  }

  function isActive(item) {
    if (item.action === 'reader') return !rightPanelOpen
    if (item.action === 'panel') return rightPanelOpen && rightPanel === item.panel
    return false
  }

  return (
    <nav className="sm:hidden flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 safe-area-bottom">
      <div className="flex">
        {NAV_ITEMS.map(item => {
          const active = isActive(item)
          return (
            <button
              key={item.id}
              onClick={() => handleItem(item)}
              className={clsx(
                'flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors min-h-[52px]',
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
              aria-label={item.label}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
