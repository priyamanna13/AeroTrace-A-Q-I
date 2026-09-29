"""Live WebSocket streaming and manual spike injection simulation router."""
from __future__ import annotations

import dataclasses
import logging
from typing import Optional
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from ..api_helpers import _SCENARIO_LABELS, _build_attribution, manager, route_cache
from ..demo_scenarios import get_scenario

log = logging.getLogger(__name__)
router = APIRouter(tags=["Simulation"])


async def _ws_handler(websocket: WebSocket):
    """Shared handler for both WebSocket endpoints (canonical + shorthand alias)."""
    origin = websocket.headers.get("origin")
    log.info(
        "Received WebSocket connection attempt: client=%s, origin=%s, path=%s",
        websocket.client, origin, websocket.url.path,
    )
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        log.warning("WebSocket connection error on client %s: %s", websocket.client, e)
        manager.disconnect(websocket)


@router.websocket("/api/v1/simulation/ws")
async def websocket_endpoint(websocket: WebSocket):
    await _ws_handler(websocket)


@router.websocket("/ws")
async def websocket_shorthand(websocket: WebSocket):
    """Shorthand alias — lets the frontend connect to ws://host:8000/ws."""
    await _ws_handler(websocket)


_WIND_BY_STATION = {
    "Shivajinagar": {"speed": "14.5 km/h", "direction": "WNW - 250°"},
    "Swargate":     {"speed": "12.0 km/h", "direction": "NW - 315°"},
    "Hadapsar":     {"speed": "10.5 km/h", "direction": "SSW - 200°"},
    "Kothrud":      {"speed": "11.8 km/h", "direction": "W - 270°"},
}

_ACTION_ADVISORY_BY_STATION = {
    "Shivajinagar": (
        "CRITICAL AIR QUALITY ALERT — Shivajinagar station has recorded AQI 310 (Very Poor) at 08:30 IST. "
        "Dominant pollutant: PM10 (387.2 µg/m³, 3.9x NAAQS limit). Wind analysis indicates the primary source is the "
        "Hinjewadi Phase-III Construction Cluster (confidence: 91%). No dust suppression measures are active on-site. "
        "A school (Vibgyor High, Balewadi) is located 380m from the source. Immediate inspection and enforcement action is required. "
        "Secondary alert: Unauthorized waste burning detected on the Mula-Mutha riverbank, 440m from Sahyadri Hospital."
    ),
    "Swargate": (
        "TRAFFIC POLLUTION ALERT — Swargate station has recorded AQI 218 (Poor) at peak commuter hours. "
        "Dominant pollutant: NO2. Heavy diesel vehicle load on the Mumbai-Bangalore highway approach is the primary source. "
        "Recommend traffic diversion and enhanced enforcement of BS-VI norms."
    ),
    "Hadapsar": (
        "INDUSTRIAL EMISSION ALERT — Hadapsar station has recorded AQI 275 (Very Poor). "
        "Dominant pollutant: SO2. Emissions traced to the MIDC industrial cluster, Unit 7 (electroplating). "
        "Recommend immediate CPCB inspection. Sensitive receptor (hospital) within 600m."
    ),
    "Kothrud": (
        "MULTI-SOURCE AMBIGUITY — Kothrud station shows elevated PM2.5 (AQI 190). "
        "Multiple contributing sources identified: residential solid waste burning, mixed traffic, and construction. "
        "Confidence split prevents single-source attribution. Broad-spectrum enforcement recommended."
    ),
}

_ATTRIBUTION_BY_STATION: dict[str, list[dict]] = {
    "Shivajinagar": [
        {"id": 1, "type": "CONSTRUCTION", "source": "Hinjewadi Phase-III Construction Cluster",                       "confidence": "91%"},
        {"id": 2, "type": "INDUSTRIAL",   "source": "Pimpri-Chinchwad Industrial Zone – Unit 14 (ACC Cement Silo)", "confidence": "84%"},
        {"id": 3, "type": "TRAFFIC",      "source": "Mumbai-Pune Expressway Entry Corridor (Wakad Toll Plaza)",       "confidence": "76%"},
        {"id": 4, "type": "WASTE_BURN",   "source": "Mula-Mutha Riverbank Open Waste Burning Site",                  "confidence": "67%"},
    ],
    "Swargate": [
        {"id": 1, "type": "TRAFFIC",      "source": "Mumbai-Bangalore Highway Heavy Diesel Corridor",                 "confidence": "88%"},
        {"id": 2, "type": "TRAFFIC",      "source": "Swargate Bus Terminal — Fleet Idling Zone",                     "confidence": "79%"},
        {"id": 3, "type": "INDUSTRIAL",   "source": "Bhavani Peth Auto Repair Cluster",                              "confidence": "61%"},
    ],
    "Hadapsar": [
        {"id": 1, "type": "INDUSTRIAL",   "source": "MIDC Hadapsar – Electroplating Unit 7",                         "confidence": "93%"},
        {"id": 2, "type": "INDUSTRIAL",   "source": "Magarpatta IT SEZ Diesel Generator Bank",                       "confidence": "72%"},
        {"id": 3, "type": "WASTE_BURN",   "source": "Ramwadi Nala Open Dump Combustion",                            "confidence": "58%"},
    ],
    "Kothrud": [
        {"id": 1, "type": "WASTE_BURN",   "source": "Chandani Chowk Solid Waste Burning",                           "confidence": "74%"},
        {"id": 2, "type": "TRAFFIC",      "source": "Karve Road Mixed Traffic Corridor",                             "confidence": "68%"},
        {"id": 3, "type": "CONSTRUCTION", "source": "Kothrud Metro Phase II Extension",                              "confidence": "59%"},
        {"id": 4, "type": "INDUSTRIAL",   "source": "Bavdhan Light Industrial Zone",                                 "confidence": "47%"},
    ],
}


def _enrich_broadcast(payload: dict) -> dict:
    """Upgrade a partial LIVE_TELEMETRY payload to the full UI data contract."""
    station = payload.get("station") or "Shivajinagar"
    if "wind" not in payload:
        payload["wind"] = _WIND_BY_STATION.get(station, {"speed": "—", "direction": "—"})

    if "action_advisory" not in payload:
        payload["action_advisory"] = _ACTION_ADVISORY_BY_STATION.get(station, "")

    raw_attr = payload.get("attribution", [])
    needs_enrich = not raw_attr or (raw_attr and "source" not in raw_attr[0])
    if needs_enrich:
        payload["attribution"] = _ATTRIBUTION_BY_STATION.get(station, [])

    if "station" not in payload:
        payload["station"] = station

    return payload


@router.post("/api/v1/simulation/trigger-spike")
async def trigger_spike(
    station_name: str = Query(
        default="Shivajinagar",
        min_length=1,
        max_length=80,
        pattern=r"^[A-Za-z][A-Za-z0-9 .()&/,'_-]*$",
    ),
    spike_aqi: int = Query(default=310, ge=100, le=600),
    dominant_pollutant: Optional[str] = Query(
        default=None,
        pattern=r"^(pm25|pm10|no2|so2|co|o3)$",
        description="Override dominant pollutant (pm25, pm10, no2, so2, co, o3)",
    ),
    scenario_type: Optional[str] = Query(
        default=None,
        pattern=r"^(construction|traffic|industrial|ambiguity)$",
        description="construction|traffic|industrial|ambiguity",
    ),
):
    """Manually trigger a simulated AQI spike for demo purposes."""
    scenario = get_scenario(station_name)

    overrides = {}
    if spike_aqi != scenario.spike_aqi:
        overrides["spike_aqi"] = spike_aqi
    if dominant_pollutant:
        overrides["dominant_pollutant"] = dominant_pollutant
    if overrides:
        scenario = dataclasses.replace(scenario, **overrides)

    res = _build_attribution(scenario)
    reading = res.pop("reading", None)

    route_cache.invalidate_station(station_name)

    res["simulation"] = True
    res["simulation_params"] = {
        "requested_aqi": spike_aqi,
        "station": station_name,
        "dominant_pollutant": scenario.dominant_pollutant,
        "scenario_type": scenario_type or _SCENARIO_LABELS.get(station_name, "Unknown Scenario"),
    }
    res["is_spike"] = True

    if spike_aqi <= 50:
        res["event_severity"] = "good"
    elif spike_aqi <= 100:
        res["event_severity"] = "satisfactory"
    elif spike_aqi <= 200:
        res["event_severity"] = "moderate"
    elif spike_aqi <= 300:
        res["event_severity"] = "poor"
    elif spike_aqi <= 400:
        res["event_severity"] = "very_poor"
    else:
        res["event_severity"] = "severe"

    _FAC_META = {
        "Shivajinagar": {
            "squad_id":   "PMC-AQ-SQUAD-01",
            "squad_lead": "Dy. Commissioner (Environment), PMC Zone A",
            "eta":        "~18 mins",
            "checklist": [
                "Issue stop-work notice to Hinjewadi Phase-III Construction Cluster (Air Act 1981 §31A)",
                "Deploy anti-smog water cannons at upwind site perimeter (NH-48 Approach Road)",
                "Verify dust-suppression compliance logs at ACC Cement Silo, PCMC Unit 14",
                "Notify Vibgyor High School (380m, Balewadi) to activate indoor air protocol",
                "Dispatch PMC Ward-A squad for on-site inspection and stack scrubber check",
            ],
        },
        "Swargate": {
            "squad_id":   "PMC-AQ-SQUAD-02",
            "squad_lead": "Dy. Commissioner (Traffic), PMC Zone B",
            "eta":        "~15 mins",
            "checklist": [
                "Divert heavy diesel traffic from Mumbai-Bangalore Highway approach (NH-48)",
                "Issue BS-VI non-compliance notices at Swargate Bus Terminal fleet bay",
                "Activate mobile pollution check-posts at Swargate junction",
                "Notify Bhavani Peth Auto Repair Cluster for VOC emission inspection",
                "Coordinate with Traffic Police for peak-hour congestion mitigation",
            ],
        },
        "Hadapsar": {
            "squad_id":   "PMC-AQ-SQUAD-03",
            "squad_lead": "Regional Officer, MPCB Pune Circle",
            "eta":        "~22 mins",
            "checklist": [
                "Issue immediate stack-closure order to MIDC Hadapsar Unit 7 (Electroplating) under §31A",
                "Verify SO2 stack scrubber operational status at MIDC cluster",
                "Alert Ruby Hall Clinic (600m) to activate indoor air quality protocol",
                "Inspect Magarpatta IT SEZ diesel generator compliance logs",
                "Collect ambient SO2 samples at receptor (hospital) boundary",
            ],
        },
        "Kothrud": {
            "squad_id":   "PMC-AQ-SQUAD-04",
            "squad_lead": "Ward Officer, Kothrud-Baner Zone",
            "eta":        "~20 mins",
            "checklist": [
                "Extinguish solid waste burning at Chandani Chowk dump site (SWM Rules 2016)",
                "Deploy mechanized road sweepers on Karve Road (mixed traffic corridor)",
                "Issue stop-work to Kothrud Metro Phase-II construction site (dust suppression lapse)",
                "Issue notice to Bavdhan Light Industrial Zone for VOC compliance",
                "Coordinate multi-agency joint inspection (PMC + MPCB + Traffic Police)",
            ],
        },
    }
    fac = _FAC_META.get(station_name, _FAC_META["Shivajinagar"])
    if "actionable_intelligence" in res and isinstance(res["actionable_intelligence"], dict):
        res["actionable_intelligence"].update(fac)
    else:
        res["actionable_intelligence"] = fac

    try:
        live_aqi = res["trigger_station"]["reading"]["total_aqi"]
    except (KeyError, TypeError):
        live_aqi = spike_aqi

    ws_payload = {
        "type": "SPIKE_ALERT",
        "payload": {
            "station_name": station_name,
            "timestamp": res["generated_at"],
            "total_aqi": live_aqi,
            "is_spike": True,
            "pre_alerts": res.get("pre_alerts"),
            "actionable_intelligence": res.get("actionable_intelligence"),
            **res
        }
    }
    await manager.broadcast(ws_payload)

    return res
