import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Polygon,
  CircleMarker,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import { useStudyStore } from '../../stores/studyStore'
import { OVERLAY_DEFINITIONS } from '../../data/journeys/index.js'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet's default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ── Constants ──────────────────────────────────────────────────────────────

const PLACE_TYPE_COLORS = {
  city:       '#3b82f6',
  mountain:   '#8b5cf6',
  river:      '#06b6d4',
  sea:        '#0ea5e9',
  region:     '#10b981',
  wilderness: '#f59e0b',
  country:    '#6b7280',
}

// Words to skip when scanning chapter text for place names
const SKIP_WORDS = new Set([
  'the', 'and', 'of', 'in', 'to', 'a', 'an', 'that', 'for', 'is', 'was',
  'he', 'she', 'they', 'it', 'his', 'her', 'their', 'my', 'your', 'our',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'did', 'does',
  'not', 'but', 'or', 'as', 'at', 'by', 'from', 'on', 'with', 'this',
  'these', 'those', 'when', 'where', 'who', 'which', 'what', 'how',
  'all', 'so', 'if', 'then', 'than', 'said', 'lord', 'god', 'jesus',
  'christ', 'spirit', 'holy', 'temple', 'man', 'men', 'people', 'king',
  'came', 'went', 'come', 'go', 'shall', 'will', 'would', 'could', 'may',
])

// ── Helper: make place-type pin icon ──────────────────────────────────────

function makePlaceIcon(placeType, highlighted = false) {
  const color = PLACE_TYPE_COLORS[placeType] || '#6b7280'
  const ring = highlighted ? `<circle cx="12" cy="12" r="11" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.5"/>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="18" height="27">
    ${ring}
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 24 12 24s12-15.6 12-24C24 5.4 18.6 0 12 0z"
      fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="4" fill="white" opacity="0.9"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: highlighted ? 'waypoint-highlighted' : '',
    iconSize: [18, 27],
    iconAnchor: [9, 27],
    popupAnchor: [0, -27],
  })
}

// ── Helper: waypoint icon for journey overlays ────────────────────────────

function makeWaypointIcon(color, highlighted = false) {
  const size = highlighted ? 14 : 10
  const pulse = highlighted
    ? `<circle cx="7" cy="7" r="6" fill="${color}" opacity="0.3"/>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="${size}" height="${size}">
    ${pulse}
    <circle cx="7" cy="7" r="5" fill="${color}" stroke="white" stroke-width="1.5"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  })
}

// ── FitBounds: auto-zoom to visible content ───────────────────────────────

function FitBounds({ places, routes, overlayCoords }) {
  const map = useMap()
  const prevKey = useRef('')

  useEffect(() => {
    const points = []
    places.forEach(p => points.push([p.lat, p.lng]))
    routes.forEach(r => r.coordinates.forEach(c => points.push(c)))
    overlayCoords.forEach(c => points.push(c))

    const key = JSON.stringify(points)
    if (key === prevKey.current || points.length === 0) return
    prevKey.current = key

    try {
      map.fitBounds(points, { padding: [30, 30], maxZoom: 8 })
    } catch {
      // ignore fitBounds errors (no points)
    }
  }, [places, routes, overlayCoords, map])

  return null
}

// ── Data hook: places + routes from API ───────────────────────────────────

function useMapData(book) {
  const [data, setData] = useState({ places: [], routes: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const url = book
      ? `/api/maps/by-verse?book=${encodeURIComponent(book)}`
      : null

    if (!url) {
      Promise.all([
        fetch('/api/maps/places').then(r => r.json()),
        fetch('/api/maps/routes').then(r => r.json()),
      ])
        .then(([pd, rd]) => {
          if (!cancelled) {
            setData({ places: pd.places, routes: rd.routes })
            setLoading(false)
          }
        })
        .catch(() => { if (!cancelled) setLoading(false) })
    } else {
      fetch(url)
        .then(r => r.json())
        .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
        .catch(() => { if (!cancelled) setLoading(false) })
    }

    return () => { cancelled = true }
  }, [book])

  return { ...data, loading }
}

// ── "Current passage" mode: extract place names from verse text ───────────

function usePlaceNamesInChapter(currentVerses, allPlaces) {
  return useCallback(() => {
    if (!currentVerses?.length || !allPlaces?.length) return new Set()

    // Build a lowercase set of all place names (and simple aliases)
    const placeIndex = new Map()
    allPlaces.forEach(p => {
      const key = p.place_name.toLowerCase().trim()
      placeIndex.set(key, p.id)
      // Also index without parenthetical notes e.g. "Antioch (Syria)" → "antioch"
      const base = key.replace(/\s*\(.*?\)\s*/, '').trim()
      if (base && base !== key) placeIndex.set(base, p.id)
    })

    const chapterText = currentVerses
      .map(v => (typeof v === 'string' ? v : v.text || v.verse_text || ''))
      .join(' ')
      .toLowerCase()

    const matched = new Set()
    placeIndex.forEach((id, placeName) => {
      if (placeName.length < 3) return
      if (SKIP_WORDS.has(placeName)) return
      // Word-boundary check
      const escaped = placeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`\\b${escaped}\\b`, 'i')
      if (re.test(chapterText)) matched.add(id)
    })

    return matched
  }, [currentVerses, allPlaces])
}

// ── Overlay layer: journey route with waypoints ───────────────────────────

function JourneyOverlay({ overlay, highlightedPlaceNames, animKey }) {
  const { data, color } = overlay
  if (!data) return null

  const routeFeature = data.route
  const waypoints = data.features || []

  // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
  const positions = routeFeature?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || []

  return (
    <>
      {positions.length > 0 && (
        <Polyline
          key={`route-${overlay.id}-${animKey}`}
          positions={positions}
          pathOptions={{
            color,
            weight: 3,
            opacity: 0.85,
            dashArray: '12 6',
            className: 'journey-path-animated',
          }}
        />
      )}

      {waypoints.map((feature, idx) => {
        const [lng, lat] = feature.geometry.coordinates
        const props = feature.properties
        const nameKey = props.name?.toLowerCase().trim()
        const isHighlighted = highlightedPlaceNames?.has(nameKey)
          || highlightedPlaceNames?.has(nameKey?.replace(/\s*\(.*?\)\s*/, '').trim())

        return (
          <Marker
            key={`wp-${overlay.id}-${idx}`}
            position={[lat, lng]}
            icon={makeWaypointIcon(color, isHighlighted)}
            zIndexOffset={isHighlighted ? 100 : 0}
          >
            <Popup maxWidth={240}>
              <div className="text-xs space-y-1 max-w-[220px]">
                <p className="font-bold text-sm leading-tight">{props.event_name}</p>
                <p className="text-gray-500 font-medium">{props.name}</p>
                {props.reference && (
                  <p className="text-blue-600 italic text-[11px]">📖 {props.reference}</p>
                )}
                {props.description && (
                  <p className="text-gray-700 dark:text-gray-300 leading-snug text-[11px] mt-1">
                    {props.description}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

// ── Overlay layer: polygon (kingdom boundaries) ────────────────────────────

function PolygonOverlay({ overlay, animKey }) {
  const { data, color } = overlay
  if (!data) return null

  const polygonFeature = data.features?.[0]
  const highlights = data.highlights || []

  if (!polygonFeature) return null

  // GeoJSON Polygon coords are [lng, lat]; Leaflet wants [lat, lng]
  const outerRing = polygonFeature.geometry.coordinates[0]
  const positions = outerRing.map(([lng, lat]) => [lat, lng])
  const props = polygonFeature.properties

  return (
    <>
      <Polygon
        key={`poly-${overlay.id}-${animKey}`}
        positions={positions}
        pathOptions={{
          color,
          weight: 2,
          opacity: 0.7,
          fillColor: color,
          fillOpacity: 0.12,
          dashArray: '6 4',
        }}
      >
        <Popup maxWidth={240}>
          <div className="text-xs space-y-1 max-w-[220px]">
            <p className="font-bold text-sm">{props.name || props.event_name}</p>
            {props.reference && (
              <p className="text-blue-600 italic text-[11px]">📖 {props.reference}</p>
            )}
            {props.description && (
              <p className="text-gray-700 dark:text-gray-300 leading-snug text-[11px] mt-1">
                {props.description}
              </p>
            )}
          </div>
        </Popup>
      </Polygon>

      {highlights.map((feature, idx) => {
        const [lng, lat] = feature.geometry.coordinates
        const hProps = feature.properties
        return (
          <CircleMarker
            key={`hl-${overlay.id}-${idx}`}
            center={[lat, lng]}
            radius={5}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.9, weight: 1.5 }}
          >
            <Popup maxWidth={240}>
              <div className="text-xs space-y-1 max-w-[220px]">
                <p className="font-bold text-sm">{hProps.event_name}</p>
                <p className="text-gray-500 font-medium">{hProps.name}</p>
                {hProps.reference && (
                  <p className="text-blue-600 italic text-[11px]">📖 {hProps.reference}</p>
                )}
                {hProps.description && (
                  <p className="text-gray-700 dark:text-gray-300 leading-snug text-[11px] mt-1">
                    {hProps.description}
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}

// ── Overlays control panel ────────────────────────────────────────────────

function OverlaysPanel({ activeOverlays, onToggle, passageMode, onPassageModeToggle, open, onOpenToggle }) {
  return (
    <div className="absolute top-2 right-2 z-[1000]">
      {/* Toggle button */}
      <button
        onClick={onOpenToggle}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-md text-xs font-semibold
          bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600
          text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title="Toggle overlay controls"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 13l4.553 2.276A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9 4" />
        </svg>
        Overlays
        {activeOverlays.size > 0 && (
          <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
            {activeOverlays.size}
          </span>
        )}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div className="mt-1 w-56 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600
          bg-white dark:bg-gray-800 overflow-hidden">

          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Historical Overlays
            </p>
          </div>

          {/* Journey overlays */}
          <div className="px-2 py-1.5 space-y-0.5">
            {OVERLAY_DEFINITIONS.map(overlay => {
              const active = activeOverlays.has(overlay.id)
              return (
                <label
                  key={overlay.id}
                  className="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer
                    hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => onToggle(overlay.id)}
                    className="sr-only"
                  />
                  {/* Color swatch + checkbox */}
                  <span
                    className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all"
                    style={{
                      borderColor: overlay.color,
                      backgroundColor: active ? overlay.color : 'transparent',
                    }}
                  >
                    {active && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[11px] text-gray-700 dark:text-gray-300 flex-1">
                    {overlay.label}
                  </span>
                  {/* Type badge */}
                  <span
                    className="text-[9px] px-1 py-0.5 rounded font-medium opacity-60"
                    style={{ color: overlay.color, backgroundColor: overlay.color + '22' }}
                  >
                    {overlay.type === 'polygon' ? 'region' : 'route'}
                  </span>
                </label>
              )
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-700 mx-2" />

          {/* Current passage mode */}
          <div className="px-2 py-1.5">
            <label className="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer
              hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <input
                type="checkbox"
                checked={passageMode}
                onChange={onPassageModeToggle}
                className="sr-only"
              />
              <span
                className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                  passageMode
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-blue-400'
                }`}
              >
                {passageMode && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="text-[11px] text-gray-700 dark:text-gray-300 flex-1 leading-tight">
                Highlight current passage
              </span>
            </label>
            {passageMode && (
              <p className="text-[9px] text-blue-500 dark:text-blue-400 px-2 pb-1 leading-tight">
                Places mentioned in the active chapter glow on the map
              </p>
            )}
          </div>

          {/* Deselect all */}
          {activeOverlays.size > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-1.5">
              <button
                onClick={() => OVERLAY_DEFINITIONS.forEach(o => activeOverlays.has(o.id) && onToggle(o.id))}
                className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Clear all overlays
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main MapPanel ──────────────────────────────────────────────────────────

export default function MapPanel() {
  const { book, currentVerses } = useStudyStore()

  // Existing filter state
  const [filterMode, setFilterMode] = useState('all')
  const [selectedTypes, setSelectedTypes] = useState(new Set(Object.keys(PLACE_TYPE_COLORS)))
  const [showRoutes, setShowRoutes] = useState(true)

  // New overlay state
  const [activeOverlays, setActiveOverlays] = useState(new Set())
  const [overlayPanelOpen, setOverlayPanelOpen] = useState(false)
  const [passageHighlightMode, setPassageHighlightMode] = useState(false)
  // animKey increments when overlays are toggled to re-trigger CSS animation
  const [animKey, setAnimKey] = useState(0)

  const activeBook = filterMode === 'passage' ? book : null
  const { places, routes, loading } = useMapData(activeBook)

  const visiblePlaces = places.filter(p => selectedTypes.has(p.place_type || 'city'))
  const visibleRoutes = showRoutes ? routes : []

  // "Current passage" highlighted place IDs
  const getHighlightedIds = usePlaceNamesInChapter(currentVerses, places)
  const highlightedIds = passageHighlightMode ? getHighlightedIds() : new Set()

  // Build a set of lowercase place names for waypoint highlighting in overlays
  const highlightedPlaceNames = passageHighlightMode
    ? new Set(
        places
          .filter(p => highlightedIds.has(p.id))
          .map(p => p.place_name.toLowerCase().trim())
      )
    : new Set()

  function toggleType(type) {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  function toggleOverlay(id) {
    setActiveOverlays(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        setAnimKey(k => k + 1) // re-trigger animation on add
      }
      return next
    })
  }

  // Collect coordinates from active overlays for FitBounds fallback
  const overlayCoords = []
  OVERLAY_DEFINITIONS.forEach(overlay => {
    if (!activeOverlays.has(overlay.id)) return
    const route = overlay.data?.route
    if (route?.geometry?.coordinates) {
      route.geometry.coordinates.forEach(([lng, lat]) => overlayCoords.push([lat, lng]))
    }
    const polys = overlay.data?.features || []
    polys.forEach(f => {
      if (f.geometry?.type === 'Polygon') {
        f.geometry.coordinates[0].forEach(([lng, lat]) => overlayCoords.push([lat, lng]))
      }
    })
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700 space-y-2 flex-shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => setFilterMode('all')}
            className={`flex-1 text-xs py-1 rounded font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All Places
          </button>
          <button
            onClick={() => setFilterMode('passage')}
            className={`flex-1 text-xs py-1 rounded font-medium transition-colors ${
              filterMode === 'passage'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            This Book ({book})
          </button>
        </div>

        {/* Place type filters */}
        <div className="flex flex-wrap gap-1 items-center">
          {Object.entries(PLACE_TYPE_COLORS).map(([type, color]) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border transition-opacity ${
                selectedTypes.has(type) ? 'opacity-100' : 'opacity-30'
              }`}
              style={{ borderColor: color, color, backgroundColor: color + '22' }}
            >
              {type}
            </button>
          ))}
          <button
            onClick={() => setShowRoutes(v => !v)}
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border transition-opacity ${
              showRoutes ? 'opacity-100' : 'opacity-30'
            }`}
            style={{ borderColor: '#f59e0b', color: '#f59e0b', backgroundColor: '#f59e0b22' }}
          >
            routes
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-gray-900/60">
            <p className="text-xs text-gray-500 dark:text-gray-400">Loading map data…</p>
          </div>
        )}

        {/* Overlays control — positioned inside the map's parent so z-index stacks correctly */}
        <OverlaysPanel
          activeOverlays={activeOverlays}
          onToggle={toggleOverlay}
          passageMode={passageHighlightMode}
          onPassageModeToggle={() => setPassageHighlightMode(v => !v)}
          open={overlayPanelOpen}
          onOpenToggle={() => setOverlayPanelOpen(v => !v)}
        />

        <MapContainer
          center={[31.77, 35.22]}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Existing place markers */}
          {visiblePlaces.map(place => {
            const highlighted = highlightedIds.has(place.id)
            return (
              <Marker
                key={place.id}
                position={[place.lat, place.lng]}
                icon={makePlaceIcon(place.place_type, highlighted)}
                zIndexOffset={highlighted ? 200 : 0}
              >
                <Popup maxWidth={220}>
                  <div className="text-xs space-y-1 max-w-[200px]">
                    <p className="font-bold text-sm">{place.place_name}</p>
                    {highlighted && (
                      <p className="text-blue-500 text-[10px] font-medium">
                        Mentioned in this chapter
                      </p>
                    )}
                    {place.place_type && (
                      <p className="text-gray-500 dark:text-gray-400 capitalize">{place.place_type}</p>
                    )}
                    {place.description && (
                      <p className="text-gray-700 dark:text-gray-300 leading-snug">{place.description}</p>
                    )}
                    {place.verse_refs && (
                      <p className="text-blue-600 italic text-[11px]">📖 {place.verse_refs}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Existing route polylines */}
          {visibleRoutes.map(route => (
            <Polyline
              key={route.id}
              positions={route.coordinates}
              pathOptions={{ color: route.color, weight: 3, opacity: 0.75, dashArray: '6 4' }}
            >
              <Popup maxWidth={220}>
                <div className="text-xs space-y-1 max-w-[200px]">
                  <p className="font-bold text-sm">{route.route_name}</p>
                  {route.description && <p className="text-gray-700 dark:text-gray-300 leading-snug">{route.description}</p>}
                  {route.verse_refs && (
                    <p className="text-blue-600 italic text-[11px]">📖 {route.verse_refs}</p>
                  )}
                </div>
              </Popup>
            </Polyline>
          ))}

          {/* Historical overlay layers */}
          {OVERLAY_DEFINITIONS.map(overlay => {
            if (!activeOverlays.has(overlay.id)) return null
            if (overlay.type === 'polygon') {
              return (
                <PolygonOverlay
                  key={overlay.id}
                  overlay={overlay}
                  animKey={animKey}
                />
              )
            }
            return (
              <JourneyOverlay
                key={overlay.id}
                overlay={overlay}
                highlightedPlaceNames={highlightedPlaceNames}
                animKey={animKey}
              />
            )
          })}

          {/* Auto-fit bounds */}
          {!loading && (
            visiblePlaces.length > 0 ||
            visibleRoutes.length > 0 ||
            overlayCoords.length > 0
          ) && (
            <FitBounds
              places={visiblePlaces}
              routes={visibleRoutes}
              overlayCoords={overlayCoords}
            />
          )}
        </MapContainer>
      </div>

      {/* Route legend + status bar */}
      <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-1.5">
        {showRoutes && visibleRoutes.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {ROUTE_COLORS_LEGEND.filter(r => visibleRoutes.some(vr => vr.color === r.color)).map(r => (
              <span key={r.label} className="flex items-center gap-1 text-[9px] text-gray-500 dark:text-gray-400">
                <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: r.color }} />
                {r.label}
              </span>
            ))}
          </div>
        )}
        <p className="text-[9px] text-gray-400 text-center">
          {visiblePlaces.length} places · {visibleRoutes.length} routes
          {activeOverlays.size > 0 && ` · ${activeOverlays.size} overlay${activeOverlays.size > 1 ? 's' : ''} active`}
          {highlightedIds.size > 0 && ` · ${highlightedIds.size} highlighted`}
          {' · '}click markers for details
        </p>
      </div>
    </div>
  )
}
