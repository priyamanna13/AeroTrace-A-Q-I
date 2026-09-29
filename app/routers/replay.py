"""Timeline history and 24-hour replay slider router."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, HTTPException, Path, Query

from ..api_helpers import _build_attribution
from ..config import get_settings
from ..demo_scenarios import get_scenario

log = logging.getLogger(__name__)
router = APIRouter(tags=["Replay"])


@router.get("/api/v1/timeline/{station_name}")
def get_timeline(
    station_name: str = Path(..., min_length=1, max_length=80, pattern=r"^[A-Za-z][A-Za-z0-9 .()&/,'_-]*$"),
):
    """Return an array of 24 hourly tick objects for the replay slider."""
    scenario = get_scenario(station_name)
    settings = get_settings()
    tz = ZoneInfo(settings.tz)

    from ..pipeline import PipelineController
    from ..sources import get_source
    from ..weather_sources.mock import MockIMDSource

    h, m = scenario.spike_local_time.split(":")
    local_hour = int(h) + int(m) / 60.0

    mock_aq = get_source(
        "mock",
        target_spike_aqi=scenario.spike_aqi,
        spike_local_hour=local_hour,
        base_profile=scenario.base_profile,
        peak_ratios=scenario.peak_ratios,
        dominant_override=scenario.dominant_pollutant,
    )
    controller = PipelineController(source=mock_aq)

    now_local = datetime.now(tz=tz).replace(minute=0, second=0, microsecond=0)

    ticks = []
    for i in range(24):
        ts = now_local - timedelta(hours=23 - i)
        ts_utc = ts.astimezone(timezone.utc)

        raw_aq = mock_aq._reading_for(scenario.station_name, ts_utc)
        reading, _ = controller.ingest_reading(raw_aq)

        weather_src = MockIMDSource(
            scenario_local_hour=ts.hour + ts.minute / 60.0,
            base=dict(scenario.weather_overrides),
            scenario_values=dict(scenario.weather_overrides),
        )
        raw_weather = weather_src.fetch_snapshot(scenario.station_name, ts_utc)

        aqi = reading.total_aqi if reading else 50
        dominant = reading.dominant_pollutant if reading else "pm10"
        wind_dir = raw_weather.wind_direction_deg if raw_weather else 180
        wind_spd = raw_weather.wind_speed_kmh if raw_weather else 5.0

        ticks.append({
            "timestamp": ts.isoformat(),
            "aqi": aqi,
            "was_spike": aqi >= 150,
            "dominant_pollutant": dominant.upper(),
            "wind_dir": wind_dir,
            "wind_speed": wind_spd,
        })

    return ticks


@router.get("/api/v1/replay/{station_name}")
def get_replay(
    station_name: str = Path(..., min_length=1, max_length=80, pattern=r"^[A-Za-z][A-Za-z0-9 .()&/,'_-]*$"),
    timestamp: str = Query(..., min_length=8, max_length=64, description="ISO-8601 timestamp"),
):
    """Full attribution pipeline reconstructed for a historical hour."""
    try:
        dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ISO-8601 timestamp format")

    scenario = get_scenario(station_name)
    res = _build_attribution(scenario, target_time=dt)
    res.pop("reading", None)
    return res
