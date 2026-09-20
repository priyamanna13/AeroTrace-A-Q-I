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
