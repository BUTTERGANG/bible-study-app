import { Suspense, lazy } from 'react'
import { BookOpen, BookOpenCheck, Bookmark, Brain, Calendar, Cross, GraduationCap, Globe, Heart, Layers, Library, Link2, Lightbulb, Map, MessageSquare, StickyNote, Church, BookMarked, Clock, Compass, TrendingUp, Rows3, CalendarDays, Bell, Users } from 'lucide-react'
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
const SermonBuilder = lazy(() => import('../SermonBuilder/SermonBuilder'))
const FactbookPanel = lazy(() => import('../Factbook/FactbookPanel'))
const LibraryReader = lazy(() => import('../Library/LibraryReader'))
const NtOtPanel = lazy(() => import('../NtOt/NtOtPanel'))
const TimelinePanel = lazy(() => import('../Timeline/TimelinePanel'))
const MapPanel = lazy(() => import('../Maps/MapPanel'))
const ComparePanel = lazy(() => import('../Compare/ComparePanel'))
const TopicalSearchPanel = lazy(() => import('../TopicalSearchPanel/TopicalSearchPanel'))
const InsightsPanel = lazy(() => import('../Insights/InsightsPanel'))
const MemorizePanel = lazy(() => import('../Memorize/MemorizePanel'))
const PrayerPanel = lazy(() => import('../Prayer/PrayerPanel'))
const StudyBuilder = lazy(() => import('../StudyBuilder/StudyBuilder'))
const DashboardPanel = lazy(() => import('../Dashboard/DashboardPanel'))
const CulturalContextPanel = lazy(() => import('../Insights/CulturalContextPanel'))
const GospelHarmony = lazy(() => import('../GospelHarmony/GospelHarmony'))
const LectionaryPanel = lazy(() => import('../Lectionary/LectionaryPanel'))
const NotificationSettings = lazy(() => import('./NotificationSettings'))
const GroupsPanel = lazy(() => import('../Groups/GroupsPanel'))
const DoctrinePanel = lazy(() => import('../Doctrine/DoctrinePanel'))
const CounselingPanel = lazy(() => import('../Counseling/CounselingPanel'))
const PreachingSeriesPanel = lazy(() => import('../PreachingSeries/PreachingSeriesPanel'))

const TABS = [
  { id: 'home', label: 'Home', icon: BookOpen },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
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
  { id: 'topical', label: 'Topical', icon: TrendingUp },
  { id: 'memorize', label: 'Memorize', icon: Brain },
  { id: 'prayer', label: 'Prayer', icon: Heart },
  { id: 'study', label: 'Study', icon: GraduationCap },
  { id: 'cultural', label: 'Culture', icon: Globe },
  { id: 'harmony', label: 'Harmony', icon: Rows3 },
  { id: 'lectionary', label: 'Lectionary', icon: CalendarDays },
  { id: 'notifications', label: 'Alerts', icon: Bell },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'doctrine', label: 'Doctrine', icon: BookOpenCheck },
  { id: 'counseling', label: 'Counseling', icon: Heart },
  { id: 'series', label: 'Series', icon: Calendar },
]

function PanelSkeleton() {
  return (
    <div className="p-4 text-xs text-gray-400 dark:text-slate-500 text-center">Loading…</div>
  )
}

export default function RightPanel() {
  const { rightPanel, setRightPanel } = useStudyStore()

  return (
    <div className="flex flex-col h-full">
      <div
        role="tablist"
        aria-label="Study panels"
        className="flex overflow-x-auto border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-900 flex-shrink-0 scrollbar-hide"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={rightPanel === id}
            aria-controls={`${id}-panel`}
            id={`tab-${id}`}
            onClick={() => setRightPanel(id)}
            className={clsx(
              'flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium transition-colors min-w-[72px]',
              rightPanel === id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-slate-950'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'
            )}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${rightPanel}-panel`}
        aria-labelledby={`tab-${rightPanel}`}
        className="flex-1 overflow-hidden"
      >
        <Suspense fallback={<PanelSkeleton />}>
          {rightPanel === 'home' && <DashboardPanel />}
          {rightPanel === 'insights' && <InsightsPanel />}
          {rightPanel === 'guide' && <PassageGuidePanel />}
          {rightPanel === 'commentary' && <CommentaryPanel />}
          {rightPanel === 'compare' && <ComparePanel />}
          {rightPanel === 'cross-ref' && <CrossReferencePanel />}
          {rightPanel === 'nt-ot' && <NtOtPanel />}
          {rightPanel === 'dictionary' && <DictionaryPanel />}
          {rightPanel === 'ai' && <AIAssistant />}
          {rightPanel === 'sermon' && <SermonBuilder />}
          {rightPanel === 'factbook' && <FactbookPanel />}
          {rightPanel === 'notes' && <NotesPanel />}
          {rightPanel === 'word-study' && <WordStudyPanel />}
          {rightPanel === 'library' && <LibraryReader />}
          {rightPanel === 'bookmarks' && <BookmarksPanel />}
          {rightPanel === 'reading' && <ReadingPlansPanel />}
          {rightPanel === 'timeline' && <TimelinePanel />}
          {rightPanel === 'maps' && <MapPanel />}
          {rightPanel === 'topical' && <TopicalSearchPanel />}
          {rightPanel === 'memorize' && <MemorizePanel />}
          {rightPanel === 'prayer' && <PrayerPanel />}
          {rightPanel === 'study' && <StudyBuilder />}
          {rightPanel === 'cultural' && <CulturalContextPanel />}
          {rightPanel === 'harmony' && <GospelHarmony />}
          {rightPanel === 'lectionary' && <LectionaryPanel />}
          {rightPanel === 'notifications' && <NotificationSettings />}
          {rightPanel === 'groups' && <GroupsPanel />}
          {rightPanel === 'doctrine' && <DoctrinePanel />}
          {rightPanel === 'counseling' && <CounselingPanel />}
          {rightPanel === 'series' && <PreachingSeriesPanel />}
        </Suspense>
      </div>
    </div>
  )
}
