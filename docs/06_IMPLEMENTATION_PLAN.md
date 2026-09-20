# AeroTrace NGEC 2026 — Implementation Plan

**Document version:** 1.1
**Date:** 2026-09-20
**Prepared by:** Technical Product Manager / Architect
**Status:** DRAFT — Ready for Execution

---

## 1. Purpose

This document provides a highly detailed, execution-ready parallel implementation plan for the AeroTrace NGEC upgrade by a 3-person team. The core objective of this plan is to **maximize genuinely independent work** (parallelism), define explicit API/data contracts, clarify responsibility boundaries, and provide clear merge/integration points.

## 2. Source of Truth / Planning Assumptions

- The **six finalized documents** in `docs/` (`00_DOCUMENTATION_STATUS.md`, `01_PRD.md`, `02_SRS.md`, `03_ARCHITECTURE.md`, `04_UI_UX.md`, `05_DEVELOPMENT.md`) are the primary product references.
- **Do not invent requirements** that are not supported by the docs or existing repository unless explicitly marked `[PROPOSED]`.
- Existing working functionality should be EXTENDED, MODIFIED, or REUSED rather than rebuilt.
- No simulated data can be presented as live/current.
- Only verified physical monitoring stations can be represented as station pins and navigate to Screen 3. Model grid points must NOT be rendered as station pins.
- All 7 cities require current/near-real-time data.
- 30-second application refresh/revalidation cycle across all 7 cities (distinct from provider update cadence).

## 3. Existing AeroTrace Baseline

Based on the repository inspection, the existing baseline is:
- **Frontend:** React 19 + Vite 8 SPA, Tailwind CSS 4, React-Leaflet 5. Single-screen UI (Pune only, `App.jsx`). Wind compass, timeline scrubber, custom SVG markers, and web socket client exist.
- **Backend:** FastAPI (v3.1.0) serving attribution for 4 Pune stations. CPCB NAQI calculation, Pasquill stability, wind cone generation, source ranking, and localized advisory.
- **Datastore:** PostGIS with `stations` and `aqi_readings` tables.
- **Providers:** CPCB Portal, Open-Meteo, WAQI climatology. OSM Overpass for source discovery.
- **Synthetic/Mock:** `MockIMDSource` for weather, deterministic simulation fallback.

## 4. Team Ownership

The team is intentionally divided by **SYSTEM OWNERSHIP**, not by screen.

### PERSON 1 — Adarsh (Backend + Data + Environmental Intelligence)
**Owns:** Multi-city data ingestion, provider availability research, CPCB station ID verification, WAQI UID verification, physical monitoring station verification, physical station coordinates, city/station configuration, current/near-real-time environmental data, current/near-real-time environmental data, CPCB/Open-Meteo/WAQI integration, real-data fallback hierarchy, 30-second application refresh, source timestamps, verified physical station registry, AQI normalization, historical data pipeline, real meteorological data (replacing `MockIMDSource`), wind calculations, plume/wind-cone calculations, source attribution backend, prediction backend, impact/intervention backend, FastAPI endpoints, PostGIS work, backend tests. Additionally owns: provider reliability, data freshness metadata, backend health (/health), fallback handling, API error handling, basic security (CORS, env vars, rate limiting), backend deployment, database/deployment verification, and production QA for backend.
**Must NOT own:** Primary frontend implementation, frontend visual design, map UI, frontend geographic transitions, map UI, analytics dashboard UI, AI chat UI.

### PERSON 2 — Priya (Frontend + Maps + Geographic Experience + UI/UX implementation)
**Owns:** Frontend architecture changes, global app shell, navigation, responsive layout, India overview, geographic transitions, map UI, verified physical station pins, AQI-severity station visualization, wind cone visualization, Screen 1-6 frontend experience, light/dark/system themes, settings UI, language UI, accessibility/voice UI, and frontend API integration. Additionally owns: Screen 0 (Landing Page), responsive design, loading/error/empty states, freshness/source transparency UI, methodology/source context UI, map and chart production readiness, accessibility basics, 404 page, favicon/metadata, deep-link SPA routing, frontend deployment, and final frontend QA.
**Must NOT own:** Provider integration, station ID/UID research, station verification/data registry, environmental fallback logic, fake/model station creation, inventing AQI formulas, attribution/prediction/intervention algorithms, fake station entities/coordinates, or environmental data provider logic.

### PERSON 3 — Anish (Analytics + AI + Alerts + Intelligence Experience)
**Owns:** Screen 8 (Alerts), Screen 9 (AI Chat), analytics interpretation, trend interpretation, anomaly presentation, anomaly presentation, contextual alerts logic/UI, AI environmental intelligence, grounded AI responses, context passing, multilingual AI response handling, AI insight/explanation UI on all screens, and related AI API integrations. Additionally owns: AI loading/error/retry states, AI grounding/context tracking, AI provider abstraction, alert UX behavior, contextual voice/read-aloud logic, AI failure/degradation handling, and intelligence QA. MYRAA TTS reference integration (P1).
**Must NOT own:** Environmental data ingestion, provider integration, CPCB/WAQI station verification, physical station registry, AQI calculations, source attribution calculations, prediction calculations, intervention calculations, environmental measurements, historical datasets, prediction outputs, source attribution results, or station entities.

## 5. Responsibility Boundaries

A screen may have multiple contributors, but one clear owner per implementation layer.
*Example - Screen 4 (Pollution Investigation):*
- **Adarsh:** Provides source attribution logic, data, and API.
- **Priya:** Implements the investigation UI, map layer, and geographic interaction.
- **Anish:** Implements the AI forensic explanation and insight integration.

## 6. Dependency Map

```text
Adarsh (Backend)                   Priya (Frontend)                   Anish (AI/Analytics)
================                   ================                   ====================
[INDEPENDENT]                      [INDEPENDENT]                      [INDEPENDENT]
Setup DB, Environment              App shell, Routing, Map Context    AI Router setup, Gemini key validation
Station configs (6 new cities)     Screen placeholders, Theme Context AI chat basic endpoints

[CONTRACT-DEPENDENT]               [CONTRACT-DEPENDENT]               [CONTRACT-DEPENDENT]
/cities API (Mockable)      <----> Screen 1 & 2 UI (using mock)
/stations API (Mockable)    <----> Screen 2 Map pins (using mock)
                                                                      AiInsightCard UI <----> AI logic endpoints

[INTEGRATION-DEPENDENT]
MERGE POINT 1: Core Navigation and City Data Integration

[INDEPENDENT]                      [INDEPENDENT]                      [INDEPENDENT]
Replace MockIMDSource              Refactor Screen 4 (Attribution)    Alert logic/rules
Prediction backend                 Screen 3 UI (Station)              Screen 7 UI (Analytics)

[CONTRACT-DEPENDENT]               [CONTRACT-DEPENDENT]               [CONTRACT-DEPENDENT]
/analytics API              <----> Trend charts in UI          <----> Screen 7 charts
/prediction API             <----> Screen 5 (Prediction) UI    <----> AI prediction explanation
/intervention API           <----> Screen 6 (Impact) UI        <----> AI impact assessment

[INTEGRATION-DEPENDENT]
MERGE POINT 2: Geographic Journey and AI Integration
```

## 7. Parallel Work Strategy

To maximize independent work, tasks are classified as:
- **`[INDEPENDENT]`**: Can be completed with zero dependencies on another's unfinished work.
- **`[CONTRACT-DEPENDENT]`**: Can proceed independently using agreed-upon API/data contracts (using development-only mocks/stubs matching the exact contract).
- **`[INTEGRATION-DEPENDENT]`**: Genuinely requires another person's implementation.

## 8. Phase-by-Phase Implementation Plan

### PHASE 1: Setup, Contracts & Landing Skeleton (Day 1)
- **Adarsh [INDEPENDENT]**: Verify PostGIS, move WAQI_TOKEN to .env. Create city_configs/. Define API JSON contracts for /cities and /stations. Implement basic security (CORS, env vars, server-side keys) and /health observability endpoint.
- **Priya [INDEPENDENT]**: Setup eact-router-dom, echarts, extract I18N. Build routing skeleton including Screen 0 (Landing Page) and 404 page. Setup frontend deployment configuration and SPA deep-link routing.
- **Anish [INDEPENDENT]**: Build/verify AI service abstraction and integration boundary (context schema, loading/error states).

### PHASE 2: Core Data & Intelligence Foundations (Day 2)
- **Adarsh [INDEPENDENT]**: Research/create configs for 6 new cities (physical stations only). Implement /cities and /stations APIs with data freshness and source transparency metadata. Handle provider cascades and graceful API error responses.
- **Priya [CONTRACT-DEPENDENT]**: Build Screen 0 (Landing Page) product intro/problem framing. Build Screen 1 (India Map) and Screen 2 (City Map) UI with map loading/error states, responsive behavior, and basic source transparency indicators.
- **Anish [INDEPENDENT]**: Implement POST /api/v1/ai/chat (basic). Set up AI context extraction logic and provider abstraction.
- **MERGE POINT 1:** Core Navigation and City Data Integration.

### PHASE 3: Station, Charts & Analytics (Day 3)
- **Adarsh [INDEPENDENT]**: Implement nalytics.py and GET /api/v1/analytics returning historical data or explicit 'unavailable' states. Optimize 30-second revalidation loop.
- **Priya [INDEPENDENT]**: Build Screen 3 (Station Intelligence). Implement chart production readiness (loading/empty states, tooltips, responsive). Implement methodology context UI popovers.
- **Anish [INDEPENDENT]**: Build Screen 7 (Analytics) UI. Implement alert logic engine and active/no-alert UX behaviors.
- **Priya [CONTRACT-DEPENDENT]**: Wire trend charts in Screen 3 and Screen 7 to /analytics contract.

### PHASE 4: Investigation & Attribution (Day 4)
- **Adarsh [INDEPENDENT]**: Replace MockIMDSource with real Open-Meteo meteorological data. Enhance source attribution backend.
- **Priya [INDEPENDENT]**: Refactor Screen 4 (Pollution Investigation) UI. Ensure mobile map controls and AQI severity legends are accessible.
- **Anish [CONTRACT-DEPENDENT]**: Connect Screen 4 AI Forensic explanation to Adarsh's attribution output. Implement factual vs estimated AI distinctions.
- **MERGE POINT 2:** Investigation and Analytics Integration.

### PHASE 5: Prediction, Impact & Alerts (Day 5)
- **Adarsh [PROPOSED / BLOCKED UNTIL METHODOLOGY CONFIRMED]**: Confirm prediction methodology. Once confirmed, implement prediction backend exposing methodology metadata.
- **Adarsh [INDEPENDENT]**: Implement intervention.py methodology, impact calculations, and POST /api/v1/intervention/simulate.
- **Priya [INDEPENDENT]**: Build Screen 5 (Prediction) map trajectory UI and Screen 6 (Impact) map layers, controls.
- **Anish [INDEPENDENT]**: Build Screen 9 (AI Chat) UI. Wire multilingual AI responses. Implement P1 contextual voice/read-aloud using MYRAA as a technical reference (TTS only, no desktop/Electron features). Include basic loading/playing/stop/failure states and ensure graceful degradation to text if audio fails.
- **Anish [CONTRACT-DEPENDENT]**: Wire AI explanations for Prediction and Impact.
- **MERGE POINT 3:** Integrate Prediction and Intervention flows.

### PHASE 6: Integration, Polish & Deployment Prep (Day 6)
- **Adarsh [INTEGRATION-DEPENDENT]**: Ensure attribution cache handles 7 cities. Validate safe production error responses and no exposed secrets.
- **Priya [INTEGRATION-DEPENDENT]**: Polish geographic transitions, deep-link routing/refresh handling, basic product branding (favicon, metadata, OG). Implement accessibility basics (keyboard focus, contrast, labels).
- **Anish [INTEGRATION-DEPENDENT]**: Verify AI failure gracefully degrades without breaking core app.
- **MERGE POINT 4:** Full End-to-End System Integration.

### PHASE 7: Production QA & Demo Readiness (Day 7)
- **Adarsh**: Verify APIs, 7 cities fallback, physical station integrity, backend health, production config. Ensure simulation is explicitly labeled DEMO SCENARIO or SIMULATED.
- **Priya**: Verify end-to-end journey (Landing → Impact), responsive UI, loading/error states, map behavior, routing, visual consistency, and deployment.
- **Anish**: Verify AI context, grounding, analytics interpretation, alerts, multilingual, and AI failure handling.
- **Team**: Run complete end-to-end journey together.

## 9. API/Data Contract Dependencies

API contracts must be agreed and documented before LIVE frontend-backend integration, but frontend development may proceed independently using development-only mocks/stubs/adapters that exactly match the agreed contract.

1. **`GET /api/v1/cities`**
   - **Owner:** Adarsh | **Consumer:** Priya (Screen 1)
   - **Required fields:** `name`, `coordinates`, `current_aqi`, `data_source`, `data_timestamp`.
2. **`GET /api/v1/cities/{city}/stations`**
   - **Owner:** Adarsh | **Consumer:** Priya (Screen 2)
   - **Required fields:** `station_id`, `name`, `coordinates`, `current_aqi`, `data_source`, `data_timestamp`.
   - **CRITICAL:** Returns VERIFIED PHYSICAL MONITORING STATIONS ONLY. No model grid points.
3. **`GET /api/v1/analytics`**
   - **Owner:** Adarsh | **Consumer:** Priya, Anish (Screens 3, 7)
   - **Required fields:** `data_points`, `trend_summary`, `data_availability_note`.
4. **`GET /api/v1/prediction/{station}/{pollutant}`**
   - **Owner:** Adarsh | **Consumer:** Priya, Anish (Screen 5)
   - **Required fields:** `timestamp`, `predicted_aqi`, `confidence_interval`, `affected_zone_geojson`, `methodology`.
5. **`POST /api/v1/intervention/simulate`**`n   - **Owner:** Adarsh (Logic and API) | **Consumer:** Priya, Anish (Screen 6)

## 10. Merge Points (Explicit Integration)

| Merge Point | When | Adarsh Deliverable | Priya Deliverable | Anish Deliverable | Integration Test |
|---|---|---|---|---|---|
| **MP1: Core Data** | End Phase 1 | `/cities`, `/stations` APIs live | Screen 1 & 2 Maps ready | AI Insight Card ready | India map loads 7 cities. Click city zooms to map with physical station pins. AI card renders. |
| **MP2: Investigation** | End Phase 2 | Open-Meteo weather live, `/analytics` live | Screen 3 & 4 routing and charts ready | Screen 7 UI, AI attribution logic | Station charts load. Attribution renders with real weather data. S4 AI text accurate. |
| **MP3: Prediction & Intervention** | End Phase 3 | /prediction (post-confirmation), /intervention/simulate | Screen 5 & 6 UI, controls, impact maps | Screen 9 UI, AI explanations for S5/S6 | Prediction trajectory renders. Intervention impacts AQI visually. AI explanations connect across all 3 layers. |
| **MP4: System Polish** | End Phase 4 | Scaled caches, DB stable | Fluid transitions, A11y, Themes | AI Grounding fixed, Alerts fire | Full geographic journey from India -> Intervention works without UI/API breaking. |

## 11. Git/Branch Strategy

- `main`: Stable, deployable.
- `develop`: Primary integration branch.
- **Branch Naming**: `feat/p1-india-map`, `fix/p2-cpcb-poller`, `feat/p3-ai-router`.
- **Merge Rules**: 
  - Never commit directly to `develop` or `main`.
  - Rebase feature branches frequently against `develop`.
  - PRs require at least one reviewer.
  - Coordinate via daily sync before touching shared files.

## 12. Shared-File Conflict Prevention

| File/Area | Primary Owner | Secondary | Prevention Strategy |
|---|---|---|---|
| `App.jsx` / Router | Priya | Anish | Priya finishes routing skeleton in Phase 1 before Anish mounts Screen 7/9 components. |
| `app/api.py` | Adarsh | Anish | Adarsh owns `api.py`. Anish places AI logic in `ai_router.py` and `intervention.py`. Adarsh simply mounts the routers. |
| `api_client.js` | Priya | Anish | Agree on standard fetch wrapper. Add individual screen methods independently. |

## 13. Testing Strategy

- **Adarsh:** API contract tests, provider fallback unit tests, station integrity verification (ensure no model coordinates in PostGIS), refresh/revalidation tests.
- **Priya:** Map interaction tests, responsive layout checks, light/dark mode and EN/HI/MR visual validation.
- **Anish:** AI grounding tests (feed mock context, ensure no hallucinations), alert trigger tests.
- **Team (E2E):** Fallback cascade validation. Ensure source metadata reflects actual provider. Validate no fake stations appear.

## 14. Acceptance Criteria (Examples)

- **City Overview:** `/cities/{city}/overview` returns current AQI, PM2.5, PM10, data source, and source timestamp for the requested city.
- **Station Integrity:** UI renders ONLY verified physical stations as pins. Model grid points do not render as pins.
- **Fallback:** When CPCB fails, Open-Meteo is used, label updates to 'Source: Open-Meteo/CAMS'.
- **Simulation:** Simulation triggers only if CPCB, Open-Meteo, and WAQI all fail. Must visibly display 'SIMULATED — live source unreachable'.
- **Refresh Cadence:** Application re-queries every 30 seconds without freezing UI, updating actual source timestamps only when providers update.

## 15. Risks / Blockers

- **Blocker:** CPCB station IDs and WAQI UIDs for 6 new cities (`[UNKNOWN]`). **Adarsh must research immediately in Phase 1**, or real data cannot flow.
- **Risk:** AI Provider integration. Gemini remains [PROPOSED] (and existing in some forms), but Anish can independently build AI context schema, service abstractions, and UI using mocked contracts until the production provider is confirmed.
- **Risk:** Routing conflicts in `App.jsx`. Mitigated by strict ownership in Phase 1.

## 16. `[UNKNOWN]` / `[PROPOSED]` Decisions (Requiring Team Confirmation)

- `[PROPOSED]` UI Libraries: `react-router-dom v6` and `recharts`.
- `[PROPOSED]` AI Provider: Gemini API.
- `[PROPOSED]` Prediction formula: `AQI_t = AQI_current * exp(-k*t)`.
- `[PROPOSED]` Intervention ERF factors: 0.25, 0.35, 0.30.
- `[UNKNOWN]` Prediction k-values by Pasquill class.
- `[UNKNOWN]` Open-Meteo CAMS Reanalysis historical coverage for 7D/30D data.

## 17. Definition of Done
1. Code on `develop` via approved PR.
2. API meets agreed JSON contract.
3. No fake stations or fake historical data implemented.
4. Source timestamp and data source label visibly rendered.
5. Works in Light/Dark mode and EN/HI/MR.
6. Does not contradict the 6 finalized planning documents.

## 18. Compact Task Reference

| Work Item | Owner | Consumer | Class | Dependency | Integration Point |
|---|---|---|---|---|---|
| /cities API | Adarsh | Priya | `[NEW]` | None | MP1 |
| /stations API | Adarsh | Priya | `[NEW]` | None | MP1 |
| Route skeleton | Priya | Team | `[NEW]` | None | MP1 |
| AI Service Integration | Anish | Priya | `[EXTEND]` | None | MP1 |
| Replace MockIMDSource| Adarsh | Adarsh | `[REPLACE]`| None | MP2 |
| Screen 4 Refactor | Priya | Team | `[MODIFY]` | /attribution API| MP2 |
| /analytics API | Adarsh | Priya/Anish| `[NEW]` | Hist. Data Source| MP2 |
| Screen 7 Analytics | Anish | Team | `[NEW]` | /analytics API | MP2 |
| /prediction API | Adarsh | Priya/Anish| `[NEW]` | Formula values | MP3 |
| Screen 5 UI | Priya | Team | `[NEW]` | /prediction API | MP3 |
| Intervention backend | Adarsh | Priya/Anish | `[NEW]` | Methodology | MP3 |










