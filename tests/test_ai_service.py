"""Unit tests for AI Service Abstraction & Router (Anish — Day 1 Deliverable)."""
import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.ai_models import AIContext, InformationProvenance, AIChatRequest
from app.ai_service import TemplateFallbackAIService, get_ai_service


@pytest.fixture
def client():
    return TestClient(app)


def test_ai_status_endpoint(client):
    response = client.get("/api/v1/ai/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "en" in data["supported_languages"]
    assert "hi" in data["supported_languages"]
    assert "mr" in data["supported_languages"]
    assert data["grounding_enforced"] is True


def test_city_insight_generation_en(client):
    payload = {
        "context": {
            "screen_id": "screen_2_city",
            "city": "Pune",
            "current_aqi": 182,
            "dominant_pollutant": "PM2.5",
            "data_source": "CPCB Portal",
            "data_timestamp": "2026-09-20T18:30:00+05:30",
            "provenance": "measured_fact",
            "language": "en"
        }
    }
    response = client.post("/api/v1/ai/insight", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Pune" in data["response_text"]
    assert "182" in data["response_text"]
    assert data["language"] == "en"
    assert data["provenance"] == "measured_fact"
    assert "CPCB Portal" in data["confidence_note"]
    assert len(data["suggested_follow_ups"]) > 0


def test_station_insight_generation_hi(client):
    payload = {
        "context": {
            "screen_id": "screen_3_station",
            "city": "Pune",
            "station": "Shivajinagar",
            "current_aqi": 310,
            "dominant_pollutant": "PM10",
            "data_source": "CPCB CAAQMS",
            "provenance": "measured_fact",
            "weather": {
                "wind_speed_kmh": 14.5,
                "wind_direction_cardinal": "WNW"
            },
            "language": "hi"
        }
    }
    response = client.post("/api/v1/ai/insight", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Shivajinagar" in data["response_text"]
    assert "310" in data["response_text"]
    assert data["language"] == "hi"


def test_simulated_provenance_flag(client):
    payload = {
        "context": {
            "screen_id": "screen_2_city",
            "city": "Mumbai",
            "current_aqi": 190,
            "provenance": "simulation",
            "is_simulated": True,
            "data_source": "Emergency Fallback",
            "language": "en"
        }
    }
    response = client.post("/api/v1/ai/insight", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "SIMULATED DATA" in data["confidence_note"]
    assert data["provenance"] == "simulation"


def test_ai_chat_endpoint_grounding(client):
    payload = {
        "message": "What is the primary source causing high pollution here?",
        "context": {
            "screen_id": "screen_4_investigation",
            "city": "Pune",
            "station": "Shivajinagar",
            "current_aqi": 310,
            "dominant_pollutant": "PM10",
            "data_source": "CPCB Portal",
            "attribution": {
                "top_candidate": {
                    "name": "Hinjewadi Construction Cluster",
                    "score_breakdown": {"confidence_score": 0.88}
                }
            },
            "language": "en"
        }
    }
    response = client.post("/api/v1/ai/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Hinjewadi Construction Cluster" in data["response_text"]
    assert "88%" in data["response_text"]
    assert data["is_grounded"] is True


def test_ai_context_from_city_overview(client):
    overview = {
        "city": "Pune",
        "current_aqi": 182.0,
        "dominant_pollutant": "PM2.5",
        "pm25": 78.4,
        "pm10": 156.2,
        "data_source": "CPCB_CAAQMS",
        "data_timestamp": "2026-09-22T18:00:00+05:30",
        "is_simulated": False,
        "is_stale": False,
    }
    ctx = AIContext.from_city_overview(overview, language="en")
    assert ctx.city == "Pune"
    assert ctx.current_aqi == 182.0
    assert ctx.provenance == InformationProvenance.MEASURED_FACT
    assert ctx.pollutants["pm25"] == 78.4

    service = get_ai_service()
    res = service.generate_insight(ctx)
    assert "Pune" in res.response_text
    assert "182" in res.response_text
    assert "CPCB_CAAQMS" in res.response_text or "CPCB_CAAQMS" in res.confidence_note
    assert res.context_summary["voice_script"] is not None


def test_screen_7_analytics_insight_mr(client):
    payload = {
        "context": {
            "screen_id": "screen_7_analytics",
            "city": "Pune",
            "current_aqi": 182,
            "dominant_pollutant": "PM2.5",
            "data_source": "CPCB_CAAQMS",
            "data_timestamp": "2026-09-22T18:00:00+05:30",
            "provenance": "measured_fact",
            "language": "mr",
            "analytics": {
                "trend_direction": "cyclical",
                "morning_peak_aqi": 245,
                "midday_dip_aqi": 136,
                "evening_peak_aqi": 227,
            }
        }
    }
    response = client.post("/api/v1/ai/insight", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Pune" in data["response_text"]
    assert "२४५" in data["response_text"] or "245" in data["response_text"]
    assert data["language"] == "mr"
    assert "voice_script" in data["context_summary"]


def test_copernicus_model_estimate_provenance(client):
    payload = {
        "context": {
            "screen_id": "screen_2_city",
            "city": "Bengaluru",
            "current_aqi": 85,
            "data_source": "Open-Meteo Air Quality (Copernicus CAMS)",
            "data_timestamp": "2026-09-22T18:00:00+05:30",
            "language": "en"
        }
    }
    response = client.post("/api/v1/ai/insight", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["provenance"] == "model_estimate"
    assert "Copernicus CAMS" in data["confidence_note"]
    assert "Measured physical sensor data" not in data["confidence_note"]

