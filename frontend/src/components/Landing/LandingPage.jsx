import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, MessageSquare, Layers, Map, Brain, Heart,
  Search, Globe, BookMarked, Calendar, Bookmark, StickyNote,
  Church, GraduationCap, Link2, Cross, Rows3, TrendingUp,
  Clock, Lightbulb, Users, Bell, Compass, Library,
  BookOpenCheck, CalendarDays, Download, Wifi, WifiOff,
  Star, Shield, Zap, ChevronRight, Menu, X,
} from 'lucide-react'

const FEATURES = [
  {
    icon: BookOpen,
    title: '13 Bible Translations',
    desc: 'KJV, ASV, BSB, YLT, LEB, Darby, and more — with full-text search across all.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Layers,
    title: 'Greek & Hebrew Interlinear',
    desc: '264K Hebrew + 137K Greek words with morphology, Strong\'s numbers, and transliteration.',
    color: 'from-indigo-500 to-indigo-600',
  },
  {
    icon: MessageSquare,
    title: 'AI Study Assistant',
    desc: 'Ask anything about a passage. Powered by Claude with full chapter context and library search.',
    color: 'from-blue-600 to-cyan-600',
  },
  {
    icon: BookMarked,
    title: '15 Commentary Sources',
    desc: 'Clarke, Barnes, Wesley, Matthew Henry, JFB, Geneva, and 9 more — 539K entries.',
    color: 'from-amber-500 to-amber-600',
  },
  {
    icon: Map,
    title: 'Biblical Maps',
    desc: 'Interactive maps with 8 historical routes, places, and journeys across the ancient world.',
    color: 'from-green-500 to-green-600',
  },
  {
    icon: Search,
    title: 'Semantic & Morphological Search',
    desc: 'Search by theme, keyword, or Greek/Hebrew morphology across the entire Bible.',
    color: 'from-cyan-500 to-cyan-600',
  },
]

const ALL_TOOLS = [
  { icon: BookOpen,      label: 'Commentary' },
  { icon: Lightbulb,    label: 'Insights' },
  { icon: Compass,      label: 'Passage Guide' },
  { icon: Cross,        label: 'Cross-Ref' },
  { icon: Link2,        label: 'NT → OT' },
  { icon: Layers,       label: 'Compare' },
  { icon: Globe,        label: 'Cultural' },
  { icon: Rows3,        label: 'Harmony' },
  { icon: BookOpenCheck,label: 'Doctrine' },
  { icon: Layers,       label: 'Word Study' },
  { icon: BookOpen,     label: 'Dictionary' },
  { icon: BookMarked,   label: 'Factbook' },
  { icon: Library,      label: 'Library' },
  { icon: TrendingUp,   label: 'Topical' },
  { icon: CalendarDays, label: 'Lectionary' },
  { icon: Clock,        label: 'Timeline' },
  { icon: Map,          label: 'Maps' },
  { icon: StickyNote,   label: 'Notes' },
  { icon: Bookmark,     label: 'Bookmarks' },
  { icon: Calendar,     label: 'Reading Plans' },
  { icon: Brain,        label: 'Memorize' },
  { icon: Heart,        label: 'Prayer' },
  { icon: GraduationCap,label: 'Study Builder' },
  { icon: MessageSquare,label: 'AI Study' },
  { icon: Church,       label: 'Sermon Builder' },
  { icon: Calendar,     label: 'Series Planner' },
  { icon: Users,        label: 'Groups' },
  { icon: Bell,         label: 'Notifications' },
  { icon: Globe,        label: 'Gospel Harmony' },
  { icon: Lightbulb,    label: 'Cultural Notes' },
  { icon: Search,       label: 'Morph Search' },
]

function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    function handler(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (installed) {
    return (
      <span className="flex items-center gap-2 text-green-400 text-sm font-medium">
        <Shield size={16} /> App installed
      </span>
    )
  }

  if (!deferredPrompt) return null

  return (
    <button
      onClick={async () => {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') setInstalled(true)
        setDeferredPrompt(null)
      }}
      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
    >
      <Download size={15} />
      Install App
    </button>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const up = () => setIsOnline(true)
    const dn = () => setIsOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', dn)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn) }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <BookOpen size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Scriptura</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-6">
            <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#tools" className="text-sm text-slate-400 hover:text-white transition-colors">Tools</a>
            <a href="#pwa" className="text-sm text-slate-400 hover:text-white transition-colors">Mobile App</a>
            <InstallButton />
            <button
              onClick={() => navigate('/read')}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Open App
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="sm:hidden p-2 text-slate-400 hover:text-white"
            onClick={() => setMobileMenuOpen(o => !o)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-slate-800 border-t border-white/5 px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm text-slate-300 py-2" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#tools" className="block text-sm text-slate-300 py-2" onClick={() => setMobileMenuOpen(false)}>Tools</a>
            <a href="#pwa" className="block text-sm text-slate-300 py-2" onClick={() => setMobileMenuOpen(false)}>Mobile App</a>
            <button
              onClick={() => navigate('/read')}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-3 rounded-lg transition-colors mt-2"
            >
              Open App
            </button>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-4 sm:px-6 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/15 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-950/60 border border-blue-500/30 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <Zap size={11} />
            31 study tools · 13 translations · AI-powered
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
            Scripture study at the<br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              depth of a seminary
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Scriptura brings together Greek &amp; Hebrew interlinear, 15 commentaries, AI study assistant,
            biblical maps, word studies, and more — in a fast, offline-capable PWA.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/read')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors w-full sm:w-auto justify-center"
            >
              Start Reading
              <ChevronRight size={18} />
            </button>
            <a
              href="#features"
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium px-8 py-3.5 rounded-xl text-base transition-colors w-full sm:w-auto justify-center"
            >
              See all features
            </a>
          </div>

          <div className="flex items-center justify-center gap-6 mt-10 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Shield size={13} className="text-green-500" /> Free &amp; open source
            </span>
            <span className="flex items-center gap-1.5">
              {isOnline
                ? <Wifi size={13} className="text-blue-400" />
                : <WifiOff size={13} className="text-amber-400" />}
              Works offline
            </span>
            <span className="flex items-center gap-1.5">
              <Download size={13} className="text-blue-400" /> Installable PWA
            </span>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div className="border-y border-white/5 bg-slate-900/50 py-6 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: '394K+', label: 'Bible verses' },
            { value: '539K+', label: 'Commentary entries' },
            { value: '401K+', label: 'Interlinear words' },
            { value: '31', label: 'Study tools' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature cards ── */}
      <section id="features" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Everything a serious student needs</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Built with the same depth as desktop Bible software, running entirely in your browser.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-slate-800 border border-white/5 rounded-2xl p-6 hover:border-blue-500/30 transition-colors group">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon size={18} className="text-white" />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── All tools grid ── */}
      <section id="tools" className="py-20 px-4 sm:px-6 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">31 built-in study tools</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Every tool is one click away — no switching apps, no subscriptions.</p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {ALL_TOOLS.map(t => (
              <div
                key={t.label}
                className="flex flex-col items-center gap-2 bg-slate-800 border border-white/5 rounded-xl p-3 hover:border-blue-500/40 hover:bg-blue-950/20 transition-all cursor-default"
              >
                <t.icon size={20} className="text-blue-400" />
                <span className="text-[11px] text-slate-400 text-center leading-tight">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PWA / Mobile section ── */}
      <section id="pwa" className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-slate-800/80 to-blue-950/60 border border-blue-500/20 rounded-3xl p-8 sm:p-12">
            <div className="grid sm:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-5">
                  <Download size={11} /> Progressive Web App
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                  Install on any device.<br />Read anywhere.
                </h2>
                <p className="text-slate-400 mb-6 leading-relaxed">
                  Scriptura installs like a native app on iOS, Android, Mac, and Windows.
                  Chapters you've visited are cached for offline reading — no internet required.
                </p>
                <ul className="space-y-3 text-sm text-slate-300">
                  {[
                    { icon: WifiOff, text: 'Full offline support for visited content' },
                    { icon: Zap,     text: 'Instant launch — no app store required' },
                    { icon: Shield,  text: 'No tracking, no ads, no account required*' },
                    { icon: Star,    text: 'Background sync when connection returns' },
                  ].map(item => (
                    <li key={item.text} className="flex items-start gap-3">
                      <item.icon size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
                      {item.text}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-600 mt-4">* Account optional for notes, highlights &amp; sync</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-white mb-1">Install on iOS</p>
                  <p className="text-xs text-slate-400">
                    Open in Safari → tap the Share button → <span className="text-white font-medium">Add to Home Screen</span>
                  </p>
                </div>
                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-white mb-1">Install on Android / Desktop</p>
                  <p className="text-xs text-slate-400 mb-3">
                    Look for the install prompt in your browser's address bar, or tap the button below.
                  </p>
                  <InstallButton />
                </div>
                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-white mb-1">Offline capability</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-amber-400'} animate-pulse`} />
                    <span className="text-xs text-slate-400">
                      {isOnline ? 'Online — all features available' : 'Offline — reading from cache'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-4 sm:px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to go deeper?</h2>
          <p className="text-slate-400 mb-8">
            Open the app and start with any book of the Bible. Commentary, word study, and AI assistance are one click away.
          </p>
          <button
            onClick={() => navigate('/read')}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-10 py-4 rounded-xl text-base transition-colors"
          >
            Open Scriptura
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <BookOpen size={11} className="text-white" />
            </div>
            <span className="font-medium text-slate-400">Scriptura Bible Study</span>
          </div>
          <p>Built with ♱ for students of Scripture</p>
        </div>
      </footer>
    </div>
  )
}
