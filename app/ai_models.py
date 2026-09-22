"""AI Context and Interaction Data Models (Anish - Intelligence Subsystem).

Defines the structured context passed from any screen into the AI layer,
and the standardized AI response schema ensuring strict grounding and provenance.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field, model_validator


class InformationProvenance(str, Enum):
    """Classification of environmental data truth level to prevent AI hallucinations."""
    MEASURED_FACT = "measured_fact"       # Verified sensor measurement (e.g. CPCB CAAQMS)
    MODEL_ESTIMATE = "model_estimate"     # Atmospheric model estimate (e.g. Open-Meteo/CAMS)
    FORECAST = "forecast"                 # Projected forward movement / dispersion
    SIMULATION = "simulation"             # Emergency synthetic fallback or demo scenario


def resolve_provenance(data_source: Optional[str], is_simulated: bool = False) -> InformationProvenance:
    """Classify environmental data truth level from provider and simulated state."""
    if is_simulated:
        return InformationProvenance.SIMULATION
    src_upper = (data_source or "").upper()
    if "SIMULAT" in src_upper:
        return InformationProvenance.SIMULATION
    if "COPERNICUS" in src_upper or "CAMS" in src_upper or "OPENMETEO" in src_upper:
        return InformationProvenance.MODEL_ESTIMATE
    if "FORECAST" in src_upper or "PREDICTION" in src_upper:
        return InformationProvenance.FORECAST
    return InformationProvenance.MEASURED_FACT


class AIContext(BaseModel):
    """Complete context model capturing user journey state across screens."""

    @model_validator(mode="before")
    @classmethod
    def _default_provenance(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "provenance" not in data or data["provenance"] is None:
                src = data.get("data_source")
                is_sim = bool(data.get("is_simulated", False))
                data["provenance"] = resolve_provenance(src, is_sim)
        return data

    screen_id: str = Field(
        ...,
        description="Originating screen identifier (e.g., 'screen_1_india', 'screen_2_city', 'screen_3_station', 'screen_4_investigation', 'screen_5_prediction', 'screen_6_impact', 'screen_7_analytics', 'screen_9_chat')",
        json_schema_extra={"example": "screen_2_city"},
    )
    city: Optional[str] = Field(None, json_schema_extra={"example": "Pune"})
    station: Optional[str] = Field(None, json_schema_extra={"example": "Shivajinagar"})
    pollutant: Optional[str] = Field(None, json_schema_extra={"example": "PM2.5"})
    language: str = Field("en", description="User language: 'en', 'hi', or 'mr'", json_schema_extra={"example": "en"})

    # Environmental Telemetry & Freshness
    current_aqi: Optional[float] = Field(None, json_schema_extra={"example": 182.0})
    dominant_pollutant: Optional[str] = Field(None, json_schema_extra={"example": "PM2.5"})
    data_source: Optional[str] = Field(None, json_schema_extra={"example": "CPCB Portal"})
    data_timestamp: Optional[str] = Field(None, json_schema_extra={"example": "2026-09-20T18:45:00+05:30"})
    provenance: InformationProvenance = Field(
        default=InformationProvenance.MEASURED_FACT,
        description="Factual classification of current reading",
    )
    is_simulated: bool = Field(False, description="True if operating in emergency simulation fallback")
    is_stale: bool = Field(False, description="True if telemetry data is older than staleness threshold")
    pollutants: Optional[dict[str, float]] = Field(
        None, description="Raw pollutant readings dict: pm25, pm10, no2, so2, co, o3"
    )

    # Subsystem Specific Context Blocks (Optional, populated depending on screen)
    sub_pollutants: Optional[dict[str, Any]] = Field(
        None, description="Concentrations and sub-indices for PM2.5, PM10, NO2, SO2, CO, O3"
    )
    weather: Optional[dict[str, Any]] = Field(
        None, description="Wind speed, direction, temperature, Pasquill stability"
    )
    attribution: Optional[dict[str, Any]] = Field(
        None, description="Top ranked sources, confidence breakdown, chemical fingerprint"
    )
    forecast: Optional[dict[str, Any]] = Field(
        None, description="Forward 1H/3H/6H trajectory and dispersion data"
    )
    intervention: Optional[dict[str, Any]] = Field(
        None, description="Selected intervention parameters and projected delta"
    )
    analytics: Optional[dict[str, Any]] = Field(
        None, description="Historical trends, 24H/7D range summaries, anomaly flags"
    )

    @classmethod
    def from_city_overview(
        cls,
        overview: dict[str, Any],
        screen_id: str = "screen_2_city",
        language: str = "en",
        analytics: Optional[dict[str, Any]] = None,
    ) -> AIContext:
        """Ground AIContext directly from an /api/v1/cities/{city}/overview payload."""
        src = overview.get("data_source") or "CPCB CAAQMS"
        is_sim = bool(overview.get("is_simulated", False)) or ("SIMULATED" in str(src).upper())
        prov = resolve_provenance(src, is_sim)

        # Extract pollutants if present
        polls: dict[str, float] = {}
        for key in ("pm25", "pm10", "no2", "so2", "co", "o3"):
            if key in overview and overview[key] is not None:
                try:
                    polls[key] = float(overview[key])
                except (ValueError, TypeError):
                    pass

        return cls(
            screen_id=screen_id,
            city=overview.get("city"),
            language=language,
            current_aqi=float(overview["current_aqi"]) if overview.get("current_aqi") is not None else None,
            dominant_pollutant=overview.get("dominant_pollutant"),
            data_source=src,
            data_timestamp=overview.get("data_timestamp"),
            provenance=prov,
            is_simulated=is_sim,
            is_stale=bool(overview.get("is_stale", False)),
            pollutants=polls or None,
            analytics=analytics,
        )

    @classmethod
    def from_station_telemetry(
        cls,
        telemetry: dict[str, Any],
        screen_id: str = "screen_3_station",
        language: str = "en",
        weather: Optional[dict[str, Any]] = None,
        attribution: Optional[dict[str, Any]] = None,
    ) -> AIContext:
        """Ground AIContext directly from verified physical CAAQMS telemetry."""
        src = telemetry.get("data_source") or "CPCB_CAAQMS"
        is_sim = bool(telemetry.get("is_simulated", False)) or ("SIMULATED" in str(src).upper())
        prov = resolve_provenance(src, is_sim)

        raw_polls = telemetry.get("pollutants") or {}
        polls: dict[str, float] = {}
        for k, v in raw_polls.items():
            if v is not None:
                try:
                    polls[k] = float(v)
                except (ValueError, TypeError):
                    pass

        return cls(
            screen_id=screen_id,
            city=telemetry.get("city"),
            station=telemetry.get("name") or telemetry.get("station_id"),
            language=language,
            current_aqi=float(telemetry["current_aqi"]) if telemetry.get("current_aqi") is not None else None,
            dominant_pollutant=telemetry.get("dominant_pollutant"),
            data_source=src,
            data_timestamp=telemetry.get("data_timestamp"),
            provenance=prov,
            is_simulated=is_sim,
            is_stale=bool(telemetry.get("is_stale", False)),
            pollutants=polls or None,
            weather=weather,
            attribution=attribution,
        )



class AIInsightRequest(BaseModel):
    """Request payload for an inline 2-4 sentence AI summary card."""
    context: AIContext


class AIChatRequest(BaseModel):
    """Request payload for interactive Screen 9 conversation."""
    message: str = Field(..., json_schema_extra={"example": "Why did AQI spike in Shivajinagar this morning?"})
    context: AIContext
    conversation_history: list[dict[str, str]] = Field(
        default_factory=list,
        description="Prior messages in format [{'role': 'user'|'assistant', 'content': '...'}]",
    )


class AIResponse(BaseModel):
    """Standardized AI output contract ensuring factual grounding and provenance."""
    response_text: str = Field(..., description="Localized response in requested language (EN/HI/MR)")
    language: str = Field("en", description="Output locale")
    provider: str = Field(..., description="Active AI provider: 'gemini', 'template_fallback', etc.")
    confidence_note: str = Field(
        ...,
        description="Mandatory grounding note indicating data provenance (Fact vs Model vs Forecast vs Simulation)",
    )
    provenance: InformationProvenance
    is_grounded: bool = Field(True, description="True if response is strictly verified against provided context")
    suggested_follow_ups: list[str] = Field(
        default_factory=list,
        description="Relevant investigation suggestions linking into deeper screens",
    )
    context_summary: dict[str, Any] = Field(
        default_factory=dict,
        description="Snapshot of key parameters used to ground this response",
    )
