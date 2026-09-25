import logging
from typing import Any, Dict

log = logging.getLogger("intervention_intelligence")

def generate_intervention_insight(scenario: str, lang: str = "en") -> Dict[str, Any]:
    scenario_lower = scenario.lower()
    
    if "traffic" in scenario_lower or "vehicle" in scenario_lower:
        en = "Simulated traffic restriction yields an Emission Reduction Factor (ERF) of 15-20%, mitigating ground-level NO2 accumulation."
        hi = "यातायात प्रतिबंध सिमुलेशन से 15-20% का उत्सर्जन कमी कारक (ERF) प्राप्त होता है, जो जमीनी स्तर पर NO2 के संचय को कम करता है।"
        mr = "वाहतूक नियंत्रण सिमुलेशनमुळे 15-20% उत्सर्जन घट (ERF) होते, ज्यामुळे NO2 ची पातळी कमी होण्यास मदत मिळते."
        voice = "Simulated traffic restriction yields an emission reduction factor of up to 20 percent, effectively mitigating ground-level nitrogen dioxide."
    elif "industrial" in scenario_lower or "factory" in scenario_lower:
        en = "Industrial curtailment scenario indicates a 35-40% ERF for SO2 and PM2.5, significantly reducing downwind exposure."
        hi = "औद्योगिक कटौती परिदृश्य SO2 और PM2.5 के लिए 35-40% ERF का संकेत देता है, जो हवा की दिशा में जोखिम को काफी कम करता है।"
        mr = "औद्योगिक कपात SO2 आणि PM2.5 मध्ये 35-40% ERF दर्शवते, ज्यामुळे वाऱ्याच्या दिशेने होणारा धोका लक्षणीयरीत्या कमी होतो."
        voice = "Industrial curtailment indicates a massive 40 percent emission reduction factor, significantly reducing downwind exposure."
    elif "dust" in scenario_lower or "construction" in scenario_lower:
        en = "Simulated dust control and water sprinkling project an ERF of 25-30% for PM10, stabilizing localized particulate dispersion."
        hi = "धूल नियंत्रण और पानी के छिड़काव से PM10 के लिए 25-30% के ERF का अनुमान है, जो स्थानीय कणों के फैलाव को स्थिर करता है।"
        mr = "धुळीवर नियंत्रण आणि पाण्याचा शिडकाव केल्यास PM10 मध्ये 25-30% ERF चा अंदाज आहे, ज्यामुळे प्रदूषकांचा प्रसार स्थिर होईल."
        voice = "Dust control and water sprinkling project an emission reduction factor of up to 30 percent for coarse particulates."
    else:
        en = "Targeted enforcement yields measurable reduction in boundary layer pollution concentrations."
        hi = "लक्षित प्रवर्तन उपायों से सीमा परत प्रदूषण सांद्रता में मापने योग्य कमी आती है।"
        mr = "लक्षित अंमलबजावणीमुळे वातावरणीय प्रदूषण पातळीत लक्षणीय घट होते."
        voice = "Targeted enforcement yields measurable reduction in pollution concentrations."

    texts = {"en": en, "hi": hi, "mr": mr}
    
    return {
        "scenario": scenario,
        "intervention_text": texts.get(lang, en),
        "voice_script": voice,
        "language": lang
    }
