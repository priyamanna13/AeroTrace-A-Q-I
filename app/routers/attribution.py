"""Attribution, spatial wind cone, source registry, and station readings router."""
from __future__ import annotations

import copy
import logging
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo
from fastapi import APIRouter, HTTPException, Path, Query

from ..api_helpers import (
    _ATTRIBUTION_TTL_S,
    _SCENARIO_LABELS,
    GLOBAL_ROUTE_CACHE,
    _build_attribution,
    _fetch_real_aqi,
    _get_default_category,
    route_cache,
)
from ..config import get_settings, load_city_config
from ..demo_scenarios import _SCENARIOS, get_scenario

log = logging.getLogger(__name__)
router = APIRouter(tags=["Spatial"])


@router.get("/api/v1/attribution/{station_name}")
def get_attribution(
    station_name: str = Path(..., min_length=1, max_length=80, pattern=r"^[A-Za-z][A-Za-z0-9 .()&/,'_-]*$"),
    active_category_tab: Optional[str] = Query(
        default=None,
        max_length=40,
        pattern=r"^[A-Za-z0-9 _-]*$",
        description="Optional UI category tab filter",
    ),
    live: bool = False,
):
    """Full attribution pipeline for a station."""
    default_cat = _get_default_category(station_name)
    category_tab = active_category_tab or default_cat
    cache_key = f"{station_name}_{category_tab}"

    if not live:
        cached = route_cache.get(cache_key)
        if cached is not None:
            return cached

    scenario = get_scenario(station_name)

    now_wall: datetime | None = None
    real_aqi: int | None = None
    real_pol: str | None = None
    real_conc: dict | None = None
    if live:
        settings = get_settings()
        now_wall = datetime.now(tz=ZoneInfo(settings.tz)).astimezone(timezone.utc)
        real_aqi, real_pol, real_conc = _fetch_real_aqi(station_name)
        if real_aqi is not None and real_aqi > 0:
            scenario = copy.deepcopy(scenario)
            scenario.spike_aqi = real_aqi
            if real_pol:
                clean_pol = real_pol.strip().lower().replace(".", "")
                scenario.dominant_pollutant = clean_pol
            if real_conc:
                scenario.base_profile = {
                    "pm25": real_conc.get("pm25", scenario.base_profile.get("pm25", 45.0)),
                    "pm10": real_conc.get("pm10", scenario.base_profile.get("pm10", 80.0)),
                    "no2":  real_conc.get("no2",  scenario.base_profile.get("no2",  35.0)),
                    "so2":  real_conc.get("so2",  scenario.base_profile.get("so2",  25.0)),
                    "co":   real_conc.get("co",   scenario.base_profile.get("co",   1.2)),
                    "o3":   real_conc.get("o3",   scenario.base_profile.get("o3",   35.0)),
                }

    res = _build_attribution(scenario, target_time=now_wall, live=live)

    if live and real_aqi is not None and real_conc:
        ts_iso = datetime.now(tz=ZoneInfo("Asia/Kolkata")).isoformat(timespec="seconds")
        effective_aqi = scenario.spike_aqi if (scenario and scenario.spike_aqi > 100) else real_aqi

        real_reading = {
            "station_name":       station_name,
            "timestamp":          ts_iso,
            "total_aqi":          effective_aqi,
            "dominant_pollutant": real_pol or "pm25",
            "pm25":  real_conc.get("pm25", 0),
            "pm10":  real_conc.get("pm10", 0),
            "no2":   real_conc.get("no2",  0),
            "so2":   real_conc.get("so2",  0),
            "o3":    real_conc.get("o3",   0),
            "co":    real_conc.get("co",   0),
        }

        if "trigger_station" in res:
            res["trigger_station"]["reading"] = real_reading
        res["is_spike"] = effective_aqi > 150

        if effective_aqi <= 50:
            sev = "good"
        elif effective_aqi <= 100:
            sev = "satisfactory"
        elif effective_aqi <= 200:
            sev = "moderate"
        elif effective_aqi <= 300:
            sev = "poor"
        elif effective_aqi <= 400:
            sev = "very_poor"
        else:
            sev = "severe"
        res["event_severity"] = sev

    res.pop("reading", None)
    route_cache.set(
        cache_key,
        res,
        ttl_seconds=_ATTRIBUTION_TTL_S,
        station_name=station_name,
        category=category_tab,
    )
    return res


@router.get("/api/v1/stations")
def list_stations():
    """List all known demo stations."""
    return {
        "stations": [
            {
                "name": s.station_name,
                "city": s.city,
                "state": s.state,
                "network": s.network,
                "coordinates": list(s.coordinates),
                "elevation_m": s.elevation_m,
                "spike_aqi": s.spike_aqi,
                "dominant_pollutant": s.dominant_pollutant,
                "scenario_type": _SCENARIO_LABELS.get(s.station_name, f"{s.dominant_pollutant.upper()} Hotspot ({s.city})"),
            }
            for s in _SCENARIOS.values()
        ]
    }


@router.get("/api/v1/stations/{station_name}/readings")
def get_readings(
    station_name: str = Path(..., min_length=1, max_length=80, pattern=r"^[A-Za-z][A-Za-z0-9 .()&/,'_-]*$"),
    limit: int = Query(default=96, ge=1, le=1000),
):
    """Recent AQI readings for a station (mock path)."""
    scenario = get_scenario(station_name)
    settings = get_settings()
    tz = ZoneInfo(settings.tz)

    from ..pipeline import PipelineController
    from ..sources import get_source

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

    now_local = datetime.now(tz=tz)
    readings = []

    for i in range(min(limit, 96)):
        ts = now_local - timedelta(minutes=15 * i)
        ts_utc = ts.astimezone(timezone.utc)
        raw = mock_aq._reading_for(scenario.station_name, ts_utc)
        reading, _ = controller.ingest_reading(raw)
        if reading:
            readings.append({
                "timestamp": ts.isoformat(),
                "total_aqi": reading.total_aqi,
                "dominant_pollutant": reading.dominant_pollutant,
                "pollutants": {
                    "pm25": reading.pm25,
                    "pm10": reading.pm10,
                    "no2":  reading.no2,
                    "so2":  reading.so2,
                    "co":   reading.co,
                    "o3":   reading.o3,
                },
            })

    return {"station_name": station_name, "count": len(readings), "readings": readings}


@router.get("/api/v1/cone/{station_name}")
def wind_cone_endpoint(
    station_name: str = Path(..., min_length=1, max_length=80, pattern=r"^[A-Za-z][A-Za-z0-9 .()&/,'_-]*$"),
    wind_dir: Optional[float] = Query(default=None, ge=0, le=360, description="Override wind direction (deg)"),
    wind_speed: Optional[float] = Query(default=None, ge=0, le=250, description="Override wind speed (km/h)"),
):
    """Return the wind cone GeoJSON for a station."""
    from ..cone_builder import build_wind_cone

    scenario = get_scenario(station_name)
    lon, lat = scenario.coordinates
    w = scenario.weather_overrides

    return build_wind_cone(
        station_lon=lon,
        station_lat=lat,
        wind_direction_deg=wind_dir if wind_dir is not None else w.get("wind_direction_deg", 290),
        wind_speed_kmh=wind_speed if wind_speed is not None else w.get("wind_speed_kmh", 14.5),
        station_name=scenario.station_name,
        cloud_cover_oktas=int(w.get("cloud_cover_oktas", 4)),
    )


@router.get("/api/v1/sources")
def list_sources():
    """Return all known pollution sources (curated + OSM-discovered)."""
    cache_key = "sources_inventory"
    cached = GLOBAL_ROUTE_CACHE.get(cache_key)
    if cached is not None:
        return cached

    sources = []
    seen_names: set[str] = set()

    for scenario in _SCENARIOS.values():
        for cand in scenario.candidates:
            if cand["name"] not in seen_names:
                seen_names.add(cand["name"])
                sources.append({
                    "name": cand["name"],
                    "source_type": cand.get("type", "unknown"),
                    "source_origin": "curated",
                    "geometry": cand.get("geometry"),
                    "description": cand.get("type", ""),
                })

    try:
        cfg = load_city_config()
        from ..overpass_client import discover_and_format
        for s in discover_and_format(cfg):
            if s["name"] not in seen_names:
                seen_names.add(s["name"])
                sources.append(s)
    except Exception:
        pass

    result = {"count": len(sources), "sources": sources}
    GLOBAL_ROUTE_CACHE[cache_key] = result
    return result
