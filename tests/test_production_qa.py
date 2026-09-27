"""Phase 7 Test Suite: Production QA & Demo Readiness (Adarsh).

Automates formal verification of all Phase 7 acceptance criteria:
  1. Health & Observability (28 physical stations, scaled cache stats, uptime).
  2. Physical Station Integrity (28 CAAQMS stations across 7 cities, 0 model grid points).
  3. Live Meteorological Pipeline (Open-Meteo & Pasquill-Gifford stability A-F across 7 cities).
  4. Atmospheric Attribution & Wind-Cone Plumes (6-block contract & GeoJSON Polygon).
  5. Forward Prediction & Downwind Plumes (Screen 5: 6-hour forecast, mandatory methodology label).
  6. Statutory Intervention Simulator (Screen 6: ERF impact, statutory disclaimer, sensitive receptors).
  7. Simulation & Spike Demo Transparency (Explicit 'simulation: true', 'is_spike: true', 'simulation_params').
  8. Security & Secret Protection (Security headers, masked database credentials).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.config import get_settings

client = TestClient(app)

TARGET_CITIES = ["Pune", "Mumbai", "Delhi", "Bengaluru", "Kolkata", "Hyderabad", "Chennai"]
SAMPLE_STATIONS = ["Shivajinagar", "Bandra", "ITO"]


# --------------------------------------------------------------------------- #
# 1. Health & Observability QA
# --------------------------------------------------------------------------- #
class TestHealthAndObservabilityQA:
    def test_health_status_and_version(self):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] in ("ok", "degraded")
        assert data["version"] == "3.1.0"
        assert data["service"] == "AeroTrace Environmental Intelligence API"
        assert "uptime_seconds" in data
        assert data["uptime_seconds"] >= 0

    def test_total_physical_stations_is_28(self):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["multi_city"]["total_physical_stations"] == 28
        assert data["multi_city"]["configured_count"] == 7
        for c in TARGET_CITIES:
            assert c in data["multi_city"]["cities"]

    def test_scaled_cache_metrics_reported(self):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        cache = data["attribution_cache"]
        assert "entries" in cache
        assert "max_size" in cache
        assert "ttl_seconds" in cache
        assert cache["ttl_seconds"] == 30.0
        assert "hits" in cache
        assert "misses" in cache
        assert "hit_ratio_pct" in cache


# --------------------------------------------------------------------------- #
# 2. Physical Station Integrity QA (FR-014, FR-015)
# --------------------------------------------------------------------------- #
class TestPhysicalStationsIntegrityQA:
    def test_seven_cities_configured(self):
        r = client.get("/api/v1/cities")
        assert r.status_code == 200
        cities = r.json()
        assert len(cities) == 7
        city_names = [c["name"] for c in cities]
        for expected in TARGET_CITIES:
            assert expected in city_names

    def test_all_28_physical_stations_have_valid_metadata(self):
        total_stations = 0
        for city in TARGET_CITIES:
            r = client.get(f"/api/v1/cities/{city}/stations")
            assert r.status_code == 200
            stations = r.json()
            assert len(stations) == 4, f"Expected 4 stations for {city}, got {len(stations)}"
            total_stations += len(stations)

            for st in stations:
                assert st["name"], "Station must have a name"
                assert "coordinates" in st
                lon, lat = st["coordinates"]
                # Must be inside Indian subcontinent mainland bounds
                assert 6.0 <= lat <= 38.0, f"Latitude {lat} out of bounds for {st['name']}"
                assert 68.0 <= lon <= 98.0, f"Longitude {lon} out of bounds for {st['name']}"
                assert "current_aqi" in st
                assert "data_source" in st
                assert "data_timestamp" in st

        assert total_stations == 28

    def test_no_model_grid_points_returned_as_stations(self):
        r = client.get("/api/v1/stations")
        assert r.status_code == 200
        data = r.json()
        stations = data["stations"] if isinstance(data, dict) and "stations" in data else data
        assert len(stations) >= 4
        # Verify no artificial grid point names like "Grid_10_20" or "Model_Point"
        for st in stations:
            name = st["name"] if isinstance(st, dict) else st
            assert not name.lower().startswith("grid_")
            assert not name.lower().startswith("model_")


# --------------------------------------------------------------------------- #
# 3. Live Meteorological Pipeline QA
# --------------------------------------------------------------------------- #
class TestMeteorologyQA:
    @pytest.mark.parametrize("city", TARGET_CITIES)
    def test_all_seven_cities_weather(self, city: str):
        r = client.get(f"/api/v1/weather/{city}")
        assert r.status_code == 200
        data = r.json()
        assert data["city"].lower() == city.lower()
        snap = data["weather_snapshot"]
        assert "wind_speed_kmh" in snap
        assert "wind_direction_deg" in snap
        assert "temperature_c" in snap
        assert "relative_humidity_pct" in snap
        assert "atmospheric_stability" in snap
        pasquill_class = snap["atmospheric_stability"]["pasquill_class"]
        assert pasquill_class in ["A", "B", "C", "D", "E", "F"]


# --------------------------------------------------------------------------- #
# 4. Atmospheric Attribution & Wind Cone QA
# --------------------------------------------------------------------------- #
class TestAttributionQA:
    @pytest.mark.parametrize("station", SAMPLE_STATIONS)
    def test_sample_stations_attribution_contract(self, station: str):
        r = client.get(f"/api/v1/attribution/{station}")
        assert r.status_code == 200
        data = r.json()
        assert "trigger_station" in data
        assert "weather_snapshot" in data
        assert "wind_cone_geometry" in data
        assert "ranked_candidates" in data
        assert "actionable_intelligence" in data
        assert len(data["ranked_candidates"]) > 0

    def test_wind_cone_geometry_geojson_polygon(self):
        r = client.get("/api/v1/attribution/Shivajinagar")
        assert r.status_code == 200
        data = r.json()
        geom = data["wind_cone_geometry"]["geometry"]
        assert geom["type"] == "Polygon"
        assert len(geom["coordinates"][0]) >= 3


# --------------------------------------------------------------------------- #
# 5. Forward Prediction & Downwind Plumes QA (Screen 5)
# --------------------------------------------------------------------------- #
class TestPredictionQA:
    def test_screen_5_forward_forecast(self):
        r = client.get("/api/v1/prediction/Shivajinagar/pm25?hours=6")
        assert r.status_code == 200
        data = r.json()
        assert data["station_name"] == "Shivajinagar"
        assert len(data["horizons"]) == 6
        assert data["label"] == "Estimated forecast - see methodology"
        assert "methodology" in data

        # Check plume polygon
        plume = data["horizons"][0]["affected_zone_geojson"]
        assert plume["type"] == "Feature"
        assert plume["geometry"]["type"] == "Polygon"


# --------------------------------------------------------------------------- #
# 6. Statutory Intervention Simulator QA (Screen 6)
# --------------------------------------------------------------------------- #
class TestInterventionQA:
    def test_screen_6_statutory_intervention(self):
        payload = {
            "station_name": "Shivajinagar",
            "intervention_type": "control_construction_dust",
            "intensity_pct": 60.0,
        }
        r = client.post("/api/v1/intervention/simulate", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["current_aqi"] > 0
        assert data["projected_aqi"] < data["current_aqi"]
        assert data["aqi_delta"] > 0
        assert data["percentage_reduction"] > 0.0
        assert "disclaimer" in data
        assert "methodology_notes" in data
        assert "sensitive_locations" in data


# --------------------------------------------------------------------------- #
# 7. Simulation & Spike Demo Transparency QA
# --------------------------------------------------------------------------- #
class TestSimulationDemoQA:
    def test_spike_injection_carries_mandatory_demo_tags(self):
        r = client.post("/api/v1/simulation/trigger-spike?station_name=Shivajinagar&spike_aqi=335")
        assert r.status_code == 200
        data = r.json()
        assert data.get("simulation") is True
        assert data.get("is_spike") is True
        assert "simulation_params" in data
        assert data["simulation_params"]["requested_aqi"] == 335


# --------------------------------------------------------------------------- #
# 8. Security & Secret Protection QA
# --------------------------------------------------------------------------- #
class TestSecurityQA:
    def test_security_headers_present(self):
        r = client.get("/health")
        assert r.headers.get("x-content-type-options") == "nosniff"
        assert r.headers.get("x-frame-options") == "DENY"

    def test_database_credentials_masked(self):
        settings = get_settings()
        sanitized = settings.sanitized_database_url
        assert "super_secret" not in sanitized
