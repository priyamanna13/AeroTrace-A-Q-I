/**
 * demo-alerts-data.js — ISOLATED demo dataset for the Screen 8 Alerts.
 *
 * PROTOTYPE/DESIGN STAGE ONLY, following the same pattern as demo-trend-data.js
 * and demo-forecast-data.js: clearly labeled "DEMO ALERTS" by the UI, never
 * presented as a live alert feed (PMJIT NGEC data-honesty rules).
 * Deterministic per city so the same city always renders the same set.
 *
 * Active alerts and zone exposure are ANCHORED to the real station AQI from
 * the existing data contract (FALLBACK_CITY_STATIONS / live endpoint), so the
 * screen always agrees with the rest of the app about "current" air quality.
 * When a real alerts backend endpoint arrives, this module is the only file to
 * replace — the screen needs no redesign.
 */

function seeded(seed) {
  let value = seed
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648
    return value / 2147483648
  }
}

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

const EVENT_TYPES = [
  { en: "AQI Spike", key: "spike" },
  { en: "PM2.5 Rise", key: "pm25" },
  { en: "AQI Threshold", key: "threshold" },
  { en: "PM10 Increase", key: "pm10" },
  { en: "No2 Buildup", key: "no2" },
]

/**
 * @param {Array} stations — city stations from the existing API contract
 * @returns {{ active: Array, history: Array, zones: Array }}
 */
export function getDemoAlerts({ cityName, stations }) {
  const list = Array.isArray(stations) && stations.length ? stations : []
  const rand = seeded(hashString(`alerts|${cityName}|${list.length}`))
  const now = Date.now()

  // ── Active alerts: primary = worst station, secondary = other elevated ones ──
  const ranked = [...list].sort((a, b) => Number(b.current_aqi || 0) - Number(a.current_aqi || 0))
  const active = []
  if (ranked.length) {
    const worst = ranked[0]
    const worstAqi = Math.round(Number(worst.current_aqi) || 0)
    active.push({
      id: `primary-${worst.station_id || worst.name}`,
      level: "critical",
      aqi: worstAqi,
      station: worst.name,
      category: worst.aqi_category || "Very Poor",
      detail:
        worst.dominant_pollutant
          ? `${worst.dominant_pollutant} has crossed the critical threshold.`
          : "AQI has crossed the critical threshold.",
      minutesAgo: 8 + Math.floor(rand() * 10),
    })
    for (const s of ranked.slice(1)) {
      const aqi = Math.round(Number(s.current_aqi) || 0)
      if (aqi < 60) continue
      const pollutant = s.dominant_pollutant || "PM2.5"
      const rise = 8 + Math.floor(rand() * 30)
      active.push({
        id: `sec-${s.station_id || s.name}`,
        level: aqi >= 200 ? "high" : "moderate",
        kind: rand() > 0.5 ? "AQI SPIKE" : `${pollutant} RISE`,
        aqi,
        station: s.name,
        delta: `+${rise}%`,
        minutesAgo: 15 + Math.floor(rand() * 40),
      })
    }
  }

  // ── Alert history: ~14 days of deterministic entries across stations ──
  const history = []
  const severities = ["critical", "high", "moderate"]
  for (let day = 13; day >= 0; day--) {
    const entries = 1 + Math.floor(rand() * 3)
    for (let e = 0; e < entries; e++) {
      const station = list[Math.floor(rand() * Math.max(1, list.length))]
      const event = EVENT_TYPES[Math.floor(rand() * EVENT_TYPES.length)]
      const sev = severities[Math.floor(rand() * (day === 0 ? 2 : 3))]
      const ts = new Date(now - day * 86400000 - Math.floor(rand() * 12) * 3600000)
      history.push({
        id: `h-${day}-${e}`,
        timestamp: ts,
        event: event.en,
        location: station?.name || cityName,
        severity: sev,
        aqi:
          sev === "critical"
            ? 280 + Math.floor(rand() * 80)
            : sev === "high"
              ? 200 + Math.floor(rand() * 70)
              : 110 + Math.floor(rand() * 80),
      })
    }
  }
  history.sort((a, b) => b.timestamp - a.timestamp)

  // ── Vulnerable zones: anchored to station coordinates, exposure from AQI ──
  const kinds = ["schools", "hospitals", "residential", "traffic"]
  const zones = []
  const center = Array.isArray(ranked[0]?.coordinates) && ranked[0].coordinates.length >= 2
    ? ranked[0].coordinates
    : null
  if (center) {
    for (const s of ranked.slice(0, 4)) {
      const kind = kinds[Math.floor(rand() * kinds.length)]
      const aqi = Math.round(Number(s.current_aqi) || 0)
      const pm25 = s.pollutants?.pm25 != null ? Math.round(Number(s.pollutants.pm25)) : Math.round(aqi * 0.42)
      zones.push({
        id: `z-${s.station_id || s.name}`,
        kind,
        station: s.name,
        // [lon, lat] matching the station coordinate convention
        coordinates: s.coordinates,
        aqi,
        pm25,
        exposure: aqi >= 300 ? "HIGH" : aqi >= 200 ? "ELEVATED" : "MODERATE",
      })
    }
  }

  return { active, history, zones }
}
