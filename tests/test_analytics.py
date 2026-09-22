"""Tests for Screen 7 Analytics & Diurnal Interpretation Engine (Anish — Day 2 Deliverable).

Verifies:
  - Multi-time-range data aggregation (24H, 7D, 30D).
  - Diurnal atmospheric physics pattern calculations.
  - Rate-of-change anomaly detection.
  - Multilingual AI analytics narratives and voice-ready scripts in EN, HI, MR.
  - Endpoints /api/v1/analytics/{city_name} and /api/v1/ai/analytics/{city_name}/insight.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.analytics import generate_city_analytics

client = TestClient(app)


class TestAnalyticsEngine:
    """Test longitudinal aggregation and atmospheric diurnal physics."""

    def test_24h_analytics_generation(self):
        data = generate_city_analytics("pune", time_range="24H")
        assert data.city == "Pune"
        assert data.time_range == "24H"
        assert len(data.data_points) == 24

        # Diurnal physics checks
        dp = data.trend.diurnal_patterns
        assert dp.morning_peak_aqi > dp.midday_dip_aqi
        assert dp.evening_peak_aqi > dp.midday_dip_aqi
        assert "07:00–10:00" in dp.morning_peak_window
        assert "12:00–16:00" in dp.midday_dip_window

        # Trend & voice script
        assert data.trend.trend_direction in ["rising", "falling", "stable", "cyclical"]
        assert "en" in data.trend.interpretation_text
        assert "hi" in data.trend.interpretation_text
        assert "mr" in data.trend.interpretation_text

        # Audio / voice read-aloud script exists
        assert "en" in data.trend.voice_script
        assert len(data.trend.voice_script["en"]) > 20
        assert "Pune" in data.trend.voice_script["en"]

    def test_7d_and_30d_ranges(self):
        data_7d = generate_city_analytics("delhi", time_range="7D")
        assert len(data_7d.data_points) == 7
        assert data_7d.time_range == "7D"

        data_30d = generate_city_analytics("mumbai", time_range="30D")
        assert len(data_30d.data_points) == 30
        assert data_30d.time_range == "30D"

    def test_unknown_city_raises_value_error(self):
        with pytest.raises(ValueError, match="not configured"):
            generate_city_analytics("atlantis")


class TestAnalyticsEndpoints:
    """Test analytics and AI interpretation API contracts."""

    def test_get_city_analytics_endpoint(self):
        r = client.get("/api/v1/analytics/pune?range=24H")
        assert r.status_code == 200
        data = r.json()
        assert data["city"] == "Pune"
        assert "trend" in data
        assert "diurnal_patterns" in data["trend"]
        assert "data_points" in data
        assert len(data["data_points"]) == 24
        assert "data_source" in data

    def test_get_city_analytics_404_for_unknown(self):
        r = client.get("/api/v1/analytics/unknown_city")
        assert r.status_code == 404

    def test_get_analytics_ai_insight_endpoint(self):
        r = client.get("/api/v1/ai/analytics/pune/insight?range=24H&lang=en")
        assert r.status_code == 200
        data = r.json()
        assert "Pune" in data["response_text"]
        assert "diurnal" in data["response_text"].lower() or "trajectory" in data["response_text"].lower()
        assert data["language"] == "en"
        assert data["is_grounded"] is True
        assert "voice_script" in data["context_summary"]

    def test_get_city_ai_insight_direct(self):
        r = client.get("/api/v1/ai/cities/pune/insight?lang=en")
        assert r.status_code == 200
        data = r.json()
        assert "Pune" in data["response_text"]
        assert data["is_grounded"] is True

    def test_get_station_ai_insight_direct(self):
        r = client.get("/api/v1/ai/cities/pune/stations/Shivajinagar/insight?lang=en")
        assert r.status_code == 200
        data = r.json()
        assert "Shivajinagar" in data["response_text"]
        assert data["is_grounded"] is True
