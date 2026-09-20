# AeroTrace NGEC 2026 — Software Requirements Specification (SRS)

**Document version:** 1.2
**Date:** 2026-09-19
**Status:** DRAFT — Pending team review
**Companion:** 01_PRD.md, 03_ARCHITECTURE.md
**Changelog:** v1.1 — Second-pass audit (data requirement corrections). v1.2 — Third-pass: 30-second application refresh cadence clarified vs provider cadence; physical station vs model data distinction; station integrity NFRs; AQI-severity-colored station pin requirement. See Section 6.

---

## 1. Introduction

This SRS defines the complete functional and non-functional requirements for AeroTrace NGEC 2026. Requirements are labeled [EXISTING], [MODIFY], or [NEW].

**Data requirement (LOCKED):** All 7 target cities (Pune, Mumbai, Delhi, Bengaluru, Kolkata, Hyderabad, Chennai) require current/near-real-time air quality and environmental data from real providers. See NFR-070 through NFR-077.

**Technology notation:** Technologies not yet confirmed as locked decisions are marked **[PROPOSED]**. Proposed technologies may be changed by team decision without requiring a document revision.

**Application refresh vs provider cadence (LOCKED):** AeroTrace uses a consistent 30-second application refresh/revalidation cycle for current/near-real-time data across all seven target cities. This cycle represents application behaviour — how frequently AeroTrace re-queries its data sources. It does NOT guarantee upstream providers publish a new measurement every 30 seconds. Provider update cadences vary (CPCB may update every 15 min; Open-Meteo/CAMS on an hourly model cycle). Each reading must expose its actual source timestamp so users can distinguish when AeroTrace last checked from when the underlying measurement was recorded.

**Physical station vs model data (LOCKED):** A verified physical monitoring station is a real-world location where an actual instrument measures environmental conditions. Atmospheric model or gridded data (e.g., Open-Meteo/CAMS) represents estimated conditions from a computational model, not a physical instrument. These categories must remain distinct throughout the system: model-derived data may NOT automatically create a station entity, station pin, or station page. Only verified physical monitoring stations may be represented as station pins and navigated to via Screen 3.

---

## 2. Functional Requirements

### 2.1 India Map / National Overview (Screen 1)

**FR-001** [NEW] The system SHALL display an interactive India map as the application entry point.
**FR-002** [NEW] The system SHALL render AQI-status city pins for: Pune, Mumbai, Delhi, Bengaluru, Kolkata, Hyderabad, Chennai.
**FR-003** [NEW] City pins SHALL visually communicate AQI severity using the CPCB 6-band color system (Good=green, Satisfactory=lime, Moderate=yellow, Poor=orange, Very Poor=red, Severe=dark red).
**FR-004** [NEW] Clicking a city pin SHALL initiate a geographic zoom transition to Screen 2 for that city.
**FR-005** [NEW] The zoom transition SHALL use smooth map animation [PROPOSED: map.flyTo()]. NOT a page-load transition.
**FR-006** [NEW] City AQI values SHALL be derived from the current highest AQI reading across all available stations at time of display.
**FR-007** [NEW] Every city pin SHALL display a data timestamp and source label (e.g., "Updated 14 min ago | Open-Meteo"). When current data is unavailable from all real providers, the pin SHALL display an explicit unavailable or simulated state. It SHALL NOT present stale or simulated data as current.

---

### 2.2 City Intelligence (Screen 2)

**FR-010** [NEW] The system SHALL display a city-wide map showing all verified physical monitoring stations as AQI-severity-colored pins. Each pin represents a confirmed real-world monitoring station, not a model grid point or arbitrary coordinate. Where a city has no verified station metadata available, the system SHALL NOT invent station pins from model coordinates or city centroids.
**FR-011** [NEW] The system SHALL display city-wide AQI, PM2.5, and PM10 values with timestamp and data source label.
**FR-012** [NEW] The system SHALL display an AQI trend chart for time ranges: 24H, 7D, 30D. Where historical data is not available from real providers for a given range, the system SHALL display a "data not available for this range" state, not synthetic trend data.
**FR-013** [EXISTING->MODIFY] Verified physical monitoring station pins SHALL use AQI-severity-based color coding consistent with FR-003. The pin color communicates the current AQI severity observed at that verified station. Pins derived from model grid coordinates, city centroids, or simulated data SHALL NOT be styled as verified station pins.
**FR-014** [NEW] The city-level map SHALL NOT display wind cones. Wind cones appear at Screen 3 only.
**FR-015** [NEW] The system SHALL display a short AI-generated city insight (2-4 sentences) grounded in current data.
**FR-016** [NEW] The AI city insight SHALL include an "Ask AeroTrace ->" control opening Screen 9 with city context pre-loaded.
**FR-017** [NEW] A contextual floating alert SHALL appear if city AQI exceeds SPIKE_THRESHOLD (default: 150), with CTA.
**FR-018** [NEW] A contextual voice/read-aloud control SHALL allow the user to hear the AI city insight.
**FR-019** [NEW] Clicking a verified physical monitoring station pin SHALL initiate a geographic zoom transition to Screen 3 (Station Intelligence) for that station. Screen 3 SHALL only be entered for verified physical monitoring stations. A city-level view derived from model data alone does not constitute a station and SHALL NOT navigate to Screen 3.

---

### 2.3 Station Intelligence (Screen 3)

**FR-020** [EXISTING->MODIFY] The system SHALL display all available pollutant readings: PM2.5, PM10, NO2, SO2, CO, O3. Each reading SHALL include a timestamp and data source label.
**FR-021** [EXISTING->MODIFY] Each pollutant SHALL display: concentration, unit, NAAQS limit, exceedance factor, AQI sub-index.
**FR-022** [NEW] Historical trend charts for 24H, 7D, 30D. Where historical data is not available from real providers, display a "data not available" state.
**FR-023** [EXISTING->MODIFY] Display current wind conditions: speed, direction, Pasquill stability class.
**FR-024** [EXISTING] Display the wind cone/plume as a GeoJSON polygon overlay.
**FR-025** [EXISTING] Wind cone computed from app/pasquill.py with dynamic half-angle widening.
**FR-026** [NEW] Display detected anomalies and pollution events for the station.
**FR-027** [NEW] Short AI station insight with "Ask AeroTrace ->" linking to Screen 9 with station context.
**FR-028** [NEW] Contextual voice/read-aloud control for AI station insight.
**FR-029** [NEW] Pollutant selector: user chooses a specific pollutant to investigate, transitions to Screen 4.

---

### 2.4 Pollution Investigation / Source Attribution (Screen 4)

**FR-030** [EXISTING->MODIFY] Display full source attribution pipeline output. Attribution SHALL use current wind and pollutant data, not a frozen demo scenario.
**FR-031** [EXISTING] Display wind cone geometry on the map.
**FR-032** [EXISTING] Display ranked candidates: name, source type, confidence score (0.0-1.0), distance, bearing.
**FR-033** [EXISTING] Source types: construction, industrial, traffic, waste_burning.
**FR-034** [EXISTING] Confidence from app/scoring.py: wind alignment, proximity, chemical fingerprint, temporal match, compliance penalty.
**FR-035** [EXISTING] Display chemical fingerprint: PM2.5/PM10 ratio, NO2/SO2 ratio, signature class.
**FR-036** [EXISTING] Display localized action advisory in user's selected language (EN/HI/MR).
**FR-037** [EXISTING->MODIFY] Display compliance profile for top-ranked candidate. NOTE: compliance profiles currently exist for Pune stations only (app/demo_scenarios.py). Extension to all 7 cities is REQUIRED. Where data unavailable, display "compliance data not available for this city."
**FR-038** [EXISTING->MODIFY] Display field team assignment. NOTE: field team data currently Pune only. Extension or generic template for other cities is REQUIRED.
**FR-039** [NEW] "Predict Impact ->" CTA transitions to Screen 5, passing full context.
**FR-040** [NEW] AI forensic explanation summarizing attribution evidence.
**FR-041** [NEW] Contextual voice/read-aloud for AI forensic explanation.
**FR-042** [EXISTING] Confidence levels and evidence basis clearly communicated. Uncertain attributions labeled ambiguous.
**FR-043** [EXISTING] When no sources found in wind cone, display ambiguous result without fabricating attribution.

---

### 2.5 Prediction (Screen 5)

**FR-050** [NEW] Display forward pollution prediction anchored to current observed conditions.
**FR-051** [NEW] Predictions for time horizons: 1H, 3H, 6H.
**FR-052** [NEW] Use current wind data to project pollution movement as a trajectory on the map.
**FR-053** [NEW] Display: predicted AQI at each horizon, pollutant concentration range, wind-driven movement.
**FR-054** [NEW] Display forecast confidence/uncertainty bounds for all predictions.
**FR-055** [NEW] All prediction outputs labeled: "Estimated forecast - see methodology." Methodology accessible from this screen.
**FR-056** [NEW] Short AI explanation including key assumptions and limitations.
**FR-057** [NEW] "View Impact ->" CTA transitions to Screen 6.
**FR-058** [NEW] Retain full context: city / station / pollutant / source event.
**FR-059** [EXISTING->MODIFY] Existing 24H timeline/replay provides backward context. Forward prediction requires a new model [PROPOSED: simplified wind-trajectory + Pasquill dispersion].

---

### 2.6 Impact & Intervention (Screen 6)

**FR-060** [NEW] Display predicted affected zones derived from Screen 5 forecast.
**FR-061** [NEW] Display sensitive locations in affected zones where reliable data exists: schools, hospitals, residential areas.
**FR-062** [EXISTING->MODIFY] Sensitive location data from compliance profiles. Currently available for Pune only (app/demo_scenarios.py). Extension to all 7 cities is REQUIRED. Where not available, display "sensitive location data not available for this city."
**FR-063** [NEW] Display estimated exposure period for affected zones.
**FR-064** [NEW] Intervention simulator with types: Reduce traffic, Control construction dust, Reduce industrial emissions.
**FR-065** [NEW] Display projected AQI change for selected intervention.
**FR-066** [NEW] Intervention methodology documented and shown to user. Results labeled as estimates/projections. Methodology currently [UNKNOWN] — must be agreed before implementation.
**FR-067** [NEW] No hard-coded fictional intervention results. All results from a documented computational model.
**FR-068** [NEW] AI explanation of impact assessment.

---

### 2.7 Analytics & Trends (Screen 7)

**FR-070** [NEW] Dedicated analytics workspace reachable from global navigation.
**FR-071** [NEW] Analysis scope selector: India, City, Station, Pollutant.
**FR-072** [EXISTING->MODIFY] AQI history charts for: 24H (existing via /api/v1/stations/{station}/readings), 7D, 30D, 1Y. For 7D+ ranges: use real historical data from available providers where it exists. Where provider-supplied historical data does not cover a requested range for a given city, display "data not available for this range." The system SHALL NOT generate synthetic trend data to fill gaps.
**FR-073** [NEW] Pollutant concentration trend charts for: PM2.5, PM10, NO2, SO2, CO, O3.
**FR-074** [NEW] Detected anomalies and pollution events highlighted on trend charts.
**FR-075** [NEW] City comparison charts. Comparisons show only cities for which data exists in the selected range.
**FR-076** [NEW] Station comparisons within a city.
**FR-077** [NEW] AI-generated trend insights for selected scope and time range.
**FR-078** [NEW] System SHALL NOT fabricate historical data. If unavailable, display clear "data not available" state.

---

### 2.8 Alerts (Screen 8)

**FR-080** [EXISTING->MODIFY] Global alerts panel in navigation bar.
**FR-081** [EXISTING] Spike alerts via WebSocket when AQI > SPIKE_THRESHOLD (150).
**FR-082** [EXISTING->MODIFY] Contextual floating alerts on city selection with elevated AQI. Include: pollutant name, severity, affected station count, CTA.
**FR-083** [EXISTING->MODIFY] Station-specific contextual alerts when station has anomalies.
**FR-084** [NEW] Alert CTAs deep-link to Screen 4 (attribution) or Screen 5 (prediction).
**FR-085** [EXISTING] Alerts include: pollutant name, AQI value, severity category, timestamp, CTA.
**FR-086** [NEW] Alert preferences configurable in Settings.
**FR-087** [NEW] Contextual alerts dismissible. No permanent visual clutter.

---

### 2.9 AI Environmental Intelligence (Screen 9)

**FR-090** [NEW] Dedicated AI chat workspace in global navigation.
**FR-091** [NEW] AI chat accepts natural-language questions in EN, HI, MR.
**FR-092** [NEW] AI chat uses AeroTrace data as grounding context. The AI SHALL NOT fabricate data.
**FR-093** [NEW] When accessed from S2-S5, AI chat receives source screen's context without user repeating it.
**FR-094** [NEW] AI distinguishes data-grounded statements from inferred/estimated statements.
**FR-095** [NEW] AI responses in user's selected language (EN/HI/MR).
**FR-096** [NEW] Short AI summaries on Screens 2, 3, 4, 5, 7 with "Ask AeroTrace ->" link opening Screen 9.
**FR-097** [NEW] If AI service unavailable, degrade gracefully to template advisory from app/intelligence.py.
**FR-098** [NEW] Voice/read-aloud for AI summaries [PROPOSED: Web Speech API].

---

### 2.10 Settings

**FR-100** [NEW] Settings screen in global navigation.
**FR-101** [NEW] Appearance: Light Mode, Dark Mode, System.
**FR-102** [NEW] Theme applies to all screens, components, and map tile layer.
**FR-103** [NEW] Theme persists via localStorage.
**FR-104** [EXISTING->MODIFY] Language selection (EN/HI/MR) moved to Settings, applies globally.
**FR-105** [NEW] Voice & Accessibility: enable/disable read-aloud, voice speed.
**FR-106** [NEW] Alert preferences: enable/disable pollution alerts, severe AQI alerts, anomaly alerts.
**FR-107** [NEW] Map preferences: animation intensity (off/low/high).
**FR-108** [NEW] Only implemented settings shown. No placeholder features.

---

### 2.11 Global Navigation

**FR-110** [NEW] Persistent global navigation bar/menu.
**FR-111** [NEW] Navigation items: AeroTrace (home), Dashboard, Cities, Live Map, Analytics, Alerts, AI, Settings.
**FR-112** [NEW] Active screen visually indicated.
**FR-113** [NEW] Navigation accessible from all 9 screens.

---

### 2.12 Localization

**FR-120** [EXISTING] Support EN, HI, MR languages.
**FR-121** [EXISTING] Localization covers: navigation, UI labels, buttons, alerts, AI advisories, source type names.
**FR-122** [NEW] Localization extends to all new screens.
**FR-123** [NEW] AI chat responses in user's selected language.
**FR-124** [NEW] Voice output uses locale-appropriate language.

---

### 2.13 Data Requirements

#### Data Taxonomy

The following four data categories are distinct and must not be conflated:

| Category | Definition | Required UI label |
|---|---|---|
| Current / near-real-time | Readings from real sources, age <=60 min | "Source: [provider] - Updated X min ago" |
| Historical | Past readings from real providers or DB | "Source: [provider] - Historical data" |
| Forecast | Model-generated future projections | "Estimated forecast - See methodology" |
| Simulated / emergency fallback | Synthetic when ALL real sources fail | "SIMULATED - live source unreachable" |

#### Data Source Registry (all 7 cities):

| Source | Type | Coverage | Freshness | Limitations | Fallback role |
|---|---|---|---|---|---|
| CPCB Portal (app.cpcbccr.com) | Direct sensor measurement | India CAAQMS stations where online | 15-30 min | Unreliable API; SSL issues | Tier 1 (primary) |
| Open-Meteo Air Quality API | Atmospheric model (Copernicus CAMS) | Global - all 7 cities confirmed | ~1H model cycle | Model, not sensor; city-scale resolution | Tier 2 (primary practical fallback) |
| WAQI API | Aggregated 3rd-party | Global; needs station UIDs per city | ~15 min | Pune UIDs known; others [REQUIRES VERIFICATION] | Tier 3 |
| OSM Overpass API | Geographic feature data | Global | Static/6H | Not air quality data | Source discovery only |
| PostGIS database | Stored ingested readings | What has been ingested | As old as last ingest | Historical archive | Historical queries |
| Emergency simulation (app/sources/mock.py) | Deterministic synthetic | All cities if configured | Not real data | NOT real data; must be labeled | Emergency floor if all Tiers 1-3 fail |

#### Data Availability by City:

| City | Current data (T1-T3) | Historical (PostGIS) | Config status |
|---|---|---|---|
| Pune | [CONFIRMED] CPCB + Open-Meteo + WAQI UID known | [CONFIRMED] 4 stations, 7-day seed | [CONFIRMED] city_config.yml |
| Mumbai | [REQUIRES VERIFICATION] Open-Meteo confirmed; CPCB IDs [UNKNOWN]; WAQI UIDs [UNKNOWN] | [NEW PIPELINE REQUIRED] | [NEW - required] |
| Delhi | [REQUIRES VERIFICATION] Open-Meteo confirmed; CPCB IDs [UNKNOWN]; WAQI UIDs [UNKNOWN] | [NEW PIPELINE REQUIRED] | [NEW - required] |
| Bengaluru | [REQUIRES VERIFICATION] Open-Meteo confirmed; CPCB IDs [UNKNOWN]; WAQI UIDs [UNKNOWN] | [NEW PIPELINE REQUIRED] | [NEW - required] |
| Kolkata | [REQUIRES VERIFICATION] Open-Meteo confirmed; CPCB IDs [UNKNOWN]; WAQI UIDs [UNKNOWN] | [NEW PIPELINE REQUIRED] | [NEW - required] |
| Hyderabad | [REQUIRES VERIFICATION] Open-Meteo confirmed; CPCB IDs [UNKNOWN]; WAQI UIDs [UNKNOWN] | [NEW PIPELINE REQUIRED] | [NEW - required] |
| Chennai | [REQUIRES VERIFICATION] Open-Meteo confirmed; CPCB IDs [UNKNOWN]; WAQI UIDs [UNKNOWN] | [NEW PIPELINE REQUIRED] | [NEW - required] |

> **Open-Meteo / CAMS data integrity note:** Open-Meteo Air Quality API provides Copernicus CAMS atmospheric model data for any coordinates globally, confirmed available for all 7 cities at no API key cost. This is model-derived data, NOT direct physical sensor measurement. Implementation consequences: (1) label as 'Source: Open-Meteo/CAMS — atmospheric model' in all UI displays; (2) the coordinates used to query Open-Meteo are model grid query points, NOT verified physical monitoring station locations; (3) Open-Meteo/CAMS data SHALL NOT automatically create station entities, station pins, or station database records; (4) Open-Meteo/CAMS data may be used for city-level or regional environmental estimates and visualised appropriately as such.

#### Computed outputs:
- CPCB NAQI total AQI (integer, may exceed 500)
- AQI sub-index per pollutant
- AQI category (Good/Satisfactory/Moderate/Poor/Very Poor/Severe)
- Dominant pollutant
- Exceedance factor per pollutant (concentration / NAAQS limit, 2 decimal ROUND_HALF_UP)
- Chemical fingerprint: PM2.5/PM10 ratio, NO2/SO2 ratio, signature class
- Pasquill stability class (A-F)
- Wind cone GeoJSON polygon
- Ranked candidates list with confidence scores

#### Database schema (EXISTING - app/models.py):
- Table stations: UUID id, name, network, city, state, elevation_m, geom (PostGIS Point SRID:4326)
- Table aqi_readings: UUID id, station_id (FK), timestamp TZ, total_aqi, aqi_category, dominant_pollutant, pm25, pm10, no2, so2, co, o3 (Float nullable)
- Unique constraint: (station_id, timestamp) - 15-minute deduplication

#### API contracts (EXISTING - app/api.py):
- GET /health -> {status, version}
- GET /api/v1/attribution/{station_name}?live=bool -> Full 6-block contract
- GET /api/v1/stations -> [{name, city, state, network, coordinates, spike_aqi, dominant_pollutant}]
- GET /api/v1/stations/{station_name}/readings?limit=int -> [{timestamp, total_aqi, aqi_category, dominant_pollutant}]
- GET /api/v1/cone/{station_name}?wind_dir&wind_speed -> GeoJSON Feature (Polygon)
- GET /api/v1/sources -> {count, sources}
- GET /api/v1/timeline/{station_name} -> [{timestamp, aqi, was_spike, dominant_pollutant, wind_dir, wind_speed}]
- GET /api/v1/replay/{station_name}?timestamp=ISO -> Full attribution contract at historical time
- POST /api/v1/simulation/trigger-spike -> Full contract + broadcast (testing/demo tool)
- WS /api/v1/simulation/ws -> SPIKE_ALERT broadcast
- WS /ws -> Shorthand alias

#### New API endpoints required (NEW):
All new endpoints returning AQI or pollutant data SHALL include data_source and data_timestamp fields.

- GET /api/v1/cities -> [{name, coordinates, current_aqi, dominant_pollutant, station_count, data_source, data_timestamp}]
- GET /api/v1/cities/{city_name}/overview -> {city, stations, aggregated_aqi, pollutants, trend_summary, data_source, data_timestamp}
- GET /api/v1/cities/{city_name}/stations -> [{station details with current AQI, data_source, data_timestamp}]
  - This endpoint returns **verified physical monitoring stations only**. Model-derived data coordinates, city centroids, and unverified coordinates are not station records and do not appear in this endpoint.
  - Model-derived environmental data (e.g., Open-Meteo/CAMS) remains a separate concern and is not returned by this endpoint.
- GET /api/v1/prediction/{station_name}/{pollutant}?hours=6 -> [{timestamp, predicted_aqi, confidence_interval, affected_zone_geojson, methodology}]
- GET /api/v1/analytics?city&station&pollutant&range=24h|7d|30d -> {data_points, anomalies, trend_summary, data_availability_note}
- POST /api/v1/intervention/simulate -> {intervention_type, current_aqi, projected_aqi, confidence, methodology_notes, disclaimer}
- POST /api/v1/ai/chat -> {message, context} -> {response, language, confidence_note}

---

## 3. Non-Functional Requirements

### 3.1 Performance

**NFR-001** API attribution endpoint (cached): response < 2 seconds.
**NFR-002** Map tile loading: initial city map < 3 seconds on stable connection.
**NFR-003** Geographic zoom animation: smooth at 60fps.
**NFR-004** AI chat response: first token < 3 seconds; full response < 10 seconds.
**NFR-005** Chart rendering: < 1 second for 24H dataset.
**NFR-006** WebSocket spike alert broadcast latency < 500ms.

### 3.2 Scalability

**NFR-010** Backend SHALL support concurrent attribution requests for all 7 cities.
**NFR-011** GLOBAL_ROUTE_CACHE extended for multi-city with city-inclusive cache keys.
**NFR-012** City configuration system extended to all 7 cities following city_config.yml pattern.
**NFR-013** OSM Overpass rate-limited: 5s inter-request delay (EXISTING).

### 3.3 Security

**NFR-020** CORS open for hackathon demo (EXISTING).
**NFR-021** API keys (WAQI_TOKEN, Gemini key) in .env, never in source code. WAQI token currently hardcoded - MUST be moved.
**NFR-022** No authentication for NGEC 2026 demo scope.
**NFR-023** SSL verification disabled for CPCB Portal Proxy (EXISTING, known risk).

### 3.4 Reliability & Availability

**NFR-030** The system SHALL remain functional when any single external data source is unavailable. Fallback follows NFR-031 cascade. Emergency simulation is used only when ALL real Tiers 1-3 fail simultaneously and SHALL be labeled per FR-007.
**NFR-031** Data fallback cascade: Tier 1 CPCB Portal -> Tier 2 Open-Meteo Air Quality API -> Tier 3 WAQI (where UIDs configured) -> Emergency: deterministic simulation (labeled "SIMULATED - live source unreachable"). Each tier attempted before fallthrough. Emergency tier is not a normal operating state.
**NFR-032** WebSocket disconnections auto-reconnect (5s backoff - EXISTING in ws_client.js).
**NFR-033** AI service unavailability falls back to template advisory from app/intelligence.py.

### 3.5 Maintainability

**NFR-040** New screens follow existing code structure: separate component files, consistent state.
**NFR-041** New API endpoints follow FastAPI pattern in app/api.py.
**NFR-042** New city configurations addable via city config YAML without code changes.
**NFR-043** Source code includes docstrings/comments consistent with existing quality.

### 3.6 Accessibility

**NFR-050** Keyboard navigation for all interactive elements.
**NFR-051** AQI color indicators include text labels - not color alone.
**NFR-052** Voice read-aloud for AI summaries on all screens.
**NFR-053** Font sizes legible at standard browser zoom.
**NFR-054** Contrast ratios meet WCAG 2.1 AA for both light and dark themes.

### 3.7 Responsiveness

**NFR-060** Responsive for desktop: 1440px, 1280px, 1024px (primary target).
**NFR-061** Map fully functional on tablet viewports (768px+).
**NFR-062** Basic readability on mobile. Full map interaction secondary priority.

### 3.8 Data Freshness and Transparency

These requirements apply uniformly to ALL 7 cities. No city is exempt.

**NFR-070** AeroTrace SHALL use a consistent 30-second application refresh/revalidation cycle for current/near-real-time data across ALL 7 cities. This cycle applies uniformly to Pune and all six other cities — no city receives preferential polling. The 30-second cycle is application behaviour: how frequently AeroTrace re-queries its upstream sources via the Tier 1-3 fallback cascade. It does NOT imply that upstream providers produce a new measurement every 30 seconds; provider cadences vary. The actual source timestamp of each reading MUST be exposed in the UI alongside the source label, so users can distinguish 'AeroTrace checked 20 seconds ago' from 'the underlying measurement was recorded 45 minutes ago.'
**NFR-071** Attribution cache expires after 30 seconds (EXISTING - _ATTRIBUTION_TTL_S = 30.0). Applies to all cities.
**NFR-072** All 7 cities require current/near-real-time data from real providers. Emergency simulation SHALL NOT be used as a planned or normal operating state for any city. This requirement supersedes any prior statement in any document suggesting mock data is an acceptable default for non-Pune cities.
**NFR-073** Historical data (7D, 30D, 1Y) SHALL be sourced from real providers where available. Where historical data is not available from any real provider for a given city and time range, the system SHALL display a "data not available for this range" state. The system SHALL NOT generate synthetic historical data to present as real trend data. Historical data availability is [REQUIRES PROVIDER VERIFICATION] per the data availability table in Section 2.13.
**NFR-074** Every AQI or pollutant reading in the UI SHALL carry a visible timestamp and data source label.
**NFR-075** Any emergency simulation reading SHALL be visually distinguished (warning indicator, "SIMULATED" label). SHALL NOT appear with "LIVE" or "Current" indicators.
**NFR-076** Data older than 60 minutes without refresh triggers a staleness warning.
**NFR-077** Data source label SHALL accurately reflect provider used: "CPCB Portal", "Open-Meteo/CAMS (atmospheric model)", "WAQI", or "SIMULATED - live source unreachable".

### 3.9 Map Rendering

**NFR-078** [NEW] Only verified physical monitoring stations SHALL be rendered as station pins on the city-level map (Screen 2). The system SHALL NOT create station pins from atmospheric model grid coordinates, city centroids, arbitrary API coordinates, or simulated data coordinates. Model-derived environmental data may be visualised geographically (e.g., as a regional layer or city-level estimate) but must not be falsely presented as a physical monitoring station. The visual treatment of model-derived geographic data is [PROPOSED] — to be decided during the UI/UX design phase.
**NFR-079** [NEW] The stations database table (app/models.py) SHALL only contain verified physical monitoring stations with known real-world coordinates. A model grid point, city centroid, or arbitrary coordinate SHALL NOT be inserted as a station record to populate the map.

**NFR-080** Leaflet renders wind cone GeoJSON without visual artifacts.
**NFR-081** Station markers use custom SVG-based divIcons (EXISTING pattern).
**NFR-082** Leaflet coordinate convention: GeoJSON [lon, lat] from API, swapped to [lat, lon] for Leaflet (EXISTING).
**NFR-083** Map supports dark/light tile layer switching based on theme setting.

### 3.10 Observability

**NFR-090** Backend emits structured logs for: AQI fetch success/failure per source per city, attribution pipeline execution, WebSocket connections/disconnections, cache hits/misses, fallback activations.
**NFR-091** Log levels: INFO normal operations, WARNING fallback activations, ERROR pipeline failures.
**NFR-092** /health endpoint returns version and status.

---

## 4. Open Questions

1. **[HIGH PRIORITY - UNKNOWN]** Gemini API model? Architecture uses Gemini [PROPOSED] - team must confirm.
2. **[HIGH PRIORITY - UNKNOWN]** CPCB station IDs and WAQI UIDs for Mumbai, Delhi, Bengaluru, Kolkata, Hyderabad, Chennai? Required for Tier 1 and Tier 3 real data. Person 2 to research.
3. **[UNKNOWN]** Intervention simulation methodology? Required per FR-066/067 before implementation.
4. **[UNKNOWN]** Does Open-Meteo historical (CAMS Reanalysis) cover required date ranges for all 7 cities? Determines 7D/30D analytics feasibility from real data.
5. **[UNKNOWN]** Routing library? [PROPOSED: react-router-dom v6] - team to confirm.
6. **[UNKNOWN]** Charting library? [PROPOSED: Recharts] - team to confirm.
7. **[UNKNOWN]** Forward prediction model specifics? [PROPOSED: simplified wind-trajectory + Pasquill] - team to confirm and document before implementation.

---

## 5. Repository Evidence

| Requirement | Evidence |
|---|---|
| FR-024/025 Wind cone | app/cone_builder.py, app/pasquill.py |
| FR-031-034 Attribution | app/ranker.py, app/scoring.py |
| FR-035 Chemical fingerprint | app/models.py L185-233 |
| FR-036 Localized advisory | app/intelligence.py L153-216 |
| FR-037 Compliance profiles (Pune only - extension required) | app/demo_scenarios.py candidates[].compliance_profile |
| FR-038 Field team (Pune only - extension required) | app/api.py L1094-1143 |
| FR-042/043 Ambiguous results | app/intelligence.py L232-249 |
| FR-081 Spike broadcast | app/api.py L1156-1169 |
| NFR-031 3-tier fallback chain | app/api.py L133-337 |
| NFR-032 WS reconnect | frontend/src/ws_client.js L62-68 |
| NFR-071 Cache TTL | app/api.py L65 (_ATTRIBUTION_TTL_S = 30.0) |
| NFR-082 Coordinate convention | frontend/src/App.jsx L10-11 comments |
| Open-Meteo global coverage confirmed | app/api.py L228-284 (lat/lon params, global API) |
| Emergency simulation source | app/sources/mock.py |

---

## 6. Change Log

### v1.1 - 2026-09-19 (Second-pass audit)

| Item | v1.0 | v1.1 |
|---|---|---|
| FR-007 | "display mock data and visually indicate data source" | Replaced: display explicit unavailable/simulated state with clear label |
| FR-012, FR-022 | No historical availability caveat | Added: if unavailable from real providers, show "data not available" - not synthetic data |
| FR-030 | No data currency clause | Attribution grounded in current data, not frozen demo scenario |
| FR-037, FR-038 | Listed as EXISTING without scope caveat | Added: currently Pune only; extension to all 7 cities required |
| FR-072 | "24H EXISTING... 7D/30D/1Y where data exists" | Rewritten: requires real historical data; prohibits synthetic gap-filling |
| NFR-030 | "falling back to mock data" | Corrected: emergency simulation labeled; not normal operating state |
| NFR-031 | "-> WAQI climatology -> mock" | Renamed emergency tier; labeled as not normal state |
| NFR-070 | "Station AQI data for Pune" | Corrected: applies to ALL 7 cities |
| NFR-072 | "For non-Pune cities, mock data is acceptable" | REMOVED. All 7 cities require real data. Emergency simulation not planned operating state. |
| NFR-073 | "MAY use mock/seed data" | Corrected: real historical where available; "data not available" state for gaps |
| Section 2.13 | Mixed real and mock sources | Added: data taxonomy table, per-city availability matrix, source registry with type/limitations/role |
| Technology references | Named as requirements | Marked [PROPOSED] throughout |
| Open Questions | Framed some as "mock vs real" choice | Reframed: real data is the requirement; questions are about how/where to source it |


