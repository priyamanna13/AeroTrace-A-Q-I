"""Phase 5 Test Suite: Forward Air Quality Prediction (Screen 5).

Tests:
1. calculate_forward_prediction unit tests:
   - Dispersion decay monotonic decrease.
   - Pasquill stability class parameterization.
   - Expanding uncertainty margin calculation.
   - Downwind advection plume footprint GeoJSON polygon generation.
   - Mandatory 'Estimated forecast - see methodology' label.
2. GET /api/v1/prediction/{station_name}/{pollutant} endpoint integration:
   - Multi-city coverage (Pune, Delhi, Mumbai, Bengaluru).
   - Custom hours horizon (1H, 3H, 6H).
   - Error handling for invalid station and unsupported pollutant.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.prediction import (
    PASQUILL_DECAY_RATES,
    calculate_forward_prediction,
    _build_advected_plume_polygon,
)

client = TestClient(app)

TEST_STATIONS = ["Shivajinagar", "ITO", "Bandra", "Peenya"]


class TestPredictionModel:
    """Unit tests for the forward prediction dispersion calculation."""

    def test_pasquill_decay_rates_monotonicity(self):
        # Class A (unstable) must disperse faster than Class F (stable inversion)
        assert PASQUILL_DECAY_RATES["A"] > PASQUILL_DECAY_RATES["B"]
        assert PASQUILL_DECAY_RATES["B"] > PASQUILL_DECAY_RATES["C"]
        assert PASQUILL_DECAY_RATES["C"] > PASQUILL_DECAY_RATES["D"]
        assert PASQUILL_DECAY_RATES["D"] > PASQUILL_DECAY_RATES["E"]
        assert PASQUILL_DECAY_RATES["E"] > PASQUILL_DECAY_RATES["F"]

    def test_default_horizon_returns_six_frames(self):
        pred = calculate_forward_prediction("Shivajinagar", "pm25", hours=6)
        assert pred["station_name"] == "Shivajinagar"
        assert pred["city"] == "Pune"
        assert pred["target_pollutant"] == "pm25"
        assert len(pred["horizons"]) == 6
        assert pred["label"] == "Estimated forecast - see methodology"
        assert "methodology" in pred

    def test_custom_horizon_returns_requested_frames(self):
        pred = calculate_forward_prediction("ITO", "pm10", hours=3)
        assert len(pred["horizons"]) == 3
        hours_returned = [h["horizon_hours"] for h in pred["horizons"]]
        assert hours_returned == [1, 2, 3]

    def test_prediction_decay_is_monotonic(self):
        pred = calculate_forward_prediction("Bandra", "pm25", hours=6)
        aqi_values = [h["predicted_aqi"] for h in pred["horizons"]]
        for i in range(len(aqi_values) - 1):
            assert aqi_values[i] >= aqi_values[i + 1], f"Decay violated: {aqi_values}"

    def test_confidence_bounds_envelop_predicted_value(self):
        pred = calculate_forward_prediction("Peenya", "pm25", hours=6)
        for h in pred["horizons"]:
            bounds = h["confidence_bounds"]
            pred_aqi = h["predicted_aqi"]
            assert bounds["lower_aqi"] <= pred_aqi <= bounds["upper_aqi"]
            assert bounds["margin_pct"] > 0

    def test_confidence_margin_expands_with_lead_time(self):
        pred = calculate_forward_prediction("Shivajinagar", "pm25", hours=6)
        margins = [h["confidence_bounds"]["margin_pct"] for h in pred["horizons"]]
        for i in range(len(margins) - 1):
            assert margins[i] < margins[i + 1]

    def test_confidence_levels_by_horizon(self):
        pred = calculate_forward_prediction("ITO", "pm25", hours=6)
        assert pred["horizons"][0]["confidence"] == "high"    # 1H
        assert pred["horizons"][1]["confidence"] == "high"    # 2H
        assert pred["horizons"][2]["confidence"] == "medium"  # 3H
        assert pred["horizons"][3]["confidence"] == "medium"  # 4H
        assert pred["horizons"][4]["confidence"] == "low"     # 5H
        assert pred["horizons"][5]["confidence"] == "low"     # 6H

    def test_advected_plume_polygon_validity(self):
        poly = _build_advected_plume_polygon(
            station_lon=77.2464,
            station_lat=28.6318,
            wind_direction_deg=110,
            wind_speed_kmh=14.0,
            lead_time_hours=3.0,
        )
        assert poly["type"] == "Feature"
        geom = poly["geometry"]
        assert geom["type"] == "Polygon"
        ring = geom["coordinates"][0]
        assert len(ring) >= 5
        # Must be a closed ring
        assert ring[0] == ring[-1]


class TestPredictionEndpoint:
    """Integration tests for GET /api/v1/prediction/{station_name}/{pollutant}."""

    @pytest.mark.parametrize("station", TEST_STATIONS)
    def test_prediction_endpoint_all_cities(self, station):
        r = client.get(f"/api/v1/prediction/{station}/pm25?hours=6")
        assert r.status_code == 200, f"Failed for {station}: {r.text}"
        data = r.json()
        assert data["station_name"].lower() == station.lower()
        assert data["target_pollutant"] == "pm25"
        assert len(data["horizons"]) == 6
        assert data["label"] == "Estimated forecast - see methodology"
        assert "weather_context" in data
        assert "pasquill_class" in data["weather_context"]
        assert "decay_rate_k" in data["weather_context"]

    def test_prediction_endpoint_invalid_pollutant_returns_404(self):
        r = client.get("/api/v1/prediction/ITO/krypton")
        assert r.status_code == 404

    def test_prediction_endpoint_unknown_station_returns_404(self):
        r = client.get("/api/v1/prediction/AtlantisStation/pm25")
        assert r.status_code == 404
