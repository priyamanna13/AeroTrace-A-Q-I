import { useCallback, useEffect, useRef, useState } from "react"
import { API } from "@/api_client"
import { CITIES, cityEnName } from "@/lib/aqi"

/**
 * Shape of one mapped city entry consumed by the National Overview UI.
 * { id, enName, aqi (number|null), dataTimestamp (string|null), isSimulated (boolean) }
 */

function mapCityAqi(id, summary) {
  if (!summary || typeof summary.current_aqi !== "number" || !Number.isFinite(summary.current_aqi)) {
    return { id, enName: cityEnName(id), aqi: null, dataTimestamp: null, isSimulated: false }
  }
  return {
    id,
    enName: cityEnName(id),
    aqi: Math.round(summary.current_aqi),
    dataTimestamp: summary.data_timestamp ?? null,
    isSimulated: Boolean(summary.is_simulated),
  }
}

/**
 * useNationalAqi — single shared source of live AQI for the National Overview.
 *
 * One request to GET /api/v1/cities (via the existing API.getCities() client,
 * the same integration Screen 3 uses) feeds the overall AQI, the city list,
 * the map pins, and the nav drawer. No demo constants, no synthetic values.
 *
 * Overall AQI = mean of the cities that reported a usable reading, so a city
 * with missing data degrades gracefully instead of corrupting the aggregate.
 *
 * Results are shared module-wide (in-flight promise + short TTL cache) so the
 * multiple mounted consumers (NationalOverview, NavigationPanel drawer) do not
 * duplicate network requests; the TTL matches the backend 30s refresh cadence.
 */
const CACHE_TTL_MS = 30_000
let cachedResult = null // { at, overallAqi, cities }
let inflight = null // { promise, at }

function fetchSummaries() {
  if (inflight && Date.now() - inflight.at < CACHE_TTL_MS) {
    return inflight.promise
  }
  const promise = API.getCities().catch((err) => {
    // Drop a failed request from the pool so an immediate retry refetches.
    if (inflight && inflight.promise === promise) inflight = null
    throw err
  })
  inflight = { promise, at: Date.now() }
  return promise
}

function applyResult(setState, summaries) {
  const byName = new Map(
    (Array.isArray(summaries) ? summaries : []).map((summary) => [
      String(summary.name || "").toLowerCase(),
      summary,
    ]),
  )
  const mappedCities = CITIES.map((city) => mapCityAqi(city.id, byName.get(city.id)))
  const usable = CITIES.map((city) => byName.get(city.id)).filter(
    (summary) => summary && typeof summary.current_aqi === "number" && Number.isFinite(summary.current_aqi),
  )
  const overall = usable.length
    ? Math.round(usable.reduce((sum, summary) => sum + summary.current_aqi, 0) / usable.length)
    : null
  cachedResult = { at: Date.now(), overallAqi: overall, cities: mappedCities }
  setState({ overallAqi: overall, cities: mappedCities, status: "ready", lastUpdated: new Date() })
}

export function useNationalAqi() {
  const [overallAqi, setOverallAqi] = useState(null)
  const [cities, setCities] = useState(() => CITIES.map((city) => mapCityAqi(city.id, null)))
  const [status, setStatus] = useState("loading") // 'loading' | 'ready' | 'error'
  const [lastUpdated, setLastUpdated] = useState(null)
  const requestIdRef = useRef(0)

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current
    const isCurrent = () => requestIdRef.current === requestId
    const setState = (next) => {
      if (!isCurrent()) return
      setOverallAqi(next.overallAqi)
      setCities(next.cities)
      setStatus(next.status)
      setLastUpdated(next.lastUpdated)
    }

    if (cachedResult && Date.now() - cachedResult.at < CACHE_TTL_MS) {
      setState({ ...cachedResult, lastUpdated: new Date(cachedResult.at), status: "ready" })
      return
    }
    setStatus("loading")
    fetchSummaries()
      .then((summaries) => {
        if (isCurrent()) applyResult(setState, summaries)
      })
      .catch(() => {
        if (!isCurrent()) return
        if (cachedResult) {
          // Serve the last known values rather than flipping to an error state.
          setState({ ...cachedResult, lastUpdated: new Date(cachedResult.at), status: "ready" })
        } else {
          setStatus("error")
        }
      })
  }, [])

  useEffect(() => {
    load()
    return () => {
      requestIdRef.current += 1
    }
  }, [load])

  return { overallAqi, cities, status, lastUpdated, retry: load }
}
