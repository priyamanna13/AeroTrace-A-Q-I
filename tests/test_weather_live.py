"""Phase 4 Test Suite: Live Weather Pipeline & Meteorological Contract.

Tests:
1. LiveOpenMeteoSource adapter unit tests (parameters, units, oktas, mixing height, 30s cache).
2. GET /api/v1/weather/{city_name} endpoint tests across all 7 cities.
3. 404 behavior for unknown cities.
4. Data transparency & currency metadata.
"""
from __future__ import annotations

import os
from datetime import datetime
from zoneinfo import ZoneInfo
import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.weather_sources.base import RawWeather, get_weather_source
from app.weather_sources.open_meteo import (
    LiveOpenMeteoSource,
    clear_weather_cache,
)

IST = ZoneInfo("Asia/Kolkata")
client = TestClient(app)

CITIES = ["pune", "mumbai", "delhi", "bengaluru", "kolkata", "hyderabad", "chennai"]


class TestLiveOpenMeteoSource:
    """Unit tests for the LiveOpenMeteoSource adapter."""

    def setup_method(self):
        clear_weather_cache()

    def test_factory_resolves_live_source(self):
        src = get_weather_source("live")
        assert isinstance(src, LiveOpenMeteoSource)
        assert src.name == "live"

    def test_fetch_snapshot_returns_raw_weather(self):
        src = LiveOpenMeteoSource()
        raw = src.fetch_snapshot("pune")
        assert raw is not None
        assert isinstance(raw, RawWeather)
        assert raw.station_name == "pune"
        assert raw.observed_at.tzinfo is not None
        assert isinstance(raw.wind_speed_kmh, float)
        assert 0 <= raw.wind_direction_deg < 360
        assert isinstance(raw.temperature_c, float)
        assert 0 <= raw.relative_humidity_pct <= 100
        assert raw.pressure_hpa > 800.0
        assert 0 <= raw.cloud_cover_oktas <= 8
        assert raw.precipitation_mm_last_1h >= 0.0
        assert raw.visibility_km >= 0.0
        assert raw.mixing_layer_height_m >= 100

    def test_caching_within_30s_ttl(self):
        clear_weather_cache()
        src = LiveOpenMeteoSource()
        w1 = src.fetch_snapshot("delhi")
        w2 = src.fetch_snapshot("delhi")
        assert w1 is w2  # Exact cached object returned within 30s window

    def test_dynamic_mixing_layer_height_bounds(self):
        src = LiveOpenMeteoSource()
        dt_day = datetime(2026, 6, 25, 13, 0, tzinfo=IST)
        dt_night = datetime(2026, 6, 25, 2, 0, tzinfo=IST)
        day_mixing = src._estimate_mixing_height(dt_day, 15.0)
        night_mixing = src._estimate_mixing_height(dt_night, 5.0)
        assert 500 <= day_mixing <= 2200
        assert 200 <= night_mixing <= 800
        assert day_mixing > night_mixing


class TestWeatherEndpoint:
    """Integration tests for GET /api/v1/weather/{city_name}."""

    def test_weather_endpoint_all_seven_cities(self):
        for city in CITIES:
            r = client.get(f"/api/v1/weather/{city}")
            assert r.status_code == 200, f"Failed for {city}: {r.text}"
            data = r.json()
            assert data["city"].lower() == city
            assert len(data["coordinates"]) == 2
            assert "weather_snapshot" in data
            assert "raw_observation" in data
            assert "pasquill_stability" in data
            assert "data_source" in data
            assert "data_timestamp" in data
            assert "data_currency" in data

            snap = data["weather_snapshot"]
            assert "wind_speed_kmh" in snap
            assert "wind_direction_deg" in snap
            assert "wind_direction_cardinal" in snap
            assert "temperature_c" in snap
            assert "relative_humidity_pct" in snap
            assert "atmospheric_stability" in snap
            assert snap["atmospheric_stability"]["pasquill_class"] in ["A", "B", "C", "D", "E", "F"]

    def test_weather_endpoint_unknown_city_returns_404(self):
        r = client.get("/api/v1/weather/atlantis")
        assert r.status_code == 404
        assert "not configured" in r.json()["detail"].lower()

    def test_weather_snapshot_pasquill_classification(self):
        r = client.get("/api/v1/weather/mumbai")
        assert r.status_code == 200
        data = r.json()
        pasquill = data["pasquill_stability"]
        assert "pasquill_class" in pasquill
        assert "label" in pasquill
        assert "description" in pasquill
        assert "dispersion_coefficient" in pasquill
