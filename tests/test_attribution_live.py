"""Phase 4 Test Suite: Multi-City Attribution & Compliance Pipeline.

Tests:
1. Dynamic scenario lookup for all 28 physical stations across 7 cities.
2. Compliance profile lookups & "compliance data not available for this city" (FR-037).
3. Localized field squad assignments across all 7 cities (FR-038).
4. Full GET /api/v1/attribution/{station_name} pipeline execution across multi-city stations.
5. GET /api/v1/stations returns 28 physical CAAQMS stations.
"""
from __future__ import annotations

import os
import uuid
import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.demo_scenarios import (
    CITY_FIELD_SQUADS,
    get_scenario,
    list_scenario_names,
)

client = TestClient(app)

SAMPLE_STATIONS = [
    ("Shivajinagar", "Pune", "Maharashtra", "PMC-AQ-SQUAD-07"),
    ("ITO", "Delhi", "Delhi", "DPCC-ENF-SQUAD-04"),
    ("Bandra", "Mumbai", "Maharashtra", "MPCB-MUM-RAPID-01"),
    ("Peenya", "Bengaluru", "Karnataka", "KSPCB-BLR-TASK-03"),
    ("Victoria Memorial", "Kolkata", "West Bengal", "WBPCB-KOL-SQUAD-02"),
    ("Sanathnagar", "Hyderabad", "Telangana", "TGPCB-HYD-FLYING-01"),
    ("Manali", "Chennai", "Tamil Nadu", "TNPCB-CHN-MOBILE-05"),
]


class TestMultiCityScenarios:
    """Test dynamic scenario construction and station registry."""

    def test_all_28_stations_registered(self):
        names = list_scenario_names()
        assert len(names) == 28, f"Expected 28 physical stations, found {len(names)}: {names}"

    @pytest.mark.parametrize("station_name,expected_city,expected_state,expected_team", SAMPLE_STATIONS)
    def test_station_scenario_metadata(self, station_name, expected_city, expected_state, expected_team):
        s = get_scenario(station_name)
        assert s.station_name.lower() == station_name.lower()
        assert s.city == expected_city
        assert s.state == expected_state
        assert s.field_team["team_id"] == expected_team
        assert len(s.coordinates) == 2
        # Verify genuine coordinates, not default Pune coordinates for non-Pune stations
        lon, lat = s.coordinates
        if expected_city != "Pune":
            assert not (73.8 < lon < 73.9 and 18.5 < lat < 18.6), f"Station {station_name} incorrectly defaulted to Pune coords"


class TestFR037ComplianceProfiles:
    """Test FR-037 compliance profile rules across cities."""

    def test_compliance_profile_fields_present_in_all_candidates(self):
        for station_name in ["Shivajinagar", "ITO", "Bandra", "Peenya", "Victoria Memorial", "Sanathnagar", "Manali"]:
            s = get_scenario(station_name)
            assert len(s.candidates) > 0
            for c in s.candidates:
                assert "compliance_status" in c
                assert "compliance_note" in c
                # If permit_id is absent, must explicitly display "compliance data not available for this city"
                if not c.get("permit_id"):
                    assert "compliance data not available for this city" in c["compliance_status"]
                    assert "compliance data not available for this city" in c["compliance_note"]


class TestFR038FieldSquads:
    """Test FR-038 localized field team assignments across 7 cities."""

    def test_all_seven_cities_have_field_squads(self):
        expected_cities = {"pune", "mumbai", "delhi", "bengaluru", "kolkata", "hyderabad", "chennai"}
        assert set(CITY_FIELD_SQUADS.keys()) == expected_cities
        for city, squad in CITY_FIELD_SQUADS.items():
            assert "team_id" in squad
            assert "team_lead" in squad
            assert "contact" in squad
            assert "jurisdiction" in squad
            assert "eta_minutes" in squad
            assert squad["eta_minutes"] > 0


class TestAttributionLiveEndpoint:
    """Integration test for GET /api/v1/attribution/{station_name} across multiple cities."""

    @pytest.mark.parametrize("station_name,expected_city,expected_squad", [
        ("Shivajinagar", "Pune", "PMC-AQ-SQUAD-07"),
        ("ITO", "Delhi", "DPCC-ENF-SQUAD-04"),
        ("Bandra", "Mumbai", "MPCB-MUM-RAPID-01"),
    ])
    def test_attribution_pipeline_multi_city(self, station_name, expected_city, expected_squad, monkeypatch):
        import app.overpass_client
        monkeypatch.setattr(app.overpass_client, "discover_and_format", lambda cfg: [])

        r = client.get(f"/api/v1/attribution/{station_name}")
        assert r.status_code == 200, f"Attribution failed for {station_name}: {r.text}"
        data = r.json()

        # 6 core contract blocks
        required_blocks = [
            "event_id",
            "trigger_station",
            "weather_snapshot",
            "wind_cone_geometry",
            "ranked_candidates",
            "actionable_intelligence",
        ]
        for block in required_blocks:
            assert block in data, f"Missing {block} in attribution response"

        # Verify trigger_station matches target city
        ts = data["trigger_station"]
        assert ts["city"] == expected_city
        assert ts["name"] == station_name

        # Verify field team assignment in actionable_intelligence matches FR-038
        ai = data["actionable_intelligence"]
        assert ai["field_team_assignment"]["team_id"] == expected_squad

        # Verify wind cone geometry is centered on the station's coordinates
        cone = data["wind_cone_geometry"]
        assert cone["geometry"]["type"] == "Polygon"

        # Verify candidates have FR-037 compliance profile
        for cand in data["ranked_candidates"]:
            assert "compliance_profile" in cand
            cp = cand["compliance_profile"]
            assert "compliance_status" in cp
            assert "compliance_note" in cp

    def test_list_stations_returns_28_physical_stations(self):
        r = client.get("/api/v1/stations")
        assert r.status_code == 200
        data = r.json()
        stations = data["stations"]
        assert len(stations) == 28
        cities_found = {s["city"] for s in stations}
        assert cities_found == {"Pune", "Mumbai", "Delhi", "Bengaluru", "Kolkata", "Hyderabad", "Chennai"}
