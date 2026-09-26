/**
 * demo-forecast-data.js — ISOLATED demo dataset for the Screen 5 Prediction.
 *
 * PROTOTYPE/DESIGN STAGE ONLY, following the same pattern as demo-trend-data.js:
 * clearly labeled "DEMO FORECAST" by the UI, never presented as a live forecast
 * (PMJIT NGEC data-honesty rules). Deterministic per city+station+range so the
 * shape is stable across renders and language switches.
 *
 * When a real forecast backend endpoint arrives, this module is the only file
 * to replace — the screen needs no redesign.
 */

// Deterministic pseudo-random generator (same pattern as demo-trend-data.js).
function seeded(seed) {
  let value = seed
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648
    return value / 2147483648
  }
}

const CITY_BASE = {
  pune: 142,
  mumbai: 145,
  delhi: 278,
  bengaluru: 68,
  kolkata: 162,
  hyderabad: 112,
  chennai: 95,
}

const RANGE_HOURS = { "6H": 6, "12H": 12, "24H": 24, "48H": 48 }
const RANGE_POINTS = { "6H": 13, "12H": 13, "24H": 13, "48H": 13 }

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/**
 * Build the full forecast payload for a city/station/range.
 * @returns {{
 *   currentAqi: number, predictedAqi: number, delta: number, confidence: number,
 *   points: Array<{ timestamp: string, value: number, predicted: boolean, confidence: number }>,
 *   drivers: Array<{ key: 'wind'|'pm25'|'weather'|'history', dir: 'rise'|'fall'|'flat', detail: string, meta: object }>,
 *   peak: { value: number, time: string, windowStart: string, windowEnd: string },
 * }}
 */
export function getDemoForecast({ cityName, stationName, range = "24H", station }) {
  const cityKey = String(cityName || "").toLowerCase()
  const base = CITY_BASE[cityKey] ?? 145
  const stationOffset = station?.current_aqi != null ? Math.round(Number(station.current_aqi) * 0.4) : 0
  const rand = seeded(hashString(`${cityKey}|${stationName}|${range}`))

  const hours = RANGE_HOURS[range] ?? 24
  const nPoints = RANGE_POINTS[range] ?? 13
  const now = new Date()

  // The forecast anchors to the OBSERVED current AQI when a station reading
  // exists (data honesty — same contract the rest of the app displays).
  const currentAqi =
    station?.current_aqi != null && Number.isFinite(Number(station.current_aqi))
      ? Math.round(Number(station.current_aqi))
      : Math.max(15, base + Math.round((rand() - 0.5) * 24) + Math.round(stationOffset * 0.3))

  // Peak shape: single evening-style peak at ~55-75% of the horizon, amplitude
  // scales with the observed baseline, plus a mild linear drift so the
  // end-of-horizon value meaningfully differs from current (deterministic).
  const peakFrac = 0.55 + rand() * 0.2
  const peakHourAbs = hours * peakFrac
  const amp = currentAqi * (0.24 + rand() * 0.14)
  const drift = (rand() - 0.35) * currentAqi * 0.22

  const points = []
  let peak = { value: 0, time: "", index: 0 }
  for (let i = 0; i < nPoints; i++) {
    const frac = i / (nPoints - 1)
    const hourAbs = hours * frac
    const ts = new Date(now.getTime() + hourAbs * 3600 * 1000)
    const shape = Math.exp(-((hourAbs - peakHourAbs) ** 2) / (2 * (hours * 0.16) ** 2))
    // i=0 is NOW — exactly the observed reading, no synthetic noise.
    const value = i === 0
      ? currentAqi
      : Math.max(
        12,
        Math.round(currentAqi + amp * shape + drift * frac + (rand() - 0.5) * currentAqi * 0.05),
      )
    const predicted = i > 0
    const confidence = predicted ? Math.round(94 - frac * 22 + (rand() - 0.5) * 3) : 100
    const point = {
      timestamp: ts,
      value,
      predicted,
      confidence: Math.min(99, Math.max(58, confidence)),
    }
    if (value > peak.value) peak = { value, time: ts, index: i }
    points.push(point)
  }

  const predictedAqi = points[points.length - 1].value
  const delta = predictedAqi - currentAqi
  const confidence = Math.round(
    points.slice(1).reduce((sum, p) => sum + p.confidence, 0) / (points.length - 1),
  )

  // Drivers — derived from the same deterministic shape (no invented science):
  const dirFromDelta = (v) => (v > base * 0.06 ? "rise" : v < -base * 0.06 ? "fall" : "flat")
  const windDirs = ["NW", "NE", "SW", "SE", "N", "W", "E", "S"]
  const windDir = windDirs[Math.floor(rand() * windDirs.length)]
  const windSpeed = 4 + Math.floor(rand() * 18)
  const pm25 = station?.pollutants?.pm25 ?? Math.round(base * 0.42)
  const weatherConds = ["Clear sky", "Haze", "Light haze", "Humid", "Calm", "Overcast"]
  const weather = weatherConds[Math.floor(rand() * weatherConds.length)]
  const pm25Dir = dirFromDelta(delta * 0.8)
  const weatherDir = weather === "Light haze" || weather === "Haze" ? "rise" : "flat"
  const windDir2 = windSpeed <= 8 ? "rise" : windSpeed >= 16 ? "fall" : "flat"

  const fmtTime = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  const windowPadMs = 60 * 60 * 1000
  const peakPoint = points[peak.index]

  return {
    currentAqi,
    predictedAqi,
    delta,
    confidence,
    points,
    drivers: [
      { key: "wind", dir: windDir2, detail: { dir: windDir, speed: windSpeed } },
      { key: "pm25", dir: pm25Dir, detail: { value: pm25 } },
      { key: "weather", dir: weatherDir, detail: { cond: weather } },
      { key: "history", dir: dirFromDelta(delta * 0.5), detail: {} },
    ],
    peak: {
      value: peak.value,
      time: fmtTime(peakPoint.timestamp),
      windowStart: fmtTime(new Date(peakPoint.timestamp.getTime() - windowPadMs)),
      windowEnd: fmtTime(new Date(peakPoint.timestamp.getTime() + windowPadMs)),
    },
    rangeHours: hours,
  }
}

/** Vulnerable-zone markers around a station coordinate (deterministic offsets). */
export function getDemoVulnerableZones({ cityName, stationName, station }) {
  const rand = seeded(hashString(`zones|${cityName}|${stationName}`))
  const center = Array.isArray(station?.coordinates) && station.coordinates.length >= 2
    ? station.coordinates
    : [73.8567, 18.5204]
  const kinds = ["schools", "hospitals", "dense", "traffic"]
  const names = {
    schools: ["Municipal School", " Vidya Mandir", "Public School"],
    hospitals: ["Civil Hospital", "Health Centre", "General Hospital"],
    dense: ["Old Bazaar Ward", "Housing Block", "Market Quarter"],
    traffic: ["Junction Corridor", "Bus Terminal", "Highway Stretch"],
  }
  return kinds.flatMap((kind, ki) =>
    [0, 1].map((j) => {
      const dLat = (rand() - 0.5) * 0.05
      const dLon = (rand() - 0.5) * 0.06
      const intensity = 0.55 + rand() * 0.45
      return {
        id: `${kind}-${ki}-${j}`,
        kind,
        name: `${names[kind][j].trim()}`,
        // [lon, lat] to match station.coordinates convention
        coordinates: [center[0] + dLon, center[1] + dLat],
        intensity,
      }
    }),
  )
}
