import { Suspense, lazy, useEffect, useState } from 'react'
import {
  BookOpen, BookOpenCheck, Bookmark, Brain, Calendar, Cross, GraduationCap,
  Globe, Heart, Layers, Library, Link2, Lightbulb, Map, MessageSquare,
  StickyNote, Church, BookMarked, Clock, Compass, TrendingUp, Rows3,
  CalendarDays, Bell, Users, LayoutGrid, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useStudyStore } from '../../stores/studyStore'
import ErrorBoundary from '../common/ErrorBoundary'
import clsx from 'clsx'

const PassageGuidePanel    = lazy(() => import('../PassageGuide/PassageGuidePanel'))
const CommentaryPanel      = lazy(() => import('../CommentaryPanel/CommentaryPanel'))
const AIAssistant          = lazy(() => import('../AIAssistant/AIAssistant'))
const NotesPanel           = lazy(() => import('../Notes/NotesPanel'))
const WordStudyPanel       = lazy(() => import('../WordStudy/WordStudyPanel'))
const BookmarksPanel       = lazy(() => import('../Bookmarks/BookmarksPanel'))
const ReadingPlansPanel    = lazy(() => import('../ReadingPlans/ReadingPlansPanel'))
const DictionaryPanel      = lazy(() => import('../Dictionary/DictionaryPanel'))
const CrossReferencePanel  = lazy(() => import('../CrossReference/CrossReferencePanel'))
const SermonBuilder        = lazy(() => import('../SermonBuilder/SermonBuilder'))
const FactbookPanel        = lazy(() => import('../Factbook/FactbookPanel'))
const LibraryReader        = lazy(() => import('../Library/LibraryReader'))
const NtOtPanel            = lazy(() => import('../NtOt/NtOtPanel'))
const TimelinePanel        = lazy(() => import('../Timeline/TimelinePanel'))
const MapPanel             = lazy(() => import('../Maps/MapPanel'))
const ComparePanel         = lazy(() => import('../Compare/ComparePanel'))
const TopicalSearchPanel   = lazy(() => import('../TopicalSearchPanel/TopicalSearchPanel'))
const InsightsPanel        = lazy(() => import('../Insights/InsightsPanel'))
const MemorizePanel        = lazy(() => import('../Memorize/MemorizePanel'))
const PrayerPanel          = lazy(() => import('../Prayer/PrayerPanel'))
const StudyBuilder         = lazy(() => import('../StudyBuilder/StudyBuilder'))
const DashboardPanel       = lazy(() => import('../Dashboard/DashboardPanel'))
const CulturalContextPanel = lazy(() => import('../Insights/CulturalContextPanel'))
const GospelHarmony        = lazy(() => import('../GospelHarmony/GospelHarmony'))
const LectionaryPanel      = lazy(() => import('../Lectionary/LectionaryPanel'))
const NotificationSettings = lazy(() => import('./NotificationSettings'))
const GroupsPanel          = lazy(() => import('../Groups/GroupsPanel'))
const DoctrinePanel        = lazy(() => import('../Doctrine/DoctrinePanel'))
const CounselingPanel      = lazy(() => import('../Counseling/CounselingPanel'))
const PreachingSeriesPanel = lazy(() => import('../PreachingSeries/PreachingSeriesPanel'))

// ── Panel registry ────────────────────────────────────────────────────────
const PANEL_MAP = {
  home:          { label: 'Dashboard',    icon: LayoutGrid },
  commentary:    { label: 'Commentary',   icon: BookOpen },
  ai:            { label: 'AI Study',     icon: MessageSquare },
  notes:         { label: 'Notes',        icon: StickyNote },
  insights:      { label: 'Insights',     icon: Lightbulb },
  'word-study':  { label: 'Word Study',   icon: Layers },
  guide:         { label: 'Passage Guide',icon: Compass },
  'cross-ref':   { label: 'Cross-Ref',    icon: Cross },
  'nt-ot':       { label: 'NT → OT',      icon: Link2 },
  compare:       { label: 'Compare',      icon: Layers },
  cultural:      { label: 'Cultural',     icon: Globe },
  harmony:       { label: 'Harmony',      icon: Rows3 },
  doctrine:      { label: 'Doctrine',     icon: BookOpenCheck },
  dictionary:    { label: 'Dictionary',   icon: BookOpen },
  factbook:      { label: 'Factbook',     icon: BookMarked },
  library:       { label: 'Library',      icon: Library },
  topical:       { label: 'Topical',      icon: TrendingUp },
  lectionary:    { label: 'Lectionary',   icon: CalendarDays },
  timeline:      { label: 'Timeline',     icon: Clock },
  maps:          { label: 'Maps',         icon: Map },
  bookmarks:     { label: 'Bookmarks',    icon: Bookmark },
  reading:       { label: 'Reading Plans',icon: Calendar },
  memorize:      { label: 'Memorize',     icon: Brain },
  prayer:        { label: 'Prayer',       icon: Heart },
  study:         { label: 'Study Builder',icon: GraduationCap },
  counseling:    { label: 'Counseling',   icon: Heart },
  sermon:        { label: 'Sermon',       icon: Church },
  series:        { label: 'Series',       icon: Calendar },
  groups:        { label: 'Groups',       icon: Users },
  notifications: { label: 'Alerts',       icon: Bell },
}

// ── Category definitions ─────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'study',
    label: 'Study',
    panels: ['commentary', 'insights', 'guide', 'cross-ref', 'nt-ot', 'compare', 'cultural', 'harmony', 'doctrine'],
  },
  {
    id: 'reference',
    label: 'Reference',
    panels: ['word-study', 'dictionary', 'factbook', 'library', 'topical', 'lectionary'],
  },
  {
    id: 'tools',
    label: 'Tools',
    panels: ['timeline', 'maps', 'home'],
  },
  {
    id: 'personal',
    label: 'Personal',
    panels: ['notes', 'bookmarks', 'reading', 'memorize', 'prayer', 'study', 'counseling'],
  },
  {
    id: 'ministry',
    label: 'Ministry',
    panels: ['ai', 'sermon', 'series', 'groups', 'notifications'],
  },
]

function whichCategory(panelId) {
  return CATEGORIES.find((c) => c.panels.includes(panelId))?.id ?? 'study'
}

function PanelSkeleton() {
  return <div className="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">Loading…</div>
}

export default function RightPanel() {
  const { rightPanel, setRightPanel } = useStudyStore()
  const [activeCat, setActiveCat] = useState(() => whichCategory(rightPanel))
  const [pickerOpen, setPickerOpen] = useState(true)

  // Sync activeCat when rightPanel is changed externally (Sidebar, openWordStudy, etc.)
  useEffect(() => {
    setActiveCat(whichCategory(rightPanel))
  }, [rightPanel])

  function selectPanel(id) {
    setRightPanel(id)
    setActiveCat(whichCategory(id))
    setPickerOpen(false)
  }

  function handleCatClick(catId) {
    if (catId === activeCat) {
      setPickerOpen((o) => !o)
    } else {
      setActiveCat(catId)
      setPickerOpen(true)
    }
  }

  const currentCat = CATEGORIES.find((c) => c.id === activeCat) ?? CATEGORIES[0]

  return (
    <div className="flex flex-col h-full">
      {/* ── Category tab bar ── */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
        {CATEGORIES.map((cat) => {
          const isActive = activeCat === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => handleCatClick(cat.id)}
              title={isActive ? (pickerOpen ? 'Collapse panel picker' : 'Expand panel picker') : cat.label}
              className={clsx(
                'flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-0.5',
                isActive
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              {cat.label}
              {isActive && (
                pickerOpen
                  ? <ChevronUp size={10} className="opacity-50" />
                  : <ChevronDown size={10} className="opacity-50" />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Panel picker grid (collapsible) ── */}
      {pickerOpen && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 px-2 py-2">
          <div className="grid grid-cols-3 gap-1">
            {currentCat.panels.map((id) => {
              const info = PANEL_MAP[id]
              if (!info) return null
              const Icon = info.icon
              const isActive = rightPanel === id
              return (
                <button
                  key={id}
                  onClick={() => selectPanel(id)}
                  title={info.label}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors text-left truncate',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <Icon size={12} className="flex-shrink-0" />
                  <span className="truncate">{info.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}


      {/* ── Panel content ── */}
      <div className="flex-1 overflow-hidden">
        <ErrorBoundary key={rightPanel}>
          <Suspense fallback={<PanelSkeleton />}>
            {rightPanel === 'home'          && <DashboardPanel />}
            {rightPanel === 'insights'      && <InsightsPanel />}
            {rightPanel === 'guide'         && <PassageGuidePanel />}
            {rightPanel === 'commentary'    && <CommentaryPanel />}
            {rightPanel === 'compare'       && <ComparePanel />}
            {rightPanel === 'cross-ref'     && <CrossReferencePanel />}
            {rightPanel === 'nt-ot'         && <NtOtPanel />}
            {rightPanel === 'dictionary'    && <DictionaryPanel />}
            {rightPanel === 'ai'            && <AIAssistant />}
            {rightPanel === 'sermon'        && <SermonBuilder />}
            {rightPanel === 'factbook'      && <FactbookPanel />}
            {rightPanel === 'notes'         && <NotesPanel />}
            {rightPanel === 'word-study'    && <WordStudyPanel />}
            {rightPanel === 'library'       && <LibraryReader />}
            {rightPanel === 'bookmarks'     && <BookmarksPanel />}
            {rightPanel === 'reading'       && <ReadingPlansPanel />}
            {rightPanel === 'timeline'      && <TimelinePanel />}
            {rightPanel === 'maps'          && <MapPanel />}
            {rightPanel === 'topical'       && <TopicalSearchPanel />}
            {rightPanel === 'memorize'      && <MemorizePanel />}
            {rightPanel === 'prayer'        && <PrayerPanel />}
            {rightPanel === 'study'         && <StudyBuilder />}
            {rightPanel === 'cultural'      && <CulturalContextPanel />}
            {rightPanel === 'harmony'       && <GospelHarmony />}
            {rightPanel === 'lectionary'    && <LectionaryPanel />}
            {rightPanel === 'notifications' && <NotificationSettings />}
            {rightPanel === 'groups'        && <GroupsPanel />}
            {rightPanel === 'doctrine'      && <DoctrinePanel />}
            {rightPanel === 'counseling'    && <CounselingPanel />}
            {rightPanel === 'series'        && <PreachingSeriesPanel />}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  )
}
