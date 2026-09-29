"""Contextual alerts router (Screen 8 & In-Screen Cards)."""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Path

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])


@router.get("")
def get_all_alerts():
    """Retrieve all active contextual alerts across all 7 metropolitan cities."""
    from ..alerts import evaluate_all_cities_alerts
    try:
        from ..db import get_session
        with get_session() as s:
            return evaluate_all_cities_alerts(s)
    except Exception:
        return evaluate_all_cities_alerts(None)


@router.get("/{city_name}")
def get_city_alerts_endpoint(
    city_name: str = Path(..., min_length=1, max_length=80, pattern=r"^[A-Za-z][A-Za-z0-9 .()&,'_-]*$"),
):
    """Retrieve active contextual alerts for a specific city and its physical CAAQMS stations."""
    from ..alerts import evaluate_city_alerts
    from ..cities import get_city_config
    if not get_city_config(city_name):
        raise HTTPException(
            status_code=404,
            detail=f"City not configured or not found: {city_name!r}",
        )
    try:
        from ..db import get_session
        with get_session() as s:
            return evaluate_city_alerts(city_name, s)
    except Exception:
        return evaluate_city_alerts(city_name, None)
