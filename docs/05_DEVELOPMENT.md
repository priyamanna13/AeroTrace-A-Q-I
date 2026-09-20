# AeroTrace NGEC 2026 — Development Plan

**Document version:** 1.2
**Date:** 2026-09-19
**Status:** DRAFT v1.2 — Third-pass: 30-second refresh cadence clarified; physical station vs model data distinction in implementation tasks
**Team size:** 3 developers

---

## 1. Repository State Summary (Pre-Development)

Before planning tasks, the following is confirmed from repository inspection:

**What works today (confirmed from code):**
- FastAPI backend serving attribution for 4 Pune stations
- CPCB NAQI calculation (standards.py)
- Wind cone / Pasquill stability (cone_builder.py, pasquill.py)
- Source ranking with confidence scoring (ranker.py, scoring.py)
- OSM Overpass source discovery (overpass_client.py)
- Localized advisory EN/HI/MR (intelligence.py)
- WebSocket spike alerts and CPCB/Open-Meteo polling
- 24H timeline and replay endpoints
- React + Leaflet frontend with dark theme
- Single-screen UI (Pune only, all in App.jsx)

**What does NOT exist (confirmed from code):**
- Multi-city support (other than Pune — Pune is the existing implementation base)
- Screen 1 (India Map) — entirely new
- Screen 5 (Prediction) — entirely new
- Screen 6 (Impact & Intervention) — entirely new
- Screen 7 (Analytics) — entirely new as a screen
- Screen 9 (AI Chat) — entirely new
- Settings screen — entirely new
- Light theme — entirely new
- react-router — not installed
- Recharts — not installed
- Gemini API integration — not present

---

## 2. Team Responsibility Division

After inspecting the existing codebase, the following division is recommended.

### Person 1 — Frontend / UI / Map

**Primary responsibility:**
- React frontend architecture (App.jsx refactoring, screen componentization)
- Multi-screen navigation [PROPOSED: react-router-dom]
- India Map (Screen 1) and geographic transitions
- City Intelligence UI (Screen 2)
- Station Intelligence UI (Screen 3)
- Light/dark theme system (ThemeContext, CSS variables)
- Global navigation bar
- Data visualization [PROPOSED: Recharts] — AQI trend, pollutant trends charts
- Responsive design
- Animation and transitions (geographic flyTo, panel transitions)
- Language context extraction (LanguageContext from App.jsx)
- Accessibility implementation

**Shared with Person 3:**
- AI insight card component (Person 1 builds card; Person 3 provides AI content via API)
- Voice read-aloud (VoiceControl.jsx — Person 1)
- Contextual alerts (Person 1 for UI; Person 3 for alert logic)

**Relies on from Person 2:**
- /api/v1/cities endpoint for India map and city overview
- /api/v1/cities/{city}/stations for city map pins
- /api/v1/stations/{station}/readings for trend charts

---

### Person 2 — Backend / Data / APIs

**Primary responsibility:**
- Multi-city backend support: research and configure 6 new cities with verified physical station coordinates, real data source integration (CPCB IDs, WAQI UIDs), and attribution scenario profiles
- New API endpoints: /api/v1/cities, /api/v1/cities/{city}/overview, /api/v1/cities/{city}/stations
- Analytics endpoint (/api/v1/analytics)
- City-level AQI aggregation (cities.py)
- 7D/30D historical data sourcing and serving (analytics.py): investigate real historical provider availability (e.g., Open-Meteo CAMS Reanalysis); implement 'data not available' state where real historical data is absent; no synthetic historical trend data in the live product
- Database: any schema changes if needed for multi-city
- Moving WAQI token to .env (security fix)
- PostGIS configuration for new cities: register verified physical station metadata (coordinates, network, city, state). Seeded AQI data is for local development and CI testing only, not the live product data strategy.
- Prediction model backend (prediction.py) — basic wind-trajectory + Pasquill dispersion
- Alerts summary endpoint (/api/v1/alerts/summary)

**Shared with Person 3:**
- Prediction endpoints (Person 2 implements model; Person 3 wires AI explanation)
- Intervention simulation methodology (Person 2 implements model; Person 3 wires AI)

**Relies on from Person 1:**
- Nothing blocking from Person 1 (backend is standalone)

---

### Person 3 — AI / Intelligence / Integration

**Primary responsibility:**
- AI API integration [PROPOSED: Gemini] (app/ai_router.py)
- AI chat endpoint (/api/v1/ai/chat) and context handling
- AI insight generation for all screen types (city, station, investigation, prediction)
- Context-aware AI: building structured prompts from screen context
- Intervention simulation logic (intervention.py)
- Screens 4, 5, 6, 9 — frontend implementation of AI-heavy screens
- Pollution Investigation UI (Screen 4) — refactored from App.jsx attribution sidebar
- Prediction UI (Screen 5)
- Impact & Intervention UI (Screen 6)
- AI Chat UI (Screen 9)
- Alert system logic (alert rules, contextual alert triggers)
- Integration testing: end-to-end pipeline from API to UI for all screens

**Shared with Person 1:**
- AI insight card (Person 3 builds the API; Person 1 builds the UI card)
- Contextual alerts (Person 3 for logic; Person 1 for floating alert component)

**Relies on from Person 2:**
- All new backend endpoints for data to ground AI responses

---

## 3. Development Phases

### Phase 0 — Setup (Day 1, all)

All three developers:
- Clone/pull latest repository
- Install proposed dependencies [PROPOSED: react-router-dom recharts]: `npm install react-router-dom recharts  # [PROPOSED libraries - confirm with team]` in frontend/
  - Team to confirm both libraries before installation
- Verify existing backend runs: `uvicorn app.api:app --reload`
- Verify existing frontend runs: `cd frontend && npm run dev`
- Confirm 4 Pune stations return data from API
- Verify the 30-second application polling cycle is active (POLL_INTERVAL_MS in App.jsx) — this will need to extend to all 7 cities
- Read all 5 planning documents

Person 2:
- Create .env with WAQI_TOKEN (move from hardcode in api.py)
- Verify PostGIS container is running

Person 3:
- Obtain and test Gemini API key
- Add GEMINI_API_KEY to .env

---

### Phase 1 — Foundation (Days 1–3)

**Person 1 — Frontend foundation:**
- [ ] Extract I18N dictionary from App.jsx → src/i18n/strings.js
- [ ] Create ThemeContext.jsx (light/dark/system)
- [ ] Create LanguageContext.jsx
- [ ] Create NavigationContext.jsx (city, station, pollutant state)
- [ ] Wrap app with providers in main.jsx
- [ ] Install and configure routing library [PROPOSED: react-router-dom] — confirm with team first
- [ ] Create GlobalNav.jsx (navigation shell)
- [ ] Create screen file stubs (all 9 screens, placeholder content)
- [ ] Create Breadcrumb.jsx
- [ ] Wire routing: India → City → Station → Pollutant → Prediction → Impact

**Person 2 — Backend foundation:**
- [ ] Move WAQI token to .env (security fix)
- [ ] Create city_configs/ directory
- [ ] Research and create city YAML configs for: Mumbai, Delhi, Bengaluru, Kolkata, Hyderabad, Chennai
  - Each config MUST specify verified physical monitoring station coordinates (CPCB CAAQMS or equivalent real stations)
  - DO NOT use model grid coordinates or city centroids as station locations
  - If a city's verified station list is not yet available, the city config remains incomplete and that city cannot have station pins on the map until verification is done
- [ ] Add station profiles and attribution configs for 6 new cities in demo_scenarios.py
  - NOTE: These are attribution scenario configs (source candidates, compliance profiles), NOT mock AQI data. Real AQI data comes from the Tier 1-3 fallback pipeline.
- [ ] Implement cities.py (city list, aggregation)
- [ ] Implement GET /api/v1/cities endpoint
- [ ] Implement GET /api/v1/cities/{city}/overview
- [ ] Implement GET /api/v1/cities/{city}/stations

**Person 3 — AI foundation:**
- [ ] Create app/ai_router.py with AI API client [PROPOSED: Gemini]
- [ ] Implement POST /api/v1/ai/chat endpoint (basic, no context yet)
- [ ] Test AI API [PROPOSED: Gemini] with a Pune attribution context prompt — requires API key first
- [ ] Create AiInsightCard.jsx stub (frontend)
- [ ] Create AiChat.jsx stub (Screen 9 frontend)

---

### Phase 2 — Core Screens (Days 3–7)

**Person 1:**
- [ ] Implement Screen 1 — India Map (IndiaOverview.jsx)
  - [ ] India map centered on India
  - [ ] 7 city pins with AQI severity colors from /api/v1/cities (city-level pins are distinct from station pins — they represent the city, not a specific station)
  - [ ] Click → flyTo city → Screen 2
- [ ] Implement Screen 2 — City Intelligence (CityIntelligence.jsx)
  - [ ] City map with verified physical monitoring station pins (no wind cones at this level)
    - Pins sourced from /api/v1/cities/{city}/stations — this endpoint returns verified physical monitoring stations only
    - If Open-Meteo/CAMS is the only available data source for a city, do NOT create fake station pins from model coordinates
  - [ ] City AQI summary panel
  - [ ] AQI trend chart [PROPOSED: Recharts] from /api/v1/cities/{city}/overview
  - [ ] Station pin click → flyTo station → Screen 3
- [ ] Implement light theme CSS (CSS variables for all color tokens)
- [ ] Implement map tile switching (dark/light)

**Person 2:**
- [ ] Implement analytics.py (historical aggregation for 7D/30D)
- [ ] Implement GET /api/v1/analytics endpoint
- [ ] Implement prediction.py (wind-trajectory + Pasquill dispersion)
- [ ] Implement GET /api/v1/prediction/{station}/{pollutant} endpoint
- [ ] Investigate and configure real historical data sources for all 7 cities (Open-Meteo CAMS Reanalysis API for historical atmospheric data)
  - [ ] If real historical data is available: ingest into PostGIS for 7D analytics
  - [ ] If real historical data is NOT available for a city+range: implement 'data not available' response state (do NOT generate synthetic trend data)
  - [ ] Seed mock data for TEST environments and CI only (label clearly in seed scripts)

**Person 3:**
- [ ] Implement Screen 4 — Pollution Investigation (refactor from App.jsx sidebar)
  - [ ] Attribution map: wind cone + source markers
  - [ ] Ranked candidates list with confidence
  - [ ] Chemical fingerprint panel
  - [ ] Compliance profile display
  - [ ] "Predict Impact →" CTA
- [ ] Implement context passing: Screen 4 → AI Chat context
- [ ] Implement intervention.py with documented methodology
- [ ] Implement POST /api/v1/intervention/simulate endpoint

---

### Phase 3 — Advanced Screens (Days 7–11)

**Person 1:**
- [ ] Implement Screen 3 — Station Intelligence (StationIntelligence.jsx)
  - [ ] All 6 pollutant cards
  - [ ] Trend charts [PROPOSED: Recharts], 24H/7D/30D
  - [ ] Wind conditions panel (reuse/modify existing wind compass)
  - [ ] Anomaly indicators
  - [ ] Pollutant selector CTA
- [ ] Implement Analytics screen (Screen 7)
  - [ ] Scope selector
  - [ ] Time range selector
  - [ ] Multi-city comparison charts
- [ ] Implement Settings screen
  - [ ] Theme selector
  - [ ] Language selector
  - [ ] Alert preferences

**Person 2:**
- [ ] Implement GET /api/v1/alerts/summary endpoint
- [ ] Extend real historical data pipeline to support 30D range where provider data is available
  - [ ] For cities/ranges where real historical data is unavailable: implement and test 'data not available' UI state
  - [ ] DO NOT generate synthetic 30D data to present as historical trend data
- [ ] Optimize multi-city route cache for concurrent requests
- [ ] Verify PostGIS schema handles multi-city data correctly

**Person 3:**
- [ ] Implement Screen 5 — Prediction (Prediction.jsx)
  - [ ] Prediction map with trajectory zone
  - [ ] 1H/3H/6H time selector
  - [ ] Confidence bands
  - [ ] AI prediction explanation
- [ ] Implement Screen 6 — Impact & Intervention (ImpactIntervention.jsx)
  - [ ] Impact zone map
  - [ ] Sensitive locations panel
  - [ ] Intervention simulator UI
  - [ ] Methodology disclaimer
- [ ] Implement Screen 9 — AI Chat (AiIntelligence.jsx)
  - [ ] Chat conversation UI
  - [ ] Context display
  - [ ] Suggested questions
  - [ ] AI response in EN/HI/MR

---

### Phase 4 — Integration & Polish (Days 11–14)

**All together:**
- [ ] Integration testing: full S1->S2->S3->S4->S5->S6 flow with real data for all configured cities
- [ ] Integration testing: all AI insights with real Gemini API
- [ ] Integration testing: WebSocket alerts with all cities
- [ ] Light/dark theme QA across all screens
- [ ] EN/HI/MR localization QA across all screens
- [ ] Responsive QA (desktop, tablet)
- [ ] Performance testing (attribution endpoint < 2s, charts < 1s)
- [ ] Accessibility QA (keyboard nav, aria labels, color contrast)
- [ ] Alert system QA (contextual alerts on S2, S3)
- [ ] Error state QA (all screens with API down)

**Person 1:**
- [ ] Geographic transition polish (flyTo timing, easing)
- [ ] Panel transition polish
- [ ] Animation performance check

**Person 2:**
- [ ] Backend performance optimization
- [ ] Verify all new endpoints are documented in OpenAPI

**Person 3:**
- [ ] AI response quality review (grounded, not hallucinated)
- [ ] Voice read-aloud QA (EN, HI, MR)
- [ ] End-to-end integration test scripts

---

### Phase 5 — Demo Preparation (Day 14–15)

**All together:**
- [ ] Full NGEC demo flow rehearsal
- [ ] Demo scenario spike trigger preparation (Shivajinagar PM10 spike for live demo)
- [ ] Backup: verify the real-data fallback cascade works if the CPCB API is unavailable (Open-Meteo/CAMS → WAQI → emergency simulation). Emergency simulation is the last resort only and must display a clear 'SIMULATED — live source unreachable' label if activated. Do not treat mock/synthetic data as a normal fallback.
- [ ] ngrok or cloud deployment for demo URL (optional)
- [ ] Final documentation check: all 5 planning docs updated

---

## 4. Dependency Map

```
Phase 0 (all) ──────────────────────────────────────────────────────────────┐
                                                                             │
Phase 1P1: React context/router  ──────────────────────────────────────────┐│
Phase 1P2: /api/v1/cities ─────────────────────────────────────────────────┤│
Phase 1P3: AI router stub ─────────────────────────────────────────────────┘│
                                                                             │
Phase 2P1: Screen 1, 2 ─────────────── depends on Phase 1P2 (cities API) ──┘
Phase 2P2: analytics.py, prediction.py ─ no frontend dependency
Phase 2P3: Screen 4 ──────────────── depends on Phase 1P2 (attribution)

Phase 3P1: Screen 3, 7, Settings ─── depends on Phase 2P1 done
Phase 3P2: Alerts, 30D data ─────── depends on Phase 2P2 done
Phase 3P3: Screen 5, 6, 9 ──────── depends on Phase 2P3 + Phase 2P2

Phase 4: Integration ──────────────── depends on all Phase 3 complete
Phase 5: Demo ──────────────────── depends on Phase 4
```

**Critical path:** P2 city backend → P1 India map → P1 city map → P3 investigation → P3 prediction → integration.

---

## 5. Git Branching Strategy

**Main branches:**
- `main` — stable, always deployable
- `develop` — integration branch

**Feature branches (naming convention):**
- `feature/p1-{feature-name}` — Person 1 frontend
- `feature/p2-{feature-name}` — Person 2 backend
- `feature/p3-{feature-name}` — Person 3 AI/integration

**Examples:**
```
feature/p1-india-map
feature/p1-react-router-setup
feature/p1-city-intelligence-screen
feature/p2-cities-api
feature/p2-multi-city-scenarios
feature/p2-prediction-model
feature/p3-gemini-integration
feature/p3-screen4-investigation
feature/p3-ai-chat
```

**PR strategy:**
- All PRs target `develop`
- Minimum 1 reviewer before merge
- PRs from `develop` → `main` only after integration testing passes

**Commit conventions:**
```
feat(p1): add India map with 7 city pins
feat(p2): implement /api/v1/cities endpoint
feat(p3): add Gemini AI chat endpoint
fix(p2): move WAQI token from hardcode to .env
refactor(p1): extract i18n to standalone module
docs: update architecture doc with prediction model
```

---

## 6. Environment Setup

### Backend setup
```bash
# 1. Clone / pull repo
# 2. Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy and configure .env
cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql+psycopg2://aq:aq@localhost:5432/aqdb
#   AQ_SOURCE=mock
#   WAQI_TOKEN=your_token_here   # MOVE from hardcode in api.py
#   GEMINI_API_KEY=your_key_here

# 5. Start PostGIS
docker compose up -d db

# 6. Seed database
python -m app.seed --reset

# 7. Start FastAPI
uvicorn app.api:app --reload --port 8000
```

### Frontend setup
```bash
cd frontend

# 1. Install existing + new dependencies
npm install
npm install react-router-dom recharts  # [PROPOSED libraries - confirm with team]

# 2. Start Vite dev server
npm run dev
# → Vite dev server at http://localhost:5173
```

---

## 7. Testing Strategy

### Backend tests (existing — run without PostGIS)
```bash
python -m pytest tests/ -v
# 53 existing tests:
#   test_standards.py — AQI math
#   test_validators.py — sentinel/unit/edge-case
#   test_pipeline.py — contract shape + DB round-trip
#   test_seed.py — mock determinism + spike accuracy
```

**New tests to write (Person 2 & 3):**
```bash
tests/test_cities.py        — /api/v1/cities, /api/v1/cities/{city}/overview
tests/test_prediction.py    — prediction model math, GeoJSON output
tests/test_intervention.py  — intervention simulation, methodology
tests/test_analytics.py     — historical aggregation, time ranges
tests/test_ai_router.py     — AI endpoint (mock Gemini API)
```

### Frontend tests
- Manual QA for all 9 screens (automated frontend tests are out of NGEC 2026 scope).

### Integration tests (Person 3)
```bash
# End-to-end: India map → city → station → investigation → prediction
python verify_demos.py  # existing — extend for new screens
python verify_person2.py  # existing — extend for new endpoints
```

---

## 8. Definition of Done

A feature is DONE when:
1. Code is on `develop` branch via reviewed PR.
2. Existing tests still pass.
3. New functionality has at least basic test coverage.
4. API endpoints are documented in FastAPI OpenAPI (auto-generated).
5. UI component renders correctly in both light and dark themes.
6. UI content renders correctly in EN, HI, and MR.
7. Error states are handled (loading, empty, error conditions).
8. No console errors in browser.
9. The planning document for this feature is not contradicted by the implementation. If there is a conflict, the document is updated by team agreement before merge.

---

## 9. Risk Management

| Risk | Owner | Mitigation |
|---|---|---|
| App.jsx refactoring breaks existing Pune flow | Person 1 | Refactor incrementally; keep existing screen working throughout |
| Gemini API unavailable | Person 3 | Fallback to static advisory from intelligence.py |
| CPCB data unavailable for one or more cities | Person 2 | Open-Meteo Tier 2 fallback covers all 7 cities. WAQI Tier 3 fallback requires UIDs per city. Emergency simulation is last resort only and must be labeled as SIMULATED in UI. |
| Prediction model too complex | Person 2/3 | Implement simplified model first; document limitations |
| react-router state conflicts | Person 1 | Resolve routing architecture in Phase 1 before anyone builds screens |
| Scope creep | All | If a feature is not in these 5 documents, it requires team agreement to add |
| Integration delays | All | Integration testing starts no later than Day 11 (Phase 4) |

---

## 10. Demo Preparation

**NGEC 2026 Demo Flow (10-minute demo):**

1. Open app → India Map (Screen 1) — show 7 cities with AQI severity
2. Click Mumbai → geographic zoom → City Intelligence (Screen 2) — city AQI, trend, AI insight
3. Click Bandra/nearest Mumbai station → zoom → Station Intelligence (Screen 3) — pollutant grid, wind cone
4. Select PM2.5 → Pollution Investigation (Screen 4) — ranked sources, confidence, forensic AI
5. Click "Predict Impact →" → Prediction (Screen 5) — 3H forecast, uncertainty
6. Click "View Impact →" → Impact & Intervention (Screen 6) — schools/hospitals, intervention simulator
7. Switch to Screen 7 — Analytics — show 7D trend comparison Delhi vs Mumbai
8. Trigger Shivajinagar PM10 spike via POST /api/v1/simulation/trigger-spike — alert appears
9. Click alert → Screen 4 with Pune attribution context
10. Screen 9 — AI Chat — "Why is PM2.5 rising in Bandra?" — contextual response in Hindi

**Demo risk mitigations:**
- Pre-warm all API caches before demo (AeroTrace uses a 30-second application revalidation cycle; ensure all 7 cities have recent data fetched before demo begins)
- Verify emergency simulation fallback works for all cities (used only if ALL real sources fail during demo)
  - If emergency simulation activates, UI must display 'SIMULATED - live source unreachable' label
  - Pre-warm all 7 cities' real data caches before demo to minimize fallback risk
- Test Gemini API response time 24H before demo
- Test ngrok tunnel stability if using remote access
- Have `start_dev.bat` (exists in repo) ready for quick startup

---

## 11. Open Questions

1. Is a Gemini API key ready and tested?
2. What is the NGEC demo environment? (Local, cloud, public URL needed?)
3. Is Open-Meteo CAMS Reanalysis (historical atmospheric data) available and complete for all 7 cities for the 7D/30D ranges needed for analytics? (Real data is required; mock is not the expected answer - the question is whether the real provider has coverage.)
4. Should Kannada be added as a localization language (Bengaluru city context)?
5. Is there a staging server for integration testing before demo?
6. Who owns the ngrok tunnel / public URL setup for demo?

---

## 12. Repository Evidence for Responsibility Division

| Responsibility | Evidence |
|---|---|
| Person 1 — App.jsx monolith to refactor | frontend/src/App.jsx (1857 lines, single component) |
| Person 1 — No router installed | frontend/package.json (no react-router) |
| Person 1 — No charts installed | frontend/package.json (no recharts) |
| Person 2 — Pune-only city config | city_config.yml (single city) |
| Person 2 — 4 demo scenarios only | app/demo_scenarios.py |
| Person 2 — WAQI token hardcoded | app/api.py L288, app/cpcb_poller.py L24 |
| Person 3 — No AI API integration | requirements.txt (no google-generativeai) |
| Person 3 — Static advisory only | app/intelligence.py (f-string templates) |
| Person 3 — Intervention data exists (compliance profiles) | app/demo_scenarios.py (near_school, near_hospital fields) |




