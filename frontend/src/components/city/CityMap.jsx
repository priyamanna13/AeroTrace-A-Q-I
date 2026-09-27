import { useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"
import { Minus, Plus } from "lucide-react"
import { SEVERITY_BANDS, severityColor, severityFor } from "@/lib/aqi"
import { useLanguage } from "@/lib/i18n/language-provider"

export const TILES = {
  // Keyless OpenStreetMap tiles (fixes "API KEY REQUIRED" from keyed CARTO basemaps).
  // Dark theme applies a CSS filter to the tile layer for the atmospheric dark look;
  // light theme uses OSM standard rendering directly. OSM attribution preserved.
  dark: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    className: "osm-tiles-dark",
    maxZoom: 19,
  },
  light: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    className: "osm-tiles-light",
    maxZoom: 19,
  },
}

/** Track the current light/dark theme so the basemap follows it (NFR-083). */
export function useThemeMode() {
  const [mode, setMode] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("light") ? "light" : "dark",
  )
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMode(document.documentElement.classList.contains("light") ? "light" : "dark")
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return mode
}

function FitStations({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) {
      map.setView(points[0], 12)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 12 })
  }, [map, points])
  return null
}

/**
 * FlyController — cinematic spatial navigation for station focus.
 * flyTo (not setView) gives the smooth zoom+pan arc from the old Per Station
 * Forensic UI; easeLinearity ~0.2 keeps it controlled, not floaty.
 * The map instance also exposes zoom in/out for the manual zoom controls.
 */
function FlyController({ selectedPosition, cityCenter, cityZoom, onReady }) {
  const map = useMap()
  const prevSelection = useRef(null)
  useEffect(() => {
    onReady?.(map)
  }, [map, onReady])
  useEffect(() => {
    if (selectedPosition) {
      prevSelection.current = selectedPosition
      map.flyTo(selectedPosition, 14, { duration: 0.8, easeLinearity: 0.2 })
    } else if (prevSelection.current) {
      // Only fly out when a station WAS focused — not on initial mount.
      prevSelection.current = null
      map.flyTo(cityCenter, cityZoom, { duration: 0.7, easeLinearity: 0.2 })
    }
  }, [map, selectedPosition, cityCenter, cityZoom])
  return null
}

/**
 * Station chip icon — the label IS the marker (L.divIcon). Unlike permanent
 * tooltips (which live in the tooltip pane and can be hidden by its zoom
 * animation state), a divIcon renders in the marker pane, moves with the
 * marker, and is always visible. Structure: label chip on top, pin dot below;
 * the chip is anchored so the DOT's center sits on the station coordinate.
 */
function stationChipIcon({ name, color, aqiText, isSelected, dimmed, ariaLabel }) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
  const classes = `station-chip${isSelected ? " is-selected" : ""}${dimmed ? " is-dimmed" : ""}`
  return L.divIcon({
    className: "station-chip-icon",
    html: `<div class="${classes}" role="button" aria-label="${esc(ariaLabel)}" aria-pressed="${isSelected}" style="--chip-accent:${color}">
      <span class="station-chip-label"><span class="station-chip-dot" style="background:${color}"></span>${esc(name)}<b>${esc(aqiText)}</b></span>
      <span class="station-chip-pin"></span>
    </div>`,
    iconSize: [0, 0],
  })
}

/**
 * CityMap — large geographic map for Screen 2 with AQI-severity-colored pins
 * for VERIFIED physical monitoring stations only (NFR-078 / Station Integrity).
 *
 * Station labels are permanent Leaflet tooltips styled as compact glass chips —
 * always visible (no hover-to-discover), data-driven from the stations array.
 * Selecting a station (map or cards — ONE shared selectedStation state owned by
 * Screen 2) flies the map to it and emphasizes the marker/label; clearing the
 * selection flies back out to the city framing.
 */
export function CityMap({ cityId, stations, loading, selectedStation, onSelectStation }) {
  const { t } = useLanguage()
  const themeMode = useThemeMode()
  const tiles = TILES[themeMode]
  const mapRef = useRef(null)

  const cityLabel = t.cities[cityId] || cityId

  const points = useMemo(
    () =>
      (stations || [])
        .filter((s) => Array.isArray(s?.coordinates) && s.coordinates.length >= 2)
        .map((s) => [s.coordinates[1], s.coordinates[0]]),
    [stations],
  )

  const center = useMemo(() => {
    if (points.length) {
      const lat = points.reduce((sum, p) => sum + p[0], 0) / points.length
      const lon = points.reduce((sum, p) => sum + p[1], 0) / points.length
      return [lat, lon]
    }
    return [20.5937, 78.9629]
  }, [points])

  // City framing zoom = what FitStations chose. Approximated from the span so
  // the fly-out returns to a similar frame without storing Leaflet internals.
  const cityZoom = useMemo(() => {
    if (points.length < 2) return 12
    const lats = points.map((p) => p[0])
    const lons = points.map((p) => p[1])
    const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lons) - Math.min(...lons))
    return span > 0.5 ? 10.5 : span > 0.2 ? 11.5 : 12
  }, [points])

  const selectedPosition = useMemo(() => {
    if (!selectedStation) return null
    const match = (stations || []).find((s) => s.name === selectedStation)
    const coords = match && Array.isArray(match.coordinates) ? match.coordinates : null
    return coords ? [coords[1], coords[0]] : null
  }, [selectedStation, stations])

  return (
    <section
      aria-label={`${cityLabel} — ${t.cityScreen.mapTitle}`}
      className="relative isolate overflow-hidden rounded-2xl border border-border"
    >
      {/* isolate + relative: the header/legend stacking stays INSIDE this section,
          so the city label can never paint over the global navbar/drawer. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-4">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t.cityScreen.mapTitle}
        </span>
        <span className="font-display text-2xl font-bold tracking-tight text-foreground/90">{cityLabel}</span>
      </div>

      {/* Height scales with viewport (capped) so the dashboard fits a laptop's
          first screen together with header, AQI card and the AI Insight top. */}
      <div className="map-atmosphere h-[420px] w-full md:h-[clamp(380px,52vh,500px)] lg:h-[clamp(400px,56vh,540px)]">
        {loading ? (
          <div className="grid size-full place-items-center bg-card/50" role="status">
            <div className="flex flex-col items-center gap-3">
              <span className="size-6 animate-spin rounded-full border-2 border-teal border-t-transparent" />
              <span className="font-mono text-xs text-muted-foreground">{t.cityScreen.loadingMap}</span>
            </div>
          </div>
        ) : (
          <MapContainer
            center={center}
            zoom={11}
            zoomControl={false}
            zoomSnap={0.5}
            scrollWheelZoom={false}
            className="size-full"
            attributionControl
          >
            <TileLayer key={themeMode} url={tiles.url} attribution={tiles.attribution} className={tiles.className} maxZoom={tiles.maxZoom} />
            <FitStations points={points} />
            <FlyController
              selectedPosition={selectedPosition}
              cityCenter={center}
              cityZoom={cityZoom}
              onReady={(map) => {
                mapRef.current = map
              }}
            />
            {(stations || []).map((station) => {
              const coords = Array.isArray(station?.coordinates) ? station.coordinates : null
              if (!coords || coords.length < 2) return null
              const position = [coords[1], coords[0]]
              const aqi = station.current_aqi
              const hasReading = aqi != null && Number.isFinite(Number(aqi))
              const severity = hasReading ? severityFor(Number(aqi)) : null
              const color = severity ? severityColor(severity) : "var(--muted-foreground)"
              const isSelected = selectedStation != null && selectedStation === station.name
              const dimmed = selectedStation != null && !isSelected
              const label = t.cityScreen.stationAria(
                station.name,
                hasReading ? Math.round(Number(aqi)) : "—",
                severity ? t.severity[severity] : t.cityScreen.notAvailable,
              )
              return (
                <Marker
                  key={station.station_id || station.name}
                  position={position}
                  icon={stationChipIcon({
                    name: station.name,
                    color,
                    aqiText: hasReading ? String(Math.round(Number(aqi))) : "—",
                    isSelected,
                    dimmed,
                    ariaLabel: label,
                  })}
                  keyboard
                  zIndexOffset={isSelected ? 1000 : 0}
                  eventHandlers={{
                    // Click = select (shared state). The screen decides what
                    // selection means (focus here, navigation from cards).
                    click: () => onSelectStation?.(isSelected ? null : station.name),
                  }}
                />
              )
            })}
          </MapContainer>
        )}
      </div>

      {/* Manual zoom controls — glass chips, right edge (scroll-wheel zoom stays
          off so page scrolling is never hijacked) */}
      {!loading && (
        <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1.5">
          <button
            type="button"
            aria-label={t.cityScreen.zoomIn || "Zoom in"}
            onClick={() => mapRef.current?.zoomIn()}
            className="grid size-9 place-items-center rounded-xl border border-border bg-popover/85 text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-popover focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t.cityScreen.zoomOut || "Zoom out"}
            onClick={() => mapRef.current?.zoomOut()}
            className="grid size-9 place-items-center rounded-xl border border-border bg-popover/85 text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-popover focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}

      {/* Focus controls — clear selection returns to the city framing */}
      {selectedStation && (
        <button
          type="button"
          onClick={() => onSelectStation?.(null)}
          className="absolute right-3 top-14 z-20 flex items-center gap-1.5 rounded-full border border-border bg-popover/85 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-popover focus-visible:outline-2 focus-visible:outline-ring"
        >
          {t.cityScreen.clearFocus}
        </button>
      )}

      <ul
        aria-label={t.cityScreen.mapLegend}
        className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 font-mono text-[10px] text-muted-foreground"
      >
        {SEVERITY_BANDS.map((band) => (
          <li key={band.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: severityColor(band.key) }} />
            <span className="sr-only">{t.severity[band.key]}: </span>
            {band.range}
          </li>
        ))}
      </ul>
    </section>
  )
}
