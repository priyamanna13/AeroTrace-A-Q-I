"""Shared helper utilities, route cache instances, and attribution pipeline builders."""
from __future__ import annotations

import copy
import logging
import math
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException, WebSocket

from .cache import ScaledRouteCache, get_route_cache
from .config import get_settings, load_city_config
from .demo_scenarios import get_scenario

log = logging.getLogger(__name__)

# ─── WEBSOCKET CONNECTION MANAGER ───────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

# ─── SCALED MULTI-CITY ROUTE CACHE ───────────────────────────────────────────
_SERVER_START_TIME: float = time.time()
_ATTRIBUTION_TTL_S: float = 30.0

route_cache: ScaledRouteCache = get_route_cache()


class _RouteCacheCompat(dict):
    """Backwards-compatible dict interface proxying to ScaledRouteCache."""

    def get(self, key, default=None):
        val = route_cache.get(key)
        return val if val is not None else default

    def __getitem__(self, key):
        val = route_cache.get(key)
        if val is None:
            raise KeyError(key)
        return val

    def __setitem__(self, key, value):
        route_cache.set(key, value, ttl_seconds=_ATTRIBUTION_TTL_S)

    def pop(self, key, default=None):
        val = route_cache.get(key)
        route_cache.invalidate(key)
        return val if val is not None else default

    def clear(self):
        route_cache.clear()

    def __contains__(self, key):
        return route_cache.get(key) is not None

    def __len__(self):
        return len(route_cache)


GLOBAL_ROUTE_CACHE: _RouteCacheCompat = _RouteCacheCompat()
_CACHE_TIMESTAMPS: dict[str, float] = {}

# ─── Station → default category mapping ───────────────────────────────────────
_STATION_CATEGORY = {
    "Shivajinagar": "Construction",
    "Swargate":     "Traffic",
    "Hadapsar":     "Industrial",
    "Kothrud":      "Ambiguity",
}


def _get_default_category(station_name: str) -> str:
    """Resolve default UI category tab for any of the 28 physical stations."""
    if station_name in _STATION_CATEGORY:
        return _STATION_CATEGORY[station_name]
    try:
        sc = get_scenario(station_name, fallback=True)
        if sc.candidates:
            top_src = sc.candidates[0].source_type.title()
            if top_src in ("Construction", "Traffic", "Industrial"):
                return top_src
    except Exception:
        pass
    return "Construction"


# ─── Station → lat/lon + WAQI station slugs ───────────────────────────────────
_STATION_COORDS: dict[str, tuple[float, float]] = {
    "Shivajinagar": (18.5308, 73.8567),
    "Swargate":     (18.5018, 73.8604),
    "Hadapsar":     (18.5089, 73.9315),
    "Kothrud":      (18.5074, 73.8076),
}


def _init_all_station_coords() -> None:
    try:
        from .cities import get_all_city_configs, _normalize_name
        configs = get_all_city_configs()
        for c_data in configs.values():
            for st in c_data.get("stations", []):
                _STATION_COORDS[st["name"]] = (float(st["lat"]), float(st["lon"]))
                _STATION_COORDS[_normalize_name(st["name"])] = (float(st["lat"]), float(st["lon"]))
    except Exception as exc:
        log.warning("Failed pre-populating station coords: %s", exc)


_init_all_station_coords()


_WAQI_STATION_UIDS: dict[str, int] = {
    "Shivajinagar": 3760,
    "Swargate":     3763,
    "Hadapsar":     3764,
    "Kothrud":      8679,
}


def _concentrations_to_cpcb(iaqi: dict) -> tuple[int | None, str | None, dict | None]:
    """Convert WAQI iaqi block to (cpcb_aqi, dominant, concentrations)."""
    from .standards import sub_index as _si

    pm25  = float((iaqi.get("pm25") or {}).get("v", 0) or 0)
    pm10  = float((iaqi.get("pm10") or {}).get("v", 0) or 0)
    no2   = float((iaqi.get("no2")  or {}).get("v", 0) or 0)
    so2   = float((iaqi.get("so2")  or {}).get("v", 0) or 0)
    o3    = float((iaqi.get("o3")   or {}).get("v", 0) or 0)
    co_mg = float((iaqi.get("co")   or {}).get("v", 0) or 0)

    subs: dict[str, float] = {}
    if pm25  > 0: subs["pm25"] = _si("pm25", pm25)
    if pm10  > 0: subs["pm10"] = _si("pm10", pm10)
    if no2   > 0: subs["no2"]  = _si("no2",  no2)
    if so2   > 0: subs["so2"]  = _si("so2",  so2)
    if o3    > 0: subs["o3"]   = _si("o3",   o3)
    if co_mg > 0: subs["co"]   = _si("co",   co_mg)

    if not subs:
        return None, None, None

    cpcb_aqi = int(round(max(subs.values())))
    dominant  = max(subs, key=subs.get)
    conc = {"pm25": pm25, "pm10": pm10, "no2": no2, "so2": so2, "o3": o3, "co": co_mg}
    return cpcb_aqi, dominant, conc


def _fetch_real_aqi(station_name: str) -> tuple[int | None, str | None, dict | None]:
    """Fetch verified current AQI and pollutant concentrations for a physical station.

    Order of precedence (guaranteeing exact single source of truth across all screens):
    1. Read latest persisted telemetry from PostgreSQL (sub-millisecond, consistent with City Overview).
    2. Read from in-memory telemetry cache (_TELEMETRY_CACHE).
    3. Evaluate via unified 4-tier cascade in app.ingestion (fetch_station_telemetry).
    """
    # 1. Database lookup
    try:
        from .db import get_session
        from .models import Station, AqiReading
        from sqlalchemy import func
        with get_session() as s:
            st = s.query(Station).filter(func.lower(Station.name) == station_name.strip().lower()).first()
            if st:
                reading = (
                    s.query(AqiReading)
                    .filter(AqiReading.station_id == st.id)
                    .order_by(AqiReading.timestamp.desc())
                    .first()
                )
                if reading and reading.total_aqi is not None:
                    conc = {
                        "pm25": float(reading.pm25 or 0),
                        "pm10": float(reading.pm10 or 0),
                        "no2": float(reading.no2 or 0),
                        "so2": float(reading.so2 or 0),
                        "co": float(reading.co or 0),
                        "o3": float(reading.o3 or 0),
                    }
                    return int(reading.total_aqi), (reading.dominant_pollutant or "PM2.5"), conc
    except Exception as exc:
        log.debug("Database lookup in _fetch_real_aqi for %s: %s", station_name, exc)

    # 2. In-memory telemetry cache lookup
    try:
        from .ingestion import _TELEMETRY_CACHE
        for key, (telem, _) in _TELEMETRY_CACHE.items():
            if telem.name.strip().lower() == station_name.strip().lower():
                return int(telem.current_aqi), telem.dominant_pollutant, telem.pollutants
    except Exception:
        pass

    # 3. Dynamic cascade fetch via unified ingestion engine
    try:
        from .cities import list_available_cities, get_city_config, _normalize_name
        from .ingestion import fetch_station_telemetry
        norm = _normalize_name(station_name)
        for c in list_available_cities():
            cfg = get_city_config(c)
            if cfg:
                for st_cfg in cfg.get("stations", []):
                    if _normalize_name(st_cfg["name"]) == norm:
                        telem = fetch_station_telemetry(st_cfg, cfg)
                        return int(telem.current_aqi), telem.dominant_pollutant, telem.pollutants
    except Exception as exc:
        log.warning("Unified cascade fetch in _fetch_real_aqi failed for %s: %s", station_name, exc)

    return None, None, None


_SCENARIO_LABELS = {
    "Shivajinagar": "Construction Spike (PM10)",
    "Swargate":     "Heavy Traffic Corridor (NO2)",
    "Hadapsar":     "Industrial Emission (SO2)",
    "Kothrud":      "Ambiguity — Multi-Source (PM2.5)",
}


def _build_attribution(scenario, target_time: datetime | None = None, live: bool = False) -> dict:
    """Core pipeline: builds the full 6-block contract response from a scenario."""
    from .cone_builder import build_wind_cone as build_cone
    from .contract import build_trigger_station_block
    from .intelligence import build_actionable_intelligence
    from .models import Station, make_point_ewkt
    from .overpass_client import discover_and_format
    from .pasquill import classify_stability
    from .pipeline import PipelineController
    from .ranker import rank_candidates
    from .sources import get_source
    from .weather_contract import build_weather_snapshot
    from .weather_sources.mock import MockIMDSource

    settings = get_settings()
    tz = ZoneInfo(settings.tz)

    # ── Resolve spike timestamp ──────────────────────────────────────────
    if target_time is None:
        h, m = scenario.spike_local_time.split(":")
        spike_local = datetime.now(tz=tz).replace(
            hour=int(h), minute=int(m), second=0, microsecond=0
        )
        spike_utc = spike_local.astimezone(timezone.utc)
        local_hour = int(h) + int(m) / 60.0
    else:
        spike_local = target_time.astimezone(tz)
        spike_utc = target_time.astimezone(timezone.utc)
        local_hour = spike_local.hour + spike_local.minute / 60.0

    # ── weather_snapshot (2A) ────────────────────────────────────────────
    raw_weather = None
    use_mock_weather = os.getenv("WEATHER_SOURCE", "").lower() == "mock" and not live
    if not use_mock_weather:
        try:
            from .weather_sources.base import get_weather_source
            live_weather_src = get_weather_source("live")
            raw_weather = live_weather_src.fetch_snapshot(scenario.station_name, spike_utc)
        except Exception as exc:
            log.warning("Live weather query failed for %s, falling back to mock: %s", scenario.station_name, exc)

    if raw_weather is None:
        weather_src = MockIMDSource(
            scenario_local_hour=local_hour,
            base=dict(scenario.weather_overrides),
            scenario_values=dict(scenario.weather_overrides),
        )
        raw_weather = weather_src.fetch_snapshot(scenario.station_name, spike_utc)

    if raw_weather is None:
        raise HTTPException(500, "Weather snapshot returned None")

    obs_dict = raw_weather.to_dict()
    is_daytime = 6 <= spike_local.hour < 18
    pasquill_result = classify_stability(
        obs_dict["wind_speed_kmh"],
        obs_dict["cloud_cover_oktas"],
        is_daytime=is_daytime,
        solar_elevation_deg=obs_dict.get("solar_elevation_deg", 30.0),
    )
    weather_block = build_weather_snapshot(obs_dict, pasquill_result)

    # ── rain scavenging logic ─────────────────────────────────────────────
    target_aqi = scenario.spike_aqi
    precipitation = obs_dict.get("precipitation_mm_last_1h", 0.0)
    scavenging_factor = 1.0

    if precipitation > 0.0:
        scavenging_factor = math.exp(-0.45 * precipitation)
        target_aqi = max(35, int(target_aqi * scavenging_factor))
        target_aqi = min(target_aqi, 95)

    # ── trigger_station (Task 1) ─────────────────────────────────────────
    mock_aq = get_source(
        "mock",
        target_spike_aqi=target_aqi,
        spike_local_hour=local_hour,
        base_profile=scenario.base_profile,
        peak_ratios=scenario.peak_ratios,
        dominant_override=scenario.dominant_pollutant,
    )
    controller = PipelineController(source=mock_aq)
    raw_aq = mock_aq._reading_for(scenario.station_name, spike_utc)

    reading, _ = controller.ingest_reading(raw_aq)

    lon, lat = scenario.coordinates
    ephemeral_station = Station(
        name=scenario.station_name,
        network=scenario.network,
        city=scenario.city,
        state=scenario.state,
        elevation_m=scenario.elevation_m,
        geom=make_point_ewkt(lon, lat),
    )
    ephemeral_station.id = uuid.uuid4()
    trigger_block = build_trigger_station_block(
        ephemeral_station, reading, tz_name=settings.tz
    )

    # ── wind_cone_geometry (2B) ──────────────────────────────────────────
    wind_cone_block = build_cone(
        station_lon=lon,
        station_lat=lat,
        wind_direction_deg=obs_dict["wind_direction_deg"],
        wind_speed_kmh=obs_dict["wind_speed_kmh"],
        station_name=scenario.station_name,
        cloud_cover_oktas=obs_dict.get("cloud_cover_oktas", 4),
        is_daytime=is_daytime,
    )

    # ── ranked_candidates (2C) ───────────────────────────────────────────
    candidates = copy.deepcopy(scenario.candidates)
    try:
        from .cities import get_city_config
        cfg = get_city_config(scenario.city) or load_city_config()
        osm_sources = discover_and_format(cfg)
        seen_names = {c["name"] for c in candidates}
        for osm_cand in osm_sources:
            if osm_cand["name"] not in seen_names:
                candidates.append(osm_cand)
                seen_names.add(osm_cand["name"])
    except Exception as e:
        log.debug("OSM discovery failed: %s", e)

    ranked = rank_candidates(
        candidates=candidates,
        station_coords=(lon, lat),
        wind_direction=obs_dict["wind_direction_deg"],
        half_angle=wind_cone_block["properties"]["half_angle_deg"],
        max_range_km=wind_cone_block["properties"]["reach_km"],
        chemical_fingerprint=reading.chemical_fingerprint(),
        event_time=scenario.spike_local_time,
    )

    # ── actionable_intelligence (2D) ─────────────────────────────────────
    intel_block = build_actionable_intelligence(
        ranked_candidates=ranked,
        station_name=scenario.station_name,
        aqi=reading.total_aqi,
        dominant_pollutant=reading.dominant_pollutant,
        event_time=spike_local.strftime("%H:%M IST"),
    )
    intel_block["field_team_assignment"] = scenario.field_team

    # ── Assemble full contract ───────────────────────────────────────────
    return {
        "event_id": str(uuid.uuid4()),
        "event_severity": "critical" if reading.total_aqi >= 300 else "moderate",
        "pipeline_version": "3.1.0",
        "generated_at": datetime.now(tz=timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%S.%f"
        )[:-3] + "Z",
        "trigger_station": trigger_block,
        "weather_snapshot": weather_block,
        "wind_cone_geometry": wind_cone_block,
        "ranked_candidates": ranked,
        "actionable_intelligence": intel_block,
        "pre_alerts": scenario.pre_alerts,
        "reading": reading,
    }
