"""FastAPI Router for Environmental Intelligence (Anish — AI & Intelligence Subsystem).

Endpoints:
  POST /api/v1/ai/insight — Generates inline 2-4 sentence summaries for Screens 2–7.
  POST /api/v1/ai/chat    — Interactive conversational environmental intelligence (Screen 9).
  GET  /api/v1/ai/status  — Liveness and active provider status.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status

from .ai_models import AIChatRequest, AIInsightRequest, AIResponse
from .ai_service import get_ai_service

log = logging.getLogger("ai_router")

router = APIRouter(prefix="/api/v1/ai", tags=["Environmental Intelligence"])


@router.get("/status")
def get_ai_status() -> dict[str, Any]:
    """Return the active AI engine status, provider type, and supported locales."""
    service = get_ai_service()
    provider_name = service.__class__.__name__
    return {
        "status": "online",
        "provider": provider_name,
        "supports_gemini": provider_name == "GeminiAIService",
        "supported_languages": ["en", "hi", "mr"],
        "grounding_enforced": True,
    }


@router.post("/insight", response_model=AIResponse)
def generate_insight_endpoint(req: AIInsightRequest) -> AIResponse:
    """Produce a concise, factual 2–4 sentence summary grounded in the screen context."""
    try:
        service = get_ai_service()
        return service.generate_insight(req.context)
    except Exception as exc:
        log.error("Failed to generate AI insight: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Environmental insight generation error: {str(exc)}",
        )


@router.post("/chat", response_model=AIResponse)
def chat_endpoint(req: AIChatRequest) -> AIResponse:
    """Interactive environmental intelligence chat retaining active screen context."""
    try:
        service = get_ai_service()
        return service.chat(req)
    except Exception as exc:
        log.error("Failed to process AI chat query: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Environmental chat error: {str(exc)}",
        )


@router.get("/cities/{city_name}/insight", response_model=AIResponse)
def get_city_insight_endpoint(city_name: str, lang: str = "en") -> AIResponse:
    """Generate an AI insight directly grounded in the live /api/v1/cities/{city}/overview payload."""
    from .cities import get_city_overview
    from .ai_models import AIContext

    overview = None
    try:
        from .db import get_session
        with get_session() as s:
            overview = get_city_overview(city_name, s)
    except Exception:
        overview = get_city_overview(city_name, None)

    if not overview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"City not configured or found: {city_name!r}",
        )

    ctx = AIContext.from_city_overview(overview, screen_id="screen_2_city", language=lang)
    service = get_ai_service()
    return service.generate_insight(ctx)


@router.get("/cities/{city_name}/stations/{station_name}/insight", response_model=AIResponse)
def get_station_insight_endpoint(city_name: str, station_name: str, lang: str = "en") -> AIResponse:
    """Generate an AI insight grounded in verified physical CAAQMS station telemetry."""
    from .cities import get_city_verified_stations
    from .ai_models import AIContext

    stations = None
    try:
        from .db import get_session
        with get_session() as s:
            stations = get_city_verified_stations(city_name, s)
    except Exception:
        stations = get_city_verified_stations(city_name, None)

    if not stations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No verified stations available for city: {city_name!r}",
        )

    target_norm = station_name.strip().lower()
    target_station = next(
        (s for s in stations if s.get("name", "").strip().lower() == target_norm or s.get("station_id", "").strip().lower() == target_norm),
        None,
    )
    if not target_station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Station {station_name!r} not found in {city_name!r}",
        )

    ctx = AIContext.from_station_telemetry(target_station, screen_id="screen_3_station", language=lang)
    service = get_ai_service()
    return service.generate_insight(ctx)


@router.get("/analytics/{city_name}/insight", response_model=AIResponse)
def get_analytics_insight_endpoint(city_name: str, range: str = "24H", lang: str = "en") -> AIResponse:
    """Generate Screen 7 AI analytics insight explaining historical trends and diurnal patterns."""
    from .analytics_intelligence import generate_city_analytics
    from .ai_models import AIContext

    try:
        analytics = generate_city_analytics(city_name, time_range=range)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate analytics for {city_name!r}: {exc}",
        )

    an_dict = {
        "trend_direction": analytics.trend.trend_direction,
        "morning_peak_aqi": analytics.trend.diurnal_patterns.morning_peak_aqi,
        "midday_dip_aqi": analytics.trend.diurnal_patterns.midday_dip_aqi,
        "evening_peak_aqi": analytics.trend.diurnal_patterns.evening_peak_aqi,
        "time_range": analytics.time_range,
    }

    ctx = AIContext(
        screen_id="screen_7_analytics",
        city=analytics.city,
        current_aqi=analytics.current_aqi,
        dominant_pollutant=analytics.dominant_pollutant,
        data_source=analytics.data_source,
        data_timestamp=analytics.data_timestamp,
        is_simulated=analytics.is_simulated,
        is_stale=analytics.is_stale,
        language=lang,
        analytics=an_dict,
    )
    service = get_ai_service()
    return service.generate_insight(ctx)


@router.get("/weather-briefing/{city_name}", response_model=AIResponse)
def get_weather_briefing_endpoint(city_name: str, lang: str = "en") -> AIResponse:
    """Weather-grounded environmental intelligence briefing endpoint."""
    from .weather_context import get_weather_context
    from .ai_models import AIContext
    
    weather = get_weather_context(city_name)
    if not weather:
        raise HTTPException(status_code=404, detail="Weather context unavailable")
        
    ctx = AIContext(
        screen_id="screen_4_weather",
        city=city_name,
        weather=weather,
        language=lang,
    )
    service = get_ai_service()
    return service.generate_insight(ctx)


@router.get("/prediction-insight/{city_name}", response_model=AIResponse)
def get_prediction_insight_endpoint(city_name: str, lang: str = "en") -> AIResponse:
    """Forward-looking AI interpretation using atmospheric conditions."""
    from .prediction_intelligence import generate_prediction_insight
    from .ai_models import AIContext
    
    prediction = generate_prediction_insight(city_name, lang)
    
    ctx = AIContext(
        screen_id="screen_5_prediction",
        city=city_name,
        language=lang,
    )
    from .ai_service import TemplateFallbackAIService
    service = TemplateFallbackAIService()
    # Intercept fallback response to insert prediction text
    res = service.generate_insight(ctx)
    res.response_text = prediction["prediction_text"]
    res.context_summary["voice_script"] = prediction["voice_script"]
    return res

