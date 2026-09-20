# AeroTrace NGEC 2026 — Architecture Document

**Document version:** 1.2
**Date:** 2026-09-19
**Status:** DRAFT v1.2 — Third-pass clarification applied
**Changelog:**
* **v1.1** — Second-pass audit and consistency corrections.
* **v1.2** — Third-pass clarification of the 30-second application refresh/revalidation cadence across all 7 cities, physical monitoring station vs model-derived data distinction, verified physical station integrity, AQI-severity station pins, and synthetic weather handling.
---

## 1. Current Architecture (As-Is)

### 1.1 System Overview

AeroTrace currently operates as a single-city (Pune) air quality attribution engine. It is a 2-tier system:

```
Browser (React SPA)
        |
     REST API + WebSocket
        |
  FastAPI Backend (Python)
        |
   PostGIS (PostgreSQL)
```

### 1.2 Frontend — EXISTING

**Stack:** React 19, Vite 8, Tailwind CSS 4, React-Leaflet 5, Leaflet 1.9
**Entry:** frontend/src/main.jsx → App.jsx
**Architecture:** Single-page application. All screen state managed in App.jsx via useState/useEffect. No routing library.

**Key frontend modules:**
- `App.jsx` (1857 lines) — Monolithic component: styles, i18n, icon factories, map camera, all screen logic, sidebar, polling loop
- `map_layers.js` — Modular Leaflet renderer: StationGridLayer, PollutionSourceLayer, WindConeLayer
- `api_client.js` — Centralized HTTP client wrapping all backend API calls
- `ws_client.js` — WebSocket client with 5s auto-reconnect
- `api_config.js` — Base URL configuration (currently hardcoded localhost:8000)

**Existing UI features confirmed:**
- Dark theme only (background #08080a)
- 72%/28% map/sidebar split layout
- Language switcher (EN/HI/MR) in sidebar
- Custom Leaflet divIcon markers with CSS animations (ping, pulse, plumeFlow, needleSway)
- Wind compass SVG widget (bottom-left map overlay)
- Live/Met status badges (top-left map overlay)
- 24H timeline replay slider (map overlay)
- Attribution sidebar: station selector, AQI pill, pollutant bars, source cards with confidence bars
- WebSocket SPIKE_ALERT toast notifications
- Polling loop (30s interval, POLL_INTERVAL_MS)

### 1.3 Backend — EXISTING

**Stack:** Python 3.11+, FastAPI 0.115+, Uvicorn, SQLAlchemy 2.0, GeoAlchemy2, Pydantic 2, pydantic-settings
**Entry:** `uvicorn app.api:app --reload --port 8000`

**Existing backend modules:**

| Module | Purpose | Status |
|---|---|---|
| app/api.py | FastAPI application, all routes, WebSocket, cache | EXISTING |
| app/config.py | pydantic-settings, .env loading, city_config.yml | EXISTING |
| app/models.py | SQLAlchemy ORM: Station (PostGIS), AqiReading | EXISTING |
| app/standards.py | CPCB NAQI formula, breakpoints, NAAQS limits | EXISTING |
| app/validators.py | CPCB sentinel/unit/anomaly screening | EXISTING |
| app/pipeline.py | Ingest → validate → compute AQI → persist | EXISTING |
| app/contract.py | build_trigger_station_block() → JSON contract | EXISTING |
| app/cone_builder.py | Wind cone GeoJSON generation (Pasquill + dynamic) | EXISTING |
| app/wind_cone.py | Core polygon generation for wind cone | EXISTING |
| app/pasquill.py | Pasquill-Gifford stability classification A–F | EXISTING |
| app/ranker.py | Source candidate ranking, haversine, bearing | EXISTING |
| app/scoring.py | wind_alignment, proximity, chemical, temporal, compliance | EXISTING |
| app/intelligence.py | Enforcement priority, actions, localized advisory | EXISTING |
| app/overpass_client.py | OSM Overpass API discovery (industrial/construction/traffic/waste) | EXISTING |
| app/demo_scenarios.py | 4 Pune station scenario profiles | EXISTING |
| app/sources/base.py | SourceAdapter ABC, RawReading | EXISTING |
| app/sources/mock.py | Deterministic mock source with diurnal Gaussian spike | EXISTING |
| app/sources/cpcb.py | Live CPCB CAAQMS adapter | EXISTING |
| app/candidate_models.py | Source candidate Pydantic models | EXISTING |
| app/weather_contract.py | build_weather_snapshot() | EXISTING |
| app/weather_models.py | Weather reading models | EXISTING |
| app/weather_sources/mock.py | MockIMDSource: temperature, humidity, wind, cloud cover | EXISTING — SYNTHETIC — must be replaced with a real weather source before live multi-city implementation |
| app/cpcb_poller.py | Async background WAQI poller, WebSocket broadcaster | EXISTING |
| app/seed.py | CLI: station upsert + 7-day backfill + AQI spike | EXISTING |
| app/seed_candidates.py | Source candidate seed data | EXISTING |
| app/db.py | SQLAlchemy engine, sessions, init_db (+PostGIS extension) | EXISTING |

### 1.4 Database — EXISTING

**Technology:** PostgreSQL 15+ with PostGIS extension (Docker: postgis/postgis:15-3.4)
**ORM:** SQLAlchemy 2.0 + GeoAlchemy2

**Tables:**
- `stations` (UUID PK, name, network, city, state, elevation_m, geom POINT SRID:4326 with GIST index)
- `aqi_readings` (UUID PK, station_id FK, timestamp TZ, total_aqi, aqi_category, dominant_pollutant, pm25, pm10, no2, so2, co, o3)

**Fallback:** SQLite (no PostGIS) for tests and dry-run. Geometry stored as EWKT string.

### 1.5 Existing API Routes Summary

```
GET  /health
GET  /api/v1/attribution/{station_name}?live=bool&active_category_tab=str
GET  /api/v1/stations
GET  /api/v1/stations/{station_name}/readings?limit=int
GET  /api/v1/cone/{station_name}?wind_dir&wind_speed
GET  /api/v1/sources
GET  /api/v1/timeline/{station_name}
GET  /api/v1/replay/{station_name}?timestamp=ISO
POST /api/v1/simulation/trigger-spike?station_name&spike_aqi&dominant_pollutant
WS   /api/v1/simulation/ws
WS   /ws
```

### 1.6 Data Flow (Current)

```
[Browser Poll/Click]
       |
       v
[api_client.js: GET /api/v1/attribution/{station}?live=true]
       |
       v
[api.py: get_attribution()]
       |
       |-- Cache hit (30s TTL) --> return cached JSON
       |
       |-- Cache miss:
           |
           ├── _fetch_real_aqi() → CPCB Portal / Open-Meteo / WAQI climatology
           ├── get_scenario(station_name) → DemoScenario profile
           ├── MockIMDSource.fetch_snapshot() → weather data [EXISTING — SYNTHETIC — MUST BE REPLACED BEFORE LIVE MULTI-CITY IMPLEMENTATION: generates synthetic temperature, humidity, wind speed/direction, and cloud cover. Synthetic wind direction/speed directly affects wind cone geometry, Pasquill stability class, plume trajectory, and source attribution accuracy. Production implementation must use real meteorological data for all 7 cities.]
           ├── classify_stability() → Pasquill class
           ├── build_wind_cone() → GeoJSON polygon
           ├── PipelineController.ingest_reading() → AqiReading
           ├── build_trigger_station_block() → contract trigger_station
           ├── discover_and_format() → OSM sources (Overpass)
           ├── rank_candidates() → ranked list with scores
           ├── build_actionable_intelligence() → advisory + actions
           └── return full 6-block JSON contract
```

### 1.7 Existing In-Memory Cache

- `GLOBAL_ROUTE_CACHE: dict[str, dict]` — route-level result cache
- `_CACHE_TIMESTAMPS: dict[str, float]` — monotonic timestamps
- `_ATTRIBUTION_TTL_S = 30.0` — 30-second TTL
- No distributed cache; in-process only

---

## 2. Proposed Architecture (NGEC 2026 Target)

### 2.1 Architecture Decision Principles

1. **Extend, do not replace** — All existing backend components remain unchanged unless explicitly modified.
2. **Layer multi-city support** — New city configs follow the city_config.yml pattern. No schema changes required.
3. **Separate concerns** — New screens are separate components, not more code in App.jsx monolith.
4. **Add routing** — react-router-dom replaces state-based navigation for 9-screen architecture.
5. **AI as a service layer** — AI API calls [PROPOSED: Gemini] are isolated in a new backend router (app/ai_router.py).
6. **Prediction as a new module** — Forward prediction is a new backend module using existing wind cone + Pasquill infrastructure.

### 2.2 Proposed Frontend Architecture

**New dependencies to add:**
- `react-router-dom` v6+ — multi-screen navigation
- `recharts` — data visualization (charts for pollutant trends)
- No other new dependencies unless strictly required. All new dependencies require team confirmation.

**New folder structure:**

```
frontend/src/
├── App.jsx                    [MODIFY] — Wire router, theme provider, nav
├── main.jsx                   [EXISTING]
├── api_client.js              [MODIFY] — Add new API methods
├── api_config.js              [EXISTING]
├── ws_client.js               [EXISTING]
├── map_layers.js              [MODIFY] — Add India map layer support
├── index.css                  [MODIFY] — Add light theme variables
├── App.css                    [MODIFY] — Light/dark theme CSS classes
│
├── context/
│   ├── ThemeContext.jsx        [NEW] — Light/dark/system theme provider
│   ├── LanguageContext.jsx     [NEW] — Global i18n provider (extract from App.jsx)
│   └── NavigationContext.jsx   [NEW] — Screen context (city, station, pollutant)
│
├── components/
│   ├── nav/
│   │   ├── GlobalNav.jsx       [NEW] — Global navigation bar
│   │   └── Breadcrumb.jsx      [NEW] — City > Station > Pollutant breadcrumb
│   ├── map/
│   │   ├── IndiaMap.jsx        [NEW] — Screen 1: India overview map
│   │   ├── CityMap.jsx         [NEW] — Screen 2: City-level map
│   │   ├── StationMap.jsx      [NEW] — Screen 3-4: Station + wind cone map
│   │   └── MapTransition.jsx   [NEW] — Manages flyTo transitions
│   ├── charts/
│   │   ├── AqiTrendChart.jsx   [NEW] — Recharts AQI line chart
│   │   ├── PollutantBars.jsx   [MODIFY] — Extract from App.jsx
│   │   └── ComparisonChart.jsx [NEW] — Multi-city/station comparison
│   ├── ai/
│   │   ├── AiInsightCard.jsx   [NEW] — Inline AI summary card (all screens)
│   │   └── AiChat.jsx          [NEW] — Screen 9: Full AI chat interface
│   ├── alerts/
│   │   ├── GlobalAlerts.jsx    [NEW] — Alert panel in nav
│   │   └── ContextualAlert.jsx [NEW] — Floating contextual alert
│   └── shared/
│       ├── AqiPill.jsx         [NEW] — AQI badge with category color
│       ├── PollutantCard.jsx   [NEW] — Single pollutant display card
│       └── VoiceControl.jsx    [NEW] — Read-aloud button
│
└── screens/
    ├── IndiaOverview.jsx       [NEW] — Screen 1
    ├── CityIntelligence.jsx    [NEW] — Screen 2
    ├── StationIntelligence.jsx [MODIFY] — Screen 3 (refactored from App.jsx)
    ├── PollutionInvestigation.jsx [MODIFY] — Screen 4 (refactored from App.jsx sidebar)
    ├── Prediction.jsx          [NEW] — Screen 5
    ├── ImpactIntervention.jsx  [NEW] — Screen 6
    ├── Analytics.jsx           [NEW] — Screen 7
    ├── Alerts.jsx              [NEW] — Screen 8
    ├── AiIntelligence.jsx      [NEW] — Screen 9
    └── Settings.jsx            [NEW] — Settings screen
```

### 2.3 Proposed Backend Architecture

**New backend modules:**

```
app/
├── api.py                     [MODIFY] — Add new route groups, keep all existing routes
├── cities.py                  [NEW] — City-level aggregation, multi-city config
├── prediction.py              [NEW] — Forward pollution trajectory prediction
├── intervention.py            [NEW] — Intervention simulation model
├── ai_router.py               [NEW] — Gemini API integration, chat endpoint
├── analytics.py               [NEW] — Historical aggregation, trend computation
├── city_configs/              [NEW] — Per-city YAML config files
│   ├── pune.yml               [EXISTING — rename city_config.yml]
│   ├── mumbai.yml             [NEW]
│   ├── delhi.yml              [NEW]
│   ├── bengaluru.yml          [NEW]
│   ├── kolkata.yml            [NEW]
│   ├── hyderabad.yml          [NEW]
│   └── chennai.yml            [NEW]
└── demo_scenarios.py          [MODIFY] — Add scenarios for 6 new cities
```

**New API routes:**

```
GET  /api/v1/cities
GET  /api/v1/cities/{city_name}/overview
GET  /api/v1/cities/{city_name}/stations
GET  /api/v1/prediction/{station_name}/{pollutant}?hours=6
GET  /api/v1/analytics?city&station&pollutant&range=24h|7d|30d
POST /api/v1/intervention/simulate
POST /api/v1/ai/chat
GET  /api/v1/alerts/summary
```

### 2.4 AI Architecture

**Component:** `app/ai_router.py` [NEW]

**Integration approach:**
1. The AI router accepts: {message, context, language} where context is a structured dict containing city, station, pollutant, current_aqi, attribution_summary, screen_id.
2. The router constructs a grounded Gemini prompt using actual AeroTrace data from the context.
3. Language instruction is included in the system prompt.
4. Response is returned to frontend with a `confidence_note` field indicating data vs. inference.

**Fallback:** If Gemini API is unavailable, the router falls back to the existing `build_actionable_intelligence()` advisory template output.

**Short AI summaries (Screens 2–7):**
- Generated per request or cached per (city, station, language, time_bucket).
- A "time_bucket" is the current 15-minute interval — AI summaries expire with AQI data.

### 2.5 Prediction Architecture

**Component:** `app/prediction.py` [NEW]

**Methodology (documented for FR-066):**
1. Take current wind direction, wind speed, and Pasquill stability class.
2. Project pollution plume center forward along the wind bearing using: `distance_km = wind_speed_kmh * hours`.
3. Apply Gaussian plume dispersion: sigma_y and sigma_z from Pasquill class (EXISTING in pasquill.py).
4. Generate a GeoJSON polygon for the predicted affected zone at each time horizon (1H, 3H, 6H).
5. Estimate predicted AQI using [PROPOSED formula]: `AQI_t = AQI_current * exp(-k * t)` where k is a decay constant derived from Pasquill class. k values must be documented and agreed by the team before implementation.
6. Confidence decreases with time horizon: 1H = high, 3H = medium, 6H = low.

**Key assumption:** This is a simplified trajectory model. Real atmospheric transport modeling (HYSPLIT, WRF) is NOT in scope.

### 2.6 Intervention Simulation Architecture

**Component:** `app/intervention.py` [NEW]

**Methodology (documented for FR-066/067):**
1. Each intervention type has a documented emission reduction factor (ERF).
   - Reduce traffic (30%): ERF_traffic = 0.25 [PROPOSED - requires team validation] (traffic typically contributes ~25% of urban AQI)
   - Control construction dust: ERF_construction = 0.35 [PROPOSED - requires team validation]
   - Reduce industrial emissions: ERF_industrial = 0.30 [PROPOSED - requires team validation]
2. The projected AQI change: `AQI_projected = AQI_current * (1 - ERF * weight_factor)`
3. The weight_factor is derived from the confidence score of the relevant source type in the attribution.
4. All results are returned with: methodology description, confidence_level ("low"/"medium"/"high"), and a disclaimer string.

### 2.7 Alert Architecture

**EXISTING components:**
- WebSocket ConnectionManager in api.py
- SPIKE_ALERT broadcast on /api/v1/simulation/trigger-spike
- cpcb_poller.py — continuous background poll, broadcasts LIVE_TELEMETRY

**NEW components:**
- `GET /api/v1/alerts/summary` — Returns current active alerts across all cities
- ContextualAlert component — frontend component that evaluates current AQI against thresholds
- Alert preference storage — localStorage for user alert preferences
- Deep-link routing — alert CTAs pass screen + context params via react-router state

### 2.8 Voice Architecture

**Component:** `VoiceControl.jsx` [NEW — frontend only]

**Technology:** Web Speech API (SpeechSynthesis) — browser-native, no external API.

**Behavior:**
- Reads the current AI insight text on the active screen.
- Language: `SpeechSynthesisUtterance.lang` set to: en-IN (English), hi-IN (Hindi), mr-IN (Marathi).
- Voice speed: configurable via Settings (slow=0.7x, normal=1.0x, fast=1.4x).
- Controls: Play/Pause/Stop.

### 2.9 Theme Architecture

**Component:** `ThemeContext.jsx` [NEW — frontend]

**Implementation:**
- CSS custom properties (variables) on `:root` for color tokens.
- Two CSS classes: `.theme-dark` and `.theme-light` on `<body>`.
- Map tiles: Dark theme uses CartoDB Dark Matter or CARTO dark tiles. Light theme uses OpenStreetMap standard tiles.
- Leaflet popup styles override via CSS class conditions.
- localStorage key: `aerotrace-theme`.

### 2.10 Localization Architecture

**EXISTING:** I18N dictionary in App.jsx (L230-284) with en/hi/mr strings.

**MODIFY:**
- Extract I18N dictionary to `src/i18n/strings.js` — shared across all components.
- Add keys for all new screen labels, alerts, settings.
- Pass language state via LanguageContext instead of prop-drilling from App.jsx.
- localStorage key: `aerotrace-language`.

### 2.11 State Management

**Current approach:** All state in App.jsx (single component).

**Proposed approach:**
- React Context for cross-screen state: ThemeContext, LanguageContext, NavigationContext.
- Screen-local state within each screen component.
- Navigation state (city, station, pollutant) passed via react-router state or NavigationContext.
- No Redux/Zustand unless NavigationContext proves insufficient.

### 2.11b Data Source and Station Integrity

**Application refresh vs provider cadence:**
AeroTrace uses a 30-second application refresh/revalidation cycle for current data across all 7 cities. This is the application polling interval, not a guarantee of new upstream measurements. Each upstream provider has its own cadence:
- CPCB Portal: ~15 minutes (when available)
- Open-Meteo/CAMS: hourly model cycle
- WAQI: ~15 minutes aggregated

The source timestamp of each reading must be preserved and exposed. AeroTrace re-querying every 30 seconds against a source that updated 40 minutes ago returns the 40-minute-old timestamp — not a new measurement.

**Physical station vs model data in the city layer:**

When implementing the city map (Screen 2), city configs, and the /api/v1/cities/{city}/stations endpoint:

1. **Verified physical monitoring stations** (CPCB CAAQMS or equivalent) are represented as station pins and navigable to Screen 3. These are real-world instruments with known coordinates.

2. **Open-Meteo/CAMS atmospheric model data** provides environmental estimates for any geographic coordinate. It is NOT a physical monitoring station. A coordinate submitted to Open-Meteo is a model query point, not a station location. Open-Meteo data MUST NOT automatically create station entities, station pins, or station database records.

3. **For cities where verified physical station metadata is not yet available:** do not create fake station pins from model coordinates. Represent city-level data as a city-level estimate only. The visual treatment of model-derived geographic data is [PROPOSED] — to be decided during the UI/UX design phase.

4. **/api/v1/cities/{city}/stations** returns **verified physical monitoring stations only**. Model-derived data (Open-Meteo/CAMS grid points, city centroids, unverified coordinates) does not appear in this endpoint and must not be inserted into the stations database table. Model-derived environmental information is a separate data concern; if it is ever surfaced via an API endpoint in a future version, that endpoint is distinct from the stations endpoint.
### 2.12 Caching Strategy

**Backend:**
- EXISTING route cache: GLOBAL_ROUTE_CACHE (30s TTL) — extend to multi-city.
- NEW: AI summary cache: per (city+station+language+time_bucket) with 15-minute TTL.
- NEW: Analytics aggregation cache: per (city+station+range) with 5-minute TTL.
- All caches are in-process (no Redis for NGEC 2026 scope).

**Frontend:**
- SWR-style polling (already implemented via setInterval in App.jsx).
- React state as a transient cache for current screen data.

### 2.13 Security

- CORS: Remain open for hackathon demo.
- WAQI token: Move from hardcode to .env (MODIFY in api.py and cpcb_poller.py).
- Gemini API key: .env only (NEW).
- No authentication for NGEC 2026 scope.

### 2.14 Deployment

**Existing:** Docker Compose (docker-compose.yml) with PostGIS + FastAPI container.
**Frontend:** Vite dev server for development; `vite build` → `dist/` for production.
**Backend:** `uvicorn app.api:app --reload --port 8000`.

**Proposed deployment for NGEC 2026:**
- Maintain existing Docker Compose setup.
- Add Gemini API key to docker-compose environment.
- Frontend served via Vite dev server for demo (production build optional).
- Consider ngrok or similar for public URL during NGEC demo (test_ngrok.py already exists in repo).

---

## 3. Component Status Register

| Component | Status | Owner | Notes |
|---|---|---|---|
| app/api.py | MODIFY | Person 2 | Add new routes, keep existing |
| app/standards.py | EXISTING | — | No changes needed |
| app/models.py | EXISTING | — | No changes needed |
| app/pipeline.py | EXISTING | — | No changes needed |
| app/cone_builder.py | EXISTING | — | No changes needed |
| app/pasquill.py | EXISTING | — | No changes needed |
| app/ranker.py | EXISTING | — | No changes needed |
| app/scoring.py | EXISTING | — | No changes needed |
| app/intelligence.py | MODIFY | Person 3 | Extend for contextual AI |
| app/overpass_client.py | EXISTING | — | No changes needed |
| app/demo_scenarios.py | MODIFY | Person 2 | Add attribution scenario configs (source candidates, compliance profiles) for 6 new cities based on verified physical monitoring stations. These are NOT mock AQI data sources — AQI comes from the Tier 1-3 data fallback pipeline (real AQI comes from the Tier 1-3 data fallback) |
| app/config.py | MODIFY | Person 2 | Multi-city config support |
| app/cpcb_poller.py | MODIFY | Person 2 | Move WAQI token to .env |
| app/cities.py | NEW | Person 2 | City aggregation |
| app/prediction.py | NEW | Person 2/3 | Forward prediction model |
| app/intervention.py | NEW | Person 3 | Intervention simulator |
| app/ai_router.py | NEW | Person 3 | Gemini API integration |
| app/analytics.py | NEW | Person 2 | Historical aggregation |
| frontend/src/App.jsx | MODIFY | Person 1 | Refactor to shell + router |
| frontend/src/map_layers.js | MODIFY | Person 1 | India map layer |
| frontend/src/api_client.js | MODIFY | Person 1 | New API methods |
| frontend/src/context/* | NEW | Person 1 | Theme, Language, Navigation |
| frontend/src/screens/* | NEW | Person 1 | All 9 screens |
| frontend/src/components/* | NEW | Person 1 | Shared components |
| city_configs/*.yml | NEW | Person 2 | 6 new city configs. Each config must specify verified physical monitoring station coordinates — not model grid points or city centroids. Coordinates must correspond to actual CPCB CAAQMS or equivalent verified stations. |

---

## 4. Architecture Decision Records (ADRs)

### ADR-001: Retain Monolithic App.jsx Pattern vs. Componentize
**Decision:** Componentize. Introduce react-router-dom and split screens into separate files.
**Rationale:** App.jsx at 1857 lines is already at the limit of maintainability. Adding 6 new screens without componentization would make coordination between 3 developers impossible.
**Consequence:** Requires refactoring App.jsx to extract existing screens first.

### ADR-002: React Router vs. State-Based Navigation
**Decision:** Add react-router-dom v6.
**Rationale:** 9-screen navigation with context passing (city → station → pollutant → source) requires clean URL-based or state-based routing. react-router provides cleaner context passing via route state and location.
**Consequence:** New dependency. Must be installed in frontend.

### ADR-003: In-Process Cache vs. Redis
**Decision:** Retain in-process cache (dict) for NGEC 2026.
**Rationale:** Redis adds operational complexity inappropriate for a 3-person hackathon team. The 30s TTL cache is sufficient for demo traffic.
**Consequence:** Cache is not shared across multiple uvicorn workers.

### ADR-004: Gemini API vs. Static Templates for AI
**Decision [PROPOSED]:** Gemini API (or equivalent LLM API) for chat (Screen 9) and enhanced summaries; fall back to static templates.
**Rationale:** The existing intelligence.py has f-string advisory templates that cover Pune scenarios. Gemini provides the conversational, multi-city, contextual AI capability needed for NGEC 2026.
**Consequence:** Requires API key management, graceful degradation, and prompt engineering.

### ADR-005: Web Speech API vs. External TTS Service
**Decision:** Web Speech API (browser-native).
**Rationale:** No external API dependency, no cost, works in all modern browsers, supports en-IN/hi-IN/mr-IN.
**Consequence:** Voice quality is browser-dependent. en-IN support is strongest.

### ADR-006: Prediction Model Approach
**Decision:** Simplified wind-trajectory + Pasquill dispersion model, clearly labeled as estimate.
**Rationale:** Full atmospheric transport modeling (HYSPLIT, WRF) requires meteorological expertise and significant compute. A documented simplified model is transparent, defensible, and implementable in hackathon timeframe.
**Consequence:** Predictions have limited real-world accuracy. Must clearly label uncertainty.

---

## 5. Open Questions

1. **RESOLVED:** All 6 new cities SHALL use real data from the Tier 1-3 fallback cascade (CPCB -> Open-Meteo -> WAQI). Open-Meteo provides confirmed global coverage including all 7 cities. The remaining open question is: which CPCB station IDs and WAQI UIDs are available for each city? Person 2 to research. Emergency simulation is the fallback of last resort only, and must be labeled.
2. **[PROPOSED - UNKNOWN]** AI integration uses Gemini API [PROPOSED]. Is a Gemini API key available? What model version? Person 3 to confirm.
3. **UNKNOWN:** Should react-router use hash-based routing (for simple hosting) or history-based routing?
4. **UNKNOWN:** What is the hosting environment for the NGEC demo? Local laptop, cloud VM, or ngrok tunnel?
5. **NEEDS VERIFICATION:** Does the existing PostGIS container have enough data seeded for analytics 7D/30D views? Note: Seeded data is for development/testing only. Real historical data from Open-Meteo CAMS Reanalysis or equivalent must be investigated for the live product.
6. **NEEDS VERIFICATION:** Are the existing Pune station CPCB IDs (site_5029, site_5148, etc. in city_config.yml) current?

---

## 6. Repository Evidence

| Architecture claim | Evidence |
|---|---|
| Single-page, no router | frontend/package.json (no react-router) |
| 72/28 map/sidebar split | frontend/src/App.jsx L101, L150 CSS |
| Dark theme only | frontend/src/App.jsx L90 (background: #08080a) |
| In-process dict cache | app/api.py L63-65 |
| 30s attribution TTL | app/api.py L65 (_ATTRIBUTION_TTL_S = 30.0) |
| WebSocket manager | app/api.py L37-57 |
| PostGIS production, SQLite test | app/models.py L44-46 |
| city_config.yml for Pune only | city_config.yml |
| 4 demo scenarios (Pune only) | app/demo_scenarios.py |
| 3-tier AQI data fallback | app/api.py L133-337 |
| Docker Compose | docker-compose.yml |
| ngrok test exists | test_ngrok.py |





