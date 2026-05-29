import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, ChevronRight, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { api } from '../../api/client';
import { useStudyStore } from '../../stores/studyStore';
import clsx from 'clsx';

const CATEGORY_COLORS = {
  'Theology Proper': 'blue',
  'Christology': 'purple',
  'Pneumatology': 'sky',
  'Soteriology': 'green',
  'Ecclesiology': 'amber',
  'Eschatology': 'rose',
  'Anthropology': 'orange',
  'Bibliology': 'teal',
  'Angelology': 'indigo',
};

const COLOR_CLASSES = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-300',   border: 'border-blue-200 dark:border-blue-700',   badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-700', badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
  sky:    { bg: 'bg-sky-50 dark:bg-sky-900/20',     text: 'text-sky-700 dark:text-sky-300',     border: 'border-sky-200 dark:border-sky-700',     badge: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300' },
  green:  { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-700', badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  amber:  { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700', badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  rose:   { bg: 'bg-rose-50 dark:bg-rose-900/20',   text: 'text-rose-700 dark:text-rose-300',   border: 'border-rose-200 dark:border-rose-700',   badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-700', badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' },
  teal:   { bg: 'bg-teal-50 dark:bg-teal-900/20',   text: 'text-teal-700 dark:text-teal-300',   border: 'border-teal-200 dark:border-teal-700',   badge: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-700', badge: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' },
};

function cc(category) {
  return COLOR_CLASSES[CATEGORY_COLORS[category]] || COLOR_CLASSES.blue;
}

// ── Doctrine Entry View ─────────────────────────────────────────
function DoctrineView({ name, onBack }) {
  const { setReference } = useStudyStore();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['doctrine', name, refreshKey],
    queryFn: () => api.getDoctrine(name, refreshKey > 0),
    staleTime: 5 * 60 * 1000,
  });

  const content = data?.content;
  const color = cc(data?.category);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
      <Loader2 size={24} className="animate-spin text-blue-500" />
      <p className="text-xs">Generating doctrinal entry…</p>
    </div>
  );

  if (isError || !content) return (
    <div className="p-4 text-center text-sm text-red-500">Failed to load. <button className="underline" onClick={() => setRefreshKey(k => k + 1)}>Retry</button></div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="panel-header flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <X size={12} /> Back
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{content.name}</span>
          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', color.badge)}>
            {content.category}
          </span>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          title="Regenerate"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
        {/* Definition */}
        <div className={clsx('rounded-lg p-3 border', color.bg, color.border)}>
          <p className={clsx('text-[10px] font-semibold uppercase tracking-wider mb-1', color.text)}>Definition</p>
          <p className="text-gray-700 dark:text-gray-200 text-xs leading-relaxed">{content.definition}</p>
        </div>

        {/* Key Verses */}
        {content.key_verses?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Key Verses</p>
            <div className="space-y-1.5">
              {content.key_verses.map((v, i) => (
                <div key={i} className="flex items-start gap-2">
                  <button
                    onClick={() => {
                      const [book, rest] = v.ref.split(/\s+(?=\d+:)/);
                      const [ch, vs] = (rest || '1:1').split(':');
                      setReference(book, parseInt(ch) || 1, parseInt(vs) || 1);
                    }}
                    className="flex-shrink-0 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                  >
                    {v.ref}
                  </button>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug">{v.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {content.summary && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Summary</p>
            <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">{content.summary}</p>
          </div>
        )}

        {/* Theological Positions */}
        {content.positions && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Theological Positions</p>
            <div className="space-y-2">
              {Object.entries(content.positions).map(([tradition, view]) => (
                <div key={tradition} className="border border-gray-100 dark:border-gray-700 rounded-lg p-2.5">
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">{tradition}</p>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">{view}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Doctrines */}
        {content.related_doctrines?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Related Doctrines</p>
            <div className="flex flex-wrap gap-1.5">
              {content.related_doctrines.map((d) => (
                <button
                  key={d}
                  onClick={() => onBack(d)}
                  className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-0.5 rounded-full transition-colors"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────
export default function DoctrinePanel() {
  const [selected, setSelected] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['doctrine-list'],
    queryFn: () => api.listDoctrines(),
    staleTime: 10 * 60 * 1000,
  });

  const coreDocs = listData?.core_doctrines || [];
  const categories = listData?.categories || [];
  const cached = new Set((listData?.entries || []).map(e => e.name));

  const filtered = useMemo(() => {
    let docs = coreDocs;
    if (activeCategory) docs = docs.filter(d => d.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(d => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
    }
    return docs;
  }, [coreDocs, activeCategory, searchQuery]);

  // Group by category for display
  const grouped = useMemo(() => {
    const map = {};
    for (const d of filtered) {
      if (!map[d.category]) map[d.category] = [];
      map[d.category].push(d);
    }
    return map;
  }, [filtered]);

  if (selected) {
    return <DoctrineView name={selected} onBack={(related) => setSelected(related || null)} />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="panel-header flex-shrink-0">
        <BookOpenCheck size={14} className="text-purple-500" />
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">Doctrine Index</span>
        <span className="text-[10px] text-gray-400">{coreDocs.length} topics</span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5">
          <Search size={12} className="text-gray-400 flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search doctrines…"
            className="w-full text-xs bg-transparent border-none focus:outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Category filter chips */}
      <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto scrollbar-hide border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={() => setActiveCategory(null)}
          className={clsx(
            'flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors',
            !activeCategory ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          )}
        >
          All
        </button>
        {categories.map((cat) => {
          const color = cc(cat);
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={clsx(
                'flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors',
                activeCategory === cat ? `${color.badge}` : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Doctrine list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {listLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-xs">No doctrines match "{searchQuery}"</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, docs]) => {
            const color = cc(cat);
            return (
              <div key={cat}>
                <p className={clsx('text-[10px] font-semibold uppercase tracking-wider mb-1.5', color.text)}>
                  {cat}
                </p>
                <div className="space-y-0.5">
                  {docs.map((d) => (
                    <button
                      key={d.name}
                      onClick={() => setSelected(d.name)}
                      className={clsx(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors',
                        'border',
                        cached.has(d.name)
                          ? `${color.bg} ${color.border} hover:opacity-90`
                          : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-white dark:bg-gray-800'
                      )}
                    >
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-100">{d.name}</span>
                      <div className="flex items-center gap-1.5">
                        {cached.has(d.name) && (
                          <span className="text-[9px] text-gray-400 dark:text-gray-500">cached</span>
                        )}
                        <ChevronRight size={12} className="text-gray-300 dark:text-gray-600" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
