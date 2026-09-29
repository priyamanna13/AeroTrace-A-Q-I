"""Civic policy interventions and counterfactual simulation router (Screen 6)."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..validation import _sanitize_path_param, _sanitize_pollutant

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/intervention", tags=["Intervention"])


class InterventionSimulateRequest(BaseModel):
    station_name: str = Field(
        ...,
        min_length=1,
        max_length=80,
        pattern=r"^[A-Za-z][A-Za-z0-9 .()&/,'_-]*$",
        description="Target monitoring station name",
    )
    intervention_type: str = Field(
        ...,
        min_length=1,
        max_length=80,
        description="control_construction_dust | reduce_traffic | reduce_industrial_emissions",
    )
    city: Optional[str] = Field(
        None,
        min_length=1,
        max_length=80,
        pattern=r"^[A-Za-z][A-Za-z0-9 .()&,'_-]*$",
        description="Optional city override",
    )
    intensity_pct: float = Field(default=50.0, ge=0.0, le=100.0)
    target_pollutant: Optional[str] = Field(
        None,
        pattern=r"^(pm25|pm10|no2|so2|co|o3)$",
        description="Optional pollutant override (pm25, pm10, no2, so2, co, o3)",
    )


@router.post("/simulate")
def simulate_civic_intervention(req: InterventionSimulateRequest):
    """Screen 6 Contract: Civic intervention simulator with documented ERF methodology.
    
    Supported intervention types:
    - 'control_construction_dust': Anti-smog water cannons, mist curtains (max ERF: 0.25)
    - 'reduce_traffic': Heavy diesel freight diversion, odd-even zones (max ERF: 0.35)
    - 'reduce_industrial_emissions': Boiler load shedding, scrubber compliance (max ERF: 0.30)
    
    Guarantees:
    - No hard-coded fictional results: derived from empirical ERF model and NAQS sensitivity weights.
    - Non-fabrication: returns 'sensitive location data not available for this city' if unverified.
    """
    from ..intervention import simulate_intervention
    safe_station = _sanitize_path_param(req.station_name, "station_name")
    try:
        return simulate_intervention(
            city=req.city or "",
            station_name=safe_station,
            intervention_type=req.intervention_type,
            intensity_pct=req.intensity_pct,
            target_pollutant=_sanitize_pollutant(req.target_pollutant),
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Intervention simulation failed: {exc}")
