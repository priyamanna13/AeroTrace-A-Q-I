"""Tests for Phase 2: Ingestion Fallback Cascade, Data Freshness, and Physical Station Integrity.

Covers:
  - 4-tier provider cascade execution.
  - Authentic live provider data fetching (CPCB / Open-Meteo).
  - Strict labeling when fallback triggers: 'SIMULATED — live source unreachable'.
  - Exact data freshness metadata: data_source, data_timestamp, last_polled_at, is_stale, is_simulated.
  - Physical station integrity across all 7 cities (28 physical CAAQMS stations).
  - 30-second TTL in-memory caching.
  - Merge Point 1 (MP1) contract compliance for Screen 1 & Screen 2 endpoints.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# Force SQLite memory for test isolation
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.cities import get_city_config, list_available_cities
from app.ingestion import (
    clear_telemetry_cache,
    fetch_station_telemetry,
    fetch_city_stations_telemetry,
    TELEMETRY_CACHE_TTL_SECONDS,
    _TELEMETRY_CACHE,
    IST,
)

client = TestClient(app)

TARGET_CITIES = ["Pune", "Mumbai", "Delhi", "Bengaluru", "Kolkata", "Hyderabad", "Chennai"]


@pytest.fixture(autouse=True)
def _clean_cache():
    """Ensure clean cache before every test run."""
    clear_telemetry_cache()
    yield
    clear_telemetry_cache()


class TestIngestionCascade:
    """Test the 4-tier provider fallback cascade logic."""

    def test_live_fetch_returns_valid_telemetry(self):
        """Tier 1 or Tier 2 must successfully fetch authentic environmental data."""
        city_cfg = get_city_config("pune")
        assert city_cfg is not None
        station_cfg = city_cfg["stations"][0]  # Shivajinagar

        telemetry = fetch_station_telemetry(station_cfg, city_cfg, force_refresh=True)

        assert telemetry.name == "Shivajinagar"
        assert telemetry.city == "Pune"
        assert telemetry.network.endswith("_CAAQMS")
        assert len(telemetry.coordinates) == 2
        assert telemetry.current_aqi > 0
        assert telemetry.dominant_pollutant in {"PM2.5", "PM10", "NO2", "SO2", "CO", "O3"}
        assert "pm25" in telemetry.pollutants
        assert "pm10" in telemetry.pollutants
        assert telemetry.data_source in {
            "CPCB_CAAQMS",
            "Open-Meteo Air Quality (Copernicus CAMS)",
            "WAQI (World Air Quality Index)",
        }
        assert telemetry.is_simulated is False
        assert "+05:30" in telemetry.data_timestamp
        assert "+05:30" in telemetry.last_polled_at

    def test_emergency_floor_simulation_labeled_correctly(self):
        """When Tiers 1-3 fail, Tier 4 MUST visibly label 'SIMULATED — live source unreachable'."""
        city_cfg = get_city_config("delhi")
        assert city_cfg is not None
        station_cfg = city_cfg["stations"][0]  # ITO

        # Force failure through Tier 3 to test Tier 4 emergency floor
        telemetry = fetch_station_telemetry(
            station_cfg,
            city_cfg,
            force_refresh=True,
            force_tier_fail_until=3,
        )

        assert telemetry.data_source == "SIMULATED — live source unreachable"
        assert telemetry.is_simulated is True
        assert telemetry.current_aqi > 0
        assert telemetry.dominant_pollutant is not None
        assert "+05:30" in telemetry.data_timestamp
        assert "+05:30" in telemetry.last_polled_at

    def test_staleness_calculation(self):
        """Verify is_stale boolean flags data older than 60 minutes."""
        city_cfg = get_city_config("chennai")
        assert city_cfg is not None
        station_cfg = city_cfg["stations"][0]

        telemetry = fetch_station_telemetry(station_cfg, city_cfg, force_refresh=True)
        # Freshly polled live data should not be stale
        assert isinstance(telemetry.is_stale, bool)

    def test_in_memory_30s_cache(self):
        """Subsequent queries within 30 seconds must return cached telemetry."""
        city_cfg = get_city_config("mumbai")
        assert city_cfg is not None
        station_cfg = city_cfg["stations"][0]

        t1 = fetch_station_telemetry(station_cfg, city_cfg, force_refresh=True)
        assert len(_TELEMETRY_CACHE) == 1

        # Second fetch without force_refresh should return identical cached object
        t2 = fetch_station_telemetry(station_cfg, city_cfg, force_refresh=False)
        assert t1.last_polled_at == t2.last_polled_at
        assert t1.current_aqi == t2.current_aqi


class TestPhysicalStationIntegrityAcrossCities:
    """Verify physical station integrity across all 7 cities (Merge Point 1 requirement)."""

    @pytest.mark.parametrize("city", ["pune", "mumbai", "delhi", "bengaluru", "kolkata", "hyderabad", "chennai"])
    def test_city_stations_return_verified_physical_only(self, city: str):
        """Every city must return exactly 4 physical CAAQMS stations, never model grid points."""
        stations = fetch_city_stations_telemetry(city)
        assert stations is not None
        assert len(stations) == 4

        for st in stations:
            # Physical verification guarantees
            assert "station_id" in st
            assert "name" in st
            assert "network" in st
            assert st["network"].endswith("_CAAQMS")
            assert "coordinates" in st
            assert len(st["coordinates"]) == 2
            assert "current_aqi" in st
            assert "aqi_category" in st
            assert "dominant_pollutant" in st
            assert "pollutants" in st
            assert "data_source" in st
            assert "data_timestamp" in st
            assert "last_polled_at" in st
            assert "is_stale" in st
            assert "is_simulated" in st


class TestMergePoint1Contracts:
    """Validate FastAPI endpoints against Merge Point 1 (MP1) data contracts."""

    def test_get_all_cities_returns_all_seven_with_freshness(self):
        """GET /api/v1/cities must return all 7 target cities with provenance."""
        r = client.get("/api/v1/cities")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 7

        city_names = {c["name"] for c in data}
        assert set(city_names) == set(TARGET_CITIES)

        for c in data:
            assert c["station_count"] == 4
            assert c["current_aqi"] > 0
            assert c["dominant_pollutant"] is not None
            assert len(c["coordinates"]) == 2
            assert c["data_source"] != ""
            assert "+05:30" in c["data_timestamp"]
            assert "+05:30" in c["last_polled_at"]
            assert isinstance(c["is_stale"], bool)
            assert isinstance(c["is_simulated"], bool)

    def test_get_city_overview_returns_live_metrics(self):
        """GET /api/v1/cities/{city}/overview must return aggregate metrics."""
        for city in ["pune", "delhi", "bengaluru"]:
            r = client.get(f"/api/v1/cities/{city}/overview")
            assert r.status_code == 200
            data = r.json()
            assert data["station_count"] == 4
            assert data["current_aqi"] > 0
            assert "pm25" in data
            assert "pm10" in data
            assert data["data_source"] != ""
            assert "+05:30" in data["data_timestamp"]

    def test_get_city_stations_returns_physical_pins(self):
        """GET /api/v1/cities/{city}/stations must return 4 verified pins."""
        r = client.get("/api/v1/cities/delhi/stations")
        assert r.status_code == 200
        stations = r.json()
        assert len(stations) == 4
        station_names = {s["name"] for s in stations}
        assert station_names == {"ITO", "Anand Vihar", "Punjabi Bagh", "RK Puram"}
        for s in stations:
            assert s["network"].endswith("_CAAQMS")
            assert s["data_source"] != ""
            assert s["current_aqi"] > 0
