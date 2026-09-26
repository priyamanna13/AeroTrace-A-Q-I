import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import EChartsWrapper from "@/components/EChartsWrapper"
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet"
import L from "leaflet"
import { BrandMark } from "@/components/site-header"
import { NavigationPanel } from "@/components/navigation-panel"
import { ListenControl } from "@/components/national-panel"
import { CitySelector } from "@/components/city/CitySelector"
import { TILES, useThemeMode } from "@/components/city/CityMap"
import { API } from "@/api_client"
import { CITY_IDS, cityEnName, severityColor, severityFor } from "@/lib/aqi"
import { getDemoForecast, getDemoVulnerableZones } from "@/lib/demo-forecast-data"
import { LanguageProvider, useLanguage } from "@/lib/i18n/language-provider"
import { cn } from "@/lib/utils"

const REFRESH_MS = 30000 // 30-second application refresh cycle (NFR-070)
const RANGES = ["6H", "12H", "24H", "48H"]

const ZONE_STYLE = {
  schools: { color: "#2dd4bf", key: "schools" },
  hospitals: { color: "#f87171", key: "hospitals" },
  dense: { color: "#fbbf24", key: "dense" },
  traffic: { color: "#a78bfa", key: "traffic" },
}

/* ── 04 — AQI Forecast graph ────────────────────────────────────────────── */

function buildForecastOption({ points, t, language }) {
  const fmtTime = (d) =>
    new Date(d).toLocaleTimeString(language === "en" ? "en-IN" : language, {
      hour: "2-digit",
      minute: "2-digit",
    })
  const labels = points.map((p, i) => (i === 0 ? t.prediction.now : fmtTime(p.timestamp)))
  const observed = points.map((p) => (p.predicted ? null : p.value))
  const predicted = points.map((p) => (p.predicted ? p.value : p.value))

  return {
    backgroundColor: "transparent",
    animationDuration: 700,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(12, 12, 16, 0.95)",
      borderColor: "rgba(255, 255, 255, 0.1)",
      textStyle: { color: "#f4f4f5", fontSize: 12 },
      formatter: (params) => {
        const idx = params?.[0]?.dataIndex
        if (idx == null) return ""
        const p = points[idx]
        const kind = p.predicted ? t.prediction.predicted : t.prediction.observed
        return `<div class="p-1 font-mono">
          <div class="text-[10px] text-zinc-400">${labels[idx]} · ${kind}</div>
          <div class="font-bold">AQI ${p.value}</div>
          ${p.predicted ? `<div class="text-[10px] text-zinc-400">${t.prediction.tooltipConfidence(p.confidence)}</div>` : ""}
        </div>`
      },
    },
    legend: {
      data: [t.prediction.observed, t.prediction.predicted],
      top: 0,
      right: 0,
      textStyle: { color: "#8b8f96", fontSize: 10, fontFamily: "monospace" },
      itemWidth: 14,
      itemHeight: 8,
    },
    grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
      axisTick: { show: false },
      axisLabel: { color: "#8b8f96", fontSize: 10, fontFamily: "monospace" },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.07)", type: "dashed" } },
      axisLabel: { color: "#8b8f96", fontSize: 10, fontFamily: "monospace" },
    },
    series: [
      {
        name: t.prediction.observed,
        type: "line",
        data: observed,
        smooth: 0.35,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2.5, color: "#2dd4bf" },
        itemStyle: { color: "#2dd4bf" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(45, 212, 191, 0.20)" },
              { offset: 1, color: "rgba(45, 212, 191, 0)" },
            ],
          },
        },
      },
      {
        name: t.prediction.predicted,
        type: "line",
        data: predicted,
        smooth: 0.35,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { width: 2, color: "rgba(148, 163, 184, 0.9)", type: "dashed" },
        itemStyle: { color: "rgba(148, 163, 184, 0.9)" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(148, 163, 184, 0.10)" },
              { offset: 1, color: "rgba(148, 163, 184, 0)" },
            ],
          },
        },
        // Subtle AQI severity bands — Poor (200) and Very Poor (300) thresholds.
        markLine: {
          silent: true,
          symbol: "none",
          data: [
            { yAxis: 200, lineStyle: { color: "rgba(249, 115, 22, 0.5)", type: "dashed", width: 1 } },
            { yAxis: 300, lineStyle: { color: "rgba(239, 68, 68, 0.45)", type: "dashed", width: 1 } },
          ],
          label: {
            color: "rgba(148,148,160,0.8)",
            fontSize: 9,
            fontFamily: "monospace",
            position: "insideEndTop",
            formatter: (p) => (p.value === 200 ? "Poor 200" : "Very Poor 300"),
          },
        },
      },
    ],
  }
}

/* ── 05 — What Drives the Prediction ───────────────────────────────────── */

function DriverCard({ driver, t }) {
  const dirIcon = {
    rise: <ArrowUpRight aria-hidden="true" className="size-4" />,
    fall: <ArrowDownRight aria-hidden="true" className="size-4" />,
    flat: <Minus aria-hidden="true" className="size-4" />,
  }
  const dirColor = {
    rise: "text-copper",
    fall: "text-teal",
    flat: "text-muted-foreground",
  }
  const dirLabel = {
    rise: t.prediction.dirRising,
    fall: t.prediction.dirFalling,
    flat: t.prediction.dirStable,
  }

  let title
  let detail
  if (driver.key === "wind") {
    title = t.prediction.wind
    detail = t.prediction.windDetail(driver.detail.dir, driver.detail.speed)
  } else if (driver.key === "pm25") {
    title = t.prediction.pm25
    detail = t.prediction.pm25Detail(driver.detail.value)
  } else if (driver.key === "weather") {
    title = t.prediction.weather
    detail = t.prediction.weatherDetail(driver.detail.cond)
  } else {
    title = t.prediction.history
    detail = t.prediction.historyDetail(dirLabel[driver.dir].toLowerCase())
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </span>
        <span className={cn("flex items-center gap-1 text-sm font-bold", dirColor[driver.dir])}>
          {dirIcon[driver.dir]}
          <span className="sr-only">{dirLabel[driver.dir]}</span>
        </span>
      </div>
      <p className="mt-1.5 text-xs font-medium text-foreground/85">{detail}</p>
      <p className={cn("mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em]", dirColor[driver.dir])}>
        {dirLabel[driver.dir]}
      </p>
    </div>
  )
}

/* ── 06 — Vulnerable Zones map ──────────────────────────────────────────── */

/* MapContainer only reads center/zoom on mount — re-fit the view whenever the
   city/station (and therefore the zones) change, mirroring CityMap's FitStations. */
function FitZones({ center, zones }) {
  const map = useMap()
  useEffect(() => {
    const points = zones.map((z) => [z.coordinates[1], z.coordinates[0]])
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 })
    } else {
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
      scrollWheelZoom={false}
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
            radius={6 + zone.intensity * 6}
            pathOptions={{
              color: "rgba(255,255,255,0.35)",
              weight: 1,
              fillColor: style.color,
              fillOpacity: 0.75,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} className="station-pin-tooltip" opacity={1}>
              {zone.name} · {t.prediction[style.key]}
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}

/* ── Screen 5 content ───────────────────────────────────────────────────── */

function PredictionContent() {
  const params = useParams()
  const { t, language } = useLanguage()
  const navigate = useNavigate()

  // Dynamic city/station: /prediction or /prediction/:cityName or /prediction/:cityName/:stationName
  const rawCity = String(params.cityName || "pune").toLowerCase()
  const cityId = CITY_IDS.includes(rawCity) ? rawCity : "pune"
  const cityNameLabel = cityEnName(cityId)
  const stationName = params.stationName ? decodeURIComponent(params.stationName) : null

  const [range, setRange] = useState("24H")
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)

  const station = useMemo(() => {
    if (stationName) {
      const match = stations.find((s) => s.name === stationName)
      if (match) return match
    }
    return stations[0] || null
  }, [stations, stationName])

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

  // Deterministic demo forecast, anchored to the observed station AQI.
  // Rebuilt per range change; labeled DEMO FORECAST in the UI (data honesty).
  const forecast = useMemo(
    () => getDemoForecast({ cityName: cityNameLabel, stationName: station?.name, range, station }),
    [cityNameLabel, station, range],
  )
  const zones = useMemo(
    () => getDemoVulnerableZones({ cityName: cityNameLabel, stationName: station?.name, station }),
    [cityNameLabel, station],
  )

  const severity = severityFor(forecast.predictedAqi)
  const currentSeverity = severityFor(forecast.currentAqi)
  const trendDir = forecast.delta > forecast.currentAqi * 0.06 ? "rise" : forecast.delta < -forecast.currentAqi * 0.06 ? "fall" : "steady"
  const trendText =
    trendDir === "rise"
      ? t.prediction.rising(forecast.currentAqi)
      : trendDir === "fall"
        ? t.prediction.falling(forecast.currentAqi)
        : t.prediction.steady(forecast.currentAqi)

  // AI Prediction Insight — grounded on the SAME demo-forecast data, localized
  // via dictionaries so displayed text and spoken text are identical.
  const insight = useMemo(() => {
    const phrases = t.prediction.driverPhrases
    const d = forecast.drivers
    const d1 = phrases[d[0].key][d[0].dir]
    const d2 = phrases[d[1].key][d[1].dir]
    if (trendDir === "rise") return t.prediction.insightRising(forecast.peak.value, forecast.peak.time, d1, d2)
    if (trendDir === "fall") return t.prediction.insightFalling(forecast.predictedAqi, forecast.peak.time, d1, d2)
    return t.prediction.insightSteady(forecast.predictedAqi, forecast.peak.time, d1, d2)
  }, [t, forecast, trendDir])

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

  const forecastOption = useMemo(
    () => buildForecastOption({ points: forecast.points, t, language }),
    [forecast, t, language],
  )

  const zoneCenter = Array.isArray(station?.coordinates) && station.coordinates.length >= 2
    ? station.coordinates
    : null

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      {header}

      <div className="mx-auto w-full max-w-[1440px] px-5 pb-12 sm:px-8 lg:px-10">
        {/* ── 01 Prediction Header ── */}
        <div
          className="flex flex-col gap-1.5"
          style={{ paddingTop: "clamp(3.75rem, 6vh, 5.25rem)" }}
        >
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-teal">
            {t.prediction.kicker(cityNameLabel, station?.name || stationName || "")}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <h1 className="heading-primary text-4xl font-bold leading-[1.05] md:text-5xl">
              {t.prediction.title}
            </h1>
            {/* City switcher — selecting a city re-routes to /prediction/:city,
                which re-derives stations, forecast, drivers, zones and map. */}
            <CitySelector cityId={cityId} onChange={(id) => navigate(`/prediction/${id}`)} />
          </div>
        </div>

        {/* ── 02 Forecast Range selector ── */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label={t.prediction.rangeAria} className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            {RANGES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={range === value}
                onClick={() => setRange(value)}
                className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                  range === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.prediction.ranges[value]}
              </button>
            ))}
          </div>
          <span
            className="rounded-full border border-copper/50 px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-copper"
            title={t.prediction.demoNote}
          >
            {t.prediction.demoChip}
          </span>
        </div>

        {/* ── 03 Predicted AQI Hero + ── 07 Expected Peak ── */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
          <section
            aria-label={t.prediction.heroLabel}
            className="relative overflow-hidden rounded-2xl border border-border bg-card/70 p-6 md:p-8"
          >
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t.prediction.heroLabel}
            </span>
            <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
              <span
                className="font-display text-7xl font-bold leading-none tabular-nums md:text-8xl"
                style={{ color: severityColor(severity) }}
              >
                {loading ? "—" : forecast.predictedAqi}
              </span>
              <div className="flex flex-col gap-1 pb-1.5">
                <span className={cn(
                  "flex items-center gap-1.5 text-sm font-semibold",
                  trendDir === "rise" ? "text-copper" : trendDir === "fall" ? "text-teal" : "text-muted-foreground",
                )}>
                  {trendDir === "rise" ? <ArrowUpRight aria-hidden="true" className="size-4" /> : trendDir === "fall" ? <ArrowDownRight aria-hidden="true" className="size-4" /> : <Minus aria-hidden="true" className="size-4" />}
                  {loading ? "…" : trendText}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {loading ? "…" : t.prediction.confidence(forecast.confidence)}
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {t.cityScreen.cityAqi}:{" "}
              <span className="font-semibold text-foreground" style={{ color: severityColor(currentSeverity) }}>
                {loading ? "—" : forecast.currentAqi}
              </span>
            </p>

            {/* risk window strip */}
            {!loading && (
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border pt-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {t.prediction.peak}
                  </span>
                  <span className="text-xl font-bold tabular-nums" style={{ color: severityColor(severityFor(forecast.peak.value)) }}>
                    {forecast.peak.value}
                  </span>
                  <span className="text-sm font-semibold text-foreground/90">{forecast.peak.time}</span>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t.prediction.riskWindow(forecast.peak.windowStart, forecast.peak.windowEnd)}
                </span>
              </div>
            )}
          </section>

          {/* ── 05 What Drives the Prediction ── */}
          <section aria-label={t.prediction.drivers} className="flex flex-col">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t.prediction.drivers}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {forecast.drivers.map((driver) => (
                <DriverCard key={driver.key} driver={driver} t={t} />
              ))}
            </div>
          </section>
        </div>

        {/* ── 04 AQI Forecast graph ── */}
        <section aria-label={t.prediction.forecast} className="mt-8 rounded-2xl border border-border bg-card/50 p-6">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t.prediction.forecast}
          </h2>
          <div className="mt-3">
            {loading ? (
              <div className="flex h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-background/40" role="status">
                <span className="size-5 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                <span className="font-mono text-xs text-muted-foreground">{t.prediction.loading}</span>
              </div>
            ) : (
              <EChartsWrapper option={forecastOption} style={{ width: "100%", height: "300px" }} />
            )}
          </div>
        </section>

        {/* ── 06 Vulnerable Zones (map is the primary visual) ── */}
        <section aria-label={t.prediction.zones} className="mt-8 rounded-2xl border border-border bg-card/50 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t.prediction.zones}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {t.prediction.zonesCaption}
            </span>
          </div>
          <div className="relative mt-4 overflow-hidden rounded-xl border border-border">
            <div className="h-[320px] w-full md:h-[360px]">
              {zoneCenter ? (
              <VulnerableZonesMap center={zoneCenter} zones={zones} t={t} />
              ) : (
                <div className="grid size-full place-items-center bg-background/40" role="status">
                  <span className="font-mono text-xs text-muted-foreground">{t.cityScreen.loadingMap}</span>
                </div>
              )}
            </div>
            {/* compact supporting legend */}
            <ul className="pointer-events-none absolute bottom-3 left-1/2 z-[500] flex -translate-x-1/2 flex-wrap justify-center gap-x-4 gap-y-1 rounded-full border border-border bg-popover/90 px-4 py-1.5 font-mono text-[10px] text-muted-foreground backdrop-blur">
              {Object.values(ZONE_STYLE).map((style) => (
                <li key={style.key} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: style.color }} />
                  {t.prediction[style.key]}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 08 AI Prediction Insight ── */}
        <section aria-label={t.prediction.insightLabel} className="mt-8 rounded-2xl border border-border bg-card/70 p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t.prediction.insightLabel}
            </span>
          </div>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-foreground/90">
            “{loading ? t.prediction.loading : insight}”
          </p>
          <ListenControl text={loading ? "" : insight} disabled={loading} />
        </section>
      </div>
    </div>
  )
}

export default function Screen5Prediction() {
  return (
    <LanguageProvider>
      <PredictionContent />
    </LanguageProvider>
  )
}
