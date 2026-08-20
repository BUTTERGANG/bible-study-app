import { Suspense, lazy, useEffect, useState } from 'react'
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
const OriginalLanguageCoursesPanel = lazy(() => import('../OriginalLanguages/OriginalLanguageCoursesPanel'))

const PANEL_GROUPS = [
  {
    id: 'scripture',
    label: 'Scripture',
    icon: BookOpen,
    panels: [
      { id: 'home', label: 'Overview', icon: BookOpen },
      { id: 'guide', label: 'Passage guide', icon: Compass },
      { id: 'commentary', label: 'Commentary', icon: BookOpen },
      { id: 'insights', label: 'Insights', icon: Lightbulb },
      { id: 'compare', label: 'Compare', icon: Layers },
      { id: 'cross-ref', label: 'Cross-references', icon: Cross },
      { id: 'nt-ot', label: 'NT / OT links', icon: Link2 },
      { id: 'harmony', label: 'Gospel harmony', icon: Rows3 },
    ],
  },
  {
    id: 'study',
    label: 'Study',
    icon: GraduationCap,
    panels: [
      { id: 'ai', label: 'AI study', icon: MessageSquare },
      { id: 'word-study', label: 'Word study', icon: Layers },
      { id: 'dictionary', label: 'Dictionary', icon: BookOpen },
      { id: 'languages', label: 'Original languages', icon: GraduationCap },
      { id: 'doctrine', label: 'Doctrine', icon: BookOpenCheck },
      { id: 'cultural', label: 'Cultural context', icon: Globe },
      { id: 'topical', label: 'Topical search', icon: TrendingUp },
      { id: 'factbook', label: 'Factbook', icon: BookMarked },
    ],
  },
  {
    id: 'library',
    label: 'Resources',
    icon: Library,
    panels: [
      { id: 'library', label: 'Library', icon: Library },
      { id: 'reading', label: 'Reading plans', icon: Calendar },
      { id: 'lectionary', label: 'Lectionary', icon: CalendarDays },
      { id: 'timeline', label: 'Timeline', icon: Clock },
      { id: 'maps', label: 'Maps', icon: Map },
    ],
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: Heart,
    panels: [
      { id: 'notes', label: 'Notes', icon: StickyNote },
      { id: 'bookmarks', label: 'Saved', icon: Bookmark },
      { id: 'memorize', label: 'Memorize', icon: Brain },
      { id: 'prayer', label: 'Prayer', icon: Heart },
      { id: 'study', label: 'Study builder', icon: GraduationCap },
    ],
  },
  {
    id: 'ministry',
    label: 'Ministry',
    icon: Users,
    panels: [
      { id: 'sermon', label: 'Sermon builder', icon: Church },
      { id: 'series', label: 'Series planner', icon: Calendar },
      { id: 'groups', label: 'Groups', icon: Users },
      { id: 'counseling', label: 'Counseling', icon: Heart },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
]

function getGroupForPanel(panelId) {
  return PANEL_GROUPS.find((group) => group.panels.some((panel) => panel.id === panelId))
}

function PanelSkeleton() {
  return (
    <div className="p-4 text-xs text-gray-400 dark:text-slate-500 text-center">Loading…</div>
  )
}
export default function RightPanel() {
  const { rightPanel, setRightPanel } = useStudyStore()
  const activeGroup = getGroupForPanel(rightPanel) || PANEL_GROUPS[0]
  const [groupId, setGroupId] = useState(activeGroup.id)

  useEffect(() => {
    setGroupId(activeGroup.id)
  }, [activeGroup.id])

  const selectedGroup = PANEL_GROUPS.find((group) => group.id === groupId) || activeGroup
  const selectGroup = (group) => {
    setGroupId(group.id)
    if (!group.panels.some((panel) => panel.id === rightPanel)) {
      setRightPanel(group.panels[0].id)
    }
  }
  const selectPanel = (panelId) => setRightPanel(panelId)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-900 flex-shrink-0">
        <div role="tablist" aria-label="Study categories" className="flex items-center gap-1 px-2 pt-2">
          {PANEL_GROUPS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={groupId === id}
              onClick={() => selectGroup(PANEL_GROUPS.find((group) => group.id === id))}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-md text-[11px] font-medium transition-colors',
                groupId === id
                  ? 'text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-950'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              )}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div role="tablist" aria-label={`${selectedGroup.label} panels`} className="flex overflow-x-auto px-2 py-2 gap-1 scrollbar-hide">
          {selectedGroup.panels.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={rightPanel === id}
              aria-controls={`${id}-panel`}
              id={`tab-${id}`}
              onClick={() => selectPanel(id)}
              className={clsx(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                rightPanel === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
              )}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>
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
          {rightPanel === 'languages' && <OriginalLanguageCoursesPanel />}
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
