import { Suspense, lazy } from 'react'
import { BookOpen, Bookmark, Calendar, Cross, Layers, Library, MessageSquare, StickyNote } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import clsx from 'clsx'

// Each panel is lazy-loaded so we don't pay for AI/word-study bundle weight on
// users who only read scripture + commentary.
const CommentaryPanel = lazy(() => import('../CommentaryPanel/CommentaryPanel'))
const AIAssistant = lazy(() => import('../AIAssistant/AIAssistant'))
const NotesPanel = lazy(() => import('../Notes/NotesPanel'))
const WordStudyPanel = lazy(() => import('../WordStudy/WordStudyPanel'))
const BookmarksPanel = lazy(() => import('../Bookmarks/BookmarksPanel'))
const ReadingPlansPanel = lazy(() => import('../ReadingPlans/ReadingPlansPanel'))
const DictionaryPanel = lazy(() => import('../Dictionary/DictionaryPanel'))
const CrossReferencePanel = lazy(() => import('../CrossReference/CrossReferencePanel'))
const LibraryReader = lazy(() => import('../Library/LibraryReader'))

const TABS = [
  { id: 'commentary', label: 'Commentary', icon: BookOpen },
  { id: 'cross-ref', label: 'Cross-Ref', icon: Cross },
  { id: 'dictionary', label: 'Dictionary', icon: BookOpen },
  { id: 'ai', label: 'AI Study', icon: MessageSquare },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'word-study', label: 'Words', icon: Layers },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'bookmarks', label: 'Saved', icon: Bookmark },
  { id: 'reading', label: 'Plans', icon: Calendar },
]

function PanelSkeleton() {
  return (
    <div className="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">Loading…</div>
  )
}

export default function RightPanel() {
  const { rightPanel, setRightPanel } = useStudyStore()

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setRightPanel(id)}
            className={clsx(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
              rightPanel === id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-gray-800'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<PanelSkeleton />}>
          {rightPanel === 'commentary' && <CommentaryPanel />}
          {rightPanel === 'cross-ref' && <CrossReferencePanel />}
          {rightPanel === 'dictionary' && <DictionaryPanel />}
          {rightPanel === 'ai' && <AIAssistant />}
          {rightPanel === 'notes' && <NotesPanel />}
          {rightPanel === 'word-study' && <WordStudyPanel />}
          {rightPanel === 'library' && <LibraryReader />}
          {rightPanel === 'bookmarks' && <BookmarksPanel />}
          {rightPanel === 'reading' && <ReadingPlansPanel />}
        </Suspense>
      </div>
    </div>
  )
}
