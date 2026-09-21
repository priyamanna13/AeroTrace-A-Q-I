"""Tests for the FastAPI API endpoints (Prompt 2D).

Uses ``fastapi.testclient.TestClient`` which requires ``httpx``.
"""
from __future__ import annotations

import os
import uuid

# Force SQLite BEFORE any app module imports.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient

from app.api import app

client = TestClient(app)


# --------------------------------------------------------------------------- #
# Health
# --------------------------------------------------------------------------- #
class TestHealth:
    def test_health_returns_200(self):
        r = client.get("/health")
        assert r.status_code == 200

    def test_health_has_status_ok(self):
        r = client.get("/health")
        data = r.json()
        assert data["status"] == "ok"

    def test_health_has_version(self):
        r = client.get("/health")
        data = r.json()
        assert "version" in data


# --------------------------------------------------------------------------- #
# Attribution endpoint
# --------------------------------------------------------------------------- #
class TestAttribution:
    def test_attribution_returns_200(self):
        r = client.get("/api/v1/attribution/Shivajinagar")
        assert r.status_code == 200

    def test_attribution_has_all_six_top_level_keys(self):
        r = client.get("/api/v1/attribution/Shivajinagar")
        data = r.json()
        expected = {
            "event_id",
            "trigger_station",
            "weather_snapshot",
            "wind_cone_geometry",
            "ranked_candidates",
            "actionable_intelligence",
        }
        assert expected <= set(data.keys()), (
            f"Missing keys: {expected - set(data.keys())}"
        )

    def test_event_id_is_valid_uuid(self):
        r = client.get("/api/v1/attribution/Shivajinagar")
        data = r.json()
        # Should not raise.
        parsed = uuid.UUID(data["event_id"])
        assert str(parsed) == data["event_id"]

    def test_trigger_station_aqi_is_integer(self):
        r = client.get("/api/v1/attribution/Shivajinagar")
        data = r.json()
        aqi = data["trigger_station"]["reading"]["total_aqi"]
        assert isinstance(aqi, int)

    def test_ranked_candidates_is_nonempty_list(self):
        r = client.get("/api/v1/attribution/Shivajinagar")
        data = r.json()
        rc = data["ranked_candidates"]
        assert isinstance(rc, list)
        assert len(rc) > 0

    def test_ranked_candidates_sorted_by_confidence(self):
        r = client.get("/api/v1/attribution/Shivajinagar")
        data = r.json()
        rc = data["ranked_candidates"]
        scores = [c["score_breakdown"]["confidence_score"] for c in rc]
        assert scores == sorted(scores, reverse=True), (
            f"Candidates not sorted descending by confidence: {scores}"
        )

    def test_wind_cone_geometry_is_polygon(self):
        r = client.get("/api/v1/attribution/Shivajinagar")
        data = r.json()
        assert data["wind_cone_geometry"]["geometry"]["type"] == "Polygon"


# --------------------------------------------------------------------------- #
# Stations
# --------------------------------------------------------------------------- #
class TestStations:
    def test_list_stations_returns_200(self):
        r = client.get("/api/v1/stations")
        assert r.status_code == 200

    def test_stations_has_entries(self):
        r = client.get("/api/v1/stations")
        data = r.json()
        assert len(data["stations"]) > 0


# --------------------------------------------------------------------------- #
# Multi-City Endpoints (Phase 1 Contracts)
# --------------------------------------------------------------------------- #
class TestCities:
    def test_list_cities_returns_200(self):
        r = client.get("/api/v1/cities")
        assert r.status_code == 200
        cities = r.json()
        assert len(cities) == 7
        city_names = {c["name"] for c in cities}
        assert "Pune" in city_names
        assert "Delhi" in city_names
        for c in cities:
            assert "current_aqi" in c
            assert "aqi_category" in c
            assert "station_count" in c
            assert "data_source" in c
            assert "data_timestamp" in c
            assert "is_stale" in c

    def test_city_overview_returns_200(self):
        r = client.get("/api/v1/cities/pune/overview")
        assert r.status_code == 200
        data = r.json()
        assert data["city"] == "Pune"
        assert data["station_count"] == 4
        assert "current_aqi" in data
        assert "pm25" in data
        assert "pm10" in data
        assert "data_source" in data

    def test_city_stations_returns_verified_physical_only(self):
        for city in ["pune", "mumbai", "delhi", "bengaluru", "kolkata", "hyderabad", "chennai"]:
            r = client.get(f"/api/v1/cities/{city}/stations")
            assert r.status_code == 200
            stations = r.json()
            assert len(stations) == 4
            for s in stations:
                assert "station_id" in s
                assert "name" in s
                assert "network" in s
                assert s["network"].endswith("_CAAQMS")
                assert "coordinates" in s
                assert len(s["coordinates"]) == 2
                assert "pollutants" in s

    def test_city_overview_not_found(self):
        r = client.get("/api/v1/cities/atlantis/overview")
        assert r.status_code == 404

