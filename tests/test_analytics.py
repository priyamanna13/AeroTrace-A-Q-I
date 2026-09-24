"""Tests for Phase 3: Historical Analytics & Multi-City Revalidation Subsystem.

Covers:
  - GET /api/v1/analytics contract compliance for 24H, 7D, and 30D horizons.
  - Strict enforcement of the non-fabrication rule for unavailable ranges (1Y).
  - Multi-city and station-specific filtering.
  - Anomaly detection and statistical trend summaries.
  - MultiCityPoller single-cycle execution across all 7 target cities.
"""
from __future__ import annotations

import os

# Force SQLite in-memory for test isolation
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient

from app.analytics import clear_analytics_cache, fetch_historical_analytics
from app.api import app
from app.cpcb_poller import run_single_poll_cycle

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_cache():
    """Ensure clean analytics cache before and after each test."""
    clear_analytics_cache()
    yield
    clear_analytics_cache()


class TestAnalyticsEndpoint:
    """Test the GET /api/v1/analytics API endpoint."""

    def test_analytics_24h_city_aggregate(self):
        """24H query must return 24 authentic hourly data points and trend summary."""
        r = client.get("/api/v1/analytics?city=Pune&range=24h")
        assert r.status_code == 200
        data = r.json()

        assert data["city"] == "Pune"
        assert data["station"] == "All Stations (City Aggregate)"
        assert data["range"] == "24h"
        assert len(data["data_points"]) == 24

        summary = data["trend_summary"]
        assert summary is not None
        assert "min_aqi" in summary
        assert "max_aqi" in summary
        assert "avg_aqi" in summary
        assert "change_pct" in summary
        assert summary["direction"] in {"improving", "deteriorating", "stable"}
        assert summary["total_data_points"] == 24

        first_pt = data["data_points"][0]
        assert "timestamp" in first_pt
        assert "aqi" in first_pt
        assert "sub_pollutants" in first_pt
        assert "pm25" in first_pt["sub_pollutants"]
        assert "is_anomaly" in first_pt

    def test_analytics_7d_specific_station(self):
        """7D query for a verified station must return 168 hourly points."""
        r = client.get("/api/v1/analytics?city=Delhi&station=ITO&pollutant=pm10&range=7d")
        assert r.status_code == 200
        data = r.json()

        assert data["city"] == "Delhi"
        assert data["station"] == "ITO"
        assert data["pollutant"] == "pm10"
        assert len(data["data_points"]) == 168
        assert data["trend_summary"]["total_data_points"] == 168

    def test_analytics_30d_coverage(self):
        """30D query must return 720 hourly points."""
        r = client.get("/api/v1/analytics?city=Mumbai&range=30d")
        assert r.status_code == 200
        data = r.json()

        assert data["range"] == "30d"
        assert len(data["data_points"]) == 720
        assert data["trend_summary"]["total_data_points"] == 720

    def test_analytics_unsupported_range_non_fabrication(self):
        """SRS NFR-073 & FR-078: System SHALL NOT fabricate synthetic data for unsupported 1Y range."""
        r = client.get("/api/v1/analytics?city=Bengaluru&range=1y")
        assert r.status_code == 200
        data = r.json()

        assert data["range"] == "1y"
        assert data["data_points"] == []
        assert data["trend_summary"] is None
        assert "not available" in data["data_availability_note"].lower()

    def test_analytics_invalid_city_returns_404(self):
        """Non-configured city must return 404 with error detail."""
        r = client.get("/api/v1/analytics?city=Atlantis&range=24h")
        assert r.status_code == 404
        assert "Atlantis" in r.json()["detail"]

    def test_analytics_invalid_station_returns_404(self):
        """Invalid station name for a city must return 404."""
        r = client.get("/api/v1/analytics?city=Delhi&station=InvalidStation&range=24h")
        assert r.status_code == 404
        assert "InvalidStation" in r.json()["detail"]

    def test_analytics_pollutant_selection(self):
        """Target pollutant value must be extracted properly."""
        r = client.get("/api/v1/analytics?city=Kolkata&pollutant=no2&range=24h")
        assert r.status_code == 200
        data = r.json()
        assert data["pollutant"] == "no2"
        first_pt = data["data_points"][0]
        assert first_pt["pollutant_value"] == first_pt["sub_pollutants"]["no2"]


class TestMultiCityPollerExecution:
    """Verify background poller execution across all 7 cities."""

    def test_single_poll_cycle_covers_all_seven_cities(self):
        """run_single_poll_cycle must poll exactly 7 cities and 28 stations."""
        summary = run_single_poll_cycle()
        assert summary["cities_polled"] == 7
        assert summary["total_stations"] == 28
        assert "Pune" in summary["city_results"]
        assert "Delhi" in summary["city_results"]
        assert "Mumbai" in summary["city_results"]
        assert "Bengaluru" in summary["city_results"]
        assert "Kolkata" in summary["city_results"]
        assert "Hyderabad" in summary["city_results"]
        assert "Chennai" in summary["city_results"]
        for city, count in summary["city_results"].items():
            assert count == 4
