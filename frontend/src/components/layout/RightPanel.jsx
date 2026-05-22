import { Suspense, lazy } from 'react'
import { BookOpen, Bookmark, Calendar, Cross, Layers, Library, Link2, Map, MessageSquare, StickyNote, Church, BookMarked, Clock, Compass } from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import clsx from 'clsx'

// Each panel is lazy-loaded so we don't pay for AI/word-study bundle weight on
// users who only read scripture + commentary.
const PassageGuidePanel = lazy(() => import('../PassageGuide/PassageGuidePanel'))
const CommentaryPanel = lazy(() => import('../CommentaryPanel/CommentaryPanel'))
const AIAssistant = lazy(() => import('../AIAssistant/AIAssistant'))
const NotesPanel = lazy(() => import('../Notes/NotesPanel'))
const WordStudyPanel = lazy(() => import('../WordStudy/WordStudyPanel'))
const BookmarksPanel = lazy(() => import('../Bookmarks/BookmarksPanel'))
const ReadingPlansPanel = lazy(() => import('../ReadingPlans/ReadingPlansPanel'))
const DictionaryPanel = lazy(() => import('../Dictionary/DictionaryPanel'))
const CrossReferencePanel = lazy(() => import('../CrossReference/CrossReferencePanel'))
const SermonAssistant = lazy(() => import('../SermonAssistant/SermonAssistant'))
const FactbookPanel = lazy(() => import('../Factbook/FactbookPanel'))
const LibraryReader = lazy(() => import('../Library/LibraryReader'))
const NtOtPanel = lazy(() => import('../NtOt/NtOtPanel'))
const TimelinePanel = lazy(() => import('../Timeline/TimelinePanel'))
const MapPanel = lazy(() => import('../Maps/MapPanel'))
const ComparePanel = lazy(() => import('../Compare/ComparePanel'))

const TABS = [
  { id: 'guide', label: 'Guide', icon: Compass },
  { id: 'commentary', label: 'Commentary', icon: BookOpen },
  { id: 'compare', label: 'Compare', icon: Layers },
  { id: 'cross-ref', label: 'Cross-Ref', icon: Cross },
  { id: 'nt-ot', label: 'NT-OT', icon: Link2 },
  { id: 'dictionary', label: 'Dictionary', icon: BookOpen },
  { id: 'ai', label: 'AI Study', icon: MessageSquare },
  { id: 'sermon', label: 'Sermon', icon: Church },
  { id: 'factbook', label: 'Factbook', icon: BookMarked },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'word-study', label: 'Words', icon: Layers },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'bookmarks', label: 'Saved', icon: Bookmark },
  { id: 'reading', label: 'Plans', icon: Calendar },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'maps', label: 'Maps', icon: Map },
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
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0 scrollbar-hide">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setRightPanel(id)}
            className={clsx(
              'flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium transition-colors min-w-[72px]',
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
          {rightPanel === 'guide' && <PassageGuidePanel />}
          {rightPanel === 'commentary' && <CommentaryPanel />}
          {rightPanel === 'compare' && <ComparePanel />}
          {rightPanel === 'cross-ref' && <CrossReferencePanel />}
          {rightPanel === 'nt-ot' && <NtOtPanel />}
          {rightPanel === 'dictionary' && <DictionaryPanel />}
          {rightPanel === 'ai' && <AIAssistant />}
          {rightPanel === 'sermon' && <SermonAssistant />}
          {rightPanel === 'factbook' && <FactbookPanel />}
          {rightPanel === 'notes' && <NotesPanel />}
          {rightPanel === 'word-study' && <WordStudyPanel />}
          {rightPanel === 'library' && <LibraryReader />}
          {rightPanel === 'bookmarks' && <BookmarksPanel />}
          {rightPanel === 'reading' && <ReadingPlansPanel />}
          {rightPanel === 'timeline' && <TimelinePanel />}
          {rightPanel === 'maps' && <MapPanel />}
        </Suspense>
      </div>
    </div>
  )
}
