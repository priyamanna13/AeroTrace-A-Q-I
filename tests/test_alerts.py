"""Tests for Contextual Alerts Subsystem (Anish — Day 2 Deliverable).

Verifies:
  - Threshold-based alert levels: Advisory, Warning, Severe Emergency.
  - Actionable health recommendations in EN, HI, MR.
  - Civic and enforcement actionable measures in EN, HI, MR.
  - Preservation of data provenance, timestamps, and simulation indicators.
  - Endpoints /api/v1/alerts and /api/v1/alerts/{city_name}.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.alerts import (
    AlertSeverity,
    ContextualAlert,
    evaluate_reading_alert,
    evaluate_city_alerts,
    evaluate_all_cities_alerts,
)

client = TestClient(app)


class TestAlertThresholds:
    """Test individual threshold rules across NAQI and NAAQS boundaries."""

    def test_good_aqi_returns_no_alert(self):
        """AQI <= 100 with normal pollutants should not trigger an alert."""
        alert = evaluate_reading_alert(
            city="Bengaluru",
            station="BTM Layout",
            aqi=45.0,
            pollutants={"pm25": 15.0, "pm10": 30.0, "no2": 20.0},
            data_source="CPCB_CAAQMS",
            data_timestamp="2026-09-22T12:00:00+05:30",
        )
        assert alert is None

    def test_advisory_threshold_aqi(self):
        """AQI between 101 and 200 must trigger an Advisory alert."""
        alert = evaluate_reading_alert(
            city="Pune",
            station="Shivajinagar",
            aqi=165.0,
            pollutants={"pm25": 55.0, "pm10": 95.0, "no2": 45.0},
            data_source="CPCB_CAAQMS",
            data_timestamp="2026-09-22T12:00:00+05:30",
        )
        assert alert is not None
        assert alert.severity == AlertSeverity.ADVISORY
        assert alert.current_aqi == 165.0
        # Multilingual content checks
        assert "en" in alert.title and "ADVISORY" in alert.title["en"]
        assert "hi" in alert.title and "सलाह" in alert.title["hi"]
        assert "mr" in alert.title and "सल्ला" in alert.title["mr"]
        # Health recommendations
        assert len(alert.health_recommendations["en"]) >= 2
        assert len(alert.health_recommendations["hi"]) >= 2
        assert len(alert.health_recommendations["mr"]) >= 2
        # Civic measures
        assert len(alert.actionable_measures["en"]) >= 2

    def test_warning_threshold_aqi(self):
        """AQI between 201 and 400 must trigger a Warning alert."""
        alert = evaluate_reading_alert(
            city="Delhi",
            station="Anand Vihar",
            aqi=310.0,
            pollutants={"pm25": 130.0, "pm10": 260.0, "no2": 70.0},
            data_source="CPCB_CAAQMS",
            data_timestamp="2026-09-22T12:00:00+05:30",
        )
        assert alert is not None
        assert alert.severity == AlertSeverity.WARNING
        assert "WARNING" in alert.title["en"]
        assert "चेतावनी" in alert.title["hi"]
        assert "चेतावणी" in alert.title["mr"]
        # Must include N95 recommendation
        assert any("N95" in rec for rec in alert.health_recommendations["en"])

    def test_severe_emergency_threshold_aqi(self):
        """AQI > 400 must trigger a Severe Emergency alert."""
        alert = evaluate_reading_alert(
            city="Delhi",
            station="Anand Vihar",
            aqi=445.0,
            pollutants={"pm25": 280.0, "pm10": 460.0, "no2": 95.0},
            data_source="CPCB_CAAQMS",
            data_timestamp="2026-09-22T12:00:00+05:30",
        )
        assert alert is not None
        assert alert.severity == AlertSeverity.SEVERE_EMERGENCY
        assert "EMERGENCY" in alert.title["en"]
        assert "आपातकाल" in alert.title["hi"]
        assert "आणीबाणी" in alert.title["mr"]
        # Must include HEPA filter recommendation
        assert any("HEPA" in rec for rec in alert.health_recommendations["en"])
        # Deep link targets screen_4_investigation
        assert alert.deep_link["screen"] == "screen_4_investigation"

    def test_simulated_alert_provenance(self):
        """Fallback simulated readings must preserve simulation markers in messages."""
        alert = evaluate_reading_alert(
            city="Kolkata",
            station="Victoria",
            aqi=240.0,
            pollutants={"pm25": 110.0, "pm10": 210.0},
            data_source="SIMULATED — live source unreachable",
            data_timestamp="2026-09-22T12:00:00+05:30",
            is_simulated=True,
        )
        assert alert is not None
        assert alert.is_simulated is True
        assert "SIMULATED DATA" in alert.message["en"]
        assert "सिम्युलेटेड डेटा" in alert.message["hi"]

    def test_boundary_conditions_100_200_400(self):
        """Test exact boundary transitions between categories."""
        # AQI 100.0 (Satisfactory boundary) -> None
        a100 = evaluate_reading_alert("Pune", "Station", 100.0, {}, "CPCB", "2026-09-22T12:00:00+05:30")
        assert a100 is None

        # AQI 100.5 (Moderate boundary) -> Advisory
        a100_5 = evaluate_reading_alert("Pune", "Station", 100.5, {}, "CPCB", "2026-09-22T12:00:00+05:30")
        assert a100_5 is not None
        assert a100_5.severity == AlertSeverity.ADVISORY

        # AQI 200.0 (Moderate upper limit) -> Advisory
        a200 = evaluate_reading_alert("Pune", "Station", 200.0, {}, "CPCB", "2026-09-22T12:00:00+05:30")
        assert a200 is not None
        assert a200.severity == AlertSeverity.ADVISORY

        # AQI 200.5 (Poor lower limit) -> Warning
        a200_5 = evaluate_reading_alert("Pune", "Station", 200.5, {}, "CPCB", "2026-09-22T12:00:00+05:30")
        assert a200_5 is not None
        assert a200_5.severity == AlertSeverity.WARNING

        # AQI 400.0 (Very Poor upper limit) -> Warning
        a400 = evaluate_reading_alert("Pune", "Station", 400.0, {}, "CPCB", "2026-09-22T12:00:00+05:30")
        assert a400 is not None
        assert a400.severity == AlertSeverity.WARNING

        # AQI 400.5 (Severe lower limit) -> Severe Emergency
        a400_5 = evaluate_reading_alert("Pune", "Station", 400.5, {}, "CPCB", "2026-09-22T12:00:00+05:30")
        assert a400_5 is not None
        assert a400_5.severity == AlertSeverity.SEVERE_EMERGENCY


class TestAlertEndpoints:
    """Test /api/v1/alerts API contracts."""

    def test_get_all_alerts_endpoint(self):
        r = client.get("/api/v1/alerts")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if len(data) > 0:
            first = data[0]
            assert "alert_id" in first
            assert "severity" in first
            assert first["severity"] in ["Severe Emergency", "Warning", "Advisory"]
            assert "health_recommendations" in first
            assert "actionable_measures" in first
            assert "title" in first
            assert "en" in first["title"]
            assert "hi" in first["title"]
            assert "mr" in first["title"]

    def test_get_city_alerts_pune(self):
        r = client.get("/api/v1/alerts/pune")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for a in data:
            assert a["city"] == "Pune"
            assert "data_source" in a
            assert "data_timestamp" in a

    def test_get_city_alerts_not_found(self):
        r = client.get("/api/v1/alerts/nonexistent_metro")
        assert r.status_code == 404
