"""AI Context and Interaction Data Models (Anish - Intelligence Subsystem).

Defines the structured context passed from any screen into the AI layer,
and the standardized AI response schema ensuring strict grounding and provenance.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


class InformationProvenance(str, Enum):
    """Classification of environmental data truth level to prevent AI hallucinations."""
    MEASURED_FACT = "measured_fact"       # Verified sensor measurement (e.g. CPCB CAAQMS)
    MODEL_ESTIMATE = "model_estimate"     # Atmospheric model estimate (e.g. Open-Meteo/CAMS)
    FORECAST = "forecast"                 # Projected forward movement / dispersion
    SIMULATION = "simulation"             # Emergency synthetic fallback or demo scenario


class AIContext(BaseModel):
    """Complete context model capturing user journey state across screens."""
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
