import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet"
import L from "leaflet"
import { CITIES, SEVERITY_BANDS, severityColor, severityFor } from "@/lib/aqi"
import { useLanguage } from "@/lib/i18n/language-provider"

const TILES = {
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
function useThemeMode() {
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
 * CityMap — large geographic map for Screen 2 with AQI-severity-colored pins
 * for VERIFIED physical monitoring stations only (NFR-078 / Station Integrity).
 * Clicking a pin navigates to Screen 3 — Station Intelligence with station context.
 */
export function CityMap({ cityId, stations, loading }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const themeMode = useThemeMode()
  const tiles = TILES[themeMode]

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

      <div className="map-atmosphere h-[440px] w-full md:h-[520px] lg:h-[560px]">
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
            {(stations || []).map((station) => {
              const coords = Array.isArray(station?.coordinates) ? station.coordinates : null
              if (!coords || coords.length < 2) return null
              const position = [coords[1], coords[0]]
              const aqi = station.current_aqi
              const hasReading = aqi != null && Number.isFinite(Number(aqi))
              const severity = hasReading ? severityFor(Number(aqi)) : null
              const color = severity ? severityColor(severity) : "var(--muted-foreground)"
              const label = t.cityScreen.stationAria(
                station.name,
                hasReading ? Math.round(Number(aqi)) : "—",
                severity ? t.severity[severity] : t.cityScreen.notAvailable,
              )
              return (
                <CircleMarker
                  key={station.station_id || station.name}
                  center={position}
                  radius={9}
                  pathOptions={{
                    color: "var(--pin-ring)",
                    weight: 2.5,
                    fillColor: color,
                    fillOpacity: 0.95,
                  }}
                  eventHandlers={{
                    // Direct navigation: City Intelligence → existing Forensic/Wind Plume
                    // UI with the clicked station already active (no intermediate step).
                    click: () =>
                      navigate(`/investigate/${encodeURIComponent(station.name)}?city=${encodeURIComponent(cityLabel)}`),
                  }}
                  role="button"
                  aria-label={t.cityScreen.openStation(station.name)}
                  keyboard
                >
                  <Tooltip direction="top" offset={[0, -8]} permanent className="station-pin-tooltip" opacity={1}>
                    {station.name}
                    {hasReading ? ` · ${Math.round(Number(aqi))}` : ""}
                  </Tooltip>
                </CircleMarker>
              )
            })}
          </MapContainer>
        )}
      </div>

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
