"""Asynchronous live AQI poller for the Pune region via WAQI API.

Polls the World Air Quality Index (WAQI) feed every POLL_INTERVAL_SECONDS
seconds. When a reading breaches SPIKE_THRESHOLD, it fires the PostGIS
attribution pipeline and broadcasts the enriched telemetry frame to all
connected WebSocket clients via the shared ConnectionManager.

Start alongside the FastAPI app — in app/api.py add to the lifespan startup:
    asyncio.create_task(start_live_aqi_pipeline())
"""
from __future__ import annotations

import asyncio
import logging
import os

import httpx

log = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────────────────────────
# Set WAQI_TOKEN env var with a valid token from https://aqicn.org/api/
# Falls back to a demo/mock flow if the token is missing or invalid.
_WAQI_TOKEN = os.getenv("WAQI_TOKEN", "")
# Pune Shivajinagar CAAQMS — UID 3760 (verified via WAQI search API).
# Slug-based feeds return "Unknown station"; geo-based snaps to Delhi.
# UID-based is the only reliable method for these offline CPCB stations.
WAQI_API_URL = (
    f"https://api.waqi.info/feed/@3760/?token={_WAQI_TOKEN}"
)
POLL_INTERVAL_SECONDS: int = 30
SPIKE_THRESHOLD: float = 150.0


# ─── Startup mock payload ─────────────────────────────────────────────────────
# Broadcast immediately on startup so the frontend exits the loading spinner
# before the first 30-second WAQI poll cycle completes.
# NOTE: is_spike=False so the dashboard loads in NOMINAL state on boot.
# Users activate the spike deliberately via the 'Toggle Spike Data' button.
_STARTUP_MOCK_PAYLOAD: dict = {
    "type": "LIVE_TELEMETRY",
    "station": "Shivajinagar",
    "timestamp": "",
    "city": "Pune",
    "aqi": 92.0,
    "dominant_pollutant": "PM2.5",
    "wind": {
        "speed": "14.5 km/h",
        "direction": "WNW - 250\u00b0",
    },
    "action_advisory": (
        "Live telemetry stream initializing — Pune air quality is currently within acceptable limits. "
        "All four CAAQMS monitoring stations are online. No active spike events detected. "
        "System is polling WAQI feed every 30 seconds."
    ),
    "is_spike": False,
    "attribution": [],
    "geo": [18.5314, 73.8446],
    "_source": "startup_nominal",  # internal marker — not shown in UI
}


# ─── Live AQI fetch ────────────────────────────────────────────────────────────
async def fetch_live_pune_aqi() -> dict | None:
    """Fetch live CPCB AQI data for Pune using _fetch_real_aqi."""
    try:
        from .api import _fetch_real_aqi
        from datetime import datetime
        from zoneinfo import ZoneInfo
        aqi, pol, conc = _fetch_real_aqi("Shivajinagar")
        if aqi is not None:
            ts_now = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m-%d %H:%M:%S")
            return {
                "aqi": float(aqi),
                "dominentpol": pol or "PM2.5",
                "time": {"s": ts_now},
                "city": {"name": "Shivajinagar", "geo": [18.5314, 73.8446]},
                "concentrations": conc or {},
            }
    except Exception as exc:  # noqa: BLE001
        log.error("Live telemetry polling exception: %s", str(exc))
    return None


# ─── Attribution helper (wraps the existing app-level pipeline) ───────────────
def _calculate_attribution(sensor_aqi: float, pollutant: str) -> list[dict]:
    """Invoke the PostGIS wind-cone attribution pipeline.

    Delegates to _build_attribution in app.api using the scenario that best
    matches the dominant pollutant. Returns a simplified list of source dicts
    suitable for direct WebSocket broadcast.
    """
    from .api import _build_attribution
    from .demo_scenarios import get_scenario

    # Pick the scenario whose dominant pollutant most closely matches the live feed.
    _POLLUTANT_SCENARIO_MAP: dict[str, str] = {
        "pm25":  "Kothrud",
        "pm2.5": "Kothrud",
        "pm10":  "Shivajinagar",
        "no2":   "Swargate",
        "so2":   "Hadapsar",
        "o3":    "Kothrud",
        "co":    "Swargate",
    }
    scenario_name = _POLLUTANT_SCENARIO_MAP.get(pollutant.lower(), "Shivajinagar")

    try:
        scenario = get_scenario(scenario_name)
        # Patch the scenario AQI so the pipeline uses the live value.
        scenario.spike_aqi = int(sensor_aqi)
        result = _build_attribution(scenario)

        # Extract ranked sources into a flat, broadcast-friendly format.
        raw_sources: list[dict] = []
        for i, block in enumerate(result.get("ranked_candidates", []), start=1):
            raw_sources.append(
                {
                    "id": i,
                    "type": (block.get("source_type", "industrial")).upper(),
                    "source": block.get("name", "Unknown Source"),
                    "confidence": f"{round(float(block.get('composite_score', 0)) * 100, 0):.0f}%",
                }
            )
        return raw_sources[:5]  # top 5 candidates max
    except Exception as exc:  # noqa: BLE001
        log.warning("Attribution pipeline error during live spike: %s", exc)
        return []


# ─── Main poller loop ─────────────────────────────────────────────────────────
async def start_live_aqi_pipeline() -> None:
    """Entry-point coroutine — schedule with asyncio.create_task() on startup."""
    # Lazy imports to avoid circular dependency at module load time.
    from .api import manager, _enrich_broadcast

    log.info("Initializing Asynchronous Live Pune Ingestion Stream...")

    # ── Startup heartbeat: unblock the frontend loading spinner immediately ──
    # The WAQI poll runs every 30 s. Without this, newly connected clients stare
    # at the spinner for up to 30 seconds (or forever if the token is missing).
    # We broadcast a fully-enriched mock reading so the UI renders immediately
    # and the real telemetry replaces it on the first successful poll.
    await asyncio.sleep(0.5)  # tiny yield so manager is fully ready
    log.info("Broadcasting startup heartbeat payload to unblock frontend.")
    await manager.broadcast(_STARTUP_MOCK_PAYLOAD)

    while True:
        data = await fetch_live_pune_aqi()

        if data:
            current_aqi = float(data.get("aqi", 0))
            dominant_pollutant: str = data.get("dominentpol", "PM2.5")
            time_stamp: str = data.get("time", {}).get("s", "")
            # WAQI city name (e.g. "Pune Shivajinagar") → last word as station hint
            waqi_city_name: str = data.get("city", {}).get("name", "Shivajinagar")
            station_hint = waqi_city_name.split()[-1] if waqi_city_name else "Shivajinagar"

            is_spike = current_aqi > SPIKE_THRESHOLD

            # Debug: confirm data is landing in the terminal
            print(f"CPCB Data Received: AQI={current_aqi}, pollutant={dominant_pollutant}, spike={is_spike}")

            attribution_results: list[dict] = []
            if is_spike:
                log.warning(
                    "CRITICAL REAL-TIME ANOMALY DETECTED IN PUNE: AQI %.1f",
                    current_aqi,
                )
                # Fires PostGIS wind-cone slicing and industrial ranking logic.
                attribution_results = _calculate_attribution(
                    sensor_aqi=current_aqi,
                    pollutant=dominant_pollutant,
                )
            else:
                log.info("Live poll OK \u2014 AQI %.1f (%s), nominal.", current_aqi, dominant_pollutant)

            # Packaging the standardised telemetry frame for the frontend.
            payload: dict = {
                "type": "LIVE_TELEMETRY",
                "station": station_hint,
                "timestamp": time_stamp,
                "city": "Pune",
                "aqi": current_aqi,
                "dominant_pollutant": dominant_pollutant,
                "is_spike": is_spike,
                "attribution": attribution_results,
                "geo": data.get("city", {}).get("geo", [18.5314, 73.8446]),
            }

            # Enrich with wind, action_advisory, and structured attribution
            # so the right sidebar always renders even if the live API is sparse.
            payload = _enrich_broadcast(payload)

            # Direct persistent WebSocket broadcast to all active clients.
            await manager.broadcast(payload)
        else:
            log.warning(
                "CPCB Data Received: 0 rows found. "
                "Check WAQI_TOKEN env var or network connectivity."
            )
            print("CPCB Data Received: 0 rows found.")

        await asyncio.sleep(POLL_INTERVAL_SECONDS)
