"""Multi-city aggregation and physical CAAQMS monitoring station endpoints (Screens 1 & 2)."""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Path

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/cities", tags=["Cities"])


@router.get("")
def get_cities():
    """Screen 1 (India Overview) Contract: List all 7 target cities with aggregate AQI."""
    from ..cities import get_all_cities_summary
    try:
        from ..db import get_session
        with get_session() as s:
            return get_all_cities_summary(s)
    except Exception:
        return get_all_cities_summary(None)


@router.get("/{city_name}/overview")
def get_city_overview_endpoint(
    city_name: str = Path(..., min_length=1, max_length=80, pattern=r"^[A-Za-z][A-Za-z0-9 .()&,'_-]*$"),
):
    """Screen 2 (City Intelligence) Contract: Overview metrics and aggregate AQI for a city."""
    from ..cities import get_city_overview
    overview = None
    try:
        from ..db import get_session
        with get_session() as s:
            overview = get_city_overview(city_name, s)
    except Exception:
        overview = get_city_overview(city_name, None)

    if not overview:
        raise HTTPException(
            status_code=404,
            detail=f"City not configured or not found: {city_name!r}",
        )
    return overview


@router.get("/{city_name}/stations")
def get_city_stations_endpoint(
    city_name: str = Path(..., min_length=1, max_length=80, pattern=r"^[A-Za-z][A-Za-z0-9 .()&,'_-]*$"),
):
    """Screen 2 (City Intelligence) Contract: VERIFIED PHYSICAL MONITORING STATIONS ONLY.
    
    Guarantees:
    - Only physical CAAQMS stations are returned (never model grid points).
    - Preserves data source, source timestamp, and staleness status.
    """
    from ..cities import get_city_verified_stations
    stations = None
    try:
        from ..db import get_session
        with get_session() as s:
            stations = get_city_verified_stations(city_name, s)
    except Exception:
        stations = get_city_verified_stations(city_name, None)

    if stations is None:
        raise HTTPException(
            status_code=404,
            detail=f"City not configured or not found: {city_name!r}",
        )
    return stations
