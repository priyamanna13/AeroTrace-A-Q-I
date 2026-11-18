"""
Generate the official Finalist Jury Q&A Crisp Answer Sheet for AeroTrace A(Q)I.
Accurately aligned with the codebase implementation for Google Cloud Code for Communities 2.0.
"""

import os
from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    """Set background color of a table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set internal cell padding (in dxa: 20 dxa = 1 pt)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_cell_border(cell, **kwargs):
    """
    Set cell borders: top, bottom, left, right.
    Format: top={"val": "single", "sz": "4", "color": "CCCCCC", "space": "0"}
    """
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(f'<w:tcBorders {nsdecls("w")}/>')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        edge_data = kwargs.get(edge)
        if edge_data:
            tag = (
                f'<w:{edge} {nsdecls("w")} '
                f'w:val="{edge_data.get("val", "single")}" '
                f'w:sz="{edge_data.get("sz", "4")}" '
                f'w:space="0" '
                f'w:color="{edge_data.get("color", "auto")}"/>'
            )
            tcBorders.append(parse_xml(tag))
    tcPr.append(tcBorders)

def build_document(output_path: str):
    doc = docx.Document()

    # Page Margins: 0.75 in (54 pt) all around
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(0.75)
        s.bottom_margin = Inches(0.75)
        s.left_margin = Inches(0.75)
        s.right_margin = Inches(0.75)

    # Styles & Fonts
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(51, 65, 85) # Slate 700

    # Palette
    C_NAVY = RGBColor(15, 23, 42)       # Slate 900
    C_TEAL = RGBColor(13, 148, 136)     # Teal 600
    C_CYAN = RGBColor(14, 116, 144)     # Cyan 700
    C_SLATE = RGBColor(100, 116, 139)   # Slate 500
    C_RED = RGBColor(220, 38, 38)       # Red 600
    C_GREEN = RGBColor(16, 149, 93)     # Emerald 600

    # --- Header Banner Table ---
    banner_table = doc.add_table(rows=1, cols=1)
    banner_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    banner_table.autofit = False
    banner_cell = banner_table.cell(0, 0)
    banner_cell.width = Inches(7.0)
    set_cell_background(banner_cell, "0F172A") # Deep Navy
    set_cell_margins(banner_cell, top=200, bottom=200, left=250, right=250)

    p_banner = banner_cell.paragraphs[0]
    p_banner.paragraph_format.space_before = Pt(0)
    p_banner.paragraph_format.space_after = Pt(4)
    run_brand = p_banner.add_run("AeroTrace A(Q)I")
    run_brand.font.name = 'Calibri'
    run_brand.font.size = Pt(20)
    run_brand.font.bold = True
    run_brand.font.color.rgb = RGBColor(248, 250, 252)

    run_sub = p_banner.add_run("  |  Atmospheric Forensic Attribution & Environmental Intelligence\n")
    run_sub.font.name = 'Calibri'
    run_sub.font.size = Pt(11)
    run_sub.font.color.rgb = RGBColor(148, 163, 184)

    run_event = p_banner.add_run("Google Cloud Code for Communities 2.0  ·  Track 2: Clean Air & Climate Resilience\n")
    run_event.font.name = 'Calibri'
    run_event.font.size = Pt(10.5)
    run_event.font.bold = True
    run_event.font.color.rgb = RGBColor(45, 212, 191) # Light Teal

    run_docname = p_banner.add_run("FINALIST JURY Q&A — CRISP ANSWER SHEET")
    run_docname.font.name = 'Calibri'
    run_docname.font.size = Pt(13)
    run_docname.font.bold = True
    run_docname.font.color.rgb = RGBColor(255, 255, 255)

    doc.add_paragraph().paragraph_format.space_after = Pt(2)

    # --- Callout: How to use this sheet ---
    how_box = doc.add_table(rows=1, cols=1)
    how_box.alignment = WD_TABLE_ALIGNMENT.CENTER
    how_cell = how_box.cell(0, 0)
    how_cell.width = Inches(7.0)
    set_cell_background(how_cell, "F0FDFA") # Light Mint/Teal
    set_cell_border(how_cell, left={"val": "single", "sz": "18", "color": "0D9488"}) # Thick teal border
    set_cell_margins(how_cell, top=140, bottom=140, left=180, right=180)

    p_how = how_cell.paragraphs[0]
    p_how.paragraph_format.space_after = Pt(2)
    r_how_t = p_how.add_run("HOW TO USE THIS SHEET (10–15 SECOND RULE):\n")
    r_how_t.font.bold = True
    r_how_t.font.size = Pt(10)
    r_how_t.font.color.rgb = C_TEAL

    r_how_b = p_how.add_run(
        "• Answer each question directly in 1–2 crisp sentences, then STOP unless the judges ask a follow-up.\n"
        "• Clearly separate implemented codebase reality from planned roadmap extensions.\n"
        "• Source attribution is mathematical potential/search guidance, NOT certified legal causation.\n"
        "• 'Under the Hood' bullets below give you the exact technical constants if pressed by technical jury members."
    )
    r_how_b.font.size = Pt(9.5)
    r_how_b.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    def add_section_header(title: str, subtitle: str = ""):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run_t = p.add_run(title)
        run_t.font.name = 'Calibri'
        run_t.font.size = Pt(13.5)
        run_t.font.bold = True
        run_t.font.color.rgb = C_NAVY

        if subtitle:
            p_sub = doc.add_paragraph()
            p_sub.paragraph_format.space_before = Pt(0)
            p_sub.paragraph_format.space_after = Pt(6)
            p_sub.paragraph_format.keep_with_next = True
            run_s = p_sub.add_run(subtitle)
            run_s.font.size = Pt(9.5)
            run_s.font.italic = True
            run_s.font.color.rgb = C_SLATE

    def add_qa(q: str, a: str, tech_note: str = ""):
        p_q = doc.add_paragraph()
        p_q.paragraph_format.space_before = Pt(6)
        p_q.paragraph_format.space_after = Pt(2)
        p_q.paragraph_format.keep_with_next = True
        r_q_label = p_q.add_run("Q. ")
        r_q_label.font.bold = True
        r_q_label.font.color.rgb = C_TEAL
        r_q = p_q.add_run(q)
        r_q.font.bold = True
        r_q.font.color.rgb = C_NAVY

        p_a = doc.add_paragraph()
        p_a.paragraph_format.space_before = Pt(0)
        p_a.paragraph_format.space_after = Pt(3 if tech_note else 5)
        r_a_label = p_a.add_run("A. ")
        r_a_label.font.bold = True
        r_a_label.font.color.rgb = C_CYAN
        r_a = p_a.add_run(a)
        r_a.font.color.rgb = RGBColor(30, 41, 59)

        if tech_note:
            p_note = doc.add_paragraph()
            p_note.paragraph_format.space_before = Pt(0)
            p_note.paragraph_format.space_after = Pt(6)
            p_note.paragraph_format.left_indent = Inches(0.25)
            r_n_tag = p_note.add_run("⚙ Codebase Anchor: ")
            r_n_tag.font.size = Pt(9)
            r_n_tag.font.bold = True
            r_n_tag.font.color.rgb = C_SLATE
            r_n = p_note.add_run(tech_note)
            r_n.font.size = Pt(9)
            r_n.font.italic = True
            r_n.font.color.rgb = RGBColor(71, 85, 105)

    # =========================================================================
    # SECTION 1
    # =========================================================================
    add_section_header("1. Google AI & System Architecture", "Core Gemini API integration, prompt grounding, and failure isolation")

    add_qa(
        "How have you integrated Google AI into AeroTrace A(Q)I?",
        "Our primary Google AI integration is Google Gemini via the Google Generative AI Python SDK. It provides grounded contextual explanations, multilingual citizen advisories (English, Hindi, Marathi), and analytical synthesis using real-time telemetry supplied by our backend.",
        "Implemented in app/ai_service.py using google.generativeai with gemini-1.5-flash / gemini-2.0-flash, decoupled behind an abstract BaseAIService interface."
    )

    add_qa(
        "What does Gemini actually do in the product?",
        "Gemini acts as an environmental intelligence interpreter. It explains live pollutant readings, translates complex atmospheric stability and forward projections into plain language, and generates conversational answers in the AI Assistant (Screen 9). It does NOT measure pollution or independently prove source causation.",
        "System prompt explicitly forbids hallucinating numerical AQI values or creating unverified legal blame."
    )

    add_qa(
        "How does the integration work?",
        "When a user or screen requests an insight, our FastAPI backend compiles a structured payload containing physical station telemetry, wind parameters, Pasquill stability, and candidate sources. This context is injected into a strict forensic system prompt sent to Gemini, and the grounded response is delivered over REST or WebSocket.",
        "Endpoints: POST /api/v1/ai/insight and POST /api/v1/ai/chat. Full JSON schema in app/ai_models.py (AIContext, AIChatRequest)."
    )

    add_qa(
        "Why use Gemini instead of rules alone?",
        "Mathematical rules compute the AQI, wind cone geometry, and confidence ranking deterministically. Gemini bridges the human gap: it generates contextual summaries, answers open-ended citizen queries, and personalizes actionable health advice across three languages.",
        "Rules guarantee mathematical reliability; Gemini guarantees accessibility and multilingual civic engagement."
    )

    add_qa(
        "Does Gemini calculate the AQI or prove pollution sources?",
        "No. AQI calculations and spatial source attribution are executed entirely by deterministic mathematical algorithms in our backend. Gemini only explains the verified results. Its output is an analytical narrative, never proof of a pollution source.",
        "AQI is calculated via CPCB NAQI breakpoints in app/standards.py; attribution confidence is scored in app/scoring.py."
    )

    add_qa(
        "How do you reduce hallucinations?",
        "We enforce three safeguards: (1) In-context grounding with measured ground-truth telemetry and timestamps, (2) Explicit negative prompt constraints prohibiting speculation or ungrounded claims, and (3) A deterministic template fallback engine that takes over if Gemini is unavailable or quota is exceeded.",
        "If GEMINI_API_KEY is absent or fails, TemplateFallbackAIService in app/ai_service.py automatically serves verified rule-based templates."
    )

    # =========================================================================
    # SECTION 2
    # =========================================================================
    add_section_header("2. AQI, Data Sources, and Reliability", "Statutory Indian CPCB NAQI calculation, 4-tier ingestion cascade, and data freshness")

    add_qa(
        "How do you calculate AQI?",
        "We calculate pollutant-specific sub-indices using the official Indian Central Pollution Control Board (CPCB) NAQI statutory breakpoints and linear interpolation. The highest valid sub-index determines the overall AQI, provided at least three pollutants including at least one particulate species (PM2.5 or PM10) are monitored.",
        "Matches Indian National Air Quality Index (NAQI) guidelines implemented in app/standards.py (compute_aqi)."
    )

    add_qa(
        "What is the AQI sub-index formula?",
        "Ip = I_LO + [(I_HI − I_LO) / (B_HI − B_LO)] × (Cp − B_LO), where Cp is the observed pollutant concentration, B_LO and B_HI are the concentration breakpoint limits, and I_LO and I_HI are the corresponding statutory AQI index band breakpoints.",
        "Indian CPCB 6-band categories: Good (0–50), Satisfactory (51–100), Moderate (101–200), Poor (201–300), Very Poor (301–400), Severe (401–500)."
    )

    add_qa(
        "Where does your environmental data come from?",
        "We operate a 4-tier live ingestion cascade: (1) Primary: Official CPCB CAAQMS national monitoring feed across 28 physical sensors in 7 cities, (2) Secondary: Open-Meteo Air Quality powered by EU Copernicus CAMS, (3) Tertiary: OpenWeatherMap Air Pollution API and WAQI (with a 50km distance guard), and (4) OpenStreetMap Overpass for runtime pollution source discovery.",
        "Implemented in app/ingestion.py. OpenAQ and MODIS were preliminary proposal references; our live codebase runs direct CPCB RSS, Copernicus CAMS, OWM, WAQI, and OSM."
    )

    add_qa(
        "Is the data real-time?",
        "Yes. AeroTrace runs a 30-second internal application refresh cycle. Every data frame explicitly exposes its upstream provider source, observation timestamp (+05:30 IST), and last_polled_at timestamp so users always know the exact age of the reading.",
        "In-memory 30s TTL cache prevents upstream API hammering while maintaining instantaneous sub-10ms UI delivery."
    )

    add_qa(
        "What happens if readings are missing or stale?",
        "Readings older than 120 minutes are explicitly marked with an 'is_stale: true' flag and visual UI banner. If primary CPCB ground sensors are offline, the engine seamlessly fails over to the Copernicus CAMS/OWM ensemble. If all external networks fail, it serves a deterministic diurnal baseline strictly marked 'SIMULATED'.",
        "Tested in tests/test_ingestion_cascade.py (TestIngestionCascade.test_emergency_floor_simulation_labeled_correctly)."
    )

    add_qa(
        "Why combine ground stations and satellite/model data?",
        "Physical ground stations provide authentic point-source ground truth, but sensor networks have spatial gaps. Satellite-assimilated atmospheric dispersion models (Copernicus CAMS) provide continuous spatial coverage across the broader airshed, creating a robust, multi-tier failover architecture.",
        "Open-Meteo provides Copernicus CAMS chemical transport data at ~10–25km grid resolution, calibrated to ground CAAQMS baselines."
    )

    # =========================================================================
    # SECTION 3
    # =========================================================================
    add_section_header("3. Wind Cone and Source Attribution", "Pasquill-Gifford atmospheric dispersion, upwind search geometry, and 5-factor scoring")

    add_qa(
        "What does the wind cone show?",
        "In Screen 4 (Forensic Investigation), the wind cone is an UPWIND SEARCH CONE pointing opposite to the wind vector to identify candidate emission sources that could have contributed to the spike. In Screen 5 (Prediction), it displays a DOWNWIND ADVECTION PLUME showing where pollutants will travel next.",
        "Opening half-angle (12° to 25°) and reach (2.5km to 7.0km) are dynamically parameterized by Pasquill-Gifford stability classes (A–F) in app/wind_cone.py."
    )

    add_qa(
        "How do you identify and rank potential pollution sources?",
        "We use a deterministic 5-factor mathematical scoring model: (1) Wind alignment (30% weight), (2) Chemical signature match (25%), (3) Temporal operating schedule (20%), (4) Spatial proximity decay (15%), and (5) Past compliance violation penalty (10% boost). The resulting confidence score ranks candidates from 0.0 to 1.0.",
        "Scoring logic in app/scoring.py (compute_confidence). Chemical match compares crustal (PM10) vs combustion (PM2.5/NO2/SO2) ratios."
    )

    add_qa(
        "Can you prove a factory or site caused an AQI spike?",
        "No, and AeroTrace does not claim legal proof. Our platform produces forensic investigative leads and potential source attribution to prioritize inspections. Establishing legal culpability requires on-site stack monitoring, physical sampling, and regulatory enforcement procedures.",
        "Attribution results are explicitly tagged as candidate rankings with confidence intervals, not definitive causation."
    )

    add_qa(
        "What if wind direction changes?",
        "When wind shifts, the upwind search sector immediately recalculates. If the wind vector no longer aligns with a candidate source, its wind alignment score drops to zero, and the platform surfaces alternative candidates that fall inside the new upwind trajectory.",
        "Evaluated via wind_alignment_score in app/scoring.py: sources outside the cone receive an alignment score of 0.0."
    )

    add_qa(
        "What is the difference between a wind cone and a heatmap?",
        "A heatmap displays static spatial concentration levels without directional intelligence. A wind cone is a physics-driven vector geometry incorporating atmospheric turbulence, advective wind transport, and stability classes to model dynamic pollutant transport pathways.",
        "Heatmaps show WHERE pollution is; wind cones show WHERE IT CAME FROM and WHERE IT IS BLOWING."
    )

    # =========================================================================
    # SECTION 4
    # =========================================================================
    add_section_header("4. Forecasting, Alerts, and Vulnerable Zones", "Atmospheric decay physics, 3-tier alerts, and automated anomaly detection")

    add_qa(
        "How do you forecast AQI?",
        "Our Prediction engine uses an atmospheric exponential dispersion decay model: AQI(t) = AQI_0 × exp(-k × t). The decay constant k (0.025 to 0.14 h⁻¹) is dynamically derived from real-time Pasquill-Gifford atmospheric stability classes, coupled with an expanding uncertainty confidence envelope of ±(5% + 3% × t) over 1h, 3h, and 6h horizons.",
        "Implemented in app/prediction.py. Pasquill decay rates: Class A (0.14 h⁻¹ rapid dilution) to Class F (0.025 h⁻¹ inversion trapping)."
    )

    add_qa(
        "How accurate is the forecast?",
        "Our forward projection is a deterministic atmospheric physics model rather than a black-box regression. We present projected trends with explicit expanding uncertainty bounds (±5% at 1H to ±23% at 6H) and clearly state: 'Estimated forecast - see methodology'. Formal MAE/RMSE benchmark figures will be certified over long-term seasonal validation.",
        "Never invent an arbitrary accuracy percentage. State the physical model and expanding confidence bounds."
    )

    add_qa(
        "What happens during an unexpected pollution event?",
        "If a sudden spike occurs, the anomaly detector immediately triggers an alert and resets the baseline. The forecast projection re-anchors to the new elevated concentration and updates the downwind dispersion polygon.",
        "Handled via app/prediction.py re-anchoring to live station telemetry or spike values."
    )

    add_qa(
        "How do you identify vulnerable zones?",
        "We perform spatial cross-referencing between the projected downwind dispersion footprint and open-source spatial datasets of sensitive receptors—specifically schools, hospitals, residential zones, and senior care facilities located within the impact corridor.",
        "Receptors are identified in app/intelligence.py and visualised as map overlays in Screen 5."
    )

    add_qa(
        "How are alerts classified as critical, high, or moderate?",
        "Alerts follow three strict tiers in app/alerts.py: (1) Advisory: AQI 101–200 or NAAQS exceedance factor ≥ 1.0, (2) Warning: AQI 201–400 or exceedance factor ≥ 2.0, and (3) Severe Emergency: AQI > 400 or acute particulate thresholds (PM2.5 > 250 µg/m³ or PM10 > 430 µg/m³).",
        "Each alert provides localized citizen health recommendations and operational municipal enforcement steps in EN, HI, MR."
    )

    add_qa(
        "Is spike detection automatic?",
        "Yes, our backend poller automatically monitors telemetry every cycle and flags spikes whenever AQI exceeds 150 or consecutive readings jump by ΔAQI ≥ 25. For live jury demonstrations, we also provide a manual spike injection endpoint to trigger immediate WebSocket broadcast workflows on demand.",
        "Automatic detection in app/cpcb_poller.py & app/analytics_intelligence.py; interactive demo trigger at POST /api/v1/simulation/trigger-spike."
    )

    # =========================================================================
    # SECTION 5
    # =========================================================================
    add_section_header("5. Forensic Action Center and Impact", "Civic enforcement protocols, statutory GRAP alignment, and multi-demographic utility")

    add_qa(
        "What is the Forensic Action Center?",
        "It is our municipal and regulatory command surface that translates technical attribution into tiered, operational civic interventions—including mechanical road sweeping, targeted water mist sprinkling, diesel generator bans, and industrial enforcement audits.",
        "Structured around statutory Graded Response Action Plan (GRAP) tiers in app/intervention.py and app/alerts.py."
    )

    add_qa(
        "Are the recommended actions generated by Gemini?",
        "No. The selection of enforcement measures is deterministic and governed by statutory CPCB and municipal environmental bylaws. Gemini is used solely to articulate and summarize these recommendations into natural-language, citizen-friendly, and multilingual advisory briefings.",
        "Regulatory logic in app/intervention.py; Gemini provides multilingual synthesis (EN, HI, MR) in app/ai_service.py."
    )

    add_qa(
        "What makes the platform actionable?",
        "Most air quality dashboards stop at telling citizens that the air is toxic. AeroTrace closes the loop: it pinpoints the likely upwind source category, identifies downwind vulnerable receptors, and prescribes specific, timed municipal interventions to neutralize the spike.",
        "End-to-end workflow: National Overview → City Airshed → Physical Station → Source Attribution → Forecast → Civic Action."
    )

    add_qa(
        "Who benefits from AeroTrace A(Q)I?",
        "Two key stakeholders: (1) Municipal authorities and pollution control boards (SPCBs/CPCB), who gain rapid investigative triage to deploy field inspectors efficiently, and (2) Citizens and vulnerable demographics, who receive localized, plain-language health guidance in their native language.",
        "Multilingual support covers English, Hindi, and Marathi with synchronized text-to-speech voice readouts."
    )

    add_qa(
        "What is your key differentiator?",
        "AeroTrace moves beyond passive AQI display to active forensic attribution. By fusing physical ground monitoring, atmospheric dispersion physics, runtime source discovery, and Google AI explanation into a single workflow, we transform raw environmental sensor data into accountable civic action.",
        "Full-stack integration: 28 physical CPCB stations, Pasquill-Gifford plume physics, OSM Overpass source graph, and Gemini."
    )

    # =========================================================================
    # SECTION 6
    # =========================================================================
    add_section_header("6. Future Vision and Google Technologies", "Multimodal incident triage, Google Earth Engine context, and scalable cloud architecture")

    add_qa(
        "How could citizen-submitted images be used?",
        "In our future roadmap, multimodal Gemini models (such as Gemini 1.5 Pro) could analyze citizen-uploaded photos of black smoke or burning waste to identify visual plume opacity and source category, cross-referenced with GPS, timestamp, and active wind vectors to filter false reports.",
        "Planned roadmap extension. An image alone cannot measure microgram concentrations, but provides crowdsourced verification."
    )

    add_qa(
        "How could Google Earth Engine help?",
        "Google Earth Engine would provide high-resolution multi-temporal satellite data (Sentinel-5P TROPOMI NO2 columns, thermal anomaly hotspots for stubble burning, and land-use change) to supplement ground monitoring across unmonitored rural and peri-urban corridors.",
        "Architecture designed for GEE integration via planetary-scale raster computation alongside BigQuery spatial analytics."
    )

    add_qa(
        "How could carbon credits fit into the vision?",
        "AeroTrace could provide the verifiable data pipeline for Measurement, Reporting, and Verification (MRV) of emissions reduction projects. By tracking empirical air quality improvements following municipal interventions, it can help audit environmental compliance for carbon offset initiatives.",
        "Requires certified greenhouse gas accounting methodologies; AQI reduction serves as empirical evidence, not standalone credit creation."
    )

    add_qa(
        "Which other Google technologies might be useful later?",
        "We are evaluating Google Earth Engine for satellite raster context, Vertex AI for continuous MLOps and automated fine-tuning of spatial dispersion models, and BigQuery GIS for querying planetary-scale historical sensor and meteorological datasets.",
        "Framed strictly as future technology roadmap, demonstrating architectural maturity and platform scalability."
    )

    add_qa(
        "What would you improve first?",
        "I would expand our live ground sensor network integration beyond the 7 pilot cities, deploy automated camera integration at key industrial clusters for optical plume verification, and conduct empirical tracer-gas field calibrations of our Pasquill dispersion parameters.",
        "Focus on ground-truth density, automated physical validation, and empirical dispersion calibration."
    )

    add_qa(
        "What is your future vision?",
        "Our vision is to transform AeroTrace into a national Environmental Intelligence Grid—enabling every municipal corporation in India to proactively detect, trace, and mitigate episodic air pollution events before they develop into hazardous public health emergencies.",
        "From reactive AQI dashboards to proactive, accountable environmental governance."
    )

    # =========================================================================
    # SUMMARY CHEAT SHEET TABLE
    # =========================================================================
    doc.add_page_break()
    add_section_header("Executive 10-Second Pitch Cheat Sheet", "Rapid-fire reference table for instant jury responses")

    matrix_table = doc.add_table(rows=6, cols=3)
    matrix_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    matrix_table.autofit = False

    col_widths = [Inches(1.5), Inches(3.2), Inches(2.3)]
    headers = ["Domain / Theme", "10-Second Core Answer", "Technical Anchor / Formula"]

    hdr_row = matrix_table.rows[0]
    for i, title in enumerate(headers):
        cell = hdr_row.cells[i]
        cell.width = col_widths[i]
        set_cell_background(cell, "0F172A")
        set_cell_margins(cell, top=120, bottom=120, left=120, right=120)
        p = cell.paragraphs[0]
        r = p.add_run(title)
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    matrix_data = [
        (
            "Google AI Role",
            "Gemini 1.5 Flash provides natural-language explanations and multilingual citizen summaries (EN, HI, MR); it does not compute AQI or prove legal source causation.",
            "app/ai_service.py\ngemini-1.5-flash with rule-based fallback"
        ),
        (
            "Environmental Data Pipeline",
            "Official CPCB CAAQMS ground monitors across 28 stations in 7 cities, backed by Copernicus CAMS (Open-Meteo), OpenWeatherMap, and OSM Overpass for runtime source discovery.",
            "app/ingestion.py\n4-tier failover cascade with 30s TTL cache"
        ),
        (
            "Source Attribution",
            "An upwind Pasquill-Gifford search cone combined with a 5-factor mathematical confidence score to generate prioritized investigative leads.",
            "app/scoring.py\n30% Wind, 25% Chem, 20% Temp, 15% Dist, 10% Pen"
        ),
        (
            "Forecasting Model",
            "An atmospheric exponential dispersion decay model parameterized by Pasquill-Gifford stability classes (A to F) with expanding confidence bounds.",
            "app/prediction.py\nAQI(t) = AQI_0 × exp(-k·t)\nk ∈ [0.025, 0.14] h⁻¹"
        ),
        (
            "Forensic Actions",
            "Enforcement measures are deterministic and aligned with statutory CPCB GRAP bylaws; Gemini solely translates and articulates them for civic teams.",
            "app/intervention.py & app/alerts.py\nStatutory GRAP decision matrix"
        ),
    ]

    for row_idx, data in enumerate(matrix_data, start=1):
        row = matrix_table.rows[row_idx]
        bg = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for col_idx in range(3):
            cell = row.cells[col_idx]
            cell.width = col_widths[col_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
            set_cell_border(cell, bottom={"val": "single", "sz": "4", "color": "E2E8F0"})
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(data[col_idx])
            r.font.size = Pt(9)
            if col_idx == 0:
                r.font.bold = True
                r.font.color.rgb = C_NAVY
            elif col_idx == 1:
                r.font.color.rgb = RGBColor(30, 41, 59)
            else:
                r.font.italic = True
                r.font.color.rgb = C_CYAN

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # --- Three Rules Box ---
    rules_box = doc.add_table(rows=1, cols=1)
    rules_box.alignment = WD_TABLE_ALIGNMENT.CENTER
    rules_cell = rules_box.cell(0, 0)
    rules_cell.width = Inches(7.0)
    set_cell_background(rules_cell, "FEF2F2") # Light Red
    set_cell_border(rules_cell, left={"val": "single", "sz": "18", "color": "DC2626"})
    set_cell_margins(rules_cell, top=140, bottom=140, left=180, right=180)

    p_r = rules_cell.paragraphs[0]
    p_r.paragraph_format.space_after = Pt(2)
    r_r_title = p_r.add_run("THREE GOLDEN RULES FOR THE JURY ROUND:\n")
    r_r_title.font.bold = True
    r_r_title.font.size = Pt(10)
    r_r_title.font.color.rgb = C_RED

    r_r_body = p_r.add_run(
        "1. Keep each initial answer to 10–15 seconds (1–2 sentences). Let the judges pull for depth.\n"
        "2. Never invent an algorithm, accuracy percentage, or unintegrated Google technology. If unmeasured, state the methodology and expanding bounds.\n"
        "3. Frame source attribution as an investigative search prioritization tool, never certified legal causation."
    )
    r_r_body.font.size = Pt(9.5)
    r_r_body.font.color.rgb = RGBColor(30, 41, 59)

    # Save document
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)
    print(f"Document successfully saved to: {output_path}")

if __name__ == "__main__":
    out_file = r"d:\Projects\AeroTrace A(Q)I\docs\AeroTrace_Finalist_Jury_QA_Crisp_Answer_Sheet.docx"
    build_document(out_file)
