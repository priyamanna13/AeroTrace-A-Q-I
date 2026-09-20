# AeroTrace NGEC 2026 — UI/UX Planning Document

**Document version:** 1.2
**Date:** 2026-09-19 (v1.2)
**Status:** DRAFT — UX structure only. Visual design decisions deferred to UI/UX design phase.
**Owner:** Person 1 (Frontend / UI/UX)

> NOTE: This document defines UX requirements, information hierarchy, user journeys,
> interaction patterns, transitions, and accessibility requirements.
> It does NOT define final visual design, color palette, typography, component styling,
> animation implementation, or design tokens. Those are UI/UX owner decisions, to be
> resolved screen by screen during the design phase using the installed design skills.

---

## 1. Existing UI Audit

### 1.1 What Currently Exists (Confirmed from Repository)

Based on inspection of `frontend/src/App.jsx` (1857 lines) and `frontend/src/map_layers.js`:

**Layout:**
- 72% / 28% split: left = map panel, right = sidebar panel
- Full-viewport, overflow: hidden
- Dark background: #08080a (entire shell)

**Map panel (72%):**
- Leaflet map, OSM tiles (standard, no dark-mode tiles confirmed)
- Custom SVG divIcon markers: trigger station (crimson + plume), source candidates (amber), secondary stations (yellow dots)
- Wind cone as GeoJSON polygon overlay (green fill, animated opacity)
- Wind compass widget (bottom-left, SVG, 72px diameter)
- Live status badge (top-left: green/amber/orange/red dot + "LIVE" label)
- Met data badge (bottom-left: wind speed, direction, temperature)
- Timeline replay scrubber (map overlay — 24H hourly slider)
- MapCameraController: flyTo() on source selection

**Sidebar panel (28%):**
- Header: station name, AQI pill, city/state meta
- Language switcher: EN/हि/म tabs (3px spacing, 9px rounded)
- Section label "ATTRIBUTED SOURCES"
- Source cards: rank badge, source type emoji + tag, source name, confidence number + bar
- Advisory card with localized text (EN/HI/MR template)
- Footer: engine label, version

**Animations (confirmed CSS keyframes in App.jsx L36-84):**
- ping, ping2, ping3 — expanding rings for trigger station
- pulse, livePulse — opacity/scale oscillation
- plumeFlow — opacity fade for wind plume SVG
- needleSway — compass needle glow
- slideInRight — sidebar panel entry
- spin — loading indicator
- yellowGlow, playbackPulse — secondary station and replay highlight

**I18N:**
- en/hi/mr dictionaries for: live_feed, attributed_sources, action_advisory, wind_label, met_label, match, maharashtra, footer_engine, source_types (4 types)
- Source name translations for 4 Pune-specific source names
- Pre-alert advisory translations

### 1.2 Current UX Gaps (Honest Assessment)

1. **Monolithic screen:** There is effectively ONE screen. No navigation. Station selection changes sidebar content only.
2. **No geographic depth:** Selecting a different station does not zoom the map geographically to that station's area — the entire city stays in view.
3. **No information hierarchy:** All information (AQI, sources, advisory, wind) is shown simultaneously in the sidebar.
4. **No charts:** There are no data visualization charts. The sidebar shows a text advisory, not trend data.
5. **No city selector:** Only Pune is presented. No path to select another city.
6. **No dedicated screens for:** prediction, impact, analytics, AI chat, settings, alerts list.
7. **Dark theme only:** No light mode exists.
8. **Language switcher is in the sidebar:** Language is a local sidebar control, not a global setting.
9. **Wind cone on all stations simultaneously:** The map shows wind cones for all selected stations — this would create clutter at city scale.
10. **No AI chat:** The advisory is a template string, not a conversational interface.

---

## 2. UX Principles for Upgrade

1. **Progressive disclosure:** Each screen reveals only what is relevant at that level of investigation.
2. **Spatial continuity:** Transitions between screens should reinforce the geographic narrative — zooming in, not jumping away.
3. **Context retention:** When the user moves deeper (S1→S2→S3→S4), the context (city, station, pollutant) must be visually retained (breadcrumb, map continuity).
4. **Evidence transparency:** AI insights and attribution results must clearly indicate confidence and data basis.
5. **Language consistency:** The selected language must apply uniformly across ALL UI elements on ALL screens.
6. **Accessible by default:** Not as an afterthought. Every screen must meet WCAG 2.1 AA.
7. **Data transparency:** Every AQI or pollutant reading must carry a visible source label and source timestamp. Simulated data must be visually distinguished. Model-derived data must be labeled as such. This is a functional UX requirement, not a visual styling choice — the exact treatment is a UI/UX owner decision, but the presence of the label is not optional.
8. **Station integrity in the UI:** Verified physical monitoring stations are represented as AQI-severity-colored station pins. Only verified physical stations navigate to Screen 3. Atmospheric model data is not a station and must not be represented as one — it may appear as a city-level or regional layer. The visual design of both is a UI/UX owner decision.

---

## 3. Screen-by-Screen UX Design Briefs

---

### Screen 1 — India Map / National Overview

**Purpose:** Entry experience. Instant orientation. Where is the problem?

**User goal:** "See which cities in India have poor air quality right now, and choose one to investigate."

**Information hierarchy (top to bottom):**
1. India map (dominant element — entire viewport)
2. City pins with AQI-category visual severity (primary data)
3. City name labels near pins
4. Global navigation (minimal, non-obtrusive)

**Required components:**
- India base map (Leaflet, appropriate zoom level to show all 7 cities)
- 7 city pins, each communicating AQI severity visually
- City name label per pin
- Global navigation bar
- AQI legend (compact, e.g., bottom-right)
- Optional: count of "cities with poor/very poor/severe AQI"

**Navigation:**
- Clicking a city pin → transition to Screen 2 for that city
- Global nav → Analytics / Alerts / AI / Settings

**User actions:**
- Click city pin → zoom + navigate to Screen 2
- Hover city pin → show tooltip: city name, current AQI, dominant pollutant, data source label, source timestamp (e.g., 'Updated 14 min ago')

**Entry points:** App load (default screen)

**Exit points:** Screen 2 (any city)

**Transitions:**
- S1 → S2: Map performs a geographic flyTo() zoom into the selected city, then Screen 2 content fades in once the map has settled.
- The map should be the same Leaflet instance throughout — not a new map instance.

**Loading state:**
- City pins appear with a loading/skeleton state while AQI data is fetching.
- If a city's AQI is unavailable, pin shows a "data unavailable" neutral state.

**Empty state:** N/A — 7 cities are always shown.

**Error state:** If API is down, all pins show "data unavailable" state with a refresh option.

**Responsive behavior:**
- Desktop (primary): Full map, city pins and labels visible.
- Tablet: Functional. Pin labels may be hidden on hover-only.
- Mobile: Map pans/pinches. City pins tappable.

**Accessibility:**
- City pins must have aria-label: "{city name}, AQI {value}, {category}".
- Keyboard: Tab through city pins, Enter to select.
- Screen reader: Announce "Navigating to {city name}" on selection.

**Animation requirements (conceptual):**
- City pins should have a subtle animation that communicates "live data" — e.g., a gentle pulse or breathing effect.
- Severe AQI pins may have a stronger animation than good-AQI pins.
- Final animation choice is a UI/UX owner decision.

**Data visualization:** City pin visual = only data viz on this screen. Chart on this screen is out of scope.

**Data freshness UX:** Each city pin must display a data timestamp and source label (e.g., "Updated 8 min ago | Open-Meteo"). When data is unavailable from all real sources, the pin must show an explicit unavailable state rather than any stale or simulated reading. The visual treatment of the unavailable state is a UI/UX owner decision.

**AI placement:** None on Screen 1. Optional: a very brief one-line national summary in the nav bar or a small info chip.

**Voice placement:** None on Screen 1.

---

### Screen 2 — City Intelligence

**Purpose:** Overview of what is happening across the selected city.

**User goal:** "Understand the city's air quality situation, identify the worst areas, and choose a station to investigate."

**Information hierarchy:**
1. City map with AQI-severity-colored verified physical monitoring station pins (dominant)
2. City AQI summary panel (PM2.5, PM10, overall AQI, trend indicator)
3. City AQI trend chart (24H/7D/30D toggle)
4. AI city insight (short, 2-4 sentences)
5. Contextual alert (if AQI elevated)
6. Navigation: back to India / forward to any station

**Required components:**
- City map (zoomed to city bounds, all verified physical monitoring stations visible as AQI-severity-colored pins)
- AQI-severity-colored verified physical monitoring station pins (no wind cones at this level). The exact palette, shape, and animation are UI/UX owner decisions. Model/grid coordinates must not become station pins.
- City summary panel: overall AQI, dominant pollutant, station count
- Pollutant summary row: PM2.5, PM10 highlighted
- AQI trend chart (Recharts line chart, time range selector: 24H/7D/30D)
- AI city insight card (2-4 sentences + "Ask AeroTrace →")
- Contextual floating alert (appears if AQI > threshold)
- Breadcrumb: India > {City}
- Time range selector for trend chart
- Voice/read-aloud control for AI insight

**Navigation:**
- Station pin click → transition to Screen 3 for that station
- Breadcrumb "India" → Screen 1
- Contextual alert CTA → Screen 4 or 5
- "Ask AeroTrace →" → Screen 9 with city context

**User actions:**
- Click station pin → zoom + navigate to Screen 3
- Toggle time range on trend chart (24H/7D/30D)
- Dismiss contextual alert
- Click "Ask AeroTrace →"
- Click voice/read-aloud

**Transitions:**
- S1 → S2: Map zooms in to city level (flyTo). City summary panel fades in.
- S2 → S3: Map zooms further to station location. Station detail panel replaces city summary.
- The geographic continuity must be preserved — the user should feel they are zooming in, not jumping.

**Loading states:**
- Station pins: skeleton dots while AQI data fetches.
- AI insight: loading indicator / skeleton text.
- Trend chart: skeleton bars.

**Empty state:** If no station data for a city: "No monitoring stations available for {city}. Data may be unavailable."

**Error state:** API error → "Unable to load city data. Retrying..." with manual refresh.

**Responsive:**
- Desktop: Map (primary, ~65-70% width) + side panel (30-35%)
- Tablet: Stacked or map-overlay panel
- Mobile: Map full-screen with swipe-up panel for data

**Accessibility:**
- Station pins: aria-label with station name and AQI.
- Chart: aria-describedby with trend summary text.
- Alert: role="alert", keyboard dismissible.

**Animation (conceptual):**
- Station pins animate to indicate live data status.
- Trend chart data should animate in on load (draw animation).
- Final animation choice: UI/UX owner decision.

**AI placement:** AI insight card below or alongside the trend chart. NOT a floating chat bubble.

**Voice placement:** Contextual button next to the AI insight card (e.g., speaker icon). NOT in global nav.

**Light/dark mode:** The city summary panel and trend chart must render correctly in both themes. Map tile must switch.

---

### Screen 3 — Station Intelligence

**Purpose:** Deep dive into a specific monitoring station.

**User goal:** "Understand everything happening at this station — all pollutants, trends, wind, and anomalies — and decide which pollutant to investigate further."

**Information hierarchy:**
1. Station map with wind cone/plume (dominant)
2. Station AQI + dominant pollutant (prominent)
3. All 6 pollutants with values and NAAQS comparison
4. Historical trend charts (pollutant-level, 24H/7D/30D)
5. Wind conditions (direction, speed, Pasquill class)
6. Detected anomalies / pollution events
7. AI station insight
8. Pollutant selector to enter Screen 4

**Required components:**
- Station-focused map with wind cone overlay (GeoJSON polygon from backend)
- Station AQI card (large, prominent)
- Pollutant grid: PM2.5, PM10, NO2, SO2, CO, O3 — each with: value, unit, exceedance factor, NAAQS bar
- Trend chart per pollutant or combined (Recharts, time range toggle)
- Wind conditions panel: speed (km/h), direction (degrees + cardinal), Pasquill class label
- Wind compass widget (existing, MODIFY if needed)
- Anomaly indicators on trend chart
- AI station insight card (2-4 sentences + "Ask AeroTrace →")
- Voice/read-aloud control
- Pollutant selector CTA (e.g., "Investigate PM2.5 →")
- Breadcrumb: India > {City} > {Station}
- Contextual station alert (if station has active anomaly)

**Navigation:**
- Pollutant selector → Screen 4
- Breadcrumb "{City}" → Screen 2
- Breadcrumb "India" → Screen 1
- "Ask AeroTrace →" → Screen 9

**User actions:**
- Select pollutant to investigate → Screen 4
- Toggle time range (24H/7D/30D) on charts
- Hover pollutant card → expanded detail tooltip
- Click wind compass → detailed wind data (modal or inline)
- Read-aloud AI insight

**Transitions:**
- S2 → S3: Map zooms further into station location. Wind cone appears as map settles.
- S3 → S4: Map retains view, UI panel transitions to investigation view.
- Wind cone should "appear" as the user settles at the station level — not present at city level.

**Loading states:**
- Pollutant cards: skeleton while data fetches.
- Wind cone: renders after API response.
- Trend charts: skeleton bars.

**Empty state:** If a pollutant is null/unavailable: display "—" with tooltip "Data not available."

**Error state:** API error → show last known reading with staleness indicator.

**Responsive:**
- Desktop: Map + full data panel
- Tablet/Mobile: Map minimized, full scrollable data panel

**Accessibility:**
- Each pollutant card: aria-label with pollutant name, value, unit, exceedance.
- Wind cone: aria-describedby "Wind from {cardinal} at {speed} km/h."

**Animation (conceptual):**
- Wind cone transition: fade/grow in as the user arrives at station level.
- Pollutant bars: animated fill on load.
- Final implementation: UI/UX owner decision.

**AI placement:** AI insight card in the data panel, below pollutant summary.

**Voice placement:** Speaker icon next to AI insight card.

---

### Screen 4 — Pollution Investigation

**Purpose:** Forensic attribution of a specific pollutant at this station.

**User goal:** "Understand where this pollutant is coming from, with evidence."

**Information hierarchy:**
1. Map: wind cone + source candidate markers (dominant)
2. Selected pollutant header (name, current value, exceedance)
3. Ranked source candidates list (confidence, type, name)
4. Chemical fingerprint evidence
5. Compliance profile of top candidate (school/hospital proximity)
6. AI forensic explanation
7. Action advisory (localized)
8. Field team assignment
9. "Predict Impact →" CTA

**Required components:**
- Attribution map: wind cone + ranked source markers (numbered by rank)
- Pollutant header card: name, AQI sub-index, concentration, exceedance factor
- Ranked candidates list: for each candidate: rank, type emoji, name, confidence %, confidence bar
- Chemical fingerprint panel: PM2.5/PM10 ratio, NO2/SO2 ratio, signature class, notes
- Evidence panel: school proximity, hospital proximity, violations
- AI forensic explanation card (2-4 sentences + "Ask AeroTrace →")
- Voice/read-aloud control
- Localized action advisory (full text, EN/HI/MR)
- Field team assignment card: squad ID, lead, ETA
- "Predict Impact →" CTA button
- Ambiguity indicator (if attribution is ambiguous, clearly labeled)
- Breadcrumb: India > {City} > {Station} > {Pollutant}

**Navigation:**
- "Predict Impact →" → Screen 5
- Breadcrumb → up through hierarchy
- "Ask AeroTrace →" → Screen 9 with full attribution context

**User actions:**
- Click source candidate → map flies to that source location
- Toggle between source candidates to compare
- Read localized advisory in EN/HI/MR
- Read-aloud AI forensic explanation
- Click "Predict Impact →"

**Transitions:**
- S3 → S4: Map remains, UI panel transitions to investigation view. Ranked source markers appear on map.
- S4 → S5: Context is carried forward. Map transitions to prediction view.

**Loading states:**
- Source candidates: loading skeleton while attribution pipeline runs.
- Chemical fingerprint: skeleton.

**Empty state:** If no sources found in wind cone: "No sources identified in upwind area. Pollution may be transported from outside this region."

**Error state:** Pipeline failure → "Attribution unavailable. Showing last known result."

**Accessibility:**
- Source cards: aria-label with rank, source name, confidence.
- Ambiguity state: clearly communicated in text, not just visually.

**Animation (conceptual):**
- Source markers appear sequentially (rank 1 first, then 2, 3, 4) — or animate in together.
- Confidence bars animate fill on load.
- Final implementation: UI/UX owner decision.

**AI placement:** AI forensic explanation card in data panel.

**Voice placement:** Speaker icon next to AI forensic explanation.

**IMPORTANT:** Attribution confidence and evidence must be clearly communicated. Do NOT present attribution results as certainties.

---

### Screen 5 — Prediction

**Purpose:** Project where this pollution will go.

**User goal:** "See where this pollution event is predicted to spread in the next 1H, 3H, 6H."

**Information hierarchy:**
1. Prediction map: current location + predicted trajectory + future zones (dominant)
2. Current state summary (station, pollutant, current AQI)
3. Forecast timeline selector (1H / 3H / 6H)
4. Predicted AQI and concentration at selected horizon
5. Confidence / uncertainty bounds
6. AI prediction explanation
7. "View Impact →" CTA

**Required components:**
- Prediction map: current wind cone + projected movement zone at selected time horizon
- Current state card: station name, pollutant, current AQI, timestamp
- Forecast time selector (1H/3H/6H buttons/tabs)
- Predicted AQI card for selected horizon (with confidence range, e.g., "AQI 180–220")
- Predicted zone on map (GeoJSON polygon, distinct from wind cone)
- Forecast confidence indicator (high/medium/low with label)
- AI prediction explanation card ("Ask AeroTrace →")
- Voice/read-aloud control
- "View Impact →" CTA
- Methodology disclaimer (visible, not buried)
- Breadcrumb: India > {City} > {Station} > {Pollutant} > Prediction

**Navigation:**
- "View Impact →" → Screen 6
- Breadcrumb → up through hierarchy
- "Ask AeroTrace →" → Screen 9

**User actions:**
- Select time horizon (1H/3H/6H) → map and AQI prediction update
- Read methodology disclaimer
- Read AI explanation

**Transitions:**
- S4 → S5: Context preserved. Map transitions to show prediction view (new zone appears).
- S5 → S6: Context preserved.

**Loading states:** Prediction computation: spinner with "Calculating forecast..."

**Error state:** "Prediction unavailable. Insufficient data for this time range."

**Accessibility:** Prediction zones: aria-describedby with text description of location and confidence.

**AI placement:** AI explanation card below forecast cards.

**Voice placement:** Speaker icon next to AI explanation.

**CRITICAL:** Methodology disclaimer must be visible. Do NOT present predictions without confidence context.

---

### Screen 6 — Impact & Intervention

**Purpose:** Who is affected, and what could change the outcome?

**User goal:** "Understand who is at risk in the predicted affected area, and model what interventions could reduce impact."

**Information hierarchy:**
1. Impact map: predicted affected zone + sensitive locations
2. Affected zone summary: area, estimated population, exposure period
3. Sensitive locations list: schools, hospitals, residential in zone
4. Intervention simulator: type selector + projected AQI result
5. AI impact explanation
6. Methodology disclaimer

**Required components:**
- Impact map: predicted zone (from S5) + sensitive location markers (schools, hospitals)
- Affected zone card: estimated area, exposure period
- Sensitive locations panel: list of schools/hospitals in zone with distance from source
- Intervention type selector: "Reduce traffic" / "Control construction dust" / "Reduce industrial emissions"
- Intervention result card: current AQI → projected AQI (e.g., 186 → 148)
- Confidence label on intervention result (high/medium/low)
- Methodology disclaimer (mandatory, per FR-066/067)
- AI impact explanation card ("Ask AeroTrace →")
- Voice/read-aloud control
- Breadcrumb

**Navigation:**
- Breadcrumb → up
- "Ask AeroTrace →" → Screen 9

**User actions:**
- Select intervention type → result updates
- Adjust intervention intensity if slider is available
- Read methodology disclaimer
- Read AI explanation

**Loading states:** Simulation computation: spinner.

**Error state:** If no sensitive locations data: "Sensitive location data not available for this area."

**IMPORTANT:** Intervention results are estimates. The UI must communicate this unambiguously.

---

### Screen 7 — Analytics & Trends

**Purpose:** Historical analysis workspace.

**User goal:** "Explore how air quality has changed over time at India, city, or station level."

**Information hierarchy:**
1. Scope selector: India / City / Station / Pollutant
2. Time range selector: 24H / 7D / 30D / 1Y
3. Primary trend chart (AQI over time)
4. Pollutant breakdown charts (PM2.5, PM10, NO2, SO2, CO, O3)
5. Anomaly highlights on charts
6. City/station comparison (if comparison mode enabled)
7. AI trend insights

**Required components:**
- Scope selector (tabs or dropdown: India / City / Station / Pollutant)
- Time range selector
- AQI trend chart (Recharts line chart with anomaly markers)
- Pollutant grid charts (smaller sparkline or bar charts per pollutant)
- Comparison toggle + city/station multi-select
- AI trend insight card ("Ask AeroTrace →")
- Data availability notice (for time ranges where data is limited)
- Download/export option (optional for NGEC 2026)

**Navigation:**
- Global nav → accessible from all screens
- "Ask AeroTrace →" → Screen 9 with analytics context

**User actions:**
- Change scope → charts update
- Change time range → charts update
- Enable comparison → add city/station to comparison
- Click anomaly on chart → details panel

**Loading/empty/error states:**
- Loading: skeleton charts
- No data: "Data not available for this scope and time range."
- Error: "Failed to load analytics data."

**Accessibility:** Charts must have text summaries and aria descriptions.

---

### Screen 8 — Alerts

**Purpose:** View and manage all alerts.

**User goal:** "See all active and recent alerts, understand their context, and navigate to the relevant investigation."

**Information hierarchy:**
1. Active alerts (top, most severe first)
2. Recent resolved alerts
3. Alert preferences (link to Settings)

**Required components:**
- Alert list: severity indicator, pollutant, city/station, AQI, timestamp, CTA
- CTA buttons: "Investigate →" (→ Screen 4), "Predict Impact →" (→ Screen 5), "View City →" (→ Screen 2)
- Filter: by city / by severity / by pollutant
- Empty state: "No active alerts"

**Contextual alerts (on Screens 2 and 3):**
- Floating, dismissible card
- City-level: "PM2.5 rising across 4 stations in Mumbai. [View Alert →]"
- Station-level: "PM2.5 increased 40% in last hour at Bandra. [Investigate →]"
- Deep-links preserve city/station context

---

### Screen 9 — AI Environmental Intelligence

**Purpose:** Conversational AI workspace.

**User goal:** "Ask questions about air quality in natural language and get evidence-based answers."

**Information hierarchy:**
1. Context indicator (if arriving from another screen: shows city/station/pollutant context)
2. Chat conversation area
3. Input field (text, with language toggle or auto-detect)
4. Suggested questions (context-aware)

**Required components:**
- Context pill/card: shows entry context (e.g., "Investigating PM2.5 at Bandra, Mumbai")
- Chat conversation: user messages + AI responses (distinct styling)
- AI response: text + confidence note (e.g., "Based on current attribution data")
- Suggested questions (3-5 context-aware quick-start prompts)
- Input field with submit button
- Language indicator (current selected language)
- "Clear context" option

**Navigation:**
- Accessible from global nav (no context)
- Deep-linked from any screen (with context)
- "Back to {Screen}" breadcrumb

**User actions:**
- Type question → AI responds
- Click suggested question → auto-submit
- Clear context → start fresh conversation
- Language toggle (if not already in Settings)

**AI response requirements:**
- Must cite data source (e.g., "According to Open-Meteo data at 14:30 IST...")
- Must indicate uncertainty ("This is an estimate based on...")
- Must respond in selected language
- Must NOT fabricate data

---

### Settings Screen

**Purpose:** Control appearance, language, voice, and alert preferences.

**Required components:**
- Appearance section: Light / Dark / System radio options
- Language section: English / Hindi / Marathi selection
- Voice & Accessibility: enable/disable read-aloud, voice speed slider
- Alert preferences: toggles for pollution alerts, severe AQI, station anomalies
- Map preferences: animation intensity
- App version and data source attribution

---

## 4. Screen Transition Requirements

| Transition | Type | Conceptual approach |
|---|---|---|
| S1 → S2 (click city) | Geographic zoom | map.flyTo(city center, city zoom level) + UI panel transition |
| S2 → S3 (click station) | Geographic zoom | map.flyTo(station coords, station zoom level) + UI panel transition |
| S3 → S4 (select pollutant) | UI transition | Map stays, panel content transitions to investigation view |
| S4 → S5 (predict impact) | Context carry + map update | Prediction zone appears on map, panel updates |
| S5 → S6 (view impact) | Context carry + map update | Impact zones + sensitive locations appear |
| Any → S7 (analytics) | Navigation | Standard nav transition |
| Any → S9 (AI) | Navigation + context | Context object passed to AI screen |
| S9 → origin (back) | Navigation | Return to origin screen |

**Motion requirements:**
- Geographic transitions (flyTo): smooth, ~1.2–1.5s duration, ease-in-out
- Panel transitions: fast (150–250ms), context-appropriate easing
- Data appearing on map (wind cone, source markers): fade in or grow in
- Do NOT animate purely for decoration. Motion must serve spatial understanding.
- Final motion implementation: UI/UX owner decision.

---

## 5. Global Navigation Requirements

**Navigation items:**
- AeroTrace (logo/home → Screen 1)
- Dashboard (→ current/default city overview)
- Cities (→ Screen 1 or city picker)
- Live Map (→ current active station map)
- Analytics (→ Screen 7)
- Alerts (→ Screen 8, with active alert count badge)
- AI (→ Screen 9)
- Settings (→ Settings screen)

**Behavior:**
- Persistent across all screens
- Active screen highlighted
- Alerts badge shows count of active alerts
- Must not obscure map content
- Responsive: collapses to icon-only or hamburger on smaller viewports

---

## 6. Light/Dark Mode Requirements

- All screens MUST support both light and dark themes.
- Theme toggle available in Settings (Light / Dark / System).
- The map tile layer MUST change with theme.
- AI insight cards, alert cards, pollutant cards, source cards — all must render correctly in both themes.
- Final visual treatment: UI/UX owner decision. Do NOT use dark-mode glassmorphism for light mode.

---

## 7. Localization Requirements

- ALL UI strings on ALL screens in EN/HI/MR.
- Language selection in Settings, persisted to localStorage.
- AI responses in selected language.
- Voice output in selected language (en-IN / hi-IN / mr-IN).
- Number formatting: follow locale conventions (EN uses "1,234.5"; HI/MR may use "1,234.5" or Devanagari numerals — to be decided by UI/UX owner).
- Right-to-left: NOT required (Hindi and Marathi are LTR scripts).

---

## 8. Accessibility Requirements

- WCAG 2.1 AA compliance for all screens.
- Color is not the sole indicator of any state (all AQI colors have text labels).
- All interactive elements keyboard-accessible.
- All charts have text alternative descriptions.
- Voice read-aloud for AI summaries.
- Font size: minimum 12px for body text, 14px+ preferred.
- Sufficient contrast in both light and dark themes.

---

## 9. Data Visualization Requirements

**Charting library:** Recharts (to be installed — NOT currently in package.json)

**Chart types needed:**
- Line chart: AQI trend over time (Screen 2, 3, 7)
- Bar/area chart: pollutant breakdown (Screen 3)
- Comparison line chart: multi-city/station (Screen 7)
- Confidence band (shaded area): prediction uncertainty (Screen 5)
- Map-based visualizations: wind cone (existing GeoJSON), predicted zones (new GeoJSON), sensitive location markers (new Leaflet markers)

**Chart requirements:**
- Responsive (resize with container)
- Accessible (aria descriptions)
- Interactive (hover/click for detailed values)
- Support both light and dark themes
- Anomaly markers on timeline charts
- Loading skeleton state

---

## 10. Contextual AI Requirements

- AI insight card appears on: Screen 2 (city), Screen 3 (station), Screen 4 (investigation), Screen 5 (prediction), Screen 7 (analytics)
- Each card: 2-4 sentences max, evidence note, "Ask AeroTrace →" link
- Card must NOT be a floating chat bubble or widget
- Card must NOT dominate the screen — it supports the primary data, not replaces it
- Voice/read-aloud: speaker icon next to each AI card
- "Ask AeroTrace →" opens Screen 9 with the current screen's context pre-loaded

---

## 11. Open Questions for UI/UX Owner

1. **Layout decisions:** What is the optimal panel layout for each screen? (Map-first with side panel? Full-screen with overlays? Stacked sections?)
2. **Navigation pattern:** Top navbar, sidebar nav, or bottom bar?
3. **Transition implementation:** CSS transitions, Framer Motion, or GSAP?
4. **Chart library:** Confirm Recharts or propose alternative.
5. **Map tile providers:** Which dark/light tile providers? (CartoDB Dark Matter, Stamen Toner, OSM standard, etc.)
6. **Breadcrumb placement:** Inside panel, above panel, or below nav?
7. **Pollutant selector in S3:** How does the user select a pollutant to investigate? (Card click, dropdown, modal?)
8. **Intervention slider vs. preset levels:** Does the intervention simulator use a percentage slider or preset reduction options?
9. **AI insight card placement:** Below data? Alongside data? Collapsible?
10. **Mobile strategy:** Map-first or data-first on mobile?

---

## 12. Repository Evidence

| UX claim | Evidence |
|---|---|
| Current dark theme | App.jsx L90 (background: #08080a) |
| No routing library | frontend/package.json |
| No charts library | frontend/package.json (no recharts) |
| EN/HI/MR i18n | App.jsx L230-284 |
| flyTo() on source select | App.jsx L594-606 (MapCameraController) |
| Wind cone as GeoJSON | map_layers.js, App.jsx |
| Wind compass | App.jsx L619-700+ |
| Live status badge | App.jsx L124-135 |
| Met data badge | App.jsx L137-146 |
| 72/28 split | App.jsx L100-155 |
| Animations | App.jsx L36-84 (keyframes) |
| Station selector in sidebar | App.jsx L293-319 (STATION_SCENARIOS) |
| AQI category colors | App.jsx L383-390 |
| No light mode | App.jsx L90 (single dark bg) |



