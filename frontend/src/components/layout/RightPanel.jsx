import { MessageSquare, BookOpen, StickyNote, BookMarked, Layers } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import CommentaryPanel from '../CommentaryPanel/CommentaryPanel'
import AIAssistant from '../AIAssistant/AIAssistant'
import NotesPanel from '../Notes/NotesPanel'
import WordStudyPanel from '../WordStudy/WordStudyPanel'
import clsx from 'clsx'

const TABS = [
  { id: 'commentary', label: 'Commentary', icon: BookOpen },
  { id: 'ai', label: 'AI Study', icon: MessageSquare },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'word-study', label: 'Words', icon: Layers },
]

export default function RightPanel() {
  const { rightPanel, setRightPanel } = useStudyStore()

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setRightPanel(id)}
            className={clsx(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
              rightPanel === id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            )}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {rightPanel === 'commentary' && <CommentaryPanel />}
        {rightPanel === 'ai' && <AIAssistant />}
        {rightPanel === 'notes' && <NotesPanel />}
        {rightPanel === 'word-study' && <WordStudyPanel />}
      </div>
    </div>
  )
}
