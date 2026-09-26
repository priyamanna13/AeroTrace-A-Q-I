/**
 * demo-trend-data.js — ISOLATED demo dataset for the Screen 2 Air Quality Trend.
 *
 * PROTOTYPE/DESIGN STAGE ONLY. These values are clearly labeled "DEMO DATA /
 * Prototype data — not live measurements" by CityTrend. They must NEVER be
 * presented as production measurements (PMJIT NGEC data-honesty rules).
 *
 * Kept in a single isolated module so the backend can replace it later by
 * returning real observed points — the chart needs no redesign, and this file
 * is the only thing to delete.
 */

// Deterministic pseudo-random generator so the same city/range always renders
// the same shape (stable for design review, no flicker between renders).
function seeded(seed) {
  let value = seed
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648
    return value / 2147483648
  }
}

// Per-city base AQI so each city's demo shape differs plausibly.
const CITY_BASE = {
  pune: 118,
  mumbai: 142,
  delhi: 262,
  bengaluru: 92,
  kolkata: 168,
  hyderabad: 126,
  chennai: 148,
}

function citySeed(cityName) {
  const key = String(cityName || "").toLowerCase()
  return CITY_BASE[key] != null ? key : "mumbai"
}

function diurnal(hour, base, rand) {
  // Two-peak diurnal shape: morning inversion (~8-10h) + evening traffic (~20-22h),
  // cleaner mid-afternoon. Adds gentle deterministic noise.
  const morning = Math.exp(-((hour - 9) ** 2) / 14) * base * 0.42
  const evening = Math.exp(-((hour - 21) ** 2) / 16) * base * 0.34
  const afternoonDip = Math.exp(-((hour - 15) ** 2) / 20) * base * 0.16
  const noise = (rand() - 0.5) * base * 0.12
  return Math.max(12, Math.round(base + morning + evening - afternoonDip + noise))
}

/**
 * Demo trend points for a city + range.
 * @returns {{ points: Array<{timestamp: string, value: number}>, label: string }}
 */
export function getDemoTrend(cityName, range = "24H") {
  const key = citySeed(cityName)
  const base = CITY_BASE[key]
  const rand = seeded(base * 7919 + range.length * 131)

  if (range === "7D") {
    const points = []
    const now = new Date()
    now.setMinutes(0, 0, 0)
    for (let day = 6; day >= 0; day--) {
      for (const hour of [3, 9, 15, 21]) {
        const ts = new Date(now)
        ts.setDate(now.getDate() - day)
        ts.setHours(hour)
        points.push({
          timestamp: ts.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }),
          value: diurnal(hour, base + Math.round((rand() - 0.5) * 30), rand),
        })
      }
    }
    return { points, label: "DEMO DATA · 7-day prototype series" }
  }

  if (range === "30D") {
    const points = []
    const now = new Date()
    for (let day = 29; day >= 0; day--) {
      const ts = new Date(now)
      ts.setDate(now.getDate() - day)
      ts.setHours(9)
      points.push({
        timestamp: ts.toLocaleDateString([], { month: "short", day: "numeric" }),
        value: diurnal(9, base + Math.round((rand() - 0.5) * 46), rand),
      })
    }
    return { points, label: "DEMO DATA · 30-day prototype series" }
  }

  // Default 24H — hourly points across the last 24 hours.
  const points = []
  const now = new Date()
  now.setMinutes(0, 0, 0)
  for (let i = 23; i >= 0; i--) {
    const ts = new Date(now)
    ts.setHours(now.getHours() - i)
    points.push({
      timestamp: ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: diurnal(ts.getHours(), base, rand),
    })
  }
  return { points, label: "DEMO DATA · 24-hour prototype series" }
}
