"""Forward Air Quality Prediction Engine for AeroTrace NGEC 2026.

Implements the Screen 5 (Prediction) backend requirements:
- Anchored forward air quality forecasting (1H, 3H, 6H horizons) derived from
  current observed station telemetry and local atmospheric stability.
- Exponential dispersion decay model: AQI(t) = AQI_current * exp(-k * t).
- Atmospheric decay rate k dynamically parameterized by Pasquill-Gifford stability class:
  Class A: 0.14 h⁻¹ (Extremely unstable, strong convective dilution)
  Class B: 0.11 h⁻¹ (Moderately unstable)
  Class C: 0.08 h⁻¹ (Slightly unstable)
  Class D: 0.06 h⁻¹ (Neutral, mechanical mixing)
  Class E: 0.04 h⁻¹ (Slightly stable)
  Class F: 0.025 h⁻¹ (Moderately stable, nocturnal inversion trapping)
- Wind advection trajectory and expanding downwind plume footprint (GeoJSON Polygon).
- Expanding confidence margin: ±(5% + 3% * t).
- Strict non-negotiable metadata: "Estimated forecast - see methodology".
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from .demo_scenarios import get_scenario
from .pasquill import classify_stability, degrees_to_cardinal
from .weather_sources.base import get_weather_source

log = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")

# Pasquill-Gifford dispersion decay constants (in h⁻¹)
PASQUILL_DECAY_RATES: dict[str, float] = {
    "A": 0.14,   # Extremely unstable (rapid thermal lofting)
    "B": 0.11,   # Moderately unstable
    "C": 0.08,   # Slightly unstable
    "D": 0.06,   # Neutral (overcast / mechanical mixing)
    "E": 0.04,   # Slightly stable (nocturnal light wind)
    "F": 0.025,  # Moderately stable (surface inversion, pollutants linger)
}

POLLUTANT_UNITS: dict[str, str] = {
    "pm25": "µg/m³",
    "pm10": "µg/m³",
    "no2": "µg/m³",
    "so2": "µg/m³",
    "co": "mg/m³",
    "o3": "µg/m³",
}

VALID_POLLUTANTS: set[str] = {"pm25", "pm10", "no2", "so2", "co", "o3"}


def _build_advected_plume_polygon(
    station_lon: float,
    station_lat: float,
    wind_direction_deg: int,
    wind_speed_kmh: float,
    lead_time_hours: float,
) -> dict[str, Any]:
    """Generate GeoJSON Polygon representing downwind dispersion footprint.
    
    The plume translates downwind (opposite to wind direction) and laterally expands
    as lead time increases.
    """
    # Downwind transport is 180° opposite of wind origin
    downwind_deg = (wind_direction_deg + 180) % 360
    theta_rad = math.radians(downwind_deg)
    perp_rad = theta_rad + math.pi / 2.0

    # Effective advection distance (km)
    effective_speed = max(3.0, min(60.0, wind_speed_kmh))
    advection_dist_km = effective_speed * lead_time_hours * 0.55
    advection_dist_km = max(0.8, min(40.0, advection_dist_km))

    # Lateral plume spread (km) expanding with distance
    lateral_spread_km = max(0.4, advection_dist_km * 0.38)

    # Convert km to approximate degrees
    lat_deg_per_km = 1.0 / 111.0
    lon_deg_per_km = 1.0 / (111.0 * max(0.2, math.cos(math.radians(station_lat))))

    # Origin (Station)
    p0 = [round(station_lon, 5), round(station_lat, 5)]

    # Mid-distance point
    mid_dist = advection_dist_km * 0.5
    mid_lon = station_lon + mid_dist * math.sin(theta_rad) * lon_deg_per_km
    mid_lat = station_lat + mid_dist * math.cos(theta_rad) * lat_deg_per_km

    # Left lateral flank
    flank_l = [
        round(mid_lon - (lateral_spread_km * 0.7) * math.sin(perp_rad) * lon_deg_per_km, 5),
        round(mid_lat - (lateral_spread_km * 0.7) * math.cos(perp_rad) * lat_deg_per_km, 5),
    ]

    # Plume tip (leading edge center)
    tip_lon = station_lon + advection_dist_km * math.sin(theta_rad) * lon_deg_per_km
    tip_lat = station_lat + advection_dist_km * math.cos(theta_rad) * lat_deg_per_km

    # Left leading wing
    wing_l = [
        round(tip_lon - (lateral_spread_km * 0.5) * math.sin(perp_rad) * lon_deg_per_km, 5),
        round(tip_lat - (lateral_spread_km * 0.5) * math.cos(perp_rad) * lat_deg_per_km, 5),
    ]

    # Tip point
    tip = [round(tip_lon, 5), round(tip_lat, 5)]

    # Right leading wing
    wing_r = [
        round(tip_lon + (lateral_spread_km * 0.5) * math.sin(perp_rad) * lon_deg_per_km, 5),
        round(tip_lat + (lateral_spread_km * 0.5) * math.cos(perp_rad) * lat_deg_per_km, 5),
    ]

    # Right lateral flank
    flank_r = [
        round(mid_lon + (lateral_spread_km * 0.7) * math.sin(perp_rad) * lon_deg_per_km, 5),
        round(mid_lat + (lateral_spread_km * 0.7) * math.cos(perp_rad) * lat_deg_per_km, 5),
    ]

    # Form closed polygon ring
    ring = [p0, flank_l, wing_l, tip, wing_r, flank_r, p0]

    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [ring],
        },
        "properties": {
            "lead_time_hours": lead_time_hours,
            "transport_direction_deg": downwind_deg,
            "advection_distance_km": round(advection_dist_km, 2),
            "lateral_spread_km": round(lateral_spread_km, 2),
        },
    }


def calculate_forward_prediction(
    station_name: str,
    pollutant: str = "pm25",
    hours: int = 6,
    session: Optional[Any] = None,
) -> dict[str, Any]:
    """Calculate forward air quality predictions anchored to current observed state.
    
    Parameters
    ----------
    station_name : str
        Target CAAQMS monitoring station name.
    pollutant : str
        Pollutant key (pm25, pm10, no2, so2, co, o3).
    hours : int
        Maximum forecast horizon window in hours (1 to 24, default 6).
    session : Optional[Session]
        Optional SQLAlchemy database session.
    
    Returns
    -------
    dict matching Screen 5 data contract specifications.
    """
    pol_key = pollutant.strip().lower()
    if pol_key not in VALID_POLLUTANTS:
        raise ValueError(f"Invalid pollutant '{pollutant}'. Allowed: {sorted(VALID_POLLUTANTS)}")

    scenario = get_scenario(station_name, fallback=False)
    if not scenario:
        raise ValueError(f"Station '{station_name}' not configured")

    lon, lat = scenario.coordinates
    city_name = scenario.city

    # ── 1. Resolve current baseline AQI and pollutant concentrations ────────
    current_aqi = scenario.spike_aqi
    base_profile = dict(scenario.base_profile)
    current_conc = float(base_profile.get(pol_key, 45.0))

    # Attempt to query live CPCB/Open-Meteo real sensor data if available
    try:
        from .api import _fetch_real_aqi
        real_aqi, real_dom, real_concs = _fetch_real_aqi(station_name)
        if real_aqi is not None and real_aqi > 0:
            current_aqi = real_aqi
            if real_concs and pol_key in real_concs:
                current_conc = float(real_concs[pol_key])
    except Exception as exc:
        log.debug("Live telemetry query skipped, using baseline: %s", exc)

    # ── 2. Retrieve live meteorological conditions & Pasquill class ─────────
    now_local = datetime.now(tz=IST)
    wind_speed_kmh = 12.0
    wind_direction_deg = 270
    cloud_cover_oktas = 2
    pasquill_class = "D"
    stability_label = "Neutral"

    try:
        live_src = get_weather_source("live")
        raw_weather = live_src.fetch_snapshot(station_name)
        if raw_weather is not None:
            wind_speed_kmh = raw_weather.wind_speed_kmh
            wind_direction_deg = raw_weather.wind_direction_deg
            cloud_cover_oktas = raw_weather.cloud_cover_oktas
    except Exception as exc:
        log.warning("Live weather unavailable for prediction, using scenario default: %s", exc)
        w_overrides = scenario.weather_overrides
        wind_speed_kmh = float(w_overrides.get("wind_speed_kmh", 12.0))
        wind_direction_deg = int(w_overrides.get("wind_direction_deg", 270))
        cloud_cover_oktas = int(w_overrides.get("cloud_cover_oktas", 2))

    # Classify Pasquill stability
    is_daytime = 6 <= now_local.hour < 18
    pasquill_res = classify_stability(
        wind_speed_kmh,
        cloud_cover_oktas,
        is_daytime=is_daytime,
        solar_elevation_deg=35.0,
    )
    pasquill_class = pasquill_res["pasquill_class"]
    stability_label = pasquill_res["label"]

    decay_k = PASQUILL_DECAY_RATES.get(pasquill_class, 0.06)

    # ── 3. Generate hourly forecasts up to requested horizon ───────────────
    max_h = max(1, min(24, int(hours)))
    horizons: list[dict[str, Any]] = []

    for h in range(1, max_h + 1):
        target_dt = now_local + timedelta(hours=h)
        target_iso = target_dt.isoformat(timespec="seconds")

        # Exponential decay calculation
        decay_factor = math.exp(-decay_k * h)
        pred_aqi = max(25, int(round(current_aqi * decay_factor)))
        pred_conc = max(1.0, round(current_conc * decay_factor, 1))

        # Confidence uncertainty margin expanding with lead time
        margin_pct = round((0.05 + 0.03 * h) * 100.0, 1)
        margin_fraction = margin_pct / 100.0

        lower_aqi = max(15, int(round(pred_aqi * (1.0 - margin_fraction))))
        upper_aqi = min(500, int(round(pred_aqi * (1.0 + margin_fraction))))

        confidence_rating = "high" if h <= 2 else "medium" if h <= 4 else "low"

        # Downwind advection plume geometry
        plume_poly = _build_advected_plume_polygon(
            station_lon=lon,
            station_lat=lat,
            wind_direction_deg=wind_direction_deg,
            wind_speed_kmh=wind_speed_kmh,
            lead_time_hours=float(h),
        )

        horizons.append({
            "horizon_hours": h,
            "timestamp": target_iso,
            "predicted_aqi": pred_aqi,
            "confidence_bounds": {
                "lower_aqi": lower_aqi,
                "upper_aqi": upper_aqi,
                "margin_pct": margin_pct,
            },
            "predicted_concentration": pred_conc,
            "confidence": confidence_rating,
            "affected_zone_geojson": plume_poly,
        })

    return {
        "station_name": scenario.station_name,
        "city": city_name,
        "target_pollutant": pol_key,
        "current_aqi": current_aqi,
        "current_concentration": round(current_conc, 1),
        "concentration_unit": POLLUTANT_UNITS.get(pol_key, "µg/m³"),
        "weather_context": {
            "wind_speed_kmh": round(wind_speed_kmh, 1),
            "wind_direction_deg": wind_direction_deg,
            "wind_cardinal": degrees_to_cardinal(wind_direction_deg),
            "pasquill_class": pasquill_class,
            "stability_label": stability_label,
            "decay_rate_k": decay_k,
        },
        "horizons": horizons,
        "label": "Estimated forecast - see methodology",
        "methodology": (
            "Exponential atmospheric dispersion decay parameterized by Pasquill-Gifford stability "
            "class and wind advection advected downwind."
        ),
    }
