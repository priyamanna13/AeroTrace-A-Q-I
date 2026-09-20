# AeroTrace NGEC 2026 — Documentation Status

**Documentation version:** 1.3
**Repository snapshot date:** 2026-09-18
**Second-pass audit date:** 2026-09-19
**Third-pass clarification date:** 2026-09-19
**Prepared by:** Senior Product Architect / Principal Engineer (AI planning agent)
**Status:** DRAFT — Awaiting team review and sign-off

---

## 1. Document Index

| Document | Path | Version | Status | Owner |
|---|---|---|---|---|
| Documentation Status (this file) | docs/00_DOCUMENTATION_STATUS.md | 1.3 | DRAFT | All |
| PRD — Product Requirements | docs/01_PRD.md | 1.2 (third-pass) | DRAFT | Product Lead |
| SRS — Software Requirements | docs/02_SRS.md | 1.2 (third-pass) | DRAFT | Tech Lead |
| Architecture | docs/03_ARCHITECTURE.md | 1.2 (third-pass) | DRAFT | Tech Lead / All |
| UI/UX Planning | docs/04_UI_UX.md | 1.2 (third-pass) | DRAFT | Person 1 (Frontend) |
| Development Plan | docs/05_DEVELOPMENT.md | 1.2 (third-pass) | DRAFT | All |
| Implementation Plan | docs/06_IMPLEMENTATION_PLAN.md | 1.1 | DRAFT — Ready for Execution | All |

---

## 2. Confirmed Existing Capabilities

The following capabilities are CONFIRMED to exist in the current AeroTrace repository
based on direct code inspection of the files listed.

### Backend (app/)
| Capability | File Evidence |
|---|---|
| FastAPI application, version 3.1.0 | app/api.py L368 |
| CPCB NAQI calculation (6 pollutants, 6 bands, > 500 extrapolation) | app/standards.py |
| NAAQS 24H limits: PM2.5=60, PM10=100, NO2=80, SO2=80, CO=4, O3=100 | app/standards.py L34-41 |
| Chemical fingerprint: PM2.5/PM10 + NO2/SO2 ratios | app/models.py L185-233 |
| Pasquill stability classification A-F | app/pasquill.py |
| Wind cone: GeoJSON polygon, dynamic half-angle widening | app/cone_builder.py |
| OSM Overpass discovery: industrial, construction, traffic, waste_burning | app/overpass_client.py |
| Source ranking: wind alignment, proximity, chemical, temporal, compliance | app/ranker.py, app/scoring.py |
| Enforcement priority, recommended actions, localized advisory EN/HI/MR | app/intelligence.py |
| 4 Pune station attribution scenario configs: Shivajinagar, Swargate, Hadapsar, Kothrud | app/demo_scenarios.py |
| 3-tier AQI data fallback: CPCB Portal -> Open-Meteo -> WAQI climatology | app/api.py L133-337 |
| Emergency simulation source (app/sources/mock.py) as fallback of last resort | app/sources/mock.py |
| Wet-scavenging (rain -> AQI reduction) | app/api.py L457-461 |
| 30s route cache (GLOBAL_ROUTE_CACHE) | app/api.py L63-65 |
| WebSocket connection manager and SPIKE_ALERT broadcast | app/api.py L37-57 |
| WAQI background poller (cpcb_poller.py), 30s interval | app/cpcb_poller.py |
| 24H timeline endpoint | app/api.py L831-886 |
| Historical replay endpoint | app/api.py L889-900 |
| Simulation spike trigger endpoint (testing/demo tool) | app/api.py L1033-1171 |
| PostGIS schema: stations (POINT SRID:4326, GIST), aqi_readings | app/models.py |
| SQLite fallback for tests/dry-run | app/models.py L44-46 |
| pydantic-settings config, .env support | app/config.py |
| city_config.yml for Pune only (CPCB IDs, Overpass bbox, thresholds) | city_config.yml |
| Docker Compose: PostGIS + FastAPI | docker-compose.yml |
| 53 passing tests (no PostGIS required) | tests/ (README.md) |
| Open-Meteo global API coverage (all 7 cities, no key required) | app/api.py L228-284 |

### Frontend (frontend/src/)
| Capability | File Evidence |
|---|---|
| React 19 + Vite 8 SPA | frontend/package.json |
| Tailwind CSS 4 | frontend/package.json |
| React-Leaflet 5 + Leaflet 1.9 | frontend/package.json |
| Dark theme (#08080a base) | App.jsx L90 |
| 72/28 map/sidebar layout | App.jsx L100-155 CSS |
| Custom SVG divIcon markers | App.jsx L399-533 |
| Wind cone GeoJSON overlay rendering | map_layers.js, App.jsx |
| Wind compass SVG widget | App.jsx L618-700+ |
| Live status badge, Met data badge | App.jsx L124-146 |
| CSS keyframe animations: ping, pulse, plumeFlow, needleSway, slideInRight, yellowGlow | App.jsx L36-84 |
| EN/HI/MR i18n dictionary | App.jsx L230-284 |
| Language switcher (3 tabs in sidebar) | App.jsx L178-181 |
| AQI category color mapper (6 bands) | App.jsx L382-390 |
| 24H replay slider (timeline scrubber) | App.jsx |
| MapCameraController: flyTo on source selection | App.jsx L587-607 |
| WebSocket client with auto-reconnect (5s) | ws_client.js |
| Centralized API client | api_client.js |
| Modular map layer renderer (3 layers) | map_layers.js |

---

## 3. Confirmed Absent Capabilities

The following do NOT currently exist in the repository:

| Capability | Verification |
|---|---|
| Multi-city support (other than Pune) | demo_scenarios.py has only 4 Pune station configs |
| India-level map screen (Screen 1) | Not in App.jsx |
| Screen 5 (Prediction) | Not in App.jsx or any backend |
| Screen 6 (Impact & Intervention) | Not in App.jsx or any backend |
| Screen 7 (Analytics) as dedicated screen | Not in App.jsx |
| Screen 9 (AI Chat) | Not in App.jsx; intelligence.py is template-only |
| Settings screen | Not in App.jsx |
| Light theme | Only dark background in all CSS |
| react-router-dom | Absent from frontend/package.json |
| Recharts | Absent from frontend/package.json |
| AI API integration (Gemini or other) | Absent from requirements.txt and all Python files |
| Forward prediction model | No prediction.py or equivalent |
| Intervention simulator | No intervention.py or equivalent |
| Global navigation bar | No multi-screen nav in App.jsx |
| Breadcrumb navigation | Not present |
| Multi-city API endpoints (/api/v1/cities) | Not in api.py |
| 7D/30D historical aggregation endpoint | Not in api.py (only 24H via readings + timeline) |
| WAQI token in .env | Hardcoded in api.py L288 and cpcb_poller.py L24 |
| City configs for Mumbai, Delhi, Bengaluru, Kolkata, Hyderabad, Chennai | No city YAML for these cities |
| CPCB station IDs for non-Pune cities | Not in any config file |
| WAQI station UIDs for non-Pune cities | Not in any config file |
| Compliance profiles / field team data for non-Pune cities | Only in demo_scenarios.py for Pune |
| Data timestamp / source label display in UI | Not in current frontend |

---

## 4. Unresolved Questions

These must be resolved by the team before or during development.

| # | Question | Urgency | Assigned to |
|---|---|---|---|
| Q1 | Is a Gemini API key available? Which model? (AI integration marked [PROPOSED: Gemini] — key needed for Phase 1P3) | HIGH | Person 3 |
| Q2 | What are the CPCB station IDs and WAQI UIDs for representative stations in Mumbai, Delhi, Bengaluru, Kolkata, Hyderabad, Chennai? Real data is required for all cities — this is a configuration task, not a design choice. | HIGH | Person 2 |
| Q3 | What is the forward prediction model? [PROPOSED: simplified wind-trajectory + Pasquill dispersion] — team must document and agree specific formula and k-values before implementation. | MEDIUM | Person 2/3 |
| Q4 | What is the intervention simulation methodology? Required per FR-066/067 before any implementation begins. | MEDIUM | Person 3 |
| Q5 | What routing library for multi-screen navigation? [PROPOSED: react-router-dom v6] — team to confirm. | LOW | Person 1 |
| Q6 | What charting library? [PROPOSED: Recharts] — team to confirm. | LOW | Person 1 |
| Q7 | Move WAQI token from hardcode to .env — must happen before any push to a shared/public repo. | HIGH — security | Person 2 |
| Q8 | What is the NGEC demo environment? (Local laptop, cloud VM, ngrok tunnel?) | HIGH — demo prep | All |
| Q9 | Is Open-Meteo CAMS Reanalysis (historical atmospheric data) available and complete for all 7 cities for 7D/30D analytics? This determines whether real historical data can be shown. | MEDIUM | Person 2 |
| Q10 | Is Kannada localization needed for Bengaluru city? | LOW | All |
| Q11 | Are sensitive location data (schools, hospitals) available for Mumbai, Delhi, Bengaluru, Kolkata, Hyderabad, Chennai? Currently only Pune has this in demo_scenarios.py. | MEDIUM | Person 2 |

---

## 5. Cross-Document Consistency Audit (First Pass — 2026-09-18)

### PRD <-> SRS
- All 9 screens in PRD covered in SRS FRs.
- Feature status labels consistent.
- Performance NFRs align with product principles.

### SRS <-> Architecture
- FR-050-059 (Prediction) align with Architecture Section 2.5.
- FR-060-068 (Intervention) align with Architecture Section 2.6.
- New API routes match between SRS Section 2.13 and Architecture Section 2.3.

### Architecture <-> Development
- Component status register matches development task assignments.
- Phase 1 backend tasks align with new modules in Architecture Section 2.3.
- ADR-001 through ADR-006 reflected in Development risk management.

### UI/UX <-> PRD
- All 9 screens have UX design briefs.
- "No wind cones on city map" consistent.
- Voice placement, AI card placement consistent.
- Light/dark mode and EN/HI/MR requirements in both documents.

### UI/UX <-> Architecture
- Component structure, ThemeContext, LanguageContext, NavigationContext consistent.

---

## 6. Second-Pass Consistency Audit — 2026-09-19

### Purpose

This section documents contradictions found in the second-pass audit and the corrections made. It also records which requirements are now locked and which still require team decision.

### Contradictions Found and Corrected

| # | Document | Location | Contradiction | Correction Applied |
|---|---|---|---|---|
| C1 | SRS | FR-007 | "display mock data and visually indicate data source" — implied mock data is the normal fallback state | Replaced: system must display an explicit unavailable/simulated state with clear labeling. Never present simulated data as current. |
| C2 | SRS | NFR-070 | "Station AQI data for Pune SHALL be refreshed every 30 seconds" — applied only to Pune | Corrected: applies to all 7 cities equally. |
| C3 | SRS | NFR-072 | "For non-Pune cities in NGEC 2026 demo scope, mock data is acceptable." | REMOVED. Replaced with: all 7 cities require real data from real providers. Emergency simulation is not planned operating state for any city. |
| C4 | SRS | NFR-073 | "Historical trend data MAY use mock/seed generated data; clearly labeled." | Corrected: real historical data from providers where available; 'data not available' state where unavailable; no synthetic historical trend data presented as real. |
| C5 | SRS | NFR-030 | "falling back to mock data" | Corrected: emergency simulation fallback, labeled. Not a normal state. |
| C6 | SRS | NFR-031 | "CPCB -> Open-Meteo -> WAQI climatology -> mock" — "mock" named as end of normal fallback | Renamed: "Emergency: deterministic simulation (labeled as SIMULATED)". Added: emergency tier is not normal operating state. |
| C7 | SRS | Section 2.13 | Data sources mixed real and synthetic without taxonomy | Added: data taxonomy table (current/historical/forecast/simulated), per-city data availability matrix, source registry with type/coverage/limitations/role. |
| C8 | SRS | Open Questions | Q4 asked "will 6 new cities use parametric mock data?" — framed as a valid option | Removed that framing. Real data is required; the question is how and where to source it per city. |
| C9 | SRS | Open Questions | Q6 "mock-generated or real APIs?" | Reframed: real data required; question is whether Open-Meteo historical coverage is sufficient. |
| C10 | Architecture | Section 2.2 | react-router-dom and recharts listed as decisions without PROPOSED qualifier | Marked [PROPOSED]. |
| C11 | Architecture | Section 2.1 | "Gemini API calls" listed as if final decision | Marked [PROPOSED: Gemini]. |
| C12 | Architecture | Section 2.4 | "Gemini" named without PROPOSED qualifier | Marked as PROPOSED. |
| C13 | Architecture | Section 2.5 | Prediction formula and k-values stated without PROPOSED qualifier | Marked [PROPOSED]; added requirement to document and agree k-values before implementation. |
| C14 | Architecture | Section 2.6 | ERF values (0.25, 0.35, 0.30) stated without PROPOSED qualifier | Marked [PROPOSED — requires team validation]. |
| C15 | Architecture | Open Question 1 | "Will 6 new cities use real Open-Meteo data or purely mock data?" — framed as an open question | Resolved: all 6 new cities SHALL use real data. Question reframed as: which CPCB IDs and WAQI UIDs are available per city? |
| C16 | Architecture | Component register | demo_scenarios.py MODIFY described as "Add 6 new city scenarios" — sounds like mock | Corrected: "Add station profiles and attribution configs for 6 new cities. Not mock AQI data." |
| C17 | Development | Phase 1 P2 | "Add 6 new city demo scenarios in demo_scenarios.py" — sounded like adding mock scenarios | Corrected: these are attribution scenario configs, not mock AQI data. |
| C18 | Development | Phase 2 P2 | "Seed 7-day historical data for all 7 cities" — implied synthetic seeding is the plan | Replaced: investigate real historical sources; seed only for test/CI; implement 'data not available' state for missing real data. |
| C19 | Development | Phase 3 P2 | "Extend mock data to support 30D analytics range for all cities" | Replaced: extend real historical data pipeline; implement 'data not available' state for gaps; no synthetic 30D data. |
| C20 | Development | Phase 4 | "Integration testing: full flow with real Pune data" | Corrected: "with real data for all configured cities." |
| C21 | Development | Risk table | "CPCB unavailable -> Open-Meteo fallback + mock deterministic data" | Corrected: Tier 2 Open-Meteo covers all 7 cities; emergency simulation is last resort only, labeled. |
| C22 | Development | Phase 5 | "Have mock data fallback ready for all cities" | Corrected: verify emergency simulation fallback works and is labeled if it activates. |
| C23 | Development | Open Question 3 | "Should analytics use seeded mock data or real APIs?" | Reframed: real data required; question is Open-Meteo historical coverage. |
| C24 | Development | Dependencies | react-router, recharts, Gemini listed as decisions | Marked [PROPOSED] throughout. |
| C25 | UI/UX | Section 9 | "Charting library: Recharts (to be installed)" — stated as if decided | Marked [PROPOSED]. Note that the UX requirement is the functional need for charts, not the specific library. |
| C26 | UI/UX | Screens 1, 2 | No data freshness UX requirements (timestamp/source label display) | Added data freshness UX notes to Screen 1 and Screen 2 briefs. |

### Requirements Now Locked (Do Not Change Without Team Agreement)

| Requirement | Status |
|---|---|
| All 7 cities require current/near-real-time data from real providers | LOCKED |
| Emergency simulation is not a planned operating state for any city | LOCKED |
| Any emergency simulation reading must be labeled "SIMULATED - live source unreachable" | LOCKED |
| Every AQI reading must carry a timestamp and data source label | LOCKED |
| Data older than 60 minutes triggers a staleness warning | LOCKED |
| System must not generate synthetic historical data to present as real trend data | LOCKED |
| When data is unavailable, display "data not available" state — not synthetic data | LOCKED |
| Screen architecture: 9 screens as defined in PRD Section 9 | LOCKED |
| Global navigation: Dashboard, Cities, Live Map, Analytics, Alerts, AI, Settings | LOCKED |
| Settings: Light mode, Dark mode, Language (EN/HI/MR), Voice/accessibility, Alert preferences, Map preferences | LOCKED |
| UI/UX document does NOT finalize: logo, fonts, color palette, visual identity, component styling | LOCKED |

### Requirements Still Requiring Team Decision (PROPOSED)

| Item | Proposal | Decision needed by |
|---|---|---|
| Multi-screen routing library | [PROPOSED: react-router-dom v6] | Phase 1 kickoff |
| Charting library | [PROPOSED: Recharts] | Phase 1 kickoff |
| AI integration API/model | [PROPOSED: Gemini API] | Phase 1P3 start |
| Forward prediction formula | [PROPOSED: AQI_t = AQI_current * exp(-k*t)] | Before prediction.py implementation |
| Prediction k-values by Pasquill class | [UNKNOWN] | Before prediction.py implementation |
| Intervention ERF factors | [PROPOSED: 0.25, 0.35, 0.30 — needs validation] | Before intervention.py implementation |
| Map tile providers (dark/light) | [UI/UX owner decision] | During UI/UX design phase |
| Layout of each screen (map split, panels) | [UI/UX owner decision] | During UI/UX design phase |
| Navigation pattern (top bar, sidebar, etc.) | [UI/UX owner decision] | During UI/UX design phase |

---

## 7. Known Inconsistencies (Remaining after Second-Pass)

| # | Inconsistency | Severity | Resolution |
|---|---|---|---|
| I1 | MockIMDSource.fetch_snapshot() is still in the main attribution data flow for weather data (app/api.py). Real Open-Meteo weather (temperature, humidity, pressure) should be used for all 7 cities, not a synthetic source. | Medium | Person 2 to replace MockIMDSource with real Open-Meteo weather API calls for all cities in Phase 2. Document in Architecture. |
| I2 | The prediction model k-values (decay constants per Pasquill class) are unspecified. Both Architecture and Development reference the formula but no values are given. | Medium | Person 2/3 must research and document k-values before prediction.py is written. Add as a pre-implementation deliverable in Phase 2. |
| I3 | Development assigns app/ai_router.py to Person 3. This is backend Python/FastAPI code. If Person 3 is primarily frontend/AI-product, this may need co-ownership with Person 2. | Medium | Team to confirm skill profiles at kickoff. |
| I4 | The compliance profiles and field team data (FR-037, FR-038) exist only for Pune. The SRS now correctly flags extension as REQUIRED. But neither Architecture nor Development has a specific task to source this data for the 6 new cities. | Medium | Person 2 to add explicit task: research and configure compliance profiles and field team data for non-Pune cities. Add to Phase 2. |

---

## 8. Recommended Next Actions

1. **Team kickoff (Day 0):** All three developers read all 5 documents before any code is written.
2. **Resolve Q2 immediately (CPCB IDs + WAQI UIDs for 6 cities)** — blocks real data for all non-Pune cities.
3. **Resolve Q1 (AI API key + model)** — no AI features possible without it.
4. **Resolve Q7 (WAQI token to .env)** — security risk in current codebase.
5. **Resolve Q8 (demo environment)** — affects all deployment decisions.
6. **Document prediction k-values (I2) before Phase 2P2** — prediction.py cannot be written without agreed formula.
7. **Address I1 (MockIMDSource replacement)** — add to Phase 2 Person 2 tasks.
8. **Address I4 (compliance profiles for non-Pune cities)** — add to Phase 2 Person 2 tasks.
9. **Confirm PROPOSED technologies (routing, charts, AI) at kickoff** — lock before Phase 1 code begins.
10. **Phase 1 starts Day 1** per Development document. No waiting.

---

## 10. Third-Pass Clarification Audit — 2026-09-19

### A. Seven-city current-data requirement (CONFIRMED LOCKED)

All seven cities require current/near-real-time environmental data from real providers. Pune is the existing implementation base only. No city receives preferential treatment in the product data requirements.

### B. 30-second application refresh cadence (CLARIFIED AND LOCKED)

AeroTrace uses a consistent **30-second application refresh/revalidation cycle** for current data across all seven cities. This is application behaviour — how frequently the system re-queries upstream sources. It applies uniformly to all cities.

**Critical distinction introduced in this pass:**

| Concept | What it means |
|---|---|
| 30-second application refresh | AeroTrace re-queries its upstream sources every 30 seconds for current data. All 7 cities. |
| Provider update cadence | How often the upstream source actually produces new data. Varies by provider (CPCB ~15 min; Open-Meteo/CAMS hourly model cycle; WAQI ~15 min). |
| Source timestamp | The time at which the upstream provider measured or modelled the data. This is what must be shown in the UI — not the AeroTrace query time. |

A 30-second AeroTrace refresh against a source that last updated 40 minutes ago returns the 40-minute-old measurement with a 40-minute-old source timestamp. Both the source and the timestamp must be visible to the user.

### C. Physical monitoring station vs atmospheric model data (CLARIFIED AND LOCKED)

| Entity type | Definition | May be a station pin? | May navigate to Screen 3? |
|---|---|---|---|
| Verified physical monitoring station | Real-world instrument at known coordinates (e.g., CPCB CAAQMS) | YES — AQI-severity-colored pin | YES |
| Open-Meteo/CAMS grid point | Model query coordinate — not a real instrument | NO | NO |
| City centroid | Geometric centre of a city boundary | NO | NO |
| Simulated data coordinate | Synthetic data origin | NO | NO |

### D. AQI-severity-colored station pins (CONFIRMED AND FORMALISED)

Verified physical monitoring stations are represented on the city map (Screen 2) as **AQI-severity-colored station pins**. The pin color communicates the current AQI severity category at that verified station. The exact palette, pin shape, animation, and styling are UI/UX owner decisions — but the functional requirement that pins are AQI-severity-colored is locked.

### E. Atmospheric model data geographic representation (PROPOSED, NOT FINALISED)

Open-Meteo/CAMS and equivalent atmospheric model data may be visualised geographically (e.g., as a regional overlay, environmental field, or city-level estimate badge). The exact visual treatment is **[PROPOSED]** and will be decided during the screen-by-screen UI/UX design phase. It must never be falsely represented as a physical monitoring station.

### F. Simulation / emergency fallback integrity (CONFIRMED LOCKED)

Simulation is testing and last-resort emergency fallback only. It must be labeled 'SIMULATED — live source unreachable'. It must never create fake station pins, fake historical series, or be presented as current measured data. Historical charts must not be populated with fabricated data; a 'data not available for this range' state is always preferable.

### G. Corrections made in this pass

| # | Document | What was corrected |
|---|---|---|
| T1 | SRS | NFR-070: changed '30 minutes or better... Pune polling model' to 30-second application refresh/revalidation cycle, uniformly all 7 cities; distinguished from provider update cadence; source timestamp exposure required |
| T2 | SRS | Intro: added locked LOCKED paragraphs on application refresh vs provider cadence, and physical station vs model data |
| T3 | SRS | FR-010: 'monitoring stations as AQI-colored pins' -> 'verified physical monitoring stations as AQI-severity-colored pins'; model data cannot create fake station pins |
| T4 | SRS | FR-013: added 'verified physical monitoring station' qualifier and 'AQI-severity-based' language |
| T5 | SRS | FR-019: Screen 3 only entered for verified physical monitoring stations |
| T6 | SRS | NFR-078 NEW: only verified physical stations as station pins; model grid points not permitted |
| T7 | SRS | NFR-079 NEW: stations DB table contains only verified physical stations |
| T8 | SRS | Section 2.13 Open-Meteo note: expanded to explicitly prohibit fake station creation from model grid coordinates |
| T9 | SRS | /api/v1/cities/{city}/stations API: clarified this endpoint returns verified physical monitoring stations only. station_entity_type enum (with model_estimate/unverified) removed — stations endpoint is not a mixed-type registry. Model-derived data is a separate concern. |
| T10 | Architecture | Added Section 2.11b: Data Source and Station Integrity (application refresh vs provider cadence; physical vs model; stations endpoint = verified physical only) |
| T11 | Architecture | MockIMDSource annotation strengthened: identified as synthetic weather, must be replaced with real weather API |
| T12 | Architecture | City configs note: must specify verified physical station coordinates only |
| T13 | PRD | Section 8 Principles: updated Principle 8 (Data Honesty — source timestamp); added Principle 9 (Station Integrity) |
| T14 | PRD | Section 10.3: Open-Meteo row updated to specify model data, not stations, coordinates are grid points |
| T15 | PRD | Section 10.8 / Success Metrics: '30 min refresh' replaced with '30-second application refresh + provider cadence distinction' |
| T16 | UI/UX | Added UX Principles 7 (Data transparency) and 8 (Station integrity in UI) |
| T17 | UI/UX | Screen 1 hover tooltip: added source label and source timestamp requirement |
| T18 | UI/UX | Screen 2 description: 'monitoring stations' -> 'verified physical monitoring stations'; AQI-severity-colored |
| T19 | UI/UX | Screen 2 required components: model data cannot automatically become station pins |
| T20 | UI/UX | Screen 3: added station integrity note — only reachable for verified physical stations |
| T21 | UI/UX | Screen 2 freshness UX note: updated to distinguish source timestamp from AeroTrace requery time |
| T22 | Development | City config task: must specify verified physical station coordinates, not model grid points |
| T23 | Development | City map task: station pins from verified physical stations only; no fake pins from model coordinates |
| T24 | Development | Person 2 responsibilities: tightened to real station research and real data integration |
## 9. Single Source of Truth Statement

> The six product/technical documents (`01_PRD.md` through `05_DEVELOPMENT.md`, with `00_DOCUMENTATION_STATUS.md` as the status index) are the primary product references. `06_IMPLEMENTATION_PLAN.md` translates those decisions into execution tasks and ownership.
>
> If implementation conflicts with documentation:
> 1. Identify the conflict.
> 2. Do NOT silently change requirements.
> 3. Update the relevant document after team agreement.
> 4. Record the change in this status document under the appropriate audit section.
>
> No feature may be added to the implementation that is not in these documents without explicit team agreement and a document update.

---

*Document first prepared: 2026-09-18 | Second-pass audit: 2026-09-19 | All team members must acknowledge reading this document before development begins.*





