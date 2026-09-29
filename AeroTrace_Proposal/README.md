# AeroTrace A(Q)I — Final 10-Page Proposal (PMJIT NGEC 2026–2027)

**Deliverable:** `AeroTrace_AQI_Proposal_PMJIT_NGEC.pdf` — exactly 10 pages, A4 landscape (297 × 210 mm), ~1 MB, fully vector (far under the 25 MB limit).

Built strictly from the approved Opus-generated blueprint. No repository analysis was performed; all content, evidence classifications, and claim-integrity language follow the blueprint verbatim.

## Files

| File | Purpose |
|---|---|
| `index.html` | The 10-page composition (all pages, diagrams, tables, placeholders) |
| `styles.css` | Design system — obsidian canvas, chips, panels, typography |
| `render.py` | CDP renderer → exact A4-landscape PDF (Chrome headless) |
| `check_layout.py` | Pre-export audit: per-page overflow + SVG sanity |
| `AeroTrace_AQI_Proposal_PMJIT_NGEC.pdf` | **The final submission PDF** |
| `assets/` | Empty — drop the four blueprint-named captures here |

## Replacing placeholders (before submission)

Four replacement-ready placeholders are marked with `[ PLACE … HERE ]` frames. Drop the real files into `assets/` and swap each `.shot` / `.artifact` block for an `<img>` (keep the frame styling so annotations still read):

1. **Page 1 — hero:** `aerotrace-landing-v2.png` (2880×1800 WebGL globe)
2. **Page 1 — provenance:** `WhatsApp-Image-2026-09-24-at-8.08.03-PM.jpeg` (hand-drawn wireframe)
3. **Page 6 — primary:** `screen4_after.png` (1600×900 forensic cockpit)
4. **Page 6 — inset:** `screen4_final.png` (Hindi localization)

Every placeholder names its expected file path, purpose, required content, and annotation targets — exactly per blueprint §15/§45.

## Re-render after edits

```bash
python render.py                      # → AeroTrace_AQI_Proposal_PMJIT_NGEC.pdf
python check_layout.py                # must print: ALL PAGES CLEAN
```

Requires Google Chrome and `pip install websocket-client pypdf`.

## Evidence-classification legend (used on every page)

- `VERIFIED IMPLEMENTED` (cyan) — verified in code/tests per blueprint
- `DEMONSTRATED PROTOTYPE` (green) — running prototype evidence
- `ILLUSTRATIVE SCENARIO` (amber) — synthetic prototype scenario, **not field validation**
- `PROPOSED` (dashed orange) — near-term, not built
- `LONG-TERM VISION` (dashed purple) — conceptual horizon

No fabricated statistics, screenshots, accuracy claims, or human-made artifacts. Prototype confidence scores (0.91 / 0.88 / 0.86 / 0.94) are labelled throughout; the 18-minute figure is classified as a modeled prototype target; all cost figures are engineered estimates.
