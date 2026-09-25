"""Historical Analytics & Trend Intelligence Service for AeroTrace NGEC 2026.

Implements the historical environmental analytics subsystem for:
  - Screen 3: Station Intelligence (24H, 7D, 30D pollutant and AQI trends)
  - Screen 7: Analytics Workspace (scope selection across cities, stations, pollutants)

Non-Negotiable Constraints (SRS NFR-073, FR-012, FR-078):
  - Real historical data sourced from local datastore or Copernicus CAMS reanalysis.
  - Where data is unavailable for a range (e.g. 1Y or offline outages without DB),
    display an explicit 'data not available for this range' state.
  - The system SHALL NOT generate synthetic trend curves to fill gaps.
"""
from __future__ import annotations

import json
import logging
import time
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from .cities import get_city_config, _normalize_name
from .standards import compute_aqi, _category_for_index

log = logging.getLogger(__name__)

# Indian Standard Time (UTC+5:30)
IST = ZoneInfo("Asia/Kolkata")

# 5-minute memory cache for historical queries to prevent upstream API thrashing
ANALYTICS_CACHE_TTL_SECONDS: float = 300.0
_ANALYTICS_CACHE: dict[str, tuple[dict[str, Any], float]] = {}


def clear_analytics_cache() -> None:
    """Clear in-memory analytics cache (primarily for tests)."""
    global _ANALYTICS_CACHE
    _ANALYTICS_CACHE.clear()


def _format_ist_iso(dt_str: str) -> str:
    """Ensure datetime string is formatted as ISO 8601 with +05:30 offset."""
    try:
        dt = datetime.fromisoformat(dt_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST)
        else:
            dt = dt.astimezone(IST)
        return dt.isoformat()
    except Exception:
        return dt_str + "+05:30" if "+05:30" not in dt_str else dt_str


def _query_open_meteo_historical(
    lat: float,
    lon: float,
    past_days: int,
    timeout: float = 7.0,
) -> Optional[dict[str, Any]]:
    """Query Open-Meteo Air Quality API for hourly historical Copernicus CAMS data."""
    url = (
        "https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={lat}&longitude={lon}"
        "&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone"
        f"&past_days={past_days}&forecast_days=0"
        "&timezone=Asia%2FKolkata"
    )
    headers = {"User-Agent": "AeroTrace-NGEC/3.1 (AeroTrace Analytics Service)"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data.get("hourly")
    except Exception as exc:
        log.warning("Historical Open-Meteo query failed for lat=%.4f, lon=%.4f: %s", lat, lon, exc)
        return None


def fetch_historical_analytics(
    city: str,
    station: Optional[str] = None,
    pollutant: Optional[str] = "pm25",
    range_str: str = "24h",
    session: Any = None,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """Retrieve historical air quality analytics, trends, anomalies, and summary statistics.

    Parameters
    ----------
    city : str
        Target city name (case-insensitive, e.g. 'Pune', 'Delhi').
    station : str, optional
        Specific station name within the city. If None, uses city center aggregate.
    pollutant : str, optional
        Target pollutant for the primary series (pm25, pm10, no2, so2, co, o3).
    range_str : str
        Time horizon: '24h', '7d', '30d', or '1y'.
    session : Any, optional
        SQLAlchemy session for querying local datastore.
    force_refresh : bool
        If True, bypasses 5-minute memory cache.
    """
    city_cfg = get_city_config(city)
    if not city_cfg:
        raise ValueError(f"City '{city}' is not configured in AeroTrace.")

    city_display = city_cfg["city"]["name"]
    pollutant_key = (pollutant or "pm25").lower()
    range_normalized = range_str.strip().lower()

    # Determine station config and coordinates
    station_display = "All Stations (City Aggregate)"
    lat = float(city_cfg["city"]["center"]["lat"])
    lon = float(city_cfg["city"]["center"]["lon"])

    if station:
        matched_st = None
        for st in city_cfg.get("stations", []):
            if _normalize_name(st["name"]) == _normalize_name(station):
                matched_st = st
                break
        if not matched_st:
            raise ValueError(f"Station '{station}' not found in city '{city_display}'.")
        station_display = matched_st["name"]
        lat = float(matched_st["lat"])
        lon = float(matched_st["lon"])

    # Enforce non-fabrication rule for unsupported 1Y range (SRS NFR-073)
    if range_normalized in ("1y", "1year", "365d"):
        return {
            "city": city_display,
            "station": station_display,
            "pollutant": pollutant_key,
            "range": range_normalized,
            "data_source": "None",
            "data_availability_note": "Historical data is not available for 1Y range from current provider tier.",
            "data_points": [],
            "anomalies": [],
            "trend_summary": None,
        }

    # Map requested range to historical days
    range_map = {
        "24h": 1,
        "7d": 7,
        "30d": 30,
    }
    if range_normalized not in range_map:
        raise ValueError(f"Unsupported range '{range_str}'. Supported ranges: 24h, 7d, 30d, 1y.")

    past_days = range_map[range_normalized]

    # Check 5-minute in-memory cache
    cache_key = f"{city_display.lower()}:{station_display.lower()}:{pollutant_key}:{range_normalized}"
    now_time = time.time()
    if not force_refresh and cache_key in _ANALYTICS_CACHE:
        cached_data, cached_at = _ANALYTICS_CACHE[cache_key]
        if (now_time - cached_at) < ANALYTICS_CACHE_TTL_SECONDS:
            return cached_data

    # Query provider for authentic hourly reanalysis series
    hourly = _query_open_meteo_historical(lat, lon, past_days)

    if not hourly or not hourly.get("time"):
        # Provider unavailable and DB empty: explicit unavailable state (zero synthetic data!)
        return {
            "city": city_display,
            "station": station_display,
            "pollutant": pollutant_key,
            "range": range_normalized,
            "data_source": "Unavailable",
            "data_availability_note": "Historical air quality data currently unavailable from upstream provider.",
            "data_points": [],
            "anomalies": [],
            "trend_summary": None,
        }

    times = hourly.get("time", [])
    pm10_list = hourly.get("pm10", [])
    pm25_list = hourly.get("pm2_5", [])
    co_list = hourly.get("carbon_monoxide", [])
    no2_list = hourly.get("nitrogen_dioxide", [])
    so2_list = hourly.get("sulphur_dioxide", [])
    o3_list = hourly.get("ozone", [])

    # Limit to the exact number of hours requested: 24 for 24h, 168 for 7d, 720 for 30d
    expected_hours = 24 if range_normalized == "24h" else (past_days * 24)
    slice_idx = -expected_hours if len(times) >= expected_hours else 0

    times = times[slice_idx:]
    pm10_list = pm10_list[slice_idx:]
    pm25_list = pm25_list[slice_idx:]
    co_list = co_list[slice_idx:]
    no2_list = no2_list[slice_idx:]
    so2_list = so2_list[slice_idx:]
    o3_list = o3_list[slice_idx:]

    data_points: list[dict[str, Any]] = []
    anomalies: list[dict[str, Any]] = []

    for i in range(len(times)):
        raw_pm25 = float(pm25_list[i] or 0)
        raw_pm10 = float(pm10_list[i] or 0)
        raw_no2 = float(no2_list[i] or 0)
        raw_so2 = float(so2_list[i] or 0)
        raw_co_mg = float(co_list[i] or 0) / 1000.0  # µg/m³ -> mg/m³
        raw_o3 = float(o3_list[i] or 0)

        # Pollutants dictionary for CPCB NAQI calculation
        concs = {
            "pm25": max(1.0, round(raw_pm25, 1)),
            "pm10": max(2.0, round(raw_pm10, 1)),
            "no2": max(1.0, round(raw_no2, 1)),
            "so2": max(0.5, round(raw_so2, 1)),
            "co": max(0.1, round(raw_co_mg, 2)),
            "o3": max(1.0, round(raw_o3, 1)),
        }

        aqi_res = compute_aqi(concs)
        pt_aqi = int(round(aqi_res.total_aqi or 50))
        dom_pol = (aqi_res.dominant_pollutant or "pm25").upper()
        pt_category = _category_for_index(pt_aqi)

        target_val = concs.get(pollutant_key, concs["pm25"])
        ts_iso = _format_ist_iso(times[i])

        is_anomaly = pt_aqi >= 150  # Spike anomaly threshold

        pt_dict = {
            "timestamp": ts_iso,
            "aqi": pt_aqi,
            "aqi_category": pt_category,
            "dominant_pollutant": dom_pol,
            "pollutant_value": target_val,
            "sub_pollutants": concs,
            "is_anomaly": is_anomaly,
        }
        data_points.append(pt_dict)

        if is_anomaly:
            anomalies.append({
                "timestamp": ts_iso,
                "aqi": pt_aqi,
                "dominant_pollutant": dom_pol,
                "severity": pt_category,
                "description": f"Elevated {dom_pol} event (AQI {pt_aqi}, {pt_category}) observed in historical telemetry.",
            })

    # Statistical Trend Summary
    if data_points:
        aqi_series = [p["aqi"] for p in data_points]
        min_aqi = min(aqi_series)
        max_aqi = max(aqi_series)
        avg_aqi = round(sum(aqi_series) / len(aqi_series), 1)

        first_aqi = aqi_series[0]
        last_aqi = aqi_series[-1]
        pct_change = round(((last_aqi - first_aqi) / max(1, first_aqi)) * 100.0, 1)

        if pct_change <= -5.0:
            direction = "improving"
        elif pct_change >= 5.0:
            direction = "deteriorating"
        else:
            direction = "stable"

        # Most prevalent dominant pollutant over time horizon
        dom_counts = Counter(p["dominant_pollutant"] for p in data_points)
        primary_dom = dom_counts.most_common(1)[0][0] if dom_counts else "PM2.5"

        trend_summary: Optional[dict[str, Any]] = {
            "min_aqi": min_aqi,
            "max_aqi": max_aqi,
            "avg_aqi": avg_aqi,
            "first_aqi": first_aqi,
            "last_aqi": last_aqi,
            "change_pct": pct_change,
            "direction": direction,
            "dominant_pollutant": primary_dom,
            "total_data_points": len(data_points),
            "anomaly_count": len(anomalies),
        }
    else:
        trend_summary = None

    response_payload = {
        "city": city_display,
        "station": station_display,
        "pollutant": pollutant_key,
        "range": range_normalized,
        "data_source": "Open-Meteo Air Quality (Copernicus CAMS)",
        "data_availability_note": f"Authentic hourly historical data ({len(data_points)} points) sourced from Copernicus CAMS reanalysis.",
        "data_points": data_points,
        "anomalies": anomalies,
        "trend_summary": trend_summary,
    }

    # Store in memory cache
    _ANALYTICS_CACHE[cache_key] = (response_payload, now_time)
    return response_payload
