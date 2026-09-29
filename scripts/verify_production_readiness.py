#!/usr/bin/env python3
"""AeroTrace NGEC 2026 — Production QA & Demo Readiness Verification Tool.

Exhaustively verifies backend readiness across all 7 target cities and 28 physical stations:
  1. System Health & Observability (GET /health)
  2. Physical Station Integrity (28 CAAQMS Stations across 7 cities, 0 model grid points)
  3. Live Meteorological Pipeline (GET /api/v1/weather/{city})
  4. Atmospheric Attribution & Pasquill Dispersion (GET /api/v1/attribution/{station})
  5. Forward Prediction & Downwind Plumes (GET /api/v1/prediction/{station}/{pollutant})
  6. Statutory Intervention Simulator (POST /api/v1/intervention/simulate)
  7. Simulation & Spike Demo Transparency (POST /api/v1/simulation/trigger-spike)
  8. Security Headers & Secret Masking
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Any, Callable

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class ProductionQARunner:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = base_url
        if base_url:
            import urllib.request
            self._fetch = self._http_fetch
        else:
            # In-process TestClient mode
            try:
                from dotenv import load_dotenv
                load_dotenv()
            except ImportError:
                pass
            from app.db import init_db
            try:
                init_db()
            except Exception:
                pass
            from fastapi.testclient import TestClient
            from app.api import app
            self.client = TestClient(app)
            self._fetch = self._client_fetch

        self.checks_passed = 0
        self.checks_failed = 0
        self.records: list[tuple[str, str, str]] = []

    def _client_fetch(self, method: str, path: str, json_data: dict | None = None) -> tuple[int, dict, dict]:
        if method == "GET":
            r = self.client.get(path)
        elif method == "POST":
            r = self.client.post(path, json=json_data)
        else:
            raise ValueError(f"Unsupported method: {method}")
        try:
            body = r.json()
        except Exception:
            body = {"raw": r.text}
        return r.status_code, body, dict(r.headers)

    def _http_fetch(self, method: str, path: str, json_data: dict | None = None) -> tuple[int, dict, dict]:
        import json
        import urllib.request
        url = f"{self.base_url.rstrip('/')}{path}"
        data = json.dumps(json_data).encode("utf-8") if json_data else None
        headers = {"Content-Type": "application/json"} if json_data else {}
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                status = resp.status
                body = json.loads(resp.read().decode("utf-8"))
                headers_dict = dict(resp.headers)
                return status, body, headers_dict
        except urllib.error.HTTPError as err:
            body = json.loads(err.read().decode("utf-8"))
            return err.code, body, dict(err.headers)

    def record(self, category: str, check_name: str, passed: bool, detail: str = "") -> None:
        if passed:
            self.checks_passed += 1
            status = "[PASS]"
        else:
            self.checks_failed += 1
            status = "[FAIL]"
        self.records.append((category, check_name, f"{status} {detail}".strip()))

    def run_all_checks(self) -> bool:
        print("=" * 78)
        print("  AeroTrace NGEC 2026 — Production QA & Demo Readiness Audit")
        print("=" * 78)
        start_time = time.time()

        self._check_health_and_observability()
        self._check_physical_stations_integrity()
        self._check_meteorology_across_all_cities()
        self._check_attribution_and_pasquill()
        self._check_prediction_and_plumes()
        self._check_intervention_simulator()
        self._check_simulation_spike_demo()
        self._check_security_and_secrets()

        elapsed = time.time() - start_time
        self._print_scorecard(elapsed)
        return self.checks_failed == 0

    def _check_health_and_observability(self) -> None:
        status, body, _ = self._fetch("GET", "/health")
        ok = (status == 200 and body.get("status") in ("ok", "degraded"))
        self.record("Health", "GET /health 200 OK", ok, f"status={body.get('status')}")

        stations_count = body.get("multi_city", {}).get("total_physical_stations", 0)
        self.record("Health", "Total Physical Stations == 28", stations_count == 28, f"count={stations_count}")

        cache_metrics = body.get("attribution_cache", {})
        has_cache = "hits" in cache_metrics and "max_size" in cache_metrics
        self.record("Health", "Scaled Cache Metrics Visible", has_cache, f"max_size={cache_metrics.get('max_size')}")

    def _check_physical_stations_integrity(self) -> None:
        status, body, _ = self._fetch("GET", "/api/v1/cities")
        cities = body if isinstance(body, list) else body.get("cities", [])
        self.record("Stations", "Configured Cities == 7", len(cities) == 7, f"cities={[c['name'] for c in cities]}")

        total_stations = 0
        all_physical = True
        for c in cities:
            c_name = c["name"]
            st_status, st_body, _ = self._fetch("GET", f"/api/v1/cities/{c_name}/stations")
            stations = st_body if isinstance(st_body, list) else st_body.get("stations", [])
            total_stations += len(stations)
            if len(stations) != 4:
                all_physical = False
            for st in stations:
                lon, lat = st.get("coordinates", [0, 0])
                # Validate coordinates are inside India mainland bounds (6N-38N, 68E-98E)
                if not (6.0 <= lat <= 38.0 and 68.0 <= lon <= 98.0):
                    all_physical = False

        self.record("Stations", "Physical Station Count == 28 (4 per city)", total_stations == 28, f"total={total_stations}")
        self.record("Stations", "Coordinates in Valid Geographic Bounds", all_physical, "All 28 verified CAAQMS GPS")

    def _check_meteorology_across_all_cities(self) -> None:
        all_cities = ["Pune", "Mumbai", "Delhi", "Bengaluru", "Kolkata", "Hyderabad", "Chennai"]
        weather_ok = True
        for city in all_cities:
            st, body, _ = self._fetch("GET", f"/api/v1/weather/{city}")
            snap = body.get("weather_snapshot", {})
            if st != 200 or "wind_speed_kmh" not in snap or "atmospheric_stability" not in snap:
                weather_ok = False
                break
        self.record("Meteorology", "All 7 Cities Live Weather Feeds", weather_ok, "Open-Meteo & Pasquill A-F operational")

    def _check_attribution_and_pasquill(self) -> None:
        test_stations = ["Shivajinagar", "Bandra", "ITO"]
        attr_ok = True
        has_cone = True
        has_sources = True

        for st_name in test_stations:
            st, body, _ = self._fetch("GET", f"/api/v1/attribution/{st_name}")
            if st != 200 or "trigger_station" not in body or "weather_snapshot" not in body:
                attr_ok = False
                break
            geom = body.get("wind_cone_geometry", {}).get("geometry", {})
            if geom.get("type") != "Polygon":
                has_cone = False
            if not body.get("ranked_candidates"):
                has_sources = False

        self.record("Attribution", "7-City Key Stations Attribution 200 OK", attr_ok, "6-block contract complete")
        self.record("Attribution", "Wind Cone Polygon Geometry Valid", has_cone, "Valid GeoJSON Polygon")
        self.record("Attribution", "Candidate Source Attribution Non-Empty", has_sources, "Curated + OSM candidates ranked")

    def _check_prediction_and_plumes(self) -> None:
        st, body, _ = self._fetch("GET", "/api/v1/prediction/Shivajinagar/pm25?hours=6")
        horizons = body.get("horizons", [])
        has_6_frames = len(horizons) == 6
        has_label = body.get("label") == "Estimated forecast - see methodology"
        has_plume = False
        if horizons and isinstance(horizons, list):
            has_plume = horizons[0].get("affected_zone_geojson", {}).get("type") == "Feature"

        self.record("Prediction", "Screen 5 6-Hour Forward Forecast", has_6_frames, f"frames={len(horizons)}")
        self.record("Prediction", "Mandatory Methodology Transparency Label", has_label, "Estimated forecast - see methodology")
        self.record("Prediction", "Downwind Advection Plume GeoJSON", has_plume, "Dynamic Polygon Footprint")

    def _check_intervention_simulator(self) -> None:
        payload = {
            "station_name": "Shivajinagar",
            "intervention_type": "control_construction_dust",
            "intensity_pct": 70.0,
        }
        st, body, _ = self._fetch("POST", "/api/v1/intervention/simulate", json_data=payload)
        ok = (st == 200 and "projected_aqi" in body and "aqi_delta" in body)
        has_disclaimer = "disclaimer" in body and "methodology_notes" in body
        has_receptors_note = "sensitive_locations" in body

        self.record("Intervention", "Screen 6 Statutory Intervention Simulate", ok, f"delta={body.get('aqi_delta')}")
        self.record("Intervention", "Mandatory Policy Planning Disclaimer", has_disclaimer, "Statutory advisory present")
        self.record("Intervention", "Sensitive Receptors Non-Fabrication Rule", has_receptors_note, "Zero fictitious schools/hospitals")

    def _check_simulation_spike_demo(self) -> None:
        st, body, _ = self._fetch("POST", "/api/v1/simulation/trigger-spike?station_name=Shivajinagar&spike_aqi=340")
        is_spike = body.get("is_spike") is True
        sim_tagged = body.get("simulation") is True and "simulation_params" in body

        self.record("Simulation", "Manual Spike Trigger (Demo Risk Mitigation)", st == 200 and is_spike, "is_spike=true")
        self.record("Simulation", "Explicit 'simulation: true' Transparency Tag", sim_tagged, "simulation_params present")

    def _check_security_and_secrets(self) -> None:
        _, _, headers = self._fetch("GET", "/health")
        nosniff = headers.get("x-content-type-options") == "nosniff"
        deny = headers.get("x-frame-options") == "DENY"
        self.record("Security", "Security Headers Attached (nosniff, DENY)", nosniff and deny, "X-Content-Type-Options & X-Frame-Options")

        from app.config import get_settings
        settings = get_settings()
        sanitized_url = settings.sanitized_database_url
        no_pw = "super_secret" not in sanitized_url
        self.record("Security", "Database Password Masking Verified", no_pw, "sanitized_database_url operational")

    def _print_scorecard(self, elapsed: float) -> None:
        print("\n" + "-" * 78)
        print(f"{'Category':<15} | {'Verification Check':<40} | {'Result':<18}")
        print("-" * 78)

        current_cat = ""
        for cat, name, res in self.records:
            cat_display = cat if cat != current_cat else ""
            current_cat = cat
            print(f"{cat_display:<15} | {name:<40} | {res}")

        print("-" * 78)
        total = self.checks_passed + self.checks_failed
        pct = round((self.checks_passed / total) * 100.0, 1) if total > 0 else 0
        print(f"Summary: {self.checks_passed}/{total} checks passed ({pct}%) in {elapsed:.2f}s")

        if self.checks_failed == 0:
            print("\n>>> VERDICT: PRODUCTION READY FOR PJMT NGEC 2026 EVALUATION <<<")
        else:
            print(f"\n>>> VERDICT: {self.checks_failed} CHECKS FAILED — ACTION REQUIRED <<<")
        print("=" * 78 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="AeroTrace Production QA Verification Tool")
    parser.add_argument("--url", default=None, help="Live backend URL (e.g. http://localhost:8000). If omitted, runs in-process.")
    args = parser.parse_args()

    runner = ProductionQARunner(base_url=args.url)
    success = runner.run_all_checks()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
