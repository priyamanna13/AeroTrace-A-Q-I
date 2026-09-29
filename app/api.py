"""FastAPI application — full attribution pipeline entrypoint for AeroTrace NGEC 2026.

Assembles modular APIRouters, CORS middleware, security headers, global error handlers,
and cold-start background poller lifecycle.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import get_settings

log = logging.getLogger(__name__)


# ─── APPLICATION LIFECYCLE ───────────────────────────────────────────────────
@asynccontextmanager
async def _lifespan(app: FastAPI):  # noqa: ARG001
    """Cold start bootstrap: initialize database, seed physical station registry,
    and launch background multi-city ingestion and poller.
    """
    from .db_init import initialize_database_and_registry
    from .cpcb_poller import start_live_aqi_pipeline

    # 1. Synchronously bootstrap schema and seed all 28 physical stations & candidate sources
    initialize_database_and_registry()

    # 2. Start the background multi-city revalidation and periodic poller loop
    poller_task = asyncio.create_task(start_live_aqi_pipeline())
    log.info("AeroTrace background ingestion & poller task spawned (task id: %s).", id(poller_task))
    try:
        yield
    finally:
        poller_task.cancel()
        try:
            await poller_task
        except asyncio.CancelledError:
            log.info("AeroTrace background poller task cancelled cleanly.")


# ─── FASTAPI APPLICATION INSTANTIATION ───────────────────────────────────────
app = FastAPI(
    title="Air Quality Attribution Engine",
    version="3.1.0",
    description="CPCB AQI spike attribution with wind-cone analysis and source ranking.",
    lifespan=_lifespan,
)

# ─── CORS CONFIGURATION ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

# ─── SECURITY HEADERS MIDDLEWARE ─────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ─── GLOBAL PRODUCTION EXCEPTION HANDLERS ────────────────────────────────────
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    now_iso = datetime.now(timezone.utc).isoformat()
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "status_code": exc.status_code,
            "detail": exc.detail,
            "path": request.url.path,
            "timestamp": now_iso,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    now_iso = datetime.now(timezone.utc).isoformat()
    formatted_errors = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "Validation error")
        formatted_errors.append(f"{loc}: {msg}" if loc else msg)

    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "status_code": 422,
            "detail": "; ".join(formatted_errors) if formatted_errors else "Validation failed",
            "errors": exc.errors(),
            "path": request.url.path,
            "timestamp": now_iso,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    error_id = str(uuid.uuid4())
    log.exception(
        "Unhandled server exception [error_id=%s] on %s: %s",
        error_id,
        request.url.path,
        exc,
    )
    now_iso = datetime.now(timezone.utc).isoformat()
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "status_code": 500,
            "detail": "An internal server error occurred. Please contact system administrator.",
            "error_id": error_id,
            "path": request.url.path,
            "timestamp": now_iso,
        },
    )


# ─── ROUTER REGISTRATION ─────────────────────────────────────────────────────
from .routers.health import router as health_router
from .routers.cities import router as cities_router
from .routers.alerts import router as alerts_router
from .routers.analytics import router as analytics_router
from .routers.weather import router as weather_router
from .routers.prediction import router as prediction_router
from .routers.intervention import router as intervention_router
from .routers.attribution import router as attribution_router
from .routers.replay import router as replay_router
from .routers.simulation import router as simulation_router
from .ai_router import router as ai_router

app.include_router(health_router)
app.include_router(cities_router)
app.include_router(alerts_router)
app.include_router(analytics_router)
app.include_router(weather_router)
app.include_router(prediction_router)
app.include_router(intervention_router)
app.include_router(attribution_router)
app.include_router(replay_router)
app.include_router(simulation_router)
app.include_router(ai_router)


# ─── BACKWARD COMPATIBILITY RE-EXPORTS ───────────────────────────────────────
# Preserves 100% backward compatibility for existing imports in tests and scripts:
#   from app.api import app, route_cache, _fetch_real_aqi, health, list_cities, etc.
from .api_helpers import (
    route_cache,
    GLOBAL_ROUTE_CACHE,
    ConnectionManager,
    manager,
    _STATION_CATEGORY,
    _get_default_category,
    _STATION_COORDS,
    _init_all_station_coords,
    _WAQI_STATION_UIDS,
    _concentrations_to_cpcb,
    _fetch_real_aqi,
    _SCENARIO_LABELS,
    _build_attribution,
)
from .validation import _sanitize_path_param, _sanitize_pollutant

from .routers.health import health, readiness
from .routers.cities import get_cities, get_city_overview_endpoint, get_city_stations_endpoint
list_cities = get_cities
city_overview = get_city_overview_endpoint
city_stations = get_city_stations_endpoint

from .routers.alerts import get_all_alerts, get_city_alerts_endpoint
from .routers.analytics import get_city_analytics_endpoint, get_analytics
from .routers.weather import get_weather
from .routers.prediction import get_prediction
from .routers.intervention import simulate_civic_intervention, InterventionSimulateRequest
from .routers.attribution import get_attribution, list_stations, get_readings, wind_cone_endpoint, list_sources
from .routers.replay import get_timeline, get_replay
from .routers.simulation import trigger_spike, websocket_endpoint, websocket_shorthand, _enrich_broadcast

__all__ = [
    "app",
    "route_cache",
    "GLOBAL_ROUTE_CACHE",
    "ConnectionManager",
    "manager",
    "_STATION_CATEGORY",
    "_get_default_category",
    "_STATION_COORDS",
    "_init_all_station_coords",
    "_WAQI_STATION_UIDS",
    "_concentrations_to_cpcb",
    "_fetch_real_aqi",
    "_SCENARIO_LABELS",
    "_build_attribution",
    "_sanitize_path_param",
    "_sanitize_pollutant",
    "health",
    "readiness",
    "get_cities",
    "list_cities",
    "get_city_overview_endpoint",
    "city_overview",
    "get_city_stations_endpoint",
    "city_stations",
    "get_all_alerts",
    "get_city_alerts_endpoint",
    "get_city_analytics_endpoint",
    "get_analytics",
    "get_weather",
    "get_prediction",
    "simulate_civic_intervention",
    "InterventionSimulateRequest",
    "get_attribution",
    "list_stations",
    "get_readings",
    "wind_cone_endpoint",
    "list_sources",
    "get_timeline",
    "get_replay",
    "trigger_spike",
    "websocket_endpoint",
    "websocket_shorthand",
    "_enrich_broadcast",
]
