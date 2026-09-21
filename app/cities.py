"""City Aggregation & Multi-City Configuration Service for AeroTrace NGEC 2026.

Implements the multi-city data layer and verified physical monitoring station registry for:
- Screen 1: GET /api/v1/cities (National Overview)
- Screen 2: GET /api/v1/cities/{city}/overview (City Intelligence Header)
- Screen 2: GET /api/v1/cities/{city}/stations (City Station Pins — Physical Only)

Data Integrity Guarantees:
1. Physical Station Integrity: Only verified physical CAAQMS stations are returned as station pins.
   Model grid coordinates (Open-Meteo) or arbitrary centroids are NEVER treated as station entities.
2. Data Freshness Transparency: Exposes actual upstream provider source and timestamp,
   preserving distinction between AeroTrace's 30s application refresh and upstream cadence.
3. Simulation Labeling: Any fallback values during outage are explicitly marked
   'SIMULATED — live source unreachable'.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional
import yaml

log = logging.getLogger(__name__)

# Indian Standard Time (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
CITY_CONFIGS_DIR = _PROJECT_ROOT / "city_configs"
DEFAULT_ROOT_CONFIG = _PROJECT_ROOT / "city_config.yml"

_CITY_CONFIG_CACHE: dict[str, dict[str, Any]] = {}

# Baseline values for deterministic fallback when live DB / external sources are unavailable
_CITY_BASELINES: dict[str, dict[str, Any]] = {
    "pune": {"base_aqi": 182.0, "dominant": "pm25", "pm25": 78.4, "pm10": 156.2, "no2": 44.0, "so2": 18.0, "co": 1.2, "o3": 34.0},
    "mumbai": {"base_aqi": 145.0, "dominant": "pm10", "pm25": 54.2, "pm10": 128.6, "no2": 42.0, "so2": 16.5, "co": 1.1, "o3": 38.0},
    "delhi": {"base_aqi": 278.0, "dominant": "pm25", "pm25": 135.0, "pm10": 260.0, "no2": 68.0, "so2": 24.0, "co": 2.1, "o3": 45.0},
    "bengaluru": {"base_aqi": 68.0, "dominant": "o3", "pm25": 22.0, "pm10": 48.0, "no2": 21.0, "so2": 8.0, "co": 0.6, "o3": 52.0},
    "kolkata": {"base_aqi": 162.0, "dominant": "pm25", "pm25": 68.0, "pm10": 142.0, "no2": 46.0, "so2": 19.0, "co": 1.3, "o3": 36.0},
    "hyderabad": {"base_aqi": 112.0, "dominant": "no2", "pm25": 38.0, "pm10": 88.0, "no2": 45.0, "so2": 14.0, "co": 0.9, "o3": 41.0},
    "chennai": {"base_aqi": 85.0, "dominant": "pm10", "pm25": 29.0, "pm10": 72.0, "no2": 26.0, "so2": 11.0, "co": 0.8, "o3": 39.0},
}

_DB_ALIVE: Optional[bool] = None
_LAST_DB_CHECK_TIME: float = 0.0


def _normalize_name(name: str) -> str:
    return name.strip().lower()


def list_available_cities() -> list[str]:
    """Return list of configured city names."""
    configs = get_all_city_configs()
    return sorted([cfg["city"]["name"] for cfg in configs.values() if "city" in cfg])


def get_city_config(city_name: str) -> Optional[dict[str, Any]]:
    """Retrieve full configuration dictionary for a city (case-insensitive)."""
    key = _normalize_name(city_name)
    if key in _CITY_CONFIG_CACHE:
        return _CITY_CONFIG_CACHE[key]

    target_file = CITY_CONFIGS_DIR / f"{key}.yml"
    if target_file.exists():
        try:
            with open(target_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                if data and "city" in data:
                    _CITY_CONFIG_CACHE[key] = data
                    return data
        except Exception as exc:
            log.error("Failed loading config from %s: %s", target_file, exc)

    if (key == "pune" or not key) and DEFAULT_ROOT_CONFIG.exists():
        try:
            with open(DEFAULT_ROOT_CONFIG, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                if data:
                    _CITY_CONFIG_CACHE["pune"] = data
                    return data
        except Exception as exc:
            log.error("Failed loading fallback config from %s: %s", DEFAULT_ROOT_CONFIG, exc)

    return None


def get_all_city_configs() -> dict[str, dict[str, Any]]:
    """Load and return all city configurations."""
    if not CITY_CONFIGS_DIR.exists():
        fallback = get_city_config("pune")
        return {"pune": fallback} if fallback else {}

    for yaml_path in CITY_CONFIGS_DIR.glob("*.yml"):
        key = _normalize_name(yaml_path.stem)
        if key not in _CITY_CONFIG_CACHE:
            try:
                with open(yaml_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    if data and "city" in data:
                        _CITY_CONFIG_CACHE[key] = data
            except Exception as exc:
                log.error("Error reading %s: %s", yaml_path, exc)

    return dict(_CITY_CONFIG_CACHE)


def get_verified_stations(city_name: str) -> list[dict[str, Any]]:
    """Return verified physical monitoring station configs for a city."""
    cfg = get_city_config(city_name)
    if not cfg or "stations" not in cfg:
        return []
    return list(cfg["stations"])


def _check_db_alive(session: Any) -> bool:
    """Fast liveness check with 10s TTL cache so offline DB does not lag requests."""
    global _DB_ALIVE, _LAST_DB_CHECK_TIME
    import time
    if session is None:
        return False
    now = time.time()
    if _DB_ALIVE is not None and (now - _LAST_DB_CHECK_TIME) < 10.0:
        return _DB_ALIVE
    try:
        from sqlalchemy import text
        session.execute(text("SELECT 1"))
        _DB_ALIVE = True
    except Exception:
        _DB_ALIVE = False
    _LAST_DB_CHECK_TIME = now
    return _DB_ALIVE


def _get_live_station_reading(session: Any, station_name: str) -> Optional[dict[str, Any]]:
    """Check database for live station reading if DB is connected."""
    if session is None or not _check_db_alive(session):
        return None
    try:
        from .models import Station, AqiReading
        from sqlalchemy import select
        st = session.execute(
            select(Station).where(Station.name == station_name)
        ).scalars().first()
        if not st:
            return None

        reading = session.execute(
            select(AqiReading)
            .where(AqiReading.station_id == st.id)
            .order_by(AqiReading.timestamp.desc())
            .limit(1)
        ).scalars().first()

        if reading:
            from .standards import dominant_pollutant
            pollutants = {
                "pm25": reading.pm25,
                "pm10": reading.pm10,
                "no2": reading.no2,
                "so2": reading.so2,
                "co": reading.co,
                "o3": reading.o3,
            }
            dom = dominant_pollutant(pollutants)
            return {
                "aqi": reading.total_aqi,
                "timestamp": reading.timestamp.isoformat(),
                "pollutants": pollutants,
                "dominant_pollutant": (dom or "PM2.5").upper(),
                "data_source": "CPCB_CAAQMS",
                "is_simulated": False,
            }
    except Exception as exc:
        log.debug("Live DB reading failed for %s: %s", station_name, exc)
    return None


def get_city_verified_stations(
    city_name: str,
    session: Any = None,
) -> Optional[list[dict[str, Any]]]:
    """Return verified physical monitoring stations only for a city.
    
    Guarantees:
    - Zero model grid points or fake stations.
    - All entries are verified physical monitoring instruments.
    """
    from .standards import compute_aqi, _category_for_index

    cfg = get_city_config(city_name)
    if not cfg or "stations" not in cfg:
        return None

    now_ist = datetime.now(IST)
    city_key = _normalize_name(city_name)
    city_display = cfg["city"]["name"]
    state_display = cfg["city"].get("state", "")
    baseline = _CITY_BASELINES.get(city_key, _CITY_BASELINES["pune"])

    verified_stations = []
    station_offsets = [0.0, 15.0, -12.0, 8.0, -6.0, 18.0]

    for idx, st_cfg in enumerate(cfg["stations"]):
        st_name = st_cfg["name"]
        st_id = st_cfg.get("cpcb_station_id", f"site_{st_name.lower()}")
        coords = [float(st_cfg["lon"]), float(st_cfg["lat"])]
        elevation_m = int(st_cfg.get("elevation_m", 500))
        network = st_cfg.get("network", "CPCB_CAAQMS")

        live_reading = _get_live_station_reading(session, st_name)

        if live_reading:
            aqi_val = round(float(live_reading["aqi"]), 1)
            pollutants = live_reading["pollutants"]
            dom_pollutant = live_reading["dominant_pollutant"]
            data_source = live_reading["data_source"]
            data_ts_str = live_reading["timestamp"]
            is_sim = live_reading.get("is_simulated", False)
        else:
            offset = station_offsets[idx % len(station_offsets)]
            pollutants = {
                "pm25": max(5.0, round(baseline["pm25"] + offset * 0.4, 1)),
                "pm10": max(10.0, round(baseline["pm10"] + offset * 0.8, 1)),
                "no2": max(5.0, round(baseline["no2"] + offset * 0.2, 1)),
                "so2": max(2.0, round(baseline["so2"] + offset * 0.1, 1)),
                "co": max(0.2, round(baseline["co"] + offset * 0.005, 1)),
                "o3": max(5.0, round(baseline["o3"] - offset * 0.1, 1)),
            }
            aqi_res = compute_aqi(pollutants)
            aqi_val = float(aqi_res.total_aqi) if aqi_res.total_aqi is not None else max(25.0, round(baseline["base_aqi"] + offset, 1))
            dom_pollutant = (aqi_res.dominant_pollutant or baseline["dominant"]).upper()
            data_source = "SIMULATED — live source unreachable"
            data_ts_str = (now_ist - timedelta(minutes=10)).isoformat()
            is_sim = True

        is_stale = False
        try:
            ts_parsed = datetime.fromisoformat(data_ts_str)
            if ts_parsed.tzinfo is None:
                ts_parsed = ts_parsed.replace(tzinfo=IST)
            if (now_ist - ts_parsed).total_seconds() > 3600:
                is_stale = True
        except Exception:
            pass

        verified_stations.append({
            "station_id": st_id,
            "name": st_name,
            "network": network,
            "city": city_display,
            "state": state_display,
            "coordinates": coords,
            "elevation_m": elevation_m,
            "current_aqi": aqi_val,
            "aqi_category": _category_for_index(aqi_val),
            "dominant_pollutant": dom_pollutant,
            "pollutants": pollutants,
            "data_source": data_source,
            "data_timestamp": data_ts_str,
            "last_polled_at": now_ist.isoformat(),
            "is_stale": is_stale,
            "is_simulated": is_sim,
        })

    return verified_stations


def get_city_overview(city_name: str, session: Any = None) -> Optional[dict[str, Any]]:
    """Return overview metrics and aggregate AQI for a city."""
    from .standards import compute_aqi, _category_for_index

    cfg = get_city_config(city_name)
    if not cfg:
        return None

    stations = get_city_verified_stations(city_name, session)
    if not stations:
        return None

    now_ist = datetime.now(IST)
    avg_aqi = round(sum(s["current_aqi"] for s in stations) / len(stations), 1)
    avg_pm25 = round(sum(s["pollutants"]["pm25"] for s in stations) / len(stations), 1)
    avg_pm10 = round(sum(s["pollutants"]["pm10"] for s in stations) / len(stations), 1)

    any_simulated = any(s["is_simulated"] for s in stations)
    data_source = "SIMULATED — live source unreachable" if any_simulated else stations[0]["data_source"]
    latest_timestamp = max(s["data_timestamp"] for s in stations)
    is_stale = any(s["is_stale"] for s in stations)

    center_coords = [float(cfg["city"]["center"]["lon"]), float(cfg["city"]["center"]["lat"])]

    pollutant_totals = {
        "pm25": avg_pm25,
        "pm10": avg_pm10,
        "no2": round(sum(s["pollutants"]["no2"] for s in stations) / len(stations), 1),
        "so2": round(sum(s["pollutants"]["so2"] for s in stations) / len(stations), 1),
        "co": round(sum(s["pollutants"]["co"] for s in stations) / len(stations), 1),
        "o3": round(sum(s["pollutants"]["o3"] for s in stations) / len(stations), 1),
    }
    try:
        aqi_res = compute_aqi(pollutant_totals)
        dom_key = aqi_res.dominant_pollutant or "pm25"
    except Exception:
        dom_key = "pm25"

    return {
        "city": cfg["city"]["name"],
        "state": cfg["city"].get("state", ""),
        "center": center_coords,
        "station_count": len(stations),
        "current_aqi": avg_aqi,
        "aqi_category": _category_for_index(avg_aqi),
        "dominant_pollutant": (dom_key or "PM2.5").upper(),
        "pm25": avg_pm25,
        "pm10": avg_pm10,
        "data_source": data_source,
        "data_timestamp": latest_timestamp,
        "last_polled_at": now_ist.isoformat(),
        "is_stale": is_stale,
        "is_simulated": any_simulated,
    }


def get_all_cities_summary(session: Any = None) -> list[dict[str, Any]]:
    """Return summary of all 7 target cities for Screen 1 (India Overview)."""
    configs = get_all_city_configs()
    cities_list = []

    for city_key, cfg in configs.items():
        city_name = cfg["city"]["name"]
        overview = get_city_overview(city_name, session)
        if overview:
            cities_list.append({
                "name": overview["city"],
                "state": overview["state"],
                "coordinates": overview["center"],
                "current_aqi": overview["current_aqi"],
                "aqi_category": overview["aqi_category"],
                "dominant_pollutant": overview["dominant_pollutant"],
                "station_count": overview["station_count"],
                "data_source": overview["data_source"],
                "data_timestamp": overview["data_timestamp"],
                "last_polled_at": overview["last_polled_at"],
                "is_stale": overview["is_stale"],
                "is_simulated": overview["is_simulated"],
            })

    cities_list.sort(key=lambda c: c["name"])
    return cities_list


__all__ = [
    "list_available_cities",
    "get_city_config",
    "get_all_city_configs",
    "get_verified_stations",
    "get_city_verified_stations",
    "get_city_overview",
    "get_all_cities_summary",
]
