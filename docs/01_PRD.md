# AeroTrace NGEC 2026 — Product Requirements Document (PRD)

**Document version:** 1.2
**Date:** 2026-09-18
**Status:** DRAFT — Pending team review
**Repository snapshot:** `D:\ET hackathon` (local) / `github.com/priyamanna13/AeroTrace`
**Changelog from v1.0:** Corrected Pune-centric data assumption. All 7 cities require current/near-real-time data. See Section 17 for full change log.

---

## 1. Product Overview

**AeroTrace** is an environmental intelligence platform for air-quality monitoring, pollution source attribution, prediction, and actionable environmental insights. The current version is a single-city (Pune) forensic attribution engine with four CPCB CAAQMS stations and a dark-mode React + Leaflet + FastAPI stack.

The **NGEC 2026 upgrade** expands AeroTrace into a seven-city national environmental intelligence product designed for the PJMT National Green Earth Challenge. The upgrade does not replace the existing system — it progressively extends it city-by-city, screen-by-screen, maintaining the existing backend pipeline architecture and adding a new multi-city, multi-screen UX layer on top.

**All seven cities are first-class citizens of this product.** The fact that Pune is the existing implementation base is an engineering starting point, not a product hierarchy. From a user and product perspective, Mumbai, Delhi, Bengaluru, Kolkata, Hyderabad, and Chennai are equal in importance to Pune.

---

## 2. Problem Statement

India's urban air quality crisis affects hundreds of millions of people, yet:

- Data is difficult to interpret without expert knowledge.
- Source attribution is rarely communicated to the public or civic bodies in actionable form.
- Predictions and impact projections are absent from mainstream monitoring tools.
- Existing interfaces present raw sensor data without spatial, temporal, or causal context.
- Language barriers prevent non-English users from accessing environmental information.

AeroTrace NGEC 2026 addresses all of these gaps by providing a progressive environmental intelligence experience that takes users from national overview to individual source attribution, prediction, and intervention — in a language they understand.

---

## 3. Product Vision

Make India's air quality crisis legible — from the satellite view to the street corner — and arm every stakeholder with the information they need to act.

---

## 4. Goals

### Primary Goals
1. Expand AeroTrace from 1 city (Pune) to 7 Indian cities, each with current/near-real-time air quality data.
2. Create a 9-screen product architecture enabling progressive environmental investigation.
3. Implement the "continuous deep zoom" UX — geographic and informational depth as one coherent experience.
4. Integrate contextual AI intelligence across all screens.
5. Support English, Hindi, and Marathi localization.
6. Implement light/dark theme across the full UI including the map.
7. Create a production-grade alert system (global + contextual).

### Secondary Goals
- Provide a dedicated analytics workspace for trend analysis.
- Implement voice/read-aloud capability for AI summaries.
- Build an intervention simulator with documented methodology.
- Create a contextual AI chat interface that retains screen context.

---

## 5. Non-Goals (NGEC 2026 Scope)

The following are explicitly OUT of scope for this phase:
- Full mobile native app (responsive web is in scope).
- Guaranteed real-time CPCB API connectivity for any city. All cities require a graceful fallback hierarchy (see Section 10.3 and 10.8).
- Integration with every CPCB station in India (a representative set per city is sufficient).
- Monetization layer or user authentication.
- Historical data beyond 7 days for any city where real historical data is not available from the data provider.

> **Removed from Non-Goals (v1.0 → v1.1):** "Real-time data from all 7 cities (mock data acceptable for non-Pune cities)" — This was an incorrect assumption. All 7 cities require current/near-real-time data. Static mock data that does not reflect actual current conditions is not acceptable for any city in the final product. See Section 10.3 and 10.8 for the required data strategy.

---

## 6. Target Users

### Primary Users
1. **Civic Decision-Makers** — Municipal commissioners, environment officers who need actionable enforcement intelligence.
2. **Environmental Journalists & Researchers** — Need accurate, evidenced, accessible data.
3. **NGEC Judges & Evaluators** — Need a coherent, technically sophisticated environmental intelligence product.

### Secondary Users
4. **General Public** — Citizens wanting to understand local air quality in their preferred language.
5. **Health Professionals** — Need predictive impact data to advise vulnerable populations.

### Personas

**Persona 1 — Ananya, Environment Officer, PMC Pune**
- Needs: Station attribution, confidence scores, enforcement checklists, Hindi/Marathi.
- Data requirement: Current CPCB CAAQMS readings; underlying CPCB provider updates typically occur every 15–30 minutes where available. AeroTrace revalidates current data every 30 seconds (application refresh cadence), but this does not imply a new CPCB measurement every 30 seconds — it means AeroTrace re-queries its sources on that cycle and exposes the actual source timestamp of each reading.

**Persona 2 — Rajan, Environmental Journalist, Mumbai**
- Needs: City patterns, source attribution, trend context.
- Data requirement: Current Mumbai station readings. Rajan will notice and report if Mumbai data is stale or fictional. Frozen mock data for Mumbai is not acceptable.

**Persona 3 — Dr. Priya, Pulmonologist, Delhi**
- Needs: Predicted pollution trajectories and health impact zones, grounded in actual current Delhi readings.
- Data requirement: Current Delhi AQI and pollutant concentrations. A static demo value does not serve clinical decision-making.

**Persona 4 — Arjun, Curious Citizen, Bengaluru**
- Needs: City AQI in preferred language, today's actionable guidance.
- Data requirement: Bengaluru's current air quality, not a pre-set number.

> **Note on persona data requirements:** These personas illustrate why mock/static data for any city undermines the product's core value proposition. The data strategy (Section 10.3 and 10.8) must serve all personas equally.

---

## 7. User Journeys

### Journey 1 — "Why is the air bad in my city today?"
India Map (S1) → clicks Mumbai → City Intelligence (S2) → sees current AQI + today's trends + AI insight → contextual alert → clicks station → Station Intelligence (S3) → selects PM2.5 → Pollution Investigation (S4) → source attribution → "Predict Impact" → Prediction (S5) → Impact & Intervention (S6).

### Journey 2 — "I need to issue a stop-work notice."
Alert notification → deep-link to S4 (source attribution + enforcement priority) → field team assignment → dispatches team.

### Journey 3 — "How has Delhi's air changed this year?"
Global Nav → Analytics (S7) → selects Delhi → selects time range → views trends → "Ask AeroTrace" → AI Chat (S9) with city context.

### Journey 4 — "What happens if we reduce traffic in Bandra by 30%?"
S6 (Impact & Intervention) → selects "Reduce traffic" → adjusts slider → projected AQI change → AI explains methodology.

> **Journey data integrity note:** Journeys 1–4 only have value if the underlying data is current. A user who checks Mumbai's AQI and later discovers it was a frozen mock number from a week ago loses trust in the entire product.

---

## 8. Product Principles

1. **Evidence First** — Every insight is grounded in available data. Uncertainty is communicated.
2. **Geographic Depth** — Navigation feels like zooming into the environment, not switching pages.
3. **Progressive Disclosure** — Users see only what is relevant at their current investigation level.
4. **No Hallucination** — AI insights never fabricate facts. Labels: estimates, simulations, data gaps.
5. **Reuse Over Rebuild** — Existing backend pipeline extended, not replaced.
6. **Localization as a Citizen Right** — English, Hindi, and Marathi from day one.
7. **Accessibility** — Usable by people with visual impairments and non-technical users.
8. **Data Honesty** — The system never silently presents stale or synthetic data as if it were current. Every reading must carry a source timestamp (when the upstream provider measured or modelled it) and a data source label. If current data is unavailable, the UI must say so explicitly.
9. **Station Integrity** — Verified physical monitoring stations are distinct from atmospheric model data. Only verified real-world monitoring instruments are represented as station pins and navigated to via Screen 3. Atmospheric model data (e.g., Open-Meteo/CAMS) provides environmental estimates but is not a station.

---

## 9. Screen Architecture

### Screen 1 — India Map / National Overview
**Purpose:** Where is the problem?
**Status:** [NEW]

Entry point. India map with 7 city pins communicating current AQI severity. Click city → geographic zoom to Screen 2.
Cities: Pune, Mumbai, Delhi, Bengaluru, Kolkata, Hyderabad, Chennai.
All 7 city pins show current AQI derived from current data sources (see Section 10.3). Data timestamp displayed per pin.
**Existing:** Leaflet map exists (Pune only, single-station).

### Screen 2 — City Intelligence
**Purpose:** What is happening across this city, right now?
**Status:** [MODIFY]

City-wide current AQI, PM2.5, PM10, 24H/7D/30D trend, AQI-colored station pins, AI insight, contextual alert, voice control.
Data freshness indicator displayed prominently (e.g., "Updated 8 min ago | Source: Open-Meteo").
**Important:** No wind cones at this level. Clean station map only.
**Existing:** Pune-only station map with attribution. Must evolve to clean city overview for all 7 cities.

### Screen 3 — Station Intelligence
**Purpose:** What is happening at this station, right now?
**Status:** [MODIFY]

All 6 pollutants with current readings and timestamps, historical graphs, wind conditions, station-level wind cone/plume, anomalies, AI insight.
**Wind cone appears HERE — not Screen 2.**
**Existing:** Wind cone, plume animation, sidebar attribution, weather badge, wind compass all exist for Pune.

### Screen 4 — Pollution Investigation
**Purpose:** Where is this pollutant coming from?
**Status:** [MODIFY]

Entry: user selects pollutant from station. Shows current pollutant reading, wind cone, source regions, confidence, evidence, AI forensic explanation, voice.
Attribution is grounded in the current wind and pollutant reading, not a frozen demo scenario.
**Existing:** Full attribution pipeline for Pune. Attribution uses current Open-Meteo weather + live AQI where available.

### Screen 5 — Prediction
**Purpose:** Where will this pollution go?
**Status:** [NEW]

Reached from Screen 4. Retains context. Shows forecast movement (1H/3H/6H), predicted AQI, wind-driven trajectory, affected zones, confidence, AI explanation.
Predictions are anchored to the current observed state, not a static scenario.
**Existing:** 24H timeline/replay exists. Forward prediction model is NEW.

### Screen 6 — Impact & Intervention
**Purpose:** Who is affected, and what can change the outcome?
**Status:** [NEW]

Predicted affected zones, sensitive locations (schools, hospitals), exposure period, intervention simulator with documented methodology.
**Existing:** Compliance profiles (near_school, near_hospital data) exist for Pune stations only. Must be extended or sourced for all cities.

### Screen 7 — Analytics & Trends
**Purpose:** How is air quality changing over time?
**Status:** [NEW as dedicated screen; PARTIAL existing]

Analysis at India/City/Station/Pollutant. Time ranges 24H/7D/30D/1Y. AQI history, pollutant trends, anomalies, comparisons, AI trend insights.
Where historical data is limited for a city, the UI must state the available range honestly.
**Existing:** 24H readings endpoint, 24H timeline. 7D/30D aggregation and dedicated screen are NEW.

### Screen 8 — Alerts
**Purpose:** Proactive notification of critical events.
**Status:** [MODIFY]

Global alerts in navigation. Contextual floating alerts on city/station selection. Deep-links to S4/S5.
Alerts triggered by current data thresholds, not pre-canned demo scenarios.
**Existing:** Pre-alerts in API contract, WebSocket SPIKE_ALERT broadcast, in-app alert panel. Make contextual and navigable.

### Screen 9 — AI Environmental Intelligence
**Purpose:** Conversational environmental intelligence chat.
**Status:** [NEW]

Dedicated AI chat. Receives screen context. Natural-language Q&A using AeroTrace's current and historical data. Short AI summaries on other screens with "Ask AeroTrace →" link.
**Existing:** Localized advisory templates in intelligence.py. Conversational interface is NEW.

---

## 10. Feature Requirements

### 10.1 Map Experience

| Feature | Status | Notes |
|---|---|---|
| India map with city pins | NEW | React-Leaflet, 7 cities |
| City AQI pin coloring | NEW | Reuse getAqiCategoryInfo() logic; color reflects CURRENT AQI |
| Data timestamp per city pin | NEW | All cities must show reading age |
| Geographic zoom transitions | MODIFY | map.flyTo() exists |
| City-level station map | MODIFY | Currently single-station focused; extend to all 7 cities |
| Station-level wind cone | EXISTING | build_wind_cone(), GeoJSON overlay |
| Station-level plume animation | EXISTING | createTriggerIcon() SVG animation |
| Source candidate markers | EXISTING | Amber-colored ranked candidates |
| Dark/light map tile switching | NEW | OSM dark/light tile providers |
| 24H replay slider | EXISTING | /api/v1/timeline, scrubber in App.jsx |

### 10.2 AQI Calculations

| Feature | Status | Notes |
|---|---|---|
| CPCB NAQI 6-pollutant formula | EXISTING | standards.py, verified |
| Sub-index per pollutant | EXISTING | sub_index() function |
| AQI category classification | EXISTING | 6-band Good to Severe |
| Exceedance factor vs NAAQS | EXISTING | exceedance_factor() |
| Chemical fingerprint | EXISTING | PM2.5/PM10 ratio, NO2/SO2 ratio |
| City-level aggregated AQI | NEW | Max or avg of current station readings |
| Multi-city AQI | NEW | Applied to all 7 cities equally |

### 10.3 Data Sources

The existing 3-tier data fallback chain from Pune (CPCB Portal Proxy → Open-Meteo Air Quality API → WAQI climatology) applies to ALL seven cities. The following table reflects the source strategy uniformly across all cities.

| Source | Status | Applies to | Notes |
|---|---|---|---|
| CPCB Portal Proxy (app.cpcbccr.com) | EXISTING | All cities | Primary source where CPCB stations are online. Unreliable; failure is normal. |
| Open-Meteo Air Quality API | EXISTING | All cities | Copernicus CAMS atmospheric model data. Global coverage. Coordinates queried are model grid points — NOT physical station locations. Must be labeled 'Open-Meteo/CAMS — atmospheric model' in UI. Must NOT be used to create station pins or station entities. May represent city-level or regional environmental estimates. |
| WAQI API | EXISTING | All cities | Third-level fallback. Station UIDs needed per city (currently only Pune UIDs are configured). |
| OSM Overpass API | EXISTING | All cities | Source discovery within each city's bounding box. City bbox config needed for each. |
| PostGIS database | EXISTING | All cities | Stores ingested readings for all cities. |
| Mock/seed data | EXISTING | Development and testing only | Acceptable for local development, CI testing, and as a last-resort emergency fallback during demo if ALL external APIs are unreachable. NOT a substitute for real data in the live product. When mock data is displayed, the UI must label it explicitly as "Simulated data — live source unavailable." |

> **Critical data policy:** The product must attempt to fetch current data from real sources for all 7 cities on every refresh cycle. Mock/deterministic data is the emergency floor, not the default for any city. A city displayed with weeks-old or fabricated readings while the UI shows it as "current" is a product defect, not an acceptable demo shortcut.

### 10.4 Source Attribution Pipeline

| Feature | Status | Notes |
|---|---|---|
| Wind cone geometry (Pasquill) | EXISTING | pasquill.py, stability classes A–F |
| Candidate source ranking | EXISTING | ranker.py, multi-factor scoring |
| Chemical fingerprint matching | EXISTING | scoring.py |
| OSM source discovery | EXISTING | overpass_client.py — requires city bbox per new city |
| Confidence score | EXISTING | Composite via compute_confidence() |
| Enforcement priority | EXISTING | compute_enforcement_priority() |
| Field team assignment | EXISTING | Static data, Pune only. Must be extended or parameterized for other cities. |
| Wet-scavenging (rain) | EXISTING | precipitation_mm → AQI scavenging |
| Multi-city attribution | NEW | Pipeline must work for all 7 cities, not just Pune scenarios |

### 10.5 AI Capabilities

| Feature | Status | Notes |
|---|---|---|
| Localized advisory EN/HI/MR | EXISTING | intelligence.py, f-string templates |
| City-level AI insight | NEW | City summary cards, grounded in current data |
| Station-level AI insight | NEW | Station context summary |
| AI forensic explanation | MODIFY | Extend existing advisory |
| Conversational AI chat | NEW | Gemini API integration |
| Context-aware AI chat | NEW | Screen context passed to AI |
| Voice read-aloud | NEW | Web Speech API |

### 10.6 Localization

| Feature | Status | Notes |
|---|---|---|
| English | EXISTING | Full coverage |
| Hindi | EXISTING | Navigation, source types, advisory |
| Marathi | EXISTING | Navigation, source types, advisory |
| Language switcher | EXISTING | EN/हि/म buttons in sidebar |
| Full UI localization (new screens) | MODIFY | Extend to all new screens |
| AI response in selected language | NEW | Gemini prompt engineering |

### 10.7 Themes

| Feature | Status | Notes |
|---|---|---|
| Dark theme | EXISTING | Full dark (#08080a base) |
| Light theme | NEW | Complete light theme |
| System theme | NEW | OS-level preference detection |
| Map tile theme switching | NEW | Light/dark OSM tile URLs |
| Theme persistence | NEW | localStorage |

### 10.8 Data Freshness and Transparency (NEW section)

This section defines requirements that apply uniformly to all 7 cities.

| Requirement | Detail |
|---|---|
| Every AQI reading displayed in the UI MUST carry a timestamp | Format: "Updated X min ago" or absolute ISO timestamp. No reading may be displayed without it. |
| Every AQI reading MUST carry a data source label | Examples: "Source: Open-Meteo", "Source: CPCB Portal", "Source: WAQI", "Simulated data — live source unavailable" |
| Application refresh cadence: all cities | AeroTrace SHALL use a consistent 30-second application refresh/revalidation cycle for current data across all 7 cities. This represents application behaviour — how frequently AeroTrace re-queries its sources. It does NOT guarantee upstream providers publish new measurements every 30 seconds. |
| Provider update cadence | Depends on upstream provider. CPCB: ~15 min where available. Open-Meteo/CAMS: hourly model cycle. WAQI: ~15 min aggregated. These are the actual measurement/model update frequencies. |
| Maximum acceptable display age without stale warning | 60 minutes. After 60 minutes without a refresh, the UI must show a staleness warning on any AQI reading from that source. |
| Simulated/mock data must be labeled | Any reading derived from the mock/seed system must be visually and textually labeled as simulated. It must NEVER appear as "live" or "current" data. |
| City pin AQI on India Map | Each city pin must show the data timestamp alongside or in the tooltip. |
| Open-Meteo coverage note | Open-Meteo provides global atmospheric model data (Copernicus CAMS) for all 7 cities. It is not a direct sensor feed; it is a model-based estimate. The UI should reflect this appropriately (e.g., "Source: Atmospheric model (Open-Meteo/CAMS)"). |
| CPCB direct sensor data note | CPCB CAAQMS data is direct sensor measurement. When available, it should be labeled as such and prioritized. |

---

## 11. Success Metrics

| Metric | Target |
|---|---|
| Cities covered with current data | 7 |
| Screens implemented | 9 |
| Source attribution | Evidence-backed, not hallucinated |
| Localization | EN/HI/MR across all screens |
| Light + dark theme | Complete |
| Geographic zoom transitions | S1→S2→S3 |
| Contextual AI | On every screen |
| Alerts | Global + contextual |
| Application refresh cadence | 30-second revalidation cycle, all 7 cities |
| Provider measurement freshness | Depends on provider; source timestamp must be exposed in UI |
| Staleness warning threshold | 60 minutes from source timestamp without a newer reading |
| Data timestamp display | 100% of AQI readings show timestamp and source label |
| API attribution latency | < 2s (cached) |
| Mock data labeling | Any simulated reading is labeled; 0 tolerance for silent mock-as-live |

---

## 12. Constraints

1. Team size: 3 developers, hackathon timeline.
2. Real data: CPCB API unreliable for all cities; graceful fallback required across all cities equally.
3. Open-Meteo provides current atmospheric model data for all 7 cities at no cost — this is the practical primary source for cities where CPCB API is unavailable. Coordinates and bounding boxes must be configured per city.
4. No Gemini API billing cap changes assumed: AI must degrade gracefully.
5. Frontend stack: React + Vite + Tailwind + React-Leaflet (no framework changes).
6. Backend stack: FastAPI + Python (no framework changes).
7. No react-router currently installed (single-page state-based navigation; must be added).
8. No Recharts currently installed (must be added if used).
9. WAQI station UIDs are currently configured only for Pune. UIDs for the other 6 cities must be researched and configured before WAQI fallback works for those cities.

---

## 13. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CPCB API unavailable for one or more cities on demo day | High | High | Open-Meteo fallback works for all 7 cities; configure coordinates per city |
| Open-Meteo CAMS resolution too coarse (city-level, not station-level) | Medium | Medium | Apply documented spatial variation offsets (existing hash-based method in api.py); label as model data |
| Gemini API quota hit | Medium | Medium | Cached responses, graceful degradation to advisory templates |
| WAQI UIDs unavailable for non-Pune cities | High | Low | WAQI is 3rd-level fallback; Open-Meteo covers this gap |
| Data freshness failures across all 7 cities simultaneously | Low | High | Mock fallback as emergency floor only; label clearly if used |
| Prediction model complexity | Medium | High | Simple trajectory + label as estimate |
| Scope divergence (3 devs) | High | High | These 5 documents are single source of truth |

---

## 14. Assumptions

1. The existing Pune attribution pipeline (CPCB NAQI, wind cone, Pasquill, source ranking) is the technical model for all other cities. The same code runs for all cities; only the station coordinates, city bbox, and scenario profiles differ.
2. Open-Meteo Air Quality API provides usable current atmospheric data for all 7 cities. This is a documented, verifiable assumption — Open-Meteo's CAMS integration covers Indian cities globally.
3. Gemini API key is available for the AI chat feature.
4. react-router-dom can be added as a frontend dependency.
5. Recharts can be added for data visualization.
6. Web Speech API is available in the demo browser environment.
7. WAQI station UIDs for non-Pune cities will need to be looked up via the WAQI search API before those UIDs can be used as 3rd-level fallback. This is a known gap.

---

## 15. Open Questions

1. Is a Gemini API key configured? What is the quota?
2. What are the WAQI station UIDs for representative stations in Mumbai, Delhi, Bengaluru, Kolkata, Hyderabad, and Chennai? (Needed for 3rd-level fallback configuration.)
3. What is the acceptable prediction methodology (wind-driven linear / Gaussian plume)?
4. What is the documented methodology for the intervention simulator?
5. Should react-router-dom be added, or remain state-based navigation?
6. Confirm Recharts as the charting library.
7. Is the hardcoded WAQI token in cpcb_poller.py/api.py safe to use? Should it move to .env?
8. What is the CPCB CAAQMS station list for Mumbai, Delhi, Bengaluru, Kolkata, Hyderabad, Chennai? (Station names and coordinates for configuring the attribution pipeline.)
9. Are sensitive location data (schools, hospitals) available for the 6 new cities, or will only Pune have this data in the Impact & Intervention screen (Screen 6)?

---

## 16. Repository Evidence

| Claim | File |
|---|---|
| Pune 4 stations | app/demo_scenarios.py, app/api.py L76-92 |
| CPCB NAQI implementation | app/standards.py |
| Wind cone builder | app/cone_builder.py, app/pasquill.py |
| OSM source discovery | app/overpass_client.py |
| Source ranking | app/ranker.py, app/scoring.py |
| EN/HI/MR localization | frontend/src/App.jsx L230-284 |
| WebSocket alerts | app/api.py L903-932, app/cpcb_poller.py |
| 24H timeline | app/api.py L831-886 |
| Leaflet + React-Leaflet | frontend/package.json |
| Dark theme | frontend/src/App.jsx L86-213 |
| No Recharts | frontend/package.json (absent) |
| No react-router | frontend/package.json (absent) |
| PostGIS + SQLAlchemy | app/models.py, app/db.py |
| 3-tier AQI fallback (applies to all cities) | app/api.py L133-337 |
| Open-Meteo covers all city coordinates | app/api.py L228-284 (lat/lon params, global API) |
| WAQI UIDs configured for Pune only | app/api.py L87-92 (_WAQI_STATION_UIDS dict) |
| Hash-based spatial variation for model data | app/api.py L191-203 |
| Mock data labeling obligation | THIS DOCUMENT Section 10.3 + 10.8 |

---

## 17. Change Log

### v1.1 — 2026-09-18

**Correction: Removed Pune-centric data assumption throughout**

The following instances in v1.0 incorrectly implied that mock/static data was an acceptable default for non-Pune cities. All instances have been corrected:

| Location | v1.0 text (incorrect) | v1.1 correction |
|---|---|---|
| Section 5 (Non-Goals) | "Real-time data from all 7 cities (mock data acceptable for non-Pune cities)" | Removed. All 7 cities require current data. |
| Section 5 (Non-Goals) | "Historical data beyond 7 days for non-Pune cities" | Revised to "for any city where real historical data is not available from the data provider." |
| Section 10.3 Data Sources | "Open-Meteo for non-Pune cities" (implying different treatment) | Table rewritten to apply data source strategy uniformly to all 7 cities. |
| Section 11 (Success Metrics) | "Data freshness (Pune) ≤ 30 min" | Changed to "all 7 cities ≤ 30 min refresh attempt." |
| Section 11 (Success Metrics) | No timestamp/labeling metric existed | Added "Data timestamp display: 100% of AQI readings show timestamp and source label." |
| Section 13 (Risks) | "Mock data for non-Pune is acceptable" | Changed to "Data freshness failures... Mock fallback as emergency floor only; label clearly if used." |
| Section 14 (Assumptions) | "Mock data for non-Pune cities is acceptable for NGEC 2026 demo" | Replaced with correct assumption about Open-Meteo global coverage. |
| Section 15 (Open Questions) | "Is real CPCB data available for the 6 new cities, or should demo use mock data?" | Reframed as: What are the WAQI UIDs and CPCB stations for non-Pune cities? (Not whether to use real data — that is a requirement, not a question.) |
| Section 1 (Product Overview) | Implied Pune-as-primary implicitly | Added explicit statement: "All seven cities are first-class citizens of this product." |
| Section 8 (Product Principles) | No data transparency principle | Added Principle 8: "Data Honesty" |
| Section 10.8 | Did not exist | NEW: "Data Freshness and Transparency" — uniform requirements for all 7 cities |
| Section 9 (Screens) | Screen descriptions lacked data currency language | Added "current/now" framing and data freshness notes to each screen |
| Personas 2–4 | No data requirement stated | Added data requirement note for each non-Pune persona explaining why mock data is unacceptable |


