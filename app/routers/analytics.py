"""Analytics, diurnal patterns, and historical trends router (Screen 7)."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Path, Query

log = logging.getLogger(__name__)
router = APIRouter(tags=["Analytics"])


@router.get("/api/v1/analytics/{city_name}")
def get_city_analytics_endpoint(
    city_name: str = Path(..., min_length=1, max_length=80, pattern=r"^[A-Za-z][A-Za-z0-9 .()&,'_-]*$"),
    range: str = Query(
        default="24H",
        description="Analytics window: 24H, 7D, or 30D",
        pattern=r"^(24h|7d|30d|24H|7D|30D)$",
    ),
):
    """Retrieve historical trends, diurnal pattern analysis, and AI interpretation for Screen 7."""
    from ..analytics_intelligence import generate_city_analytics
    from ..cities import get_city_config, list_available_cities, _normalize_name

    target_city = city_name
    matched_station = None
    city_cfg = get_city_config(city_name)
    if not city_cfg:
        # Check if target is a station name in any configured city
        norm = _normalize_name(city_name)
        for c in list_available_cities():
            cfg = get_city_config(c)
            if cfg:
                for st in cfg.get("stations", []):
                    if _normalize_name(st["name"]) == norm:
                        target_city = cfg["city"]["name"]
                        matched_station = st["name"]
                        city_cfg = cfg
                        break
            if matched_station:
                break

    if not city_cfg:
        raise HTTPException(
            status_code=404,
            detail=f"City or station not configured or not found: {city_name!r}",
        )

    try:
        from ..db import get_session
        with get_session() as s:
            payload = generate_city_analytics(target_city, time_range=range, session=s)
    except Exception:
        payload = generate_city_analytics(target_city, time_range=range, session=None)

    if matched_station:
        payload_dict = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        payload_dict["station"] = matched_station
        return payload_dict
    return payload


@router.get("/api/v1/analytics")
def get_analytics(
    city: str = Query(
        default="Pune",
        min_length=1,
        max_length=80,
        pattern=r"^[A-Za-z][A-Za-z0-9 .()&,'_-]*$",
        description="Target city name",
    ),
    station: Optional[str] = Query(
        default=None,
        min_length=1,
        max_length=80,
        pattern=r"^[A-Za-z][A-Za-z0-9 .()&/,'_-]*$",
        description="Specific station name, or omit for city-wide",
    ),
    pollutant: Optional[str] = Query(
        default="pm25",
        pattern=r"^(pm25|pm10|no2|so2|co|o3)$",
        description="Target pollutant key (pm25, pm10, no2, so2, co, o3)",
    ),
    range: str = Query(
        default="24h",
        pattern=r"^(24h|7d|30d|1y)$",
        description="Time horizon: 24h, 7d, 30d, 1y",
    ),
):
    """Screen 3 & Screen 7 Contract: Historical timeline, trend statistics, anomalies, and availability notes.
    
    Guarantees:
    - Real hourly historical data from Copernicus CAMS reanalysis or local datastore.
    - Non-fabrication: If range is unsupported or offline, returns explicit data_availability_note without inventing data.
    """
    from ..analytics import fetch_historical_analytics
    try:
        from ..db import get_session
        with get_session() as s:
            return fetch_historical_analytics(
                city=city,
                station=station,
                pollutant=pollutant,
                range_str=range,
                session=s,
            )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as exc:
        try:
            return fetch_historical_analytics(
                city=city,
                station=station,
                pollutant=pollutant,
                range_str=range,
                session=None,
            )
        except ValueError as ve2:
            raise HTTPException(status_code=404, detail=str(ve2))
        except Exception as exc2:
            raise HTTPException(status_code=500, detail=f"Analytics query failed: {exc2}")
