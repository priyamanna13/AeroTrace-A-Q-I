import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { API } from "@/api_client"
import { useLanguage } from "@/lib/i18n/language-provider"
import { ListenControl } from "@/components/national-panel"

/**
 * CityInsight — AI CITY INSIGHT panel for Screen 2.
 * Short AI summary of the city's current air-quality situation (no chat panel).
 *
 * Language parity guarantee: the DISPLAYED insight text and the SPOKEN text are
 * derived from the same single value (`displayedInsight`). When the backend
 * returns text for the selected language it is shown as-is; otherwise a grounded
 * localized summary is rendered from the SAME insight data (city, AQI, category,
 * dominant pollutant, station count) — never an unrelated hardcoded translation.
 * ASK AI → navigates to the existing AI screen (Screen 9) with city context.
 */
export function CityInsight({ cityId, cityName, overview, stationCount }) {
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const requestRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestRef.current
    setLoading(true)
    setFailed(false)

    API.getAIInsight({
      screen_id: "screen_2",
      city: cityName,
      current_aqi: overview?.current_aqi,
      dominant_pollutant: overview?.dominant_pollutant,
      station_count: stationCount,
      language,
      provenance: overview?.is_simulated ? "simulation" : "sensor_measurement",
      is_simulated: Boolean(overview?.is_simulated),
    })
      .then((data) => {
        if (requestRef.current !== requestId) return
        setInsight(data || null)
        setLoading(false)
      })
      .catch(() => {
        if (requestRef.current !== requestId) return
        setFailed(true)
        setLoading(false)
      })
  }, [cityId, cityName, language, overview?.current_aqi, overview?.dominant_pollutant, overview?.is_simulated, stationCount])

  /**
   * The single source of truth for both display and speech.
   * - If the backend answered for the selected language (or answered in English
   *   while English is selected), use its text directly.
   * - Otherwise (e.g. offline fallback returned English while Hindi is selected)
   *   render a grounded localized summary from the same insight data so the
   *   visible text and the spoken text are always the same content & language.
   */
  const displayedInsight = useMemo(() => {
    if (loading) return null
    const apiText = typeof insight?.response_text === "string" ? insight.response_text.trim() : ""
    if (apiText) {
      if (language === "en") return apiText
      // Heuristic: Devanagari-aware script check for hi/mr responses.
      const isDevanagari = /[\u0900-\u097F]/.test(apiText)
      if (language === "hi" || language === "mr") {
        if (isDevanagari) return apiText
      } else if (language !== "en") {
        return apiText // other languages: trust the backend response as-is
      }
      // English text while a Devanagari language is selected → localize from data.
    }
    if (failed && !apiText) return null
    if (!insight && !apiText) return null

    const aqi = overview?.current_aqi
    const hasAqi = aqi != null && Number.isFinite(Number(aqi))
    if (!hasAqi && !overview?.aqi_category && !overview?.dominant_pollutant) return null

    // Localize the English category from the data contract (e.g. "Moderate" → "मध्यम").
    const CATEGORY_TO_SEVERITY = {
      Good: "good",
      Satisfactory: "satisfactory",
      Moderate: "moderate",
      Poor: "poor",
      "Very Poor": "veryPoor",
      Severe: "severe",
    }
    const severityKey = CATEGORY_TO_SEVERITY[overview?.aqi_category]
    const categoryLabel = severityKey
      ? t.severity[severityKey]
      : overview?.aqi_category || "—"

    return t.cityScreen.insightTemplate(
      cityName,
      hasAqi ? Math.round(Number(aqi)) : "—",
      categoryLabel,
      overview?.dominant_pollutant || "PM2.5",
      stationCount ?? 0,
    )
  }, [loading, insight, failed, language, cityName, overview, stationCount, t])

  const handleAskAi = () => {
    navigate("/ai", {
      state: {
        screen_id: "screen_2",
        city: cityName,
        city_id: cityId,
        current_aqi: overview?.current_aqi,
        dominant_pollutant: overview?.dominant_pollutant,
      },
    })
  }

  return (
    <section
      aria-labelledby="city-insight-heading"
      className="flex flex-1 flex-col rounded-2xl border border-border bg-card/70 p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <span
          id="city-insight-heading"
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          {t.cityScreen.aiInsight}
        </span>
        <span aria-hidden="true" className="size-1.5 rounded-full bg-teal" />
      </div>

      {/* Listen reads EXACTLY the displayed insight text — same string, selected
          language. Disabled while loading or when there is nothing to read.
          Placed directly under the heading (top of card) per composition feedback. */}
      <div className="mt-3">
        <ListenControl text={displayedInsight || ""} disabled={loading || !displayedInsight} />
      </div>

      <div className="mt-4 flex-1">
        {loading ? (
          <div className="space-y-2.5" role="status" aria-label={t.cityScreen.aiLoading}>
            <div className="h-3 w-[92%] animate-pulse rounded bg-muted" />
            <div className="h-3 w-[78%] animate-pulse rounded bg-muted" />
            <div className="h-3 w-[55%] animate-pulse rounded bg-muted" />
          </div>
        ) : displayedInsight ? (
          <p className="text-pretty text-sm leading-relaxed text-foreground/90">{displayedInsight}</p>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">{t.cityScreen.aiUnavailable}</p>
        )}
        {insight?.confidence_note && !loading && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {insight.confidence_note}
          </p>
        )}
      </div>

      {/* ASK AI — primary action, bottom-left of the card. */}
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleAskAi}
          className="group inline-flex items-center gap-2 rounded-xl border border-teal/40 bg-teal/10 px-4 py-2.5 text-sm font-semibold text-teal transition-colors hover:bg-teal/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t.cityScreen.askAi}
          <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
    </section>
  )
}
