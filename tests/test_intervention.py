"""Phase 5 Test Suite: Intervention Simulator & Impact Model (Screen 6).

Tests:
1. simulate_intervention unit tests:
   - Emission Reduction Factor (ERF) calculations across statutory policies.
   - Intensity scaling (0%, 25%, 50%, 100%).
   - Pollutant sensitivity weighting factors.
   - Sensitive receptor mapping (schools, hospitals) without fabrication.
   - Explicit disclaimer and methodology notes.
2. POST /api/v1/intervention/simulate endpoint integration:
   - Multi-city coverage (Delhi, Mumbai, Bengaluru, Pune).
   - Validation for unknown intervention types and unknown stations.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.intervention import (
    INTERVENTION_CONFIGS,
    simulate_intervention,
    _normalize_intervention_type,
)

client = TestClient(app)


class TestInterventionModel:
    """Unit tests for the intervention simulation computational engine."""

    def test_intervention_configs_contain_all_three_statutory_types(self):
        expected_types = {"control_construction_dust", "reduce_traffic", "reduce_industrial_emissions"}
        assert set(INTERVENTION_CONFIGS.keys()) == expected_types
        for key, cfg in INTERVENTION_CONFIGS.items():
            assert cfg["max_erf"] > 0
            assert "label" in cfg
            assert "primary_pollutant" in cfg
            assert "pollutant_weights" in cfg

    def test_alias_normalization(self):
        assert _normalize_intervention_type("Reduce traffic") == "reduce_traffic"
        assert _normalize_intervention_type("traffic") == "reduce_traffic"
        assert _normalize_intervention_type("Control construction dust") == "control_construction_dust"
        assert _normalize_intervention_type("dust") == "control_construction_dust"
        assert _normalize_intervention_type("Reduce industrial emissions") == "reduce_industrial_emissions"
        assert _normalize_intervention_type("industrial") == "reduce_industrial_emissions"

    def test_intensity_scaling_monotonically_increases_reduction(self):
        r25 = simulate_intervention("Delhi", "ITO", "control_construction_dust", intensity_pct=25.0)
        r50 = simulate_intervention("Delhi", "ITO", "control_construction_dust", intensity_pct=50.0)
        r100 = simulate_intervention("Delhi", "ITO", "control_construction_dust", intensity_pct=100.0)

        assert r25["aqi_delta"] < r50["aqi_delta"] < r100["aqi_delta"]
        assert r25["projected_aqi"] > r50["projected_aqi"] > r100["projected_aqi"]
        assert r25["percentage_reduction"] < r50["percentage_reduction"] < r100["percentage_reduction"]

    def test_zero_intensity_produces_zero_reduction(self):
        res = simulate_intervention("Mumbai", "Bandra", "reduce_traffic", intensity_pct=0.0)
        assert res["aqi_delta"] == 0
        assert res["percentage_reduction"] == 0.0
        assert res["projected_aqi"] == res["current_aqi"]

    def test_intensity_clamping_bounds(self):
        # Negative clamped to 0
        res_neg = simulate_intervention("Pune", "Shivajinagar", "reduce_traffic", intensity_pct=-20.0)
        assert res_neg["intensity_pct"] == 0.0
        # Over 100 clamped to 100
        res_over = simulate_intervention("Pune", "Shivajinagar", "reduce_traffic", intensity_pct=150.0)
        assert res_over["intensity_pct"] == 100.0

    def test_sensitive_locations_extracted_from_candidates(self):
        # Shivajinagar scenario has candidate Vibgyor High School and Aditya Birla Hospital
        res = simulate_intervention("Pune", "Shivajinagar", "control_construction_dust")
        assert len(res["sensitive_locations"]) > 0
        names = [loc["name"] for loc in res["sensitive_locations"]]
        assert any("School" in n or "Hospital" in n for n in names)
        for loc in res["sensitive_locations"]:
            assert loc["type"] in ["school", "hospital", "residential"]
            assert loc["distance_m"] > 0
            assert loc["status"] == "exposure_mitigated_by_intervention"

    def test_non_fabrication_sensitive_locations_note(self):
        # Verify that if no sensitive locations are present, explicit note is provided
        res = simulate_intervention("Pune", "Shivajinagar", "reduce_traffic")
        if not res["sensitive_locations"]:
            assert res["sensitive_locations_note"] == "sensitive location data not available for this city"
        else:
            assert res["sensitive_locations_note"] is None

    def test_mandatory_disclaimer_and_methodology(self):
        res = simulate_intervention("Bengaluru", "Peenya", "reduce_industrial_emissions")
        assert "disclaimer" in res
        assert "methodology_notes" in res
        assert "Emission Reduction Factor" in res["methodology_notes"]
        assert "model estimates" in res["disclaimer"]


class TestInterventionEndpoint:
    """Integration tests for POST /api/v1/intervention/simulate."""

    @pytest.mark.parametrize("station,intervention", [
        ("ITO", "control_construction_dust"),
        ("Bandra", "reduce_traffic"),
        ("Peenya", "reduce_industrial_emissions"),
        ("Shivajinagar", "control_construction_dust"),
    ])
    def test_simulate_endpoint_success(self, station, intervention):
        payload = {
            "station_name": station,
            "intervention_type": intervention,
            "intensity_pct": 50.0,
        }
        r = client.post("/api/v1/intervention/simulate", json=payload)
        assert r.status_code == 200, f"Failed for {station}: {r.text}"
        data = r.json()
        assert data["station_name"] == station
        assert data["intervention_type"] == intervention
        assert data["current_aqi"] > 0
        assert data["projected_aqi"] < data["current_aqi"]
        assert data["aqi_delta"] > 0
        assert data["percentage_reduction"] > 0.0
        assert "affected_zone_summary" in data
        assert "exposure_period" in data["affected_zone_summary"]

    def test_simulate_endpoint_invalid_type_returns_400(self):
        payload = {
            "station_name": "ITO",
            "intervention_type": "illegal_magic_filter",
            "intensity_pct": 50.0,
        }
        r = client.post("/api/v1/intervention/simulate", json=payload)
        assert r.status_code == 400

    def test_simulate_endpoint_unknown_station_returns_400(self):
        payload = {
            "station_name": "AtlantisCentral",
            "intervention_type": "reduce_traffic",
            "intensity_pct": 50.0,
        }
        r = client.post("/api/v1/intervention/simulate", json=payload)
        assert r.status_code == 400
