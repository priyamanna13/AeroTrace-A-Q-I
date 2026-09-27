import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowRight, TriangleAlert } from "lucide-react"
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet"
import L from "leaflet"
import { BrandMark } from "@/components/site-header"
import { NavigationPanel } from "@/components/navigation-panel"
import { CitySelector } from "@/components/city/CitySelector"
import { TILES, useThemeMode } from "@/components/city/CityMap"
import { API } from "@/api_client"
import { CITY_IDS, cityEnName, severityColor, severityFor } from "@/lib/aqi"
import { getDemoAlerts } from "@/lib/demo-alerts-data"
import { LanguageProvider, useLanguage } from "@/lib/i18n/language-provider"
import { ListenControl } from "@/components/national-panel"
import { cn } from "@/lib/utils"

const REFRESH_MS = 30000 // 30-second application refresh cycle (NFR-070)
const HISTORY_PAGE = 8
const SEV_DOT = { critical: "#ef4444", high: "#f97316", moderate: "#fbbf24" }
const ZONE_STYLE = {
  schools: { color: "#2dd4bf" },
  hospitals: { color: "#f87171" },
  residential: { color: "#fbbf24" },
  traffic: { color: "#a78bfa" },
}

/* MapContainer only reads center/zoom on mount — re-fit when the city changes. */
function FitZones({ center, zones }) {
  const map = useMap()
  useEffect(() => {
    const points = zones.map((z) => [z.coordinates[1], z.coordinates[0]])
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [52, 52], maxZoom: 13 })
    } else if (center) {
      map.setView([center[1], center[0]], 12)
    }
  }, [map, zones, center])
  return null
}

function VulnerableZonesMap({ center, zones, t }) {
  const themeMode = useThemeMode()
  const tiles = TILES[themeMode]

  return (
    <MapContainer
      center={[center[1], center[0]]}
      zoom={12}
      zoomControl={false}
      zoomSnap={0.5}
      // Native wheel/pinch zoom (matches the forensic + city maps; design
      // intentionally hides zoom buttons, so scroll is the zoom affordance).
      scrollWheelZoom
      className="size-full"
      attributionControl
    >
      <TileLayer key={themeMode} url={tiles.url} attribution={tiles.attribution} className={tiles.className} maxZoom={tiles.maxZoom} />
      <FitZones center={center} zones={zones} />
      {zones.map((zone) => {
        const style = ZONE_STYLE[zone.kind]
        return (
          <CircleMarker
            key={zone.id}
            center={[zone.coordinates[1], zone.coordinates[0]]}
            radius={8}
            pathOptions={{
              color: "var(--pin-ring)",
              weight: 2,
              fillColor: style.color,
              fillOpacity: 0.9,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} className="station-pin-tooltip" opacity={1}>
              <div className="font-semibold">{zone.station} {t.alertsScreen[zone.kind]}</div>
              <div className="font-mono text-[10px]">
                AQI {zone.aqi} · PM2.5 {zone.pm25} µg/m³ · {t.alertsScreen.exposure} {zone.exposure}
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}

const LEVEL_COLOR = {
  critical: "#ef4444",
  high: "#f97316",
  moderate: "#fbbf24",
}

function AlertsContent() {
  const params = useParams()
  const navigate = useNavigate()
  const { t, language } = useLanguage()

  const rawCity = String(params.cityName || "pune").toLowerCase()
  const cityId = CITY_IDS.includes(rawCity) ? rawCity : "pune"
  const cityNameLabel = cityEnName(cityId)
  const a = t.alertsScreen

  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyFilter, setHistoryFilter] = useState("all")
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    const load = () => {
      API.getCityStations(cityNameLabel)
        .then((list) => {
          if (!isMounted) return
          setStations(Array.isArray(list) ? list : [])
          setLoading(false)
        })
        .catch(() => {
          if (!isMounted) return
          setStations([])
          setLoading(false)
        })
    }
    load()
    const interval = setInterval(load, REFRESH_MS)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [cityNameLabel])

  // Deterministic demo alert set anchored to the live/contract station AQI,
  // labeled DEMO ALERTS in the UI until a real alerts endpoint lands.
  const { active, history, zones } = useMemo(
    () => getDemoAlerts({ cityName: cityNameLabel, stations }),
    [cityNameLabel, stations],
  )

  const filteredHistory = useMemo(
    () => (historyFilter === "all" ? history : history.filter((h) => h.severity === historyFilter)),
    [history, historyFilter],
  )
  const visibleHistory = filteredHistory.slice(0, visibleCount)

  const fmtTs = (d) =>
    d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })

  // Spoken summary for the primary alert's Listen control (localized template).
  const primaryAlertSpoken = a.criticalAlertSpoken(
    active[0]?.station ?? "",
    active[0]?.aqi ?? "",
    active[0]?.category ?? "",
    active[0]?.detail ?? "",
  )

  const header = (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-4 lg:px-10">
      <div className="pointer-events-auto">
        <BrandMark />
      </div>
      <div className="pointer-events-auto">
        <NavigationPanel onSelectCity={(id) => navigate(`/city/${id}`)} />
      </div>
    </header>
  )

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      {header}

      <div className="mx-auto w-full max-w-[1440px] px-5 pb-12 sm:px-8 lg:px-10">
        {/* ── Page introduction ── */}
        <div className="flex flex-col gap-1.5" style={{ paddingTop: "clamp(3.75rem, 6vh, 5.25rem)" }}>
          <h1 className="heading-primary text-4xl font-bold leading-[1.05] md:text-5xl">{a.title}</h1>
          <p className="max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
            {a.description}
          </p>
        </div>

        {/* ── City selector ── */}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {a.cityLabel}
          </span>
          <CitySelector cityId={cityId} onChange={(id) => navigate(`/alerts/${id}`)} />
          <span
            className="rounded-full border border-copper/50 px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-copper"
            title={a.demoNote}
          >
            {a.demoChip}
          </span>
        </div>

        {/* ── Active Alerts ── */}
        <section aria-label={a.active} className="mt-8">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {a.active}
          </h2>

          {loading ? (
            <div className="mt-3 h-28 animate-pulse rounded-2xl border border-border bg-card/50" aria-busy="true" />
          ) : active.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
              {a.noActive}
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr_1fr]">
              {/* Primary alert — stands out by severity, not decoration */}
              <article
                className="rounded-2xl border bg-card/70 p-5"
                style={{ borderColor: `color-mix(in oklab, ${LEVEL_COLOR[active[0].level]} 55%, var(--border))` }}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: LEVEL_COLOR[active[0].level] }} />
                  <span
                    className="font-mono text-[11px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: LEVEL_COLOR[active[0].level] }}
                  >
                    {a.criticalAlert}
                  </span>
                  <ListenControl
                    text={active.length > 0 ? primaryAlertSpoken : ""}
                    lang={language}
                    className="listen-control ml-1 self-center"
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-display text-5xl font-bold leading-none tabular-nums" style={{ color: severityColor(severityFor(active[0].aqi)) }}>
                    {active[0].aqi}
                  </span>
                  <span className="text-sm font-semibold text-foreground/90">{active[0].station}</span>
                </div>
                <p className="mt-1 text-sm font-semibold" style={{ color: severityColor(severityFor(active[0].aqi)) }}>
                  {active[0].category}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-foreground/85">{active[0].detail}</p>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {a.detectedAgo(active[0].minutesAgo)}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/investigate/${encodeURIComponent(active[0].station)}`)}
                    className="group inline-flex items-center gap-1.5 text-sm font-semibold text-teal transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {a.viewDetails}
                    <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                </div>
              </article>

              {/* Secondary compact alerts */}
              {active.slice(1, 3).map((alert) => (
                <article key={alert.id} className="rounded-2xl border border-border bg-card/60 p-4">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ background: LEVEL_COLOR[alert.level] }} />
                    <span
                      className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: LEVEL_COLOR[alert.level] }}
                    >
                      {alert.kind}
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm font-semibold text-foreground">{alert.station}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{alert.aqi}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {a.minutesAgo(alert.minutesAgo)}
                    {alert.delta ? ` · ${alert.delta}` : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ── Vulnerable Zones — primary visual (CURRENT alert impact, not prediction) ── */}
        <section aria-label={a.zones} className="mt-8 rounded-2xl border border-border bg-card/50 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <TriangleAlert aria-hidden="true" className="size-4 text-copper" />
              {a.zones} · {a.zonesCaption}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {a.affected(zones.length)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{a.zonesNote}</p>

          <div className="relative mt-4 overflow-hidden rounded-xl border border-border">
            <div className="h-[340px] w-full md:h-[400px]">
              {zones.length ? (
                <VulnerableZonesMap center={zones[0].coordinates} zones={zones} t={t} />
              ) : (
                <div className="grid size-full place-items-center bg-background/40" role="status">
                  <span className="font-mono text-xs text-muted-foreground">{a.loadingMap}</span>
                </div>
              )}
            </div>
            {/* compact supporting legend */}
            <ul className="pointer-events-none absolute bottom-3 left-1/2 z-[500] flex -translate-x-1/2 flex-wrap justify-center gap-x-4 gap-y-1 rounded-full border border-border bg-popover/90 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">
              {Object.entries(ZONE_STYLE).map(([kind, style]) => (
                <li key={kind} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: style.color }} />
                  {a[kind]}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Alert History ── */}
        <section aria-label={a.history} className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {a.history}
            </h2>
            <div role="group" aria-label={a.history} className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
              {["all", "critical", "high", "moderate"].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={historyFilter === value}
                  onClick={() => {
                    setHistoryFilter(value)
                    setVisibleCount(HISTORY_PAGE)
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    historyFilter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a.filters[value]}
                </button>
              ))}
            </div>
          </div>

          {!loading && filteredHistory.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
              {a.historyEmpty}
            </p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-semibold">{a.colTime}</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">{a.colEvent}</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">{a.colLocation}</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">{a.colSeverity}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/city/${cityId}`)}
                      className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
                      tabIndex={0}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                        {fmtTs(row.timestamp)}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{row.event}</td>
                      <td className="px-4 py-2.5 text-foreground/85">{row.location}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: SEV_DOT[row.severity] }}>
                          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: SEV_DOT[row.severity] }} />
                          {a.sev[row.severity]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredHistory.length > visibleCount && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + HISTORY_PAGE)}
                className="rounded-xl border border-border bg-card/60 px-5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {a.loadMore}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/**
 * Screen 8 — Alerts.
 * LanguageProvider is REQUIRED here: without it useLanguage() falls back to the
 * no-op context and the Settings → Language selector would not update anything.
 */
export default function Screen8Alerts() {
  return (
    <LanguageProvider>
      <AlertsContent />
    </LanguageProvider>
  )
}
