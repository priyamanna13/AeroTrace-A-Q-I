"""Contextual Alerts Subsystem for AeroTrace NGEC 2026.

Implements threshold-based environmental alerts categorized by:
  - Advisory (AQI 101-200 or NAAQS exceedance factor >= 1.0)
  - Warning (AQI 201-400 or exceedance factor >= 2.0)
  - Severe Emergency (AQI > 400 or acute PM2.5 > 250 / PM10 > 430)

Provides:
  - Actionable health recommendations localized in EN, HI, MR for general, vulnerable, and sensitive groups.
  - Civic actionable measures for municipal administration and enforcement teams.
  - Strict data provenance linking back to physical station sensors or simulation fallback.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field

from .cities import get_city_overview, get_city_verified_stations, get_all_city_configs
from .standards import NAAQS_LIMITS

log = logging.getLogger("alerts")
IST = timezone(timedelta(hours=5, minutes=30))


class AlertSeverity(str, Enum):
    """Categorical severity for public health and civic environmental response."""
    ADVISORY = "Advisory"
    WARNING = "Warning"
    SEVERE_EMERGENCY = "Severe Emergency"


class ContextualAlert(BaseModel):
    """Standardized contextual alert schema."""
    alert_id: str = Field(..., description="Unique deterministic identifier for the alert event")
    severity: AlertSeverity = Field(..., description="Alert tier: Advisory, Warning, or Severe Emergency")
    city: str = Field(..., description="Target metropolitan area")
    station: Optional[str] = Field(None, description="Physical CAAQMS station identifier if station-specific")
    pollutant: str = Field(..., description="Dominant or triggering pollutant species")
    current_aqi: float = Field(..., description="Observed AQI value")
    trigger_value: float = Field(..., description="Concentration or AQI value triggering this alert")
    threshold_value: float = Field(..., description="Benchmark threshold that was crossed")
    data_source: str = Field(..., description="Upstream data provider or simulation status")
    data_timestamp: str = Field(..., description="ISO 8601 observation timestamp")
    is_simulated: bool = Field(False, description="True if based on fallback synthetic data")
    title: dict[str, str] = Field(..., description="Localized alert headline in en, hi, mr")
    message: dict[str, str] = Field(..., description="Localized contextual summary in en, hi, mr")
    health_recommendations: dict[str, list[str]] = Field(
        ..., description="Actionable health advice for citizens in en, hi, mr"
    )
    actionable_measures: dict[str, list[str]] = Field(
        ..., description="Operational civic and enforcement steps for civic teams in en, hi, mr"
    )
    deep_link: dict[str, Any] = Field(
        default_factory=dict, description="Screen routing metadata for frontend deep navigation"
    )
    created_at: str = Field(
        default_factory=lambda: datetime.now(IST).isoformat(),
        description="Timestamp when this alert payload was evaluated",
    )


# --------------------------------------------------------------------------- #
# Multi-lingual Template Registry
# --------------------------------------------------------------------------- #
def _build_alert_content(
    severity: AlertSeverity,
    city: str,
    station: Optional[str],
    pollutant: str,
    aqi: float,
    trigger_val: float,
    is_simulated: bool,
) -> tuple[dict[str, str], dict[str, str], dict[str, list[str]], dict[str, list[str]]]:
    """Generate localized titles, messages, health advice, and civic measures."""
    loc_str = f"{station}, {city}" if station else city
    p_upper = pollutant.upper()
    aqi_int = int(round(aqi))

    if severity == AlertSeverity.SEVERE_EMERGENCY:
        titles = {
            "en": f"CRITICAL AIR QUALITY EMERGENCY — {loc_str}",
            "hi": f"गंभीर वायु गुणवत्ता आपातकाल — {loc_str}",
            "mr": f"अतिगंभीर हवेची आणीबाणी — {loc_str}",
        }
        messages = {
            "en": (
                f"Severe atmospheric contamination detected in {loc_str} with AQI reaching {aqi_int} "
                f"driven by hazardous {p_upper} levels ({trigger_val:.1f}). Extreme health hazard across all demographics."
                + (" (SIMULATED DATA)" if is_simulated else "")
            ),
            "hi": (
                f"{loc_str} में AQI {aqi_int} के साथ गंभीर प्रदूषण स्तर दर्ज किया गया है, "
                f"जिसमें {p_upper} स्तर ({trigger_val:.1f}) खतरनाक है। सभी नागरिकों के लिए स्वास्थ्य का अत्यधिक जोखिम।"
                + (" (सिम्युलेटेड डेटा)" if is_simulated else "")
            ),
            "mr": (
                f"{loc_str} मध्ये AQI {aqi_int} सह अतिगंभीर प्रदूषण नोंदवले गेले असून "
                f"{p_upper} चे प्रमाण ({trigger_val:.1f}) धोकादायक आहे. सर्व नागरिकांच्या आरोग्यासाठी अत्यंत घातक."
                + (" (सिम्युलेटेड डेटा)" if is_simulated else "")
            ),
        }
        health = {
            "en": [
                "CRITICAL HEALTH HAZARD: Avoid all outdoor physical activity. Keep doors and windows tightly sealed.",
                "Vulnerable groups (children, elderly, cardiovascular/respiratory patients) must remain strictly indoors with HEPA air filtration.",
                "Seek immediate medical consultation in case of acute breathing distress, wheezing, or chest tightness.",
            ],
            "hi": [
                "गंभीर स्वास्थ्य जोखिम: सभी बाहरी शारीरिक गतिविधियों से बचें। दरवाजों और खिड़कियों को मजबूती से बंद रखें।",
                "संवेदनशील समूह (बच्चे, बुजुर्ग, हृदय व श्वास रोगी) HEPA एयर फिल्टर के साथ पूरी तरह से घर के अंदर रहें।",
                "सांस लेने में अत्यधिक कठिनाई, घरघराहट या सीने में जकड़न होने पर तुरंत डॉक्टर से संपर्क करें।",
            ],
            "mr": [
                "अतिगंभीर आरोग्य धोका: सर्व बाह्य शारीरिक हालचाली पूर्णपणे टाळा. खिडक्या व दारे घट्ट बंद ठेवा.",
                "संवेदनशील गट (मुले, वृद्ध, हृदय व दमा रुग्ण) यांनी HEPA एअर प्युरिफायरसह घरातच राहावे.",
                "श्वास घेण्यास तीव्र त्रास किंवा छातीत कळ आल्यास तातडीने वैद्यकीय सल्ला घ्यावा.",
            ],
        }
        civic = {
            "en": [
                "Issue immediate stop-work orders for construction and demolition activities across the zone.",
                "Mandate continuous water-misting cannons and anti-smog guns along arterial transport corridors.",
                "Enforce strict entry restrictions on non-essential commercial diesel trucks.",
            ],
            "hi": [
                "संबंधित क्षेत्र में निर्माण और विध्वंस गतिविधियों पर तत्काल रोक लगाने के आदेश जारी करें।",
                "प्रमुख सड़कों पर लगातार वाटर-कैनन मिस्टिंग और एंटी-स्मॉग गन का संचालन करें।",
                "गैर-आवश्यक वाणिज्यिक डीजल ट्रकों के शहर में प्रवेश पर पूर्ण प्रतिबंध लगाएं।",
            ],
            "mr": [
                "संबंधित परिसरातील सर्व बांधकाम आणि पाडकाम कामांवर तातडीने बंदीचे आदेश लागू करा.",
                "प्रमुख रस्त्यांवर सतत पाण्याचे फवारे (वॉटर कॅनन) आणि अँटी-स्मॉग गन चालवा.",
                "अनावश्यक अवजड डिझेल वाहनांच्या शहर प्रवेशावर कडक निर्बंध घाला.",
            ],
        }

    elif severity == AlertSeverity.WARNING:
        titles = {
            "en": f"AIR QUALITY WARNING — {loc_str}",
            "hi": f"वायु गुणवत्ता चेतावनी — {loc_str}",
            "mr": f"हवेची गुणवत्ता चेतावणी — {loc_str}",
        }
        messages = {
            "en": (
                f"Air quality in {loc_str} has deteriorated to Poor/Very Poor with AQI at {aqi_int} "
                f"({p_upper}: {trigger_val:.1f}). Pronounced respiratory discomfort likely for active populations."
                + (" (SIMULATED DATA)" if is_simulated else "")
            ),
            "hi": (
                f"{loc_str} में वायु गुणवत्ता गिरकर खराब श्रेणी में पहुंच गई है, जहां AQI {aqi_int} है "
                f"({p_upper}: {trigger_val:.1f})। सक्रिय आबादी को सांस लेने में कठिनाई हो सकती है।"
                + (" (सिम्युलेटेड डेटा)" if is_simulated else "")
            ),
            "mr": (
                f"{loc_str} मध्ये हवेची गुणवत्ता घसरून वाईट श्रेणीत पोहोचली असून AQI {aqi_int} आहे "
                f"({p_upper}: {trigger_val:.1f}). नागरिकांना श्वसनाचा त्रास होण्याची शक्यता आहे."
                + (" (सिम्युलेटेड डेटा)" if is_simulated else "")
            ),
        }
        health = {
            "en": [
                "Unhealthy atmospheric conditions. Wear certified N95/N99 particulate respirators when stepping outdoors.",
                "Limit vigorous exercise and prolonged morning/evening walks outdoors.",
                "Ensure school children are not engaged in prolonged outdoor sports during peak smog hours.",
            ],
            "hi": [
                "अस्वस्थ वायुमंडलीय स्थिति। बाहर निकलते समय प्रमाणित N95/N99 मास्क का उपयोग करें।",
                "सुबह और शाम के समय बाहरी भारी व्यायाम और लंबी सैर को सीमित करें।",
                "यह सुनिश्चित करें कि स्कूली बच्चे पीक आवर्स के दौरान बाहर मैदान में न खेलें।",
            ],
            "mr": [
                "हवेची स्थिती अस्वस्थ आहे. घराबाहेर पडताना प्रमाणित N95/N99 मास्क वापरा.",
                "सकाळच्या आणि संध्याकाळच्या वेळी बाहेर व्यायाम किंवा धावणे टाळा.",
                "शाळेतील विद्यार्थ्यांना प्रदूषणाच्या वेळी जास्त वेळ मैदानावर खेळू देऊ नका.",
            ],
        }
        civic = {
            "en": [
                "Deploy mechanized road vacuum sweepers and periodic dust-suppression sprinkling.",
                "Intensify patrols against illegal biomass, municipal solid waste, and leaf burning.",
                "Prohibit the operation of diesel generator sets except for essential medical facilities.",
            ],
            "hi": [
                "सड़कों की मशीनीकृत वैक्यूम सफाई और नियमित पानी के छिड़काव का अभियान चलाएं।",
                "बायोमास, कचरा और पत्तियों को जलाने के खिलाफ विशेष गश्त तेज करें।",
                "आपातकालीन चिकित्सा सेवाओं को छोड़कर डीजल जनरेटर सेटों के उपयोग पर प्रतिबंध लगाएं।",
            ],
            "mr": [
                "रस्त्यांची यांत्रिक व्हॅक्यूम स्वच्छता व धूळ नियंत्रणासाठी पाण्याचे फवारे मारा.",
                "कचरा, पालापाचोळा किंवा बायोमास जाळण्याविरोधात विशेष पथके तैनात करा.",
                "रुग्णालये वगळता इतर सर्व ठिकाणी डिझेल जनरेटरच्या वापरावर बंदी घाला.",
            ],
        }

    else:  # Advisory
        titles = {
            "en": f"AIR QUALITY ADVISORY — {loc_str}",
            "hi": f"वायु गुणवत्ता सलाह — {loc_str}",
            "mr": f"हवेची गुणवत्ता सल्ला — {loc_str}",
        }
        messages = {
            "en": (
                f"Moderate to elevated pollution levels observed in {loc_str} (AQI: {aqi_int}, dominant: {p_upper}). "
                f"Exceedance of ambient environmental standards may impact sensitive groups."
                + (" (SIMULATED DATA)" if is_simulated else "")
            ),
            "hi": (
                f"{loc_str} में वायु प्रदूषण का स्तर सामान्य से अधिक पाया गया है (AQI: {aqi_int}, प्रमुख: {p_upper})। "
                f"पर्यावरणीय मानकों के उल्लंघन से संवेदनशील व्यक्तियों पर प्रभाव पड़ सकता है।"
                + (" (सिम्युलेटेड डेटा)" if is_simulated else "")
            ),
            "mr": (
                f"{loc_str} मध्ये हवेचे प्रदूषण मध्यम ते वाढलेले आढळले आहे (AQI: {aqi_int}, मुख्य: {p_upper}). "
                f"मानकांपेक्षा जास्त प्रदूषणामुळे संवेदनशील व्यक्तींना त्रास होऊ शकतो."
                + (" (सिम्युलेटेड डेटा)" if is_simulated else "")
            ),
        }
        health = {
            "en": [
                "Air quality is degraded. Asthmatic and cardiac patients should carry prescribed inhalers and medications.",
                "Keep home and vehicle ventilation on recirculate mode during traffic congestion.",
                "Consider wearing lightweight protective face coverings in dusty transit corridors.",
            ],
            "hi": [
                "वायु गुणवत्ता सामान्य से खराब है। दमा और हृदय रोगी अपनी निर्धारित दवाएं साथ रखें।",
                "ट्रैफिक जाम के दौरान घर और वाहन के वेंटिलेशन को रीसर्क्युलेट मोड पर रखें।",
                "धूल भरे रास्तों पर चलते समय सुरक्षात्मक फेस मास्क पहनें।",
            ],
            "mr": [
                "हवेची गुणवत्ता घसरलेली आहे. दमा व हृदयविकार असणाऱ्यांनी नियमित औषधे सोबत ठेवावीत.",
                "वाहतूक कोंडीत असताना वाहनातील हवा अंतर्गत पुनर्प्रवाह (Recirculate) मोडवर ठेवा.",
                "धूळयुक्त परिसरात जाताना तोंडाला मास्क किंवा रुमाल बांधा.",
            ],
        }
        civic = {
            "en": [
                "Enforce mandatory dust screens and covered debris transport on all active construction permits.",
                "Optimize signal timing along congested bottlenecks to minimize vehicle idling emissions.",
                "Audit industrial stacks and monitor continuous emission monitoring systems (CEMS).",
            ],
            "hi": [
                "सभी निर्माण स्थलों पर धूल अवरोधक पर्दे और मलबे के ढंके हुए परिवहन को अनिवार्य करें।",
                "वाहनों के इंजन बंद रखने और जाम कम करने के लिए ट्रैफिक सिग्नल टाइमिंग को ठीक करें।",
                "औद्योगिक उत्सर्जन निगरानी प्रणालियों (CEMS) की जांच करें।",
            ],
            "mr": [
                "बांधकाम ठिकाणी धूळ रोखणारे हिरवे पडदे लावणे आणि ढिगारे झाकून नेणे सक्तीचे करा.",
                "वाहतूक कोंडी कमी करण्यासाठी सिग्नलचे नियोजन सुधारा.",
                "कारखान्यांच्या धुराड्यांमधून होणाऱ्या उत्सर्जनाची (CEMS) नियमित तपासणी करा.",
            ],
        }

    return titles, messages, health, civic


# --------------------------------------------------------------------------- #
# Evaluation Engine
# --------------------------------------------------------------------------- #
def evaluate_reading_alert(
    city: str,
    station: Optional[str],
    aqi: float,
    pollutants: dict[str, float],
    data_source: str,
    data_timestamp: str,
    is_simulated: bool = False,
) -> Optional[ContextualAlert]:
    """Evaluate whether a telemetry reading crosses threshold limits."""
    pm25 = float(pollutants.get("pm25") or 0.0)
    pm10 = float(pollutants.get("pm10") or 0.0)
    no2 = float(pollutants.get("no2") or 0.0)

    # 1. Check Severe Emergency (AQI > 400 or acute PM2.5 >= 250 / PM10 >= 430)
    if aqi > 400.0 or pm25 >= 250.0 or pm10 >= 430.0:
        severity = AlertSeverity.SEVERE_EMERGENCY
        if pm25 >= 250.0:
            dom = "pm25"
            trig_val = pm25
            thresh_val = 250.0
        elif pm10 >= 430.0:
            dom = "pm10"
            trig_val = pm10
            thresh_val = 430.0
        else:
            dom = "AQI"
            trig_val = aqi
            thresh_val = 400.0

    # 2. Check Warning (AQI > 200 or PM2.5 >= 120 / PM10 >= 250 / NO2 >= 160)
    elif aqi > 200.0 or pm25 >= 120.0 or pm10 >= 250.0 or no2 >= 160.0:
        severity = AlertSeverity.WARNING
        if pm25 >= 120.0:
            dom = "pm25"
            trig_val = pm25
            thresh_val = 120.0
        elif pm10 >= 250.0:
            dom = "pm10"
            trig_val = pm10
            thresh_val = 250.0
        elif no2 >= 160.0:
            dom = "no2"
            trig_val = no2
            thresh_val = 160.0
        else:
            dom = "AQI"
            trig_val = aqi
            thresh_val = 200.0

    # 3. Check Advisory (AQI > 100 or PM2.5 >= 60 / PM10 >= 100 / NO2 >= 80)
    elif aqi > 100.0 or pm25 >= 60.0 or pm10 >= 100.0 or no2 >= 80.0:
        severity = AlertSeverity.ADVISORY
        if pm25 >= 60.0:
            dom = "pm25"
            trig_val = pm25
            thresh_val = 60.0
        elif pm10 >= 100.0:
            dom = "pm10"
            trig_val = pm10
            thresh_val = 100.0
        elif no2 >= 80.0:
            dom = "no2"
            trig_val = no2
            thresh_val = 80.0
        else:
            dom = "AQI"
            trig_val = aqi
            thresh_val = 100.0

    else:
        return None  # Good / Satisfactory conditions, no alert needed

    titles, messages, health, civic = _build_alert_content(
        severity=severity,
        city=city,
        station=station,
        pollutant=dom,
        aqi=aqi,
        trigger_val=trig_val,
        is_simulated=is_simulated,
    )

    st_key = f"-{station.lower().replace(' ', '_')}" if station else ""
    sev_key = severity.value.lower().replace(" ", "_")
    alert_id = f"alert-{city.lower()}{st_key}-{dom.lower()}-{sev_key}"

    screen_target = "screen_4_investigation" if severity != AlertSeverity.ADVISORY else "screen_2_city"
    deep_link = {
        "screen": screen_target,
        "city": city,
        "station": station,
        "pollutant": dom.upper(),
        "severity": severity.value,
    }

    return ContextualAlert(
        alert_id=alert_id,
        severity=severity,
        city=city,
        station=station,
        pollutant=dom.upper(),
        current_aqi=round(aqi, 1),
        trigger_value=round(trig_val, 1),
        threshold_value=round(thresh_val, 1),
        data_source=data_source,
        data_timestamp=data_timestamp,
        is_simulated=is_simulated,
        title=titles,
        message=messages,
        health_recommendations=health,
        actionable_measures=civic,
        deep_link=deep_link,
    )


def evaluate_city_alerts(city_name: str, session: Any = None) -> list[ContextualAlert]:
    """Evaluate alerts for a given city across city overview and individual physical stations."""
    alerts: list[ContextualAlert] = []

    # 1. City-level aggregate overview
    overview = get_city_overview(city_name, session)
    if overview:
        polls = {
            "pm25": overview.get("pm25", 0.0),
            "pm10": overview.get("pm10", 0.0),
        }
        city_alert = evaluate_reading_alert(
            city=overview["city"],
            station=None,
            aqi=overview["current_aqi"],
            pollutants=polls,
            data_source=overview["data_source"],
            data_timestamp=overview["data_timestamp"],
            is_simulated=overview["is_simulated"],
        )
        if city_alert:
            alerts.append(city_alert)

    # 2. Individual verified physical CAAQMS stations
    stations = get_city_verified_stations(city_name, session) or []
    for st in stations:
        st_alert = evaluate_reading_alert(
            city=overview["city"] if overview else city_name,
            station=st.get("name"),
            aqi=st.get("current_aqi", 0.0),
            pollutants=st.get("pollutants", {}),
            data_source=st.get("data_source", "CPCB_CAAQMS"),
            data_timestamp=st.get("data_timestamp", ""),
            is_simulated=st.get("is_simulated", False),
        )
        if st_alert:
            alerts.append(st_alert)

    # Sort: Severe Emergency -> Warning -> Advisory
    sev_rank = {
        AlertSeverity.SEVERE_EMERGENCY: 0,
        AlertSeverity.WARNING: 1,
        AlertSeverity.ADVISORY: 2,
    }
    alerts.sort(key=lambda a: (sev_rank.get(a.severity, 3), -a.current_aqi))
    return alerts


def evaluate_all_cities_alerts(session: Any = None) -> list[ContextualAlert]:
    """Evaluate and aggregate active alerts across all 7 target cities."""
    all_alerts: list[ContextualAlert] = []
    configs = get_all_city_configs()

    for city_key, cfg in configs.items():
        city_name = cfg["city"]["name"]
        city_alerts = evaluate_city_alerts(city_name, session)
        all_alerts.extend(city_alerts)

    sev_rank = {
        AlertSeverity.SEVERE_EMERGENCY: 0,
        AlertSeverity.WARNING: 1,
        AlertSeverity.ADVISORY: 2,
    }
    all_alerts.sort(key=lambda a: (sev_rank.get(a.severity, 3), -a.current_aqi))
    return all_alerts
