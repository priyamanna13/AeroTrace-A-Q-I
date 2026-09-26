import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { BrandMark } from "@/components/site-header"
import { NavigationPanel } from "@/components/navigation-panel"
import { ListenControl, VoicePreferenceSelect } from "@/components/national-panel"
import { CityAqiCard } from "@/components/city/CityAqiCard"
import { CityInsight } from "@/components/city/CityInsight"
import { CityMap } from "@/components/city/CityMap"
import { CitySelector } from "@/components/city/CitySelector"
import { CityTrend } from "@/components/city/CityTrend"
import { StationCards } from "@/components/city/StationCards"
import { CITY_IDS, cityEnName } from "@/lib/aqi"
import { API } from "@/api_client"
import { LanguageProvider, useLanguage } from "@/lib/i18n/language-provider"

const REFRESH_MS = 30000 // 30-second application refresh cycle (NFR-070)

function Screen2Content() {
  const params = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()

  // Mumbai is the default prototype city (per Screen 2 composition spec).
  const rawCity = String(params.cityName || "mumbai").toLowerCase()
  const cityId = CITY_IDS.includes(rawCity) ? rawCity : "mumbai"

  const [overview, setOverview] = useState(null)
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)

  // Canonical English name for API calls, AI context, and navigation context —
  // display name stays i18n-driven; contracts stay language-invariant.
  const cityNameLabel = cityEnName(cityId)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    const load = () => {
      Promise.all([API.getCityOverview(cityNameLabel), API.getCityStations(cityNameLabel)])
        .then(([overviewData, stationsData]) => {
          if (!isMounted) return
          setOverview(overviewData || null)
          setStations(Array.isArray(stationsData) ? stationsData : [])
          setLoading(false)
        })
        .catch(() => {
          if (!isMounted) return
          setOverview(null)
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
  }, [cityId, cityNameLabel])

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
        {/* Page header: kicker + City Intelligence + city selector + back link */}
        <div
          className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
          style={{ paddingTop: "clamp(3.75rem, 6vh, 5.25rem)" }}
        >
          <div className="flex flex-col gap-2">
            {/* Small city-context label — distinct role from the big page heading (Part 3). */}
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-teal">
              {typeof t.cityScreen.kicker === "function" ? t.cityScreen.kicker(cityNameLabel) : t.cityScreen.kicker}
            </p>
            <h1 className="heading-primary text-4xl font-bold leading-[1.05] md:text-5xl">
              {t.cityScreen.title}
            </h1>
            {/* City-level context copy — NOT the national tagline (Part 4). */}
            <p className="max-w-md text-pretty text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
              {t.cityScreen.description}
            </p>
            <CitySelector cityId={cityId} onChange={(id) => navigate(`/city/${id}`)} />
          </div>

          <button
            type="button"
            onClick={() => navigate("/national")}
            className="group inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            {t.map.returnToIndia}
          </button>
        </div>

        {/* Top editorial split: information (left) / map (right, dominant) */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(320px,2fr)_3fr] lg:gap-10">
          <div className="flex flex-col gap-6">
            <CityAqiCard overview={overview} loading={loading} />
            <CityInsight
              cityId={cityId}
              cityName={cityNameLabel}
              overview={overview}
              stationCount={stations.length}
            />
          </div>

          <div>
            <CityMap cityId={cityId} stations={stations} loading={loading} />
          </div>
        </div>

        {/* Air quality trend — full width below the split */}
        <div className="mt-10">
          <CityTrend cityId={cityId} cityName={cityNameLabel} />
        </div>

        {/* Monitored stations — exactly the city's verified stations */}
        <div className="mt-10">
          <StationCards cityId={cityId} stations={stations} loading={loading} />
        </div>
      </div>
    </div>
  )
}

/**
 * Screen 2 — City Intelligence.
 * LanguageProvider is REQUIRED here: without it useLanguage() falls back to the
 * no-op context and the Settings → Language selector would not update anything.
 */
export default function Screen2CityIntelligence() {
  return (
    <LanguageProvider>
      <Screen2Content />
    </LanguageProvider>
  )
}
