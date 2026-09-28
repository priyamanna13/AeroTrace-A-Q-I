/**
 * Shared AQI domain utilities for the seven monitored cities.
 *
 * Live AQI values are NOT stored here anymore — screens consume the
 * useNationalAqi() hook (backed by GET /api/v1/cities) for real numbers.
 * This module keeps only city identity, map layout metadata, and the
 * severity classification/color helpers shared across screens.
 */

/** Monitored cities in canonical display order with map pin metadata. */
export const CITIES = [
  { id: "mumbai", labelSide: "left" },
  { id: "pune", labelSide: "right" },
  { id: "delhi", labelSide: "right" },
  { id: "bengaluru", labelSide: "left" },
  { id: "hyderabad", labelSide: "right" },
  { id: "chennai", labelSide: "right" },
  { id: "kolkata", labelSide: "right" },
]

/**
 * Geometric label offset and alignment sequencing to ensure zero collision between
 * closely situated cities (e.g., Mumbai/Pune, Bengaluru/Chennai, Hyderabad).
 */
export const CITY_MAP_LAYOUT = {
  mumbai:    { side: "left",  dx: -22, dy: -28 },
  pune:      { side: "right", dx:  22, dy: -18 },
  delhi:     { side: "right", dx:  22, dy: -28 },
  bengaluru: { side: "left",  dx: -22, dy: -28 },
  hyderabad: { side: "right", dx:  22, dy: -28 },
  chennai:   { side: "right", dx:  22, dy: -28 },
  kolkata:   { side: "right", dx:  22, dy: -28 },
}

/** Canonical route slugs for the seven monitored cities (Screen 2 selector). */
export const CITY_IDS = CITIES.map((city) => city.id)

/**
 * Canonical English city names for API calls and cross-screen navigation context.
 * Display names come from i18n (t.cities); API contracts and route params must
 * stay language-invariant so backend keys and fallbacks resolve correctly.
 */
export const CITY_EN_NAMES = {
  pune: "Pune",
  mumbai: "Mumbai",
  delhi: "Delhi",
  bengaluru: "Bengaluru",
  kolkata: "Kolkata",
  hyderabad: "Hyderabad",
  chennai: "Chennai",
}

export function cityEnName(id) {
  return CITY_EN_NAMES[id] || "Mumbai"
}

export const SEVERITY_BANDS = [
  { key: "good", max: 50, range: "0–50" },
  { key: "satisfactory", max: 100, range: "51–100" },
  { key: "moderate", max: 200, range: "101–200" },
  { key: "poor", max: 300, range: "201–300" },
  { key: "veryPoor", max: 400, range: "301–400" },
  { key: "severe", max: Number.POSITIVE_INFINITY, range: "401+" },
]

export function severityFor(aqi) {
  if (aqi == null) return "moderate"
  return (SEVERITY_BANDS.find((band) => aqi <= band.max) ?? SEVERITY_BANDS[SEVERITY_BANDS.length - 1]).key
}

const SEVERITY_VAR = {
  good: "var(--aqi-good)",
  satisfactory: "var(--aqi-satisfactory)",
  moderate: "var(--aqi-moderate)",
  poor: "var(--aqi-poor)",
  veryPoor: "var(--aqi-very-poor)",
  severe: "var(--aqi-severe)",
}

export function severityColor(key) {
  return SEVERITY_VAR[key] || "var(--aqi-moderate)"
}
