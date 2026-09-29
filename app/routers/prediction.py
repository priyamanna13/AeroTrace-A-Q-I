"""Forward dispersion and air quality trajectory prediction router (Screen 5)."""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Path, Query

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/prediction", tags=["Prediction"])


@router.get("/{station_name}/{pollutant}")
def get_prediction(
    station_name: str = Path(..., min_length=1, max_length=80, pattern=r"^[A-Za-z][A-Za-z0-9 .()&/,'_-]*$"),
    pollutant: str = Path(
        ...,
        min_length=1,
        max_length=32,
        pattern=r"^[A-Za-z0-9]+$",
    ),
    hours: int = Query(default=6, ge=1, le=24, description="Forecast horizon in hours (1-24)"),
):
    """Screen 5 Contract: Forward air quality forecasting anchored to observed conditions.
    
    Returns:
    - 1H, 3H, 6H predicted AQI and pollutant concentrations.
    - Pasquill-Gifford dispersion decay trajectory.
    - Expanding confidence uncertainty intervals.
    - Downwind advected plume footprint GeoJSON polygon.
    - Non-negotiable label: 'Estimated forecast - see methodology'.
    """
    from ..prediction import calculate_forward_prediction
    pol_key = (pollutant or "").strip().lower()
    try:
        from ..db import get_session
        with get_session() as s:
            return calculate_forward_prediction(
                station_name=station_name,
                pollutant=pol_key,
                hours=hours,
                session=s,
            )
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as exc:
        try:
            return calculate_forward_prediction(
                station_name=station_name,
                pollutant=pol_key,
                hours=hours,
                session=None,
            )
        except ValueError as ve2:
            raise HTTPException(status_code=404, detail=str(ve2))
        except Exception as exc2:
            raise HTTPException(status_code=500, detail=f"Prediction failed: {exc2}")
