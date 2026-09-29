"""Observability, health check, and system telemetry router."""
from __future__ import annotations

import logging
import time
from fastapi import APIRouter
from sqlalchemy import text

from ..config import get_settings
from ..cache import get_route_cache
from ..cities import list_available_cities
from ..demo_scenarios import list_scenario_names

log = logging.getLogger(__name__)
router = APIRouter(tags=["Meta"])
_SERVER_START_TIME = time.time()


@router.get("/health")
def health():
    """Observability & health endpoint for AeroTrace NGEC 2026."""
    cities = list_available_cities()
    all_stations = list_scenario_names()

    db_connected = False
    has_postgis = False
    db_error_msg = None
    db_engine = "unknown"

    settings = get_settings()
    if settings.is_sqlite:
        db_engine = "sqlite"
    elif "postgres" in settings.database_url:
        db_engine = "postgresql"

    try:
        from ..db import get_session
        with get_session() as session:
            session.execute(text("SELECT 1"))
            db_connected = True
            try:
                has_postgis = bool(session.execute(
                    text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='postgis')")
                ).scalar())
            except Exception:
                has_postgis = False
    except Exception as exc:
        db_error_msg = "Database connection failed"
        log.warning("Database health check error: %s", exc)

    cache_metrics = get_route_cache().get_metrics()
    uptime_s = round(time.time() - _SERVER_START_TIME, 1)

    return {
        "status": "ok" if db_connected or settings.is_sqlite else "degraded",
        "service": "AeroTrace Environmental Intelligence API",
        "version": "3.1.0",
        "pipeline_version": "3.1.0",
        "environment": "production" if not settings.is_sqlite else "development",
        "uptime_seconds": uptime_s,
        "database": {
            "connected": db_connected,
            "postgis_enabled": has_postgis,
            "engine": db_engine,
            "error": db_error_msg,
        },
        "multi_city": {
            "configured_count": len(cities),
            "total_physical_stations": len(all_stations),
            "cities": cities,
        },
        "weather_adapter": {
            "provider": "Open-Meteo",
            "cache_ttl_seconds": 30.0,
            "active": True,
        },
        "attribution_cache": cache_metrics,
        "cadence": {
            "application_refresh_seconds": 30,
            "staleness_threshold_minutes": 60,
        },
    }


@router.get("/ready")
def readiness():
    """Readiness probe for container orchestration."""
    return {"status": "ready"}
