export const CITIES = [
  { id: "pune", aqi: 116, labelSide: "right" },
  { id: "mumbai", aqi: 74, labelSide: "left" },
  { id: "delhi", aqi: 212, labelSide: "right" },
  { id: "bengaluru", aqi: 96, labelSide: "left" },
  { id: "kolkata", aqi: 168, labelSide: "right" },
  { id: "hyderabad", aqi: 139, labelSide: "right" },
  { id: "chennai", aqi: 188, labelSide: "right" },
]

export const NATIONAL_AQI = 145

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
