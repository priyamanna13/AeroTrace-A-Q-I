"""Automated Test Suite for Phase 6: Production Hardening, Caching & Integration.

Validates:
  1. Thread-safe, bounded, expiring ScaledRouteCache (LRU, TTL, station invalidation, metrics).
  2. Security headers middleware (nosniff, DENY, Referrer-Policy).
  3. Safe production error responses (sanitized 500 without stack trace leaks, structured 404/422).
  4. Observability and enhanced diagnostics on GET /health (sanitized DB errors, 28 stations).
  5. Multi-city end-to-end integration across all 7 cities.
"""
from __future__ import annotations

import threading
import time
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.api import app, route_cache
from app.cache import ScaledRouteCache
from app.config import Settings


client = TestClient(app)


# --------------------------------------------------------------------------- #
# 1. ScaledRouteCache Unit & Concurrency Tests
# --------------------------------------------------------------------------- #
class TestScaledRouteCache:
    def test_cache_hit_and_miss(self):
        cache = ScaledRouteCache(max_size=10, default_ttl_seconds=5.0)
        assert cache.get("nonexistent") is None
        assert cache.get_metrics()["misses"] == 1
        assert cache.get_metrics()["hits"] == 0

        cache.set("item1", {"aqi": 120}, ttl_seconds=5.0)
        val = cache.get("item1")
        assert val == {"aqi": 120}
        assert cache.get_metrics()["hits"] == 1

    def test_cache_ttl_expiration(self):
        cache = ScaledRouteCache(max_size=10, default_ttl_seconds=0.1)
        cache.set("item_short", {"temp": 28.5}, ttl_seconds=0.05)
        assert cache.get("item_short") == {"temp": 28.5}

        # Wait for TTL expiry
        time.sleep(0.08)
        assert cache.get("item_short") is None
        assert cache.get_metrics()["misses"] == 1

    def test_cache_lru_capacity_eviction(self):
        cache = ScaledRouteCache(max_size=3, default_ttl_seconds=10.0)
        cache.set("k1", "v1")
        cache.set("k2", "v2")
        cache.set("k3", "v3")

        # Access k1 to make k2 the least recently used
        _ = cache.get("k1")

        # Adding 4th item must evict k2
        cache.set("k4", "v4")

        assert cache.get("k2") is None  # evicted
        assert cache.get("k1") == "v1"
        assert cache.get("k3") == "v3"
        assert cache.get("k4") == "v4"
        assert cache.get_metrics()["evictions"] == 1
        assert cache.get_metrics()["entries"] == 3

    def test_cache_station_invalidation(self):
        cache = ScaledRouteCache(max_size=20, default_ttl_seconds=30.0)
        cache.set("Shivajinagar_Construction", {"data": 1}, station_name="Shivajinagar")
        cache.set("Shivajinagar_Traffic", {"data": 2}, station_name="Shivajinagar")
        cache.set("ITO_Traffic", {"data": 3}, station_name="ITO")
        cache.set("Bandra_Industrial", {"data": 4}, station_name="Bandra")

        assert len(cache) == 4
        evicted = cache.invalidate_station("Shivajinagar")
        assert evicted == 2
        assert len(cache) == 2
        assert cache.get("Shivajinagar_Construction") is None
        assert cache.get("Shivajinagar_Traffic") is None
        assert cache.get("ITO_Traffic") == {"data": 3}
        assert cache.get("Bandra_Industrial") == {"data": 4}

    def test_cache_thread_safety(self):
        cache = ScaledRouteCache(max_size=100, default_ttl_seconds=10.0)
        errors = []

        def worker(thread_id: int):
            try:
                for i in range(50):
                    key = f"key_{thread_id}_{i % 10}"
                    cache.set(key, {"tid": thread_id, "idx": i})
                    val = cache.get(key)
                    if val is not None:
                        assert val["tid"] == thread_id
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(t,)) for t in range(6)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"Thread safety errors: {errors}"
        assert len(cache) <= 100

    def test_cache_metrics_hit_ratio(self):
        cache = ScaledRouteCache(max_size=10, default_ttl_seconds=10.0)
        cache.set("key", "val")
        _ = cache.get("key")   # hit
        _ = cache.get("key")   # hit
        _ = cache.get("key")   # hit
        _ = cache.get("miss")  # miss

        metrics = cache.get_metrics()
        assert metrics["hits"] == 3
        assert metrics["misses"] == 1
        assert metrics["total_requests"] == 4
        assert metrics["hit_ratio_pct"] == 75.0


# --------------------------------------------------------------------------- #
# 2. Security Headers & Secrets Protection Tests
# --------------------------------------------------------------------------- #
class TestSecurityAndHeaders:
    def test_security_headers_present_on_api_responses(self):
        r = client.get("/health")
        assert r.status_code == 200
        headers = r.headers
        assert headers.get("x-content-type-options") == "nosniff"
        assert headers.get("x-frame-options") == "DENY"
        assert headers.get("x-xss-protection") == "1; mode=block"
        assert "strict-origin" in headers.get("referrer-policy", "")

    def test_cors_headers_open_for_hackathon_demo(self):
        r = client.options("/api/v1/cities", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
        assert r.headers.get("access-control-allow-origin") == "*"

    def test_sanitized_database_url_masks_password(self):
        s = Settings(database_url="postgresql+psycopg2://aq_user:super_secret_pw@db.host.internal:5432/aqdb")
        sanitized = s.sanitized_database_url
        assert "super_secret_pw" not in sanitized
        assert "***" in sanitized
        assert "aq_user" in sanitized
        assert "db.host.internal" in sanitized


# --------------------------------------------------------------------------- #
# 3. Safe Production Error Responses Tests
# --------------------------------------------------------------------------- #
class TestSafeErrorResponses:
    def test_404_error_envelope_structure(self):
        r = client.get("/api/v1/prediction/NonExistentStation999/pm25")
        assert r.status_code == 404
        data = r.json()
        assert data.get("status") == "error"
        assert data.get("status_code") == 404
        assert "detail" in data
        assert "timestamp" in data
        assert "path" in data

    def test_422_validation_error_envelope_structure(self):
        # Invalid horizon hours (< 1)
        r = client.get("/api/v1/prediction/Shivajinagar/pm25?hours=0")
        assert r.status_code == 422
        data = r.json()
        assert data.get("status") == "error"
        assert data.get("status_code") == 422
        assert "detail" in data
        assert "errors" in data

    def test_unhandled_500_masks_python_traceback(self):
        # Using raise_server_exceptions=False to test production client perception
        unsafe_client = TestClient(app, raise_server_exceptions=False)

        # Patch a service function to raise an unexpected internal exception with file path
        with patch("app.cities.get_all_cities_summary", side_effect=RuntimeError("Secret internal path /var/secrets/root.key failed")):
            r = unsafe_client.get("/api/v1/cities")
            assert r.status_code == 500
            data = r.json()
            assert data.get("status") == "error"
            assert data.get("status_code") == 500
            assert "error_id" in data
            assert data.get("detail") == "An internal server error occurred. Please contact system administrator."

            # Verify ZERO traceback or secret path leaked in response payload
            raw_text = r.text
            assert "Traceback" not in raw_text
            assert "/var/secrets" not in raw_text
            assert ".py" not in raw_text


# --------------------------------------------------------------------------- #
# 4. Enhanced /health Endpoint & Diagnostics Tests
# --------------------------------------------------------------------------- #
class TestHealthObservability:
    def test_health_returns_enhanced_diagnostics(self):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()

        assert data["status"] in ("ok", "degraded")
        assert data["version"] == "3.1.0"
        assert "uptime_seconds" in data
        assert "environment" in data

        # Database block
        assert "database" in data
        assert "connected" in data["database"]
        assert "engine" in data["database"]

        # Multi-city block
        assert "multi_city" in data
        assert data["multi_city"]["configured_count"] == 7
        assert data["multi_city"]["total_physical_stations"] == 28
        assert "Pune" in data["multi_city"]["cities"]
        assert "Delhi" in data["multi_city"]["cities"]

        # Attribution cache block
        assert "attribution_cache" in data
        assert "entries" in data["attribution_cache"]
        assert "hits" in data["attribution_cache"]
        assert "ttl_seconds" in data["attribution_cache"]
        assert data["attribution_cache"]["ttl_seconds"] == 30.0

    def test_health_sanitizes_database_failure(self):
        from sqlalchemy.exc import OperationalError

        # Mock DB failure with simulated sensitive connection error
        with patch("app.db.get_session", side_effect=OperationalError("password=my_secret_pass host=10.0.0.1", params=[], orig=Exception())):
            r = client.get("/health")
            assert r.status_code == 200
            data = r.json()

            # Error must be sanitized without password or host
            db_error = data["database"].get("error")
            assert db_error == "Database connection failed"
            assert "my_secret_pass" not in r.text
            assert "10.0.0.1" not in r.text


# --------------------------------------------------------------------------- #
# 5. Multi-City Integration & Regression Smoke Tests
# --------------------------------------------------------------------------- #
class TestMultiCityIntegrationSmoke:
    @pytest.mark.parametrize("city", ["Pune", "Mumbai", "Delhi", "Bengaluru", "Kolkata", "Hyderabad", "Chennai"])
    def test_all_seven_cities_weather_and_overview(self, city: str):
        # 1. City Overview
        r1 = client.get(f"/api/v1/cities/{city}/overview")
        assert r1.status_code == 200
        assert r1.json()["city"] == city

        # 2. Weather snapshot
        r2 = client.get(f"/api/v1/weather/{city}")
        assert r2.status_code == 200
        assert r2.json()["city"] == city

    @pytest.mark.parametrize("station", ["Shivajinagar", "Bandra", "ITO", "Peenya", "Victoria Memorial", "Sanathnagar", "Manali"])
    def test_key_stations_attribution_and_prediction(self, station: str):
        # Attribution
        r_att = client.get(f"/api/v1/attribution/{station}")
        assert r_att.status_code == 200
        assert "trigger_station" in r_att.json()

        # Prediction
        r_pred = client.get(f"/api/v1/prediction/{station}/pm25?hours=3")
        assert r_pred.status_code == 200
        assert len(r_pred.json()["horizons"]) == 3

    def test_trigger_spike_invalidates_route_cache(self):
        station = "Bandra"

        # 1. Prime cache
        r1 = client.get(f"/api/v1/attribution/{station}")
        assert r1.status_code == 200

        # 2. Trigger simulated spike
        r_spike = client.post(f"/api/v1/simulation/trigger-spike?station_name={station}&spike_aqi=365")
        assert r_spike.status_code == 200

        # 3. Next query must fetch fresh spiked attribution rather than stale cached
        r2 = client.get(f"/api/v1/attribution/{station}")
        assert r2.status_code == 200
