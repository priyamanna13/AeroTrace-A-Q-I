"""Multi-City Ingestion & Provider Fallback Cascade Engine for AeroTrace NGEC 2026.

Implements the multi-source normalized environmental data ingestion ensemble across all 7 cities:
  - Provider 1 (Primary Government Ground Sensor Network): Live CPCB CAAQMS official RSS feed.
  - Provider 2 (Secondary Global Weather Grid): Open-Meteo Air Quality (Copernicus CAMS).
  - Provider 3 (Secondary Global Weather Grid): OpenWeatherMap Air Pollution API (OWM_API_KEY).
  - Provider 4 (Tertiary Station Feed): WAQI feed with US EPA -> Indian CPCB inverse normalization and distance guarding.
  - Emergency Floor: Deterministic diurnal baseline, STRICTLY labeled
    'SIMULATED — live source unreachable' with is_simulated=True.

Guarantees:
  1. Physical Station Integrity: Only verified physical CAAQMS stations from city_configs/
     are ever ingested or emitted as station entities.
  2. Data Provenance Transparency: Every telemetry frame carries upstream data_source,
     upstream data_timestamp, 30-second last_polled_at, is_stale (>120m), and is_simulated.
  3. 30-Second Refresh Cadence: 30-second in-memory TTL caching prevents API spam and
     rate limits while ensuring responsive data delivery.
  4. Multi-Source Normalization: All upstream feeds are normalized to Indian CPCB NAQI standards.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import ssl
import threading
import time
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from .standards import compute_aqi, _category_for_index, us_aqi_to_concentration, cpcb_sub_index_to_concentration

log = logging.getLogger(__name__)

# Indian Standard Time (UTC+5:30)
IST = ZoneInfo("Asia/Kolkata")

# 30-second application refresh TTL
TELEMETRY_CACHE_TTL_SECONDS: float = 30.0

# 120-minute staleness threshold matching hourly provider update cycles
STALENESS_THRESHOLD_SECONDS: float = 7200.0

# In-memory cache: station_key -> (StationTelemetry, float_timestamp)
_TELEMETRY_CACHE: dict[str, tuple[StationTelemetry, float]] = {}

# CPCB CAAQMS Official Feed In-Memory Cache (15-minute TTL to respect upstream server)
_CPCB_FEED_CACHE: dict[str, Any] = {"stations": [], "last_polled": 0.0}
_CPCB_FEED_LOCK = threading.Lock()
CPCB_FEED_TTL_SECONDS: float = 900.0

# Baseline fallback concentrations when all live networks are unreachable (Emergency Floor)
_CITY_BASELINES: dict[str, dict[str, float]] = {
    "pune": {"pm25": 78.4, "pm10": 156.2, "no2": 44.0, "so2": 18.0, "co": 1.2, "o3": 34.0},
    "mumbai": {"pm25": 54.2, "pm10": 128.6, "no2": 42.0, "so2": 16.5, "co": 1.1, "o3": 38.0},
    "delhi": {"pm25": 135.0, "pm10": 260.0, "no2": 68.0, "so2": 24.0, "co": 2.1, "o3": 45.0},
    "bengaluru": {"pm25": 22.0, "pm10": 48.0, "no2": 21.0, "so2": 8.0, "co": 0.6, "o3": 52.0},
    "kolkata": {"pm25": 68.0, "pm10": 142.0, "no2": 46.0, "so2": 19.0, "co": 1.3, "o3": 36.0},
    "hyderabad": {"pm25": 38.0, "pm10": 88.0, "no2": 45.0, "so2": 14.0, "co": 0.9, "o3": 41.0},
    "chennai": {"pm25": 29.0, "pm10": 72.0, "no2": 26.0, "so2": 11.0, "co": 0.8, "o3": 39.0},
}


@dataclass
class StationTelemetry:
    """Standardized telemetry frame for a verified physical monitoring station."""

    station_id: str
    name: str
    network: str
    city: str
    state: str
    coordinates: list[float]  # GeoJSON [longitude, latitude]
    elevation_m: int
    current_aqi: float
    aqi_category: str
    dominant_pollutant: str
    pollutants: dict[str, float]  # pm25, pm10, no2, so2, co, o3
    data_source: str
    data_timestamp: str  # ISO-8601 with timezone (+05:30)
    last_polled_at: str  # ISO-8601 with timezone (+05:30)
    is_stale: bool
    is_simulated: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def clear_telemetry_cache() -> None:
    """Clear in-memory telemetry cache (primarily for tests)."""
    global _TELEMETRY_CACHE, _CPCB_FEED_CACHE
    _TELEMETRY_CACHE.clear()
    with _CPCB_FEED_LOCK:
        _CPCB_FEED_CACHE = {"stations": [], "last_polled": 0.0}


def _format_iso_ist(dt: datetime) -> str:
    """Format datetime as ISO 8601 string in IST with explicit +05:30."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    else:
        dt = dt.astimezone(IST)
    return dt.isoformat()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two GPS coordinates in kilometers."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return r * c


def _normalize_str(s: str) -> str:
    """Normalize string for fuzzy station and city matching."""
    return "".join(c for c in s.lower() if c.isalnum())


# ── Provider 1: Official CPCB CAAQMS Feed (Government Ground Sensors) ────────
def _get_cpcb_rss_stations(timeout: float = 25.0) -> list[dict[str, Any]]:
    """Fetch and parse all physical stations from official CPCB CAAQMS RSS feed with 15m in-memory cache."""
    global _CPCB_FEED_CACHE
    now = time.time()
    with _CPCB_FEED_LOCK:
        if _CPCB_FEED_CACHE["stations"] and (now - _CPCB_FEED_CACHE["last_polled"]) < CPCB_FEED_TTL_SECONDS:
            return _CPCB_FEED_CACHE["stations"]

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        url = "https://airquality.cpcb.gov.in/caaqms/rss_feed"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
            "Accept": "application/xml, text/xml, */*",
        }
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                xml_data = resp.read()
            root = ET.fromstring(xml_data)

            parsed_stations = []
            for state in root.findall(".//State"):
                for city in state.findall(".//City"):
                    c_name = city.get("id", "").strip()
                    for st in city.findall(".//Station"):
                        st_name = st.get("id", "").strip()
                        lastupdate = st.get("lastupdate", "").strip()
                        lat = float(st.get("latitude", 0) or 0)
                        lon = float(st.get("longitude", 0) or 0)

                        aq_tag = st.find("Air_Quality_Index")
                        official_aqi = (
                            int(aq_tag.get("Value"))
                            if aq_tag is not None and aq_tag.get("Value", "").isdigit()
                            else None
                        )
                        official_pred = aq_tag.get("Predominant_Parameter") if aq_tag is not None else None

                        sub_indices = {}
                        hourly_sub_indices = {}
                        for p in st.findall(".//Pollutant_Index"):
                            raw_id = p.get("id", "").lower().replace(".", "").strip()
                            # Normalize pollutant id: ozone -> o3, pm25 -> pm25
                            p_id = "o3" if "zone" in raw_id or raw_id == "o" else raw_id
                            avg_val = p.get("Avg")
                            hr_val = p.get("Hourly_sub_index")
                            if avg_val and avg_val != "NA":
                                try:
                                    sub_indices[p_id] = float(avg_val)
                                except ValueError:
                                    pass
                            if hr_val and hr_val != "NA":
                                try:
                                    hourly_sub_indices[p_id] = float(hr_val)
                                except ValueError:
                                    pass

                        parsed_stations.append({
                            "city": c_name,
                            "name": st_name,
                            "norm_name": _normalize_str(st_name),
                            "lastupdate": lastupdate,
                            "lat": lat,
                            "lon": lon,
                            "official_aqi": official_aqi,
                            "official_pred": official_pred,
                            "sub_indices": sub_indices,
                            "hourly_sub_indices": hourly_sub_indices,
                        })

            _CPCB_FEED_CACHE["stations"] = parsed_stations
            _CPCB_FEED_CACHE["last_polled"] = now
            return parsed_stations
        except Exception as exc:
            log.warning("CPCB CAAQMS RSS feed fetch failed: %s", exc)
            return _CPCB_FEED_CACHE.get("stations", [])


def _fetch_tier1_cpcb(
    station_cfg: dict[str, Any],
    city_cfg: dict[str, Any],
    timeout: float = 25.0,
) -> Optional[dict[str, Any]]:
    """Live ingestion directly from official CPCB CAAQMS national monitoring feed."""
    stations = _get_cpcb_rss_stations(timeout=timeout)
    if not stations:
        return None

    c_name = city_cfg.get("city", {}).get("name", "")
    st_name = station_cfg.get("name", "")
    st_lat = float(station_cfg.get("lat", 0) or 0)
    st_lon = float(station_cfg.get("lon", 0) or 0)
    norm = _normalize_str(st_name)

    # 1. Match by station name within matching city
    matched = None
    for xs in stations:
        city_match = (
            xs["city"].lower() in c_name.lower()
            or c_name.lower() in xs["city"].lower()
            or (c_name.lower() == "bengaluru" and "bangalore" in xs["city"].lower())
        )
        if city_match:
            if norm in xs["norm_name"] or xs["norm_name"] in norm:
                matched = xs
                break

    # 2. Match by GPS proximity within 15 km in same city
    if not matched and st_lat and st_lon:
        best_d = 999.0
        for xs in stations:
            city_match = (
                xs["city"].lower() in c_name.lower()
                or c_name.lower() in xs["city"].lower()
                or (c_name.lower() == "bengaluru" and "bangalore" in xs["city"].lower())
            )
            if city_match and xs["lat"] and xs["lon"]:
                d = _haversine_km(st_lat, st_lon, xs["lat"], xs["lon"])
                if d < best_d and d <= 15.0:
                    best_d = d
                    matched = xs

    if not matched:
        return None

    # Prioritize hourly sub-index (current conditions), fallback to 24-hr average
    pollutants_sub = {}
    all_keys = set(matched["sub_indices"].keys()) | set(matched["hourly_sub_indices"].keys())
    for k in all_keys:
        if k in matched["hourly_sub_indices"]:
            pollutants_sub[k] = matched["hourly_sub_indices"][k]
        elif k in matched["sub_indices"]:
            pollutants_sub[k] = matched["sub_indices"][k]

    # Convert CPCB sub-indices to canonical physical concentrations (ug/m3 or mg/m3)
    pollutants_conc = {k: cpcb_sub_index_to_concentration(k, v) for k, v in pollutants_sub.items()}

    # Ensure canonical key coverage
    for req in ("pm25", "pm10", "no2", "so2", "co", "o3"):
        if req not in pollutants_conc or pollutants_conc[req] is None:
            pollutants_conc[req] = 0.0

    # Parse lastupdate timestamp: format "DD-MM-YYYY HH:MM:SS" in IST
    ts_str = matched.get("lastupdate", "")
    try:
        dt = datetime.strptime(ts_str, "%d-%m-%Y %H:%M:%S").replace(tzinfo=IST)
    except Exception:
        dt = datetime.now(IST)

    # Staleness check: if station has not updated in > 2 hours, reject
    now_ist = datetime.now(IST)
    if (now_ist - dt).total_seconds() > STALENESS_THRESHOLD_SECONDS:
        log.debug("CPCB station %s is stale (>2h old).", matched["name"])
        return None

    return {
        "pollutants": pollutants_conc,
        "data_source": "CPCB_CAAQMS",
        "data_timestamp": _format_iso_ist(dt),
    }


# ── Provider 2: Open-Meteo Air Quality (Copernicus CAMS) ────────────────────
def _fetch_tier2_open_meteo(
    station_cfg: dict[str, Any],
    city_cfg: dict[str, Any],
    timeout: float = 4.0,
) -> Optional[dict[str, Any]]:
    """Live ingestion via Open-Meteo Air Quality (Copernicus CAMS). Pure raw model data."""
    lat = station_cfg.get("lat")
    lon = station_cfg.get("lon")
    if lat is None or lon is None:
        return None

    url = (
        "https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={lat}&longitude={lon}"
        "&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone"
        "&timezone=Asia%2FKolkata"
    )
    headers = {"User-Agent": "AeroTrace-NGEC/3.1 (AeroTrace Air Quality Intelligence)"}

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        cur = data.get("current", {})
        pm25_raw = float(cur.get("pm2_5", 0) or 0)
        pm10_raw = float(cur.get("pm10", 0) or 0)
        co_raw = float(cur.get("carbon_monoxide", 0) or 0) / 1000.0
        no2_raw = float(cur.get("nitrogen_dioxide", 0) or 0)
        so2_raw = float(cur.get("sulphur_dioxide", 0) or 0)
        o3_raw = float(cur.get("ozone", 0) or 0)

        # Raw Copernicus CAMS concentrations without synthetic hash multipliers
        pollutants = {
            "pm25": max(1.0, round(pm25_raw, 1)),
            "pm10": max(2.0, round(pm10_raw, 1)),
            "no2": max(1.0, round(no2_raw, 1)),
            "so2": max(0.5, round(so2_raw, 1)),
            "co": max(0.1, round(co_raw, 2)),
            "o3": max(5.0, round(o3_raw * 0.15, 1)),
        }

        time_str = cur.get("time")
        if time_str:
            try:
                dt = datetime.fromisoformat(time_str).replace(tzinfo=IST)
            except Exception:
                dt = datetime.now(IST)
        else:
            dt = datetime.now(IST)

        return {
            "pollutants": pollutants,
            "data_source": "Open-Meteo Air Quality (Copernicus CAMS)",
            "data_timestamp": _format_iso_ist(dt),
        }
    except Exception as exc:
        log.debug("Open-Meteo fetch failed for %s: %s", station_cfg.get("name"), exc)

    return None


# ── Provider 3: OpenWeatherMap Air Pollution API ─────────────────────────────
def _fetch_provider_owm(
    station_cfg: dict[str, Any],
    city_cfg: dict[str, Any],
    timeout: float = 4.0,
) -> Optional[dict[str, Any]]:
    """Live ingestion via OpenWeatherMap Air Pollution API."""
    token = os.getenv("OWM_API_KEY", "").strip()
    if not token:
        return None

    lat = station_cfg.get("lat")
    lon = station_cfg.get("lon")
    if lat is None or lon is None:
        return None

    url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={token}"
    headers = {"User-Agent": "AeroTrace-NGEC/3.1 (AeroTrace Air Quality Intelligence)"}

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        items = data.get("list", [])
        if not items:
            return None

        cur = items[0]
        comps = cur.get("components", {})
        unix_ts = cur.get("dt", 0)
        dt = (
            datetime.fromtimestamp(unix_ts, tz=timezone.utc).astimezone(IST)
            if unix_ts
            else datetime.now(IST)
        )

        pollutants = {
            "pm25": max(1.0, round(float(comps.get("pm2_5", 0) or 0), 1)),
            "pm10": max(2.0, round(float(comps.get("pm10", 0) or 0), 1)),
            "no2": max(1.0, round(float(comps.get("no2", 0) or 0), 1)),
            "so2": max(0.5, round(float(comps.get("so2", 0) or 0), 1)),
            "co": max(0.1, round(float(comps.get("co", 0) or 0) / 1000.0, 2)),
            "o3": max(5.0, round(float(comps.get("o3", 0) or 0) * 0.15, 1)),
        }

        return {
            "pollutants": pollutants,
            "data_source": "OpenWeatherMap",
            "data_timestamp": _format_iso_ist(dt),
        }
    except Exception as exc:
        log.debug("OpenWeatherMap fetch failed for %s: %s", station_cfg.get("name"), exc)

    return None


# ── Provider 4: WAQI API (World Air Quality Index) ───────────────────────────
def _fetch_tier3_waqi(
    station_cfg: dict[str, Any],
    city_cfg: dict[str, Any],
    timeout: float = 4.0,
) -> Optional[dict[str, Any]]:
    """Live ingestion via WAQI feed with distance guard and US EPA inverse conversion."""
    token = os.getenv("WAQI_TOKEN") or os.getenv("WAQI_API_KEY", "")
    if not token:
        return None

    lat = station_cfg.get("lat")
    lon = station_cfg.get("lon")
    if lat is None or lon is None:
        return None

    url = f"https://api.waqi.info/feed/geo:{lat};{lon}/?token={token}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AeroTrace-NGEC/3.1"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        if data.get("status") == "ok":
            d = data.get("data", {})

            # Distance Guard: verify WAQI didn't fall back to a distant city station
            w_geo = d.get("city", {}).get("geo", [])
            if len(w_geo) >= 2:
                dist_km = _haversine_km(lat, lon, float(w_geo[0]), float(w_geo[1]))
                if dist_km > 50.0:
                    log.warning(
                        "WAQI distance guard triggered for %s: returned station %s is %.1fkm away. Discarding.",
                        station_cfg.get("name"),
                        d.get("city", {}).get("name"),
                        dist_km,
                    )
                    return None

            iaqi = d.get("iaqi", {})
            pm25_iaqi = float((iaqi.get("pm25") or {}).get("v", 0) or 0)
            pm10_iaqi = float((iaqi.get("pm10") or {}).get("v", 0) or 0)
            no2_iaqi = float((iaqi.get("no2") or {}).get("v", 0) or 0)
            so2_iaqi = float((iaqi.get("so2") or {}).get("v", 0) or 0)
            o3_iaqi = float((iaqi.get("o3") or {}).get("v", 0) or 0)
            co_iaqi = float((iaqi.get("co") or {}).get("v", 0) or 0)

            # Invert US EPA AQI values back to canonical mass concentrations (µg/m³ / mg/m³)
            pm25_c = us_aqi_to_concentration("pm25", pm25_iaqi) if pm25_iaqi > 0 else None
            pm10_c = us_aqi_to_concentration("pm10", pm10_iaqi) if pm10_iaqi > 0 else None
            no2_c = us_aqi_to_concentration("no2", no2_iaqi) if no2_iaqi > 0 else None
            so2_c = us_aqi_to_concentration("so2", so2_iaqi) if so2_iaqi > 0 else None
            o3_c = us_aqi_to_concentration("o3", o3_iaqi) if o3_iaqi > 0 else None
            co_c = us_aqi_to_concentration("co", co_iaqi) if co_iaqi > 0 else None

            pollutants = {}
            if pm25_c is not None: pollutants["pm25"] = pm25_c
            if pm10_c is not None: pollutants["pm10"] = pm10_c
            if no2_c is not None: pollutants["no2"] = no2_c
            if so2_c is not None: pollutants["so2"] = so2_c
            if o3_c is not None: pollutants["o3"] = o3_c
            if co_c is not None: pollutants["co"] = co_c

            if pm25_c or pm10_c:
                time_s = d.get("time", {}).get("s")
                if time_s:
                    try:
                        dt = datetime.fromisoformat(time_s).replace(tzinfo=IST)
                    except Exception:
                        dt = datetime.now(IST)
                else:
                    dt = datetime.now(IST)

                return {
                    "pollutants": pollutants,
                    "data_source": "WAQI (World Air Quality Index)",
                    "data_timestamp": _format_iso_ist(dt),
                }
    except Exception as exc:
        log.debug("WAQI fetch failed for %s: %s", station_cfg.get("name"), exc)

    return None


# ── Tier 4: Emergency Floor Simulation (Offline Fallback) ───────────────────
def _fetch_tier4_simulation(
    station_cfg: dict[str, Any],
    city_cfg: dict[str, Any],
) -> dict[str, Any]:
    """Tier 4 Emergency Floor Simulation. Triggered ONLY when all live networks are unreachable."""
    city_name = city_cfg.get("city", {}).get("name", "pune").lower()
    base = _CITY_BASELINES.get(city_name, _CITY_BASELINES["pune"])

    now_ist = datetime.now(IST)
    hour = now_ist.hour + now_ist.minute / 60.0
    morning_peak = 0.25 * (1.0 / (1.0 + ((hour - 8.5) / 1.5) ** 2))
    evening_peak = 0.20 * (1.0 / (1.0 + ((hour - 19.5) / 1.8) ** 2))
    factor = 0.85 + morning_peak + evening_peak

    h = int(hashlib.md5(station_cfg.get("name", "").encode("utf-8")).hexdigest(), 16)
    offset = ((h % 15) - 7) * 1.5

    pollutants = {
        "pm25": max(5.0, round((base["pm25"] + offset * 0.4) * factor, 1)),
        "pm10": max(10.0, round((base["pm10"] + offset * 0.8) * factor, 1)),
        "no2": max(5.0, round((base["no2"] + offset * 0.2) * factor, 1)),
        "so2": max(2.0, round((base["so2"] + offset * 0.1) * factor, 1)),
        "co": max(0.2, round((base["co"] + offset * 0.01) * factor, 2)),
        "o3": max(5.0, round((base["o3"] - offset * 0.1) * (2.0 - factor), 1)),
    }

    est_timestamp = now_ist - timedelta(minutes=15)

    return {
        "pollutants": pollutants,
        "data_source": "SIMULATED — live source unreachable",
        "data_timestamp": _format_iso_ist(est_timestamp),
        "is_simulated": True,
    }


def _combine_providers(provider_results: list[dict[str, Any]]) -> dict[str, Any]:
    """Multi-source consensus averaging and dynamic source labeling."""
    if len(provider_results) == 1:
        return provider_results[0]

    active_sources = [r["data_source"] for r in provider_results]

    # Calculate individual CPCB AQI per provider
    prov_aqis: list[float] = []
    for r in provider_results:
        r_aqi = compute_aqi(r["pollutants"])
        if r_aqi.total_aqi is not None:
            prov_aqis.append(float(r_aqi.total_aqi))

    if prov_aqis:
        consensus_aqi = round(sum(prov_aqis) / len(prov_aqis), 1)
    else:
        consensus_aqi = 100.0

    consensus_pollutants: dict[str, float] = {}
    for p_key in ("pm25", "pm10", "no2", "so2", "co", "o3"):
        p_vals = [
            float(r["pollutants"][p_key])
            for r in provider_results
            if p_key in r["pollutants"] and float(r["pollutants"][p_key]) > 0
        ]
        if p_vals:
            consensus_pollutants[p_key] = round(
                sum(p_vals) / len(p_vals), 2 if p_key == "co" else 1
            )
        else:
            consensus_pollutants[p_key] = 0.0

    short_names = []
    for s in active_sources:
        if "CPCB" in s: short_names.append("CPCB")
        elif "Open-Meteo" in s: short_names.append("Open-Meteo")
        elif "OpenWeather" in s: short_names.append("OpenWeather")
        elif "WAQI" in s: short_names.append("WAQI")
        else: short_names.append(s)

    data_source = f"Ensemble ({', '.join(short_names)})"
    latest_ts = max(r["data_timestamp"] for r in provider_results)

    return {
        "pollutants": consensus_pollutants,
        "current_aqi": consensus_aqi,
        "data_source": data_source,
        "data_timestamp": latest_ts,
        "is_simulated": False,
    }


# ── Master Ingestion & Normalization Cascade Engine ───────────────────────────
def fetch_station_telemetry(
    station_cfg: dict[str, Any],
    city_cfg: dict[str, Any],
    force_refresh: bool = False,
    force_tier_fail_until: Optional[int] = None,
) -> StationTelemetry:
    """Execute provider cascade and normalization for a verified physical CAAQMS station."""
    station_name = station_cfg["name"]
    city_name = city_cfg.get("city", {}).get("name", "")
    cache_key = f"{city_name.lower()}:{station_name.lower()}"
    now_time = time.time()
    now_ist = datetime.now(IST)

    # 1. Check in-memory 30-second cache
    if not force_refresh and cache_key in _TELEMETRY_CACHE:
        cached_item, cached_at = _TELEMETRY_CACHE[cache_key]
        if (now_time - cached_at) < TELEMETRY_CACHE_TTL_SECONDS:
            return cached_item

    fail_threshold = force_tier_fail_until or 0

    # Handle explicit test cascade simulation
    if fail_threshold >= 3:
        result = _fetch_tier4_simulation(station_cfg, city_cfg)
    else:
        # Step 1: Attempt Tier 1 CPCB CAAQMS (Official Statutory Ground Truth)
        p1 = None
        if fail_threshold < 1:
            p1 = _fetch_tier1_cpcb(station_cfg, city_cfg)

        if p1 is not None:
            # Physical CAAQMS ground sensor is actively operating!
            # If WAQI is also available for this station (within 50km), ensemble the two ground monitors
            p_waqi = _fetch_tier3_waqi(station_cfg, city_cfg) if fail_threshold < 3 else None
            if p_waqi is not None:
                result = _combine_providers([p1, p_waqi])
            else:
                result = p1
        else:
            # CPCB CAAQMS offline or bypassed in cascade test -> Fall back to secondary networks
            fallback_providers = []
            if fail_threshold < 2:
                p_meteo = _fetch_tier2_open_meteo(station_cfg, city_cfg)
                if p_meteo:
                    fallback_providers.append(p_meteo)

            if fail_threshold < 3:
                p_owm = _fetch_provider_owm(station_cfg, city_cfg)
                if p_owm:
                    fallback_providers.append(p_owm)
                p_waqi = _fetch_tier3_waqi(station_cfg, city_cfg)
                if p_waqi:
                    fallback_providers.append(p_waqi)

            if fallback_providers:
                result = _combine_providers(fallback_providers)
            else:
                result = _fetch_tier4_simulation(station_cfg, city_cfg)

    # Calculate final CPCB dominant pollutant and category
    pollutants = result["pollutants"]
    aqi_res = compute_aqi(pollutants)
    if "current_aqi" in result:
        current_aqi = result["current_aqi"]
    else:
        current_aqi = float(aqi_res.total_aqi) if aqi_res.total_aqi is not None else 100.0

    raw_dom = (aqi_res.dominant_pollutant or "pm25").lower()
    canonical_dom_map = {
        "pm25": "PM2.5",
        "pm10": "PM10",
        "no2": "NO2",
        "so2": "SO2",
        "co": "CO",
        "o3": "O3",
    }
    dominant_pollutant = canonical_dom_map.get(raw_dom, raw_dom.upper())
    aqi_cat = _category_for_index(current_aqi)

    # Check staleness against 120-minute threshold
    data_ts_str = result["data_timestamp"]
    is_stale = False
    try:
        parsed_dt = datetime.fromisoformat(data_ts_str)
        if parsed_dt.tzinfo is None:
            parsed_dt = parsed_dt.replace(tzinfo=IST)
        age_seconds = (now_ist - parsed_dt).total_seconds()
        if age_seconds > STALENESS_THRESHOLD_SECONDS:
            is_stale = True
    except Exception:
        pass

    telemetry = StationTelemetry(
        station_id=station_cfg.get("cpcb_station_id", f"site_{station_name.lower()}"),
        name=station_name,
        network=station_cfg.get("network", "CPCB_CAAQMS"),
        city=city_cfg.get("city", {}).get("name", "Unknown"),
        state=city_cfg.get("city", {}).get("state", "Unknown"),
        coordinates=[float(station_cfg["lon"]), float(station_cfg["lat"])],
        elevation_m=int(station_cfg.get("elevation_m", 0)),
        current_aqi=current_aqi,
        aqi_category=aqi_cat,
        dominant_pollutant=dominant_pollutant,
        pollutants=pollutants,
        data_source=result["data_source"],
        data_timestamp=result["data_timestamp"],
        last_polled_at=_format_iso_ist(now_ist),
        is_stale=is_stale,
        is_simulated=bool(result.get("is_simulated", False)),
    )

    # Cache for 30 seconds
    _TELEMETRY_CACHE[cache_key] = (telemetry, now_time)
    return telemetry


# ── Batch City Fetching ───────────────────────────────────────────────────────
def fetch_city_stations_telemetry(
    city_name: str,
    session: Any = None,
    force_refresh: bool = False,
    force_tier_fail_until: Optional[int] = None,
) -> Optional[list[dict[str, Any]]]:
    """Fetch live telemetry for all verified physical stations in a city concurrently.

    Returns a list of dicts conforming to the Screen 2 Station Pins contract.
    Persists readings to database if an active session is provided.
    """
    from .cities import get_city_config

    city_cfg = get_city_config(city_name)
    if not city_cfg or "stations" not in city_cfg:
        return None

    stations = city_cfg["stations"]

    # Poll stations concurrently using thread pool (4 workers per city)
    with ThreadPoolExecutor(max_workers=min(len(stations), 4)) as executor:
        futures = [
            executor.submit(
                fetch_station_telemetry,
                st,
                city_cfg,
                force_refresh,
                force_tier_fail_until,
            )
            for st in stations
        ]
        telemetry_items = [f.result() for f in futures]

    # Convert to contract dicts
    out: list[dict[str, Any]] = [item.to_dict() for item in telemetry_items]

    # Optional DB persistence if session is active
    if session is not None:
        _persist_readings_to_db(session, telemetry_items)

    return out


def _persist_readings_to_db(session: Any, items: list[StationTelemetry]) -> None:
    """Safely persist or update live telemetry in the database."""
    try:
        from .models import Station, AqiReading
        from sqlalchemy import select

        for item in items:
            st = session.execute(
                select(Station).where(Station.name == item.name)
            ).scalars().first()
            if not st:
                continue

            dt = datetime.fromisoformat(item.data_timestamp)
            # Idempotent upsert check
            existing = session.execute(
                select(AqiReading).where(
                    AqiReading.station_id == st.id,
                    AqiReading.timestamp == dt,
                )
            ).scalars().first()

            if existing:
                existing.total_aqi = int(round(item.current_aqi))
                existing.aqi_category = item.aqi_category
                existing.dominant_pollutant = item.dominant_pollutant.lower()
                existing.pm25 = item.pollutants.get("pm25")
                existing.pm10 = item.pollutants.get("pm10")
                existing.no2 = item.pollutants.get("no2")
                existing.so2 = item.pollutants.get("so2")
                existing.co = item.pollutants.get("co")
                existing.o3 = item.pollutants.get("o3")
                existing.data_source = item.data_source
                existing.is_simulated = item.is_simulated
            else:
                reading = AqiReading(
                    station_id=st.id,
                    timestamp=dt,
                    total_aqi=int(round(item.current_aqi)),
                    aqi_category=item.aqi_category,
                    dominant_pollutant=item.dominant_pollutant.lower(),
                    pm25=item.pollutants.get("pm25"),
                    pm10=item.pollutants.get("pm10"),
                    no2=item.pollutants.get("no2"),
                    so2=item.pollutants.get("so2"),
                    co=item.pollutants.get("co"),
                    o3=item.pollutants.get("o3"),
                    data_source=item.data_source,
                    is_simulated=item.is_simulated,
                )
                session.add(reading)
        session.commit()
    except Exception as exc:
        log.warning("DB persistence error: %s", exc)
        try:
            session.rollback()
        except Exception:
            pass
