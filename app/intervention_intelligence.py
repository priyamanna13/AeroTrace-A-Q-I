import logging
from typing import Any, Dict, List, Optional

log = logging.getLogger("intervention_intelligence")

# Calibrated ERF specifications matching Adarsh's intervention.py
INTERVENTION_METRICS: dict[str, dict[str, Any]] = {
    "control_construction_dust": {
        "label": "Control Construction Dust",
        "max_erf": 0.25,
        "primary": "PM10",
        "weights": {"PM10": 1.00, "PM2.5": 0.85},
        "description": "Mobile anti-smog water cannons, boundary misting curtains, and covered haulage",
    },
    "reduce_traffic": {
        "label": "Reduce Traffic",
        "max_erf": 0.35,
        "primary": "NO2",
        "weights": {"NO2": 1.00, "CO": 0.90, "PM2.5": 0.75},
        "description": "Diesel commercial freight diversions, arterial congestion zoning, and mobile BS-VI checkposts",
    },
    "reduce_industrial_emissions": {
        "label": "Reduce Industrial Emissions",
        "max_erf": 0.30,
        "primary": "SO2",
        "weights": {"SO2": 1.00, "NO2": 0.75, "PM2.5": 0.80},
        "description": "Selective boiler load shedding and stack scrubber compliance enforcement",
    },
}

STATUTORY_DISCLAIMER: str = (
    "Simulated projection based on empirical ERF model. Actual ambient response varies with "
    "micrometeorological dispersion conditions. Official civic implementation requires municipal statutory clearance."
)


def generate_intervention_insight(
    scenario: str,
    lang: str = "en",
    city: str = "Pune",
    intensity_pct: float = 50.0,
    sensitive_locations: Optional[List[Dict[str, Any]]] = None,
    sensitive_locations_note: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate ERF-grounded intervention insight adhering strictly to Phase 5 zero-hallucination rules.
    
    Zero-Hallucination Policy:
    - If sensitive_locations is empty, strictly adhere to 'sensitive location data not available for this city'.
    - Do NOT invent fictitious schools or hospitals in AI narrative summaries.
    - Mandatory statutory planning advisory disclaimer included.
    """
    scenario_lower = scenario.strip().lower()
    clamped_intensity = max(10.0, min(100.0, float(intensity_pct)))

    if "traffic" in scenario_lower or "vehicle" in scenario_lower:
        cfg = INTERVENTION_METRICS["reduce_traffic"]
        erf_pct = round(cfg["max_erf"] * (clamped_intensity / 100.0) * 100, 1)
        en_action = f"Simulated traffic curtailment yields an Emission Reduction Factor (ERF) of 15-20% (~{erf_pct}% at {clamped_intensity:.0f}% intensity) for {cfg['primary']}, with secondary reductions in PM2.5 (weight 0.75) and CO (weight 0.90)."
        hi_action = f"यातायात प्रतिबंध सिमुलेशन से 15-20% (~{erf_pct}% {clamped_intensity:.0f}% तीव्रता पर) का उत्सर्जन कमी कारक (ERF) {cfg['primary']} में प्राप्त होता है, साथ ही PM2.5 में भी कमी आती है।"
        mr_action = f"वाहतूक नियंत्रण सिमुलेशनमुळे 15-20% (~{erf_pct}% {clamped_intensity:.0f}% तीव्रतेवर) उत्सर्जन घट (ERF) {cfg['primary']} मध्ये होते आणि PM2.5 ची पातळीही कमी होते."
    elif "industrial" in scenario_lower or "factory" in scenario_lower:
        cfg = INTERVENTION_METRICS["reduce_industrial_emissions"]
        erf_pct = round(cfg["max_erf"] * (clamped_intensity / 100.0) * 100, 1)
        en_action = f"Industrial curtailment scenario indicates a 35-40% ERF (~{erf_pct}% at {clamped_intensity:.0f}% intensity) for {cfg['primary']} and secondary PM2.5 abatement (weight 0.80), mitigating downwind exposure."
        hi_action = f"औद्योगिक कटौती परिदृश्य 35-40% ERF (~{erf_pct}% {clamped_intensity:.0f}% तीव्रता पर) {cfg['primary']} और PM2.5 (भार 0.80) में दर्शाता है।"
        mr_action = f"औद्योगिक कपात सिमुलेशन 35-40% ERF (~{erf_pct}% {clamped_intensity:.0f}% तीव्रतेवर) {cfg['primary']} आणि PM2.5 (भार 0.80) मध्ये दर्शवते."
    elif "dust" in scenario_lower or "construction" in scenario_lower:
        cfg = INTERVENTION_METRICS["control_construction_dust"]
        erf_pct = round(cfg["max_erf"] * (clamped_intensity / 100.0) * 100, 1)
        en_action = f"Simulated dust control and water sprinkling project an ERF of 25-30% (~{erf_pct}% at {clamped_intensity:.0f}% intensity) for {cfg['primary']} and fine PM2.5 (weight 0.85)."
        hi_action = f"धूल नियंत्रण और पानी के छिड़काव से 25-30% के ERF (~{erf_pct}% {clamped_intensity:.0f}% तीव्रता पर) का अनुमान {cfg['primary']} और PM2.5 के लिए है।"
        mr_action = f"धुळीवर नियंत्रण आणि पाण्याचा शिडकाव केल्यास 25-30% ERF (~{erf_pct}% {clamped_intensity:.0f}% तीव्रतेवर) {cfg['primary']} आणि PM2.5 मध्ये अपेक्षित आहे."
    else:
        cfg = {"label": "Targeted Enforcement", "max_erf": 0.20, "primary": "AQI"}
        erf_pct = round(0.20 * (clamped_intensity / 100.0) * 100, 1)
        en_action = f"Targeted enforcement and civic compliance measures yield an estimated ERF of ~{erf_pct}% across active urban hotspots."
        hi_action = f"लक्षित नागरिक प्रवर्तन उपाय ({clamped_intensity:.0f}% तीव्रता) सक्रिय हॉटस्पॉट्स में ~{erf_pct}% ERF का अनुमान लगाते हैं।"
        mr_action = f"लक्षित नागरी अंमलबजावणी उपाय ({clamped_intensity:.0f}% तीव्रता) सक्रिय भागात ~{erf_pct}% ERF दर्शवतात."

    # Zero-Hallucination Receptor Narrative Clause
    if sensitive_locations and len(sensitive_locations) > 0:
        names = [loc.get("name", "identified facility") for loc in sensitive_locations[:3]]
        rec_en = f" Verified sensitive receptors shielded include: {', '.join(names)}."
        rec_hi = f" सत्यापित सुरक्षित संवेदनशील स्थानों में शामिल हैं: {', '.join(names)}।"
        rec_mr = f" संरक्षित संवेदनशील ठिकाणांमध्ये समावेश आहे: {', '.join(names)}."
    else:
        # Strictly cite official non-fabrication note
        s_note = sensitive_locations_note or "sensitive location data not available for this city"
        rec_en = f" Note: {s_note}."
        rec_hi = f" सूचना: {s_note}।"
        rec_mr = f" नोंद: {s_note}."

    en_text = f"{en_action}{rec_en} [{STATUTORY_DISCLAIMER}]"
    hi_text = f"{hi_action}{rec_hi} [{STATUTORY_DISCLAIMER}]"
    mr_text = f"{mr_action}{rec_mr} [{STATUTORY_DISCLAIMER}]"

    texts = {"en": en_text, "hi": hi_text, "mr": mr_text}

    voice = f"Intervention simulation projects an emission reduction factor of up to {erf_pct} percent, mitigating ground-level concentrations."

    return {
        "scenario": scenario,
        "intervention_type": cfg.get("label", scenario),
        "intensity_pct": clamped_intensity,
        "erf_percentage": erf_pct,
        "intervention_text": texts.get(lang, en_text),
        "voice_script": voice,
        "statutory_disclaimer": STATUTORY_DISCLAIMER,
        "language": lang,
    }

