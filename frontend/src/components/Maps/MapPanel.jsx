import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useStudyStore } from '../../stores/studyStore'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet's default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const PLACE_TYPE_COLORS = {
  city:       '#3b82f6',
  mountain:   '#8b5cf6',
  river:      '#06b6d4',
  sea:        '#0ea5e9',
  region:     '#10b981',
  wilderness: '#f59e0b',
  country:    '#6b7280',
}

function makePlaceIcon(placeType) {
  const color = PLACE_TYPE_COLORS[placeType] || '#6b7280'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="18" height="27">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 24 12 24s12-15.6 12-24C24 5.4 18.6 0 12 0z"
      fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="4" fill="white" opacity="0.9"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [18, 27],
    iconAnchor: [9, 27],
    popupAnchor: [0, -27],
  })
}

function FitBounds({ places, routes }) {
  const map = useMap()
  useEffect(() => {
    const points = []
    places.forEach(p => points.push([p.lat, p.lng]))
    routes.forEach(r => r.coordinates.forEach(c => points.push(c)))
    if (points.length > 0) {
      try {
        map.fitBounds(points, { padding: [30, 30], maxZoom: 8 })
      } catch (_) {}
    }
  }, [places, routes, map])
  return null
}

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

const ROUTE_COLORS_LEGEND = [
  { color: '#f59e0b', label: 'Exodus Route' },
  { color: '#8b5cf6', label: "Abraham's Journey" },
  { color: '#ef4444', label: "Paul's 1st Journey" },
  { color: '#10b981', label: "Paul's 2nd Journey" },
  { color: '#0ea5e9', label: "Paul's 3rd Journey" },
  { color: '#dc2626', label: 'Way of the Cross' },
  { color: '#f97316', label: 'Flight to Egypt' },
  { color: '#84cc16', label: "Joshua's Conquest" },
]

export default function MapPanel() {
  const { book } = useStudyStore()
  const [filterMode, setFilterMode] = useState('all')
  const [selectedTypes, setSelectedTypes] = useState(new Set(Object.keys(PLACE_TYPE_COLORS)))
  const [showRoutes, setShowRoutes] = useState(true)
  const activeBook = filterMode === 'passage' ? book : null
  const { places, routes, loading } = useMapData(activeBook)

  const visiblePlaces = places.filter(p => selectedTypes.has(p.place_type || 'city'))
  const visibleRoutes = showRoutes ? routes : []

  function toggleType(type) {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

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

          {visiblePlaces.map(place => (
            <Marker
              key={place.id}
              position={[place.lat, place.lng]}
              icon={makePlaceIcon(place.place_type)}
            >
              <Popup maxWidth={220}>
                <div className="text-xs space-y-1 max-w-[200px]">
                  <p className="font-bold text-sm">{place.place_name}</p>
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
          ))}

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

          {!loading && (visiblePlaces.length > 0 || visibleRoutes.length > 0) && (
            <FitBounds places={visiblePlaces} routes={visibleRoutes} />
          )}
        </MapContainer>
      </div>

      {/* Status bar */}
      <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <p className="text-[9px] text-gray-400 text-center">
          {visiblePlaces.length} places · {visibleRoutes.length} routes · click markers for details
        </p>
      </div>
    </div>
  )
}
