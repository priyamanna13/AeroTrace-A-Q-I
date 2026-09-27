/**
 * ai-assistant.js — Grounded question answering for the Screen 9 AI workspace.
 *
 * Data-honesty rules (same discipline as demo-alerts-data / demo-forecast-data):
 *   - Answers are built ONLY from data the app already shows: observed station
 *     readings (API.getCityStations contract) and the labeled DEMO forecast shape.
 *   - Every answer carries an explicit provenance: OBSERVED (direct station
 *     readings), DERIVED (analysis from observed values), PREDICTION (DEMO
 *     forecast — never presented as fact), or NO DATA (never invent an answer).
 *   - Answer text is produced by localized dictionary templates so the displayed
 *     text and the Listen read-aloud are identical in en/hi/mr.
 *
 * When a real multilingual /api/v1/ai/chat backend lands, only this module's
 * call site changes — the screen needs no redesign.
 */

import { severityFor } from "@/lib/aqi"
import { getDemoForecast } from "@/lib/demo-forecast-data"

export const PROVENANCE = {
  observed: "observed",
  derived: "derived",
  prediction: "prediction",
  unavailable: "unavailable",
}

const INTENT = {
  compare: "compare",
  areas: "areas",
  trend: "trend",
  forecast: "forecast",
  driver: "driver",
  current: "current",
  fallback: "fallback",
}

const RX = {
  compare: /compare|comparison|\bvs\b|versus|तुलना/,
  areas: /area|affected|where|zone|neighbourhood|neighborhood|region|क्षेत्र|कहाँ|कहां|इलाक|ठिकाण|परिसर|प्रभावित|प्रदेश/,
  trend: /worse|worsen|better|improv|trend|getting|बिगड़|सुधार|बदतर|वाढत|ट्रेंड/,
  forecast: /forecast|predict|tomorrow|upcoming|expected|later|पूर्वानुमान|अनुमान|भविष्य|अंदाज|पुढील/,
  driver: /pm\s?2|pm25|why|driver|driving|source|cause|क्यों|कारण|स्रोत|कशामुळे/,
  current: /aqi|air|current|now|status|quality|pollut|वायु|वर्तमान|अभी|अब|सध्या|आता|स्थिति|स्थिती/,
}

/** Map a free-text question to one intent. Order encodes specificity. */
export function classifyQuestion(question) {
  const q = String(question || "").toLowerCase()
  if (RX.compare.test(q)) return INTENT.compare
  if (RX.areas.test(q)) return INTENT.areas
  if (RX.trend.test(q)) return INTENT.trend
  if (RX.forecast.test(q)) return INTENT.forecast
  if (RX.driver.test(q)) return INTENT.driver
  if (RX.current.test(q)) return INTENT.current
  return INTENT.fallback
}

function fmtTime(date) {
  try {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

/** Flatten the station context into template-ready, language-neutral fields. */
function buildData({ cityName, station, stations, t }) {
  const list = (Array.isArray(stations) ? stations : []).filter(
    (s) => s && s.name && s.current_aqi != null && Number.isFinite(Number(s.current_aqi)),
  )
  const active = list.find((s) => s.name === station?.name) || list[0]
  if (!active) return null

  const aqi = Math.round(Number(active.current_aqi))
  const sorted = [...list].sort((a, b) => Number(b.current_aqi) - Number(a.current_aqi))
  const worst = sorted[0]
  const best = sorted[sorted.length - 1]

  // Forecast shape reuses the Screen 5 demo module, anchored to the observed
  // station AQI — same labeled-DEMO data the rest of the app displays.
  const forecast = getDemoForecast({ cityName, stationName: active.name, range: "24H", station: active })
  const deltaDir =
    forecast.delta > aqi * 0.06 ? "rise" : forecast.delta < -aqi * 0.06 ? "fall" : "flat"

  return {
    city: cityName,
    station: active.name,
    aqi,
    category: t.severity[severityFor(aqi)] || "",
    pollutant: active.dominant_pollutant || "PM2.5",
    pm25: active.pollutants?.pm25 ?? "—",
    pm10: active.pollutants?.pm10 ?? "—",
    count: list.length,
    worstName: worst?.name || active.name,
    worstAqi: worst ? Math.round(Number(worst.current_aqi)) : aqi,
    worstCategory: worst ? t.severity[severityFor(Math.round(Number(worst.current_aqi)))] || "" : "",
    bestName: best?.name || active.name,
    bestAqi: best ? Math.round(Number(best.current_aqi)) : aqi,
    list: sorted
      .slice(0, 4)
      .map((s) => `${s.name} ${Math.round(Number(s.current_aqi))}`)
      .join(" · "),
    forecastAqi: forecast.predictedAqi,
    peakValue: forecast.peak.value,
    peakTime: fmtTime(forecast.peak.time),
    deltaDir,
  }
}

/**
 * Produce a grounded answer for a question.
 * @returns {{ text: string, provenance: string, intent: string }}
 */
export function askAssistant({ question, cityName, station, stations, t }) {
  const intent = classifyQuestion(question)
  const ans = t.aiScreen.answers
  const d = buildData({ cityName, station, stations, t })

  if (!d) {
    return { text: t.aiScreen.unavailable(), provenance: PROVENANCE.unavailable, intent }
  }

  switch (intent) {
    case INTENT.compare:
      return { text: ans.compare(d), provenance: PROVENANCE.observed, intent }
    case INTENT.areas:
      return { text: ans.areas(d), provenance: PROVENANCE.observed, intent }
    case INTENT.trend:
      return {
        text: d.deltaDir === "rise" ? ans.trendRise(d) : d.deltaDir === "fall" ? ans.trendFall(d) : ans.trendFlat(d),
        provenance: PROVENANCE.prediction,
        intent,
      }
    case INTENT.forecast:
      return { text: ans.forecast(d), provenance: PROVENANCE.prediction, intent }
    case INTENT.driver:
      return { text: ans.driver(d), provenance: PROVENANCE.derived, intent }
    case INTENT.current:
      return { text: ans.current(d), provenance: PROVENANCE.observed, intent }
    default:
      return { text: ans.fallback(d), provenance: PROVENANCE.derived, intent }
  }
}
