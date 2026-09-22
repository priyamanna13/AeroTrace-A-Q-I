/**
 * AeroTrace A-Q-I — Centralized API Client
 * Fixed: BASE_URL corrected to port 8000 (FastAPI/Uvicorn).
 * Added: getAllWindCones(), getAttributionLive(), graceful error handling on every method.
 */
const BASE_URL = "http://localhost:8000";

async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Accept': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API ${path} → HTTP ${response.status}`);
  }
  return response.json();
}

export const API = {
  BASE_URL,

  /** GET /api/v1/stations — all 4 CPCB CAAQMS monitoring stations */
  async getStations() {
    return apiFetch('/api/v1/stations');
  },

  /** GET /api/v1/sources — curated + OSM-discovered pollution sources */
  async getSources() {
    return apiFetch('/api/v1/sources');
  },

  /** GET /api/v1/cone/{station} — wind cone GeoJSON for a single station */
  async getWindCone(stationName, timestamp = null) {
    let path = `/api/v1/cone/${encodeURIComponent(stationName)}`;
    if (timestamp) path += `?timestamp=${encodeURIComponent(timestamp)}`;
    return apiFetch(path);
  },

  /**
   * Fetch wind cones for multiple stations in parallel.
   * Returns an object keyed by station name; failed fetches are silently omitted.
   * @param {string[]} stationNames
   * @returns {Promise<Record<string, object>>}
   */
  async getAllWindCones(stationNames) {
    const results = await Promise.allSettled(
      stationNames.map(name => apiFetch(`/api/v1/cone/${encodeURIComponent(name)}`))
    );
    const cones = {};
    stationNames.forEach((name, i) => {
      if (results[i].status === 'fulfilled') {
        cones[name] = results[i].value;
      }
    });
    return cones;
  },

  /**
   * GET /api/v1/attribution/{station}
   * Returns full forensic attribution report (ranked_candidates, advisory, etc.)
   */
  async getAttribution(stationName) {
    return apiFetch(`/api/v1/attribution/${encodeURIComponent(stationName)}?live=true`);
  },

  /**
   * GET /api/v1/attribution/{station}?live=true
   * Bypass the server-side 30s cache; forces a fresh pipeline evaluation.
   */
  async getAttributionLive(stationName) {
    return apiFetch(`/api/v1/attribution/${encodeURIComponent(stationName)}?live=true`);
  },

  /** GET /api/v1/timeline/{station} — 24-hour tick array for the replay scrubber */
  async getTimeline(stationName) {
    return apiFetch(`/api/v1/timeline/${encodeURIComponent(stationName)}`);
  },

  /** GET /api/v1/replay/{station}?timestamp=... — full attribution for a historical hour */
  async getReplay(stationName, timestamp) {
    return apiFetch(
      `/api/v1/replay/${encodeURIComponent(stationName)}?timestamp=${encodeURIComponent(timestamp)}`
    );
  },

  /** GET /api/v1/ai/status — check active AI service status */
  async getAIStatus() {
    return apiFetch('/api/v1/ai/status');
  },

  /** POST /api/v1/ai/insight — generate grounded screen insight */
  async getAIInsight(context) {
    return apiFetch('/api/v1/ai/insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    });
  },

  /** POST /api/v1/ai/chat — interactive grounded chat query */
  async sendAIChat(message, context, conversationHistory = []) {
    return apiFetch('/api/v1/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        context,
        conversation_history: conversationHistory,
      }),
    });
  },

  /** GET /api/v1/cities — Screen 1: list all 7 metros */
  async getCities() {
    return apiFetch('/api/v1/cities');
  },

  /** GET /api/v1/cities/{city}/overview — Screen 2: city header */
  async getCityOverview(cityName) {
    return apiFetch(`/api/v1/cities/${encodeURIComponent(cityName)}/overview`);
  },

  /** GET /api/v1/cities/{city}/stations — Screen 2: verified physical CAAQMS stations */
  async getCityStations(cityName) {
    return apiFetch(`/api/v1/cities/${encodeURIComponent(cityName)}/stations`);
  },

  /** GET /api/v1/alerts — all active metropolitan alerts */
  async getAllAlerts() {
    return apiFetch('/api/v1/alerts');
  },

  /** GET /api/v1/alerts/{city} — active alerts for a specific city */
  async getCityAlerts(cityName) {
    return apiFetch(`/api/v1/alerts/${encodeURIComponent(cityName)}`);
  },

  /** GET /api/v1/analytics/{city}?range=24H — Screen 7 historical trends & diurnal physics */
  async getCityAnalytics(cityName, range = '24H') {
    return apiFetch(`/api/v1/analytics/${encodeURIComponent(cityName)}?range=${encodeURIComponent(range)}`);
  },

  /** GET /api/v1/ai/cities/{city}/insight — auto-grounded city insight */
  async getCityAIInsight(cityName, lang = 'en') {
    return apiFetch(`/api/v1/ai/cities/${encodeURIComponent(cityName)}/insight?lang=${encodeURIComponent(lang)}`);
  },

  /** GET /api/v1/ai/cities/{city}/stations/{station}/insight — auto-grounded station insight */
  async getStationAIInsight(cityName, stationName, lang = 'en') {
    return apiFetch(`/api/v1/ai/cities/${encodeURIComponent(cityName)}/stations/${encodeURIComponent(stationName)}/insight?lang=${encodeURIComponent(lang)}`);
  },

  /** GET /api/v1/ai/analytics/{city}/insight — auto-grounded Screen 7 analytics insight */
  async getAnalyticsAIInsight(cityName, range = '24H', lang = 'en') {
    return apiFetch(`/api/v1/ai/analytics/${encodeURIComponent(cityName)}/insight?range=${encodeURIComponent(range)}&lang=${encodeURIComponent(lang)}`);
  },
};


