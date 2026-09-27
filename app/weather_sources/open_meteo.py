"""Live Open-Meteo Weather Source Adapter for AeroTrace NGEC 2026.

Replaces the synthetic MockIMDSource with authentic real-time meteorological feeds:
  - Queries Open-Meteo Weather API for current surface weather across all 7 cities.
  - Emits RawWeather instances with exact contract units:
    wind_speed_kmh, wind_direction_deg, temperature_c, relative_humidity_pct,
    pressure_hpa, cloud_cover_oktas (0-8), precipitation_mm_last_1h, visibility_km,
    and dynamically estimated mixing_layer_height_m.
  - Features 30-second in-memory caching to conform with AeroTrace's 30-second cadence.
  - Dynamic coordinate resolution across all 28 physical CAAQMS stations and 7 city centers.
"""
from __future__ import annotations

import json
import logging
import math
import time
import urllib.request
from datetime import datetime, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from .base import RawWeather, WeatherSourceAdapter
from ..cities import get_all_city_configs, _normalize_name

log = logging.getLogger(__name__)

# Indian Standard Time (UTC+5:30)
IST = ZoneInfo("Asia/Kolkata")

# 30-second cache TTL matching application cadence
WEATHER_CACHE_TTL_SECONDS: float = 30.0
_WEATHER_CACHE: dict[str, tuple[RawWeather, float]] = {}


def clear_weather_cache() -> None:
    """Clear in-memory weather cache (primarily for tests)."""
    global _WEATHER_CACHE
    _WEATHER_CACHE.clear()


class LiveOpenMeteoSource(WeatherSourceAdapter):
    """Real HTTP weather adapter querying Open-Meteo for authentic atmospheric parameters."""

    name = "live"

    def __init__(self, timeout: float = 5.0) -> None:
        self.timeout = timeout
        self._coord_cache: dict[str, tuple[float, float]] = {}
        self._load_coordinates()

    def _load_coordinates(self) -> None:
        """Cache all 28 physical stations and 7 city center coordinates."""
        configs = get_all_city_configs()
        for city_key, cfg in configs.items():
            if "city" in cfg:
                city_name = cfg["city"]["name"]
                lat = float(cfg["city"]["center"]["lat"])
                lon = float(cfg["city"]["center"]["lon"])
                self._coord_cache[_normalize_name(city_name)] = (lat, lon)

            for st in cfg.get("stations", []):
                st_name = st["name"]
                s_lat = float(st["lat"])
                s_lon = float(st["lon"])
                self._coord_cache[_normalize_name(st_name)] = (s_lat, s_lon)

    def resolve_coords(self, target: str) -> tuple[float, float]:
        """Resolve (lat, lon) for a station or city name, with Pune center fallback."""
        key = _normalize_name(target)
        if key in self._coord_cache:
            return self._coord_cache[key]
        # Refresh coordinate registry if newly added
        self._load_coordinates()
        return self._coord_cache.get(key, (18.5308, 73.8567))

    def _estimate_mixing_height(self, local_dt: datetime, wind_speed_kmh: float) -> int:
        """Estimate atmospheric boundary layer mixing height dynamically.
        
        Convective mixing during daytime lofts the boundary layer (600-1400m);
        nighttime nocturnal boundary layer is shallower (250-450m).
        """
        hour = local_dt.hour + local_dt.minute / 60.0
        if 6.0 <= hour <= 18.0:
            # Daytime solar insolation peak around 13:00
            sin_elev = math.sin((hour - 6.0) / 12.0 * math.pi)
            mixing = 500.0 + 750.0 * sin_elev + (wind_speed_kmh * 15.0)
        else:
            mixing = 250.0 + (wind_speed_kmh * 10.0)
        return int(round(min(2200.0, max(200.0, mixing))))

    def fetch_snapshot(self, station_name: str, timestamp: Optional[datetime] = None) -> Optional[RawWeather]:
        """Fetch nearest weather observation for the given station or city."""
        now_time = time.time()
        cache_key = _normalize_name(station_name)

        if cache_key in _WEATHER_CACHE:
            cached_weather, cached_at = _WEATHER_CACHE[cache_key]
            if (now_time - cached_at) < WEATHER_CACHE_TTL_SECONDS:
                return cached_weather

        lat, lon = self.resolve_coords(station_name)

        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            "&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation,visibility"
            "&wind_speed_unit=kmh"
            "&timezone=Asia%2FKolkata"
        )
        headers = {"User-Agent": "AeroTrace-NGEC/3.1 (AeroTrace Meteorological Pipeline)"}

        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            cur = data.get("current", {})
            wind_speed = round(float(cur.get("wind_speed_10m") or 0.0), 1)
            wind_dir = int(round(float(cur.get("wind_direction_10m") or 0.0))) % 360
            temp_c = round(float(cur.get("temperature_2m") or 25.0), 1)
            humidity = int(round(float(cur.get("relative_humidity_2m") or 50.0)))
            pressure = round(float(cur.get("surface_pressure") or 1013.25), 1)
            cloud_pct = float(cur.get("cloud_cover") or 0.0)
            cloud_oktas = min(8, max(0, int(round(cloud_pct * 8.0 / 100.0))))
            precip = round(float(cur.get("precipitation") or 0.0), 1)
            vis_m = float(cur.get("visibility") or 10000.0)
            vis_km = round(vis_m / 1000.0, 1)

            time_str = cur.get("time")
            if time_str:
                try:
                    obs_dt = datetime.fromisoformat(time_str).replace(tzinfo=IST)
                except Exception:
                    obs_dt = datetime.now(IST)
            else:
                obs_dt = datetime.now(IST)

            mixing_m = self._estimate_mixing_height(obs_dt, wind_speed)

            raw = RawWeather(
                station_name=station_name,
                observed_at=obs_dt,
                source="Open-Meteo_Live",
                wind_speed_kmh=wind_speed,
                wind_direction_deg=wind_dir,
                temperature_c=temp_c,
                relative_humidity_pct=humidity,
                pressure_hpa=pressure,
                cloud_cover_oktas=cloud_oktas,
                precipitation_mm_last_1h=precip,
                visibility_km=vis_km,
                mixing_layer_height_m=mixing_m,
                extra={"latitude": lat, "longitude": lon, "cloud_cover_pct": cloud_pct},
            )

            _WEATHER_CACHE[cache_key] = (raw, now_time)
            return raw

        except Exception as exc:
            log.warning("Open-Meteo weather fetch failed for %s (lat=%.4f, lon=%.4f): %s", station_name, lat, lon, exc)
            # Offline emergency fallback: use deterministic mock to ensure pipeline never crashes
            from .mock import MockIMDSource
            fallback_src = MockIMDSource()
            ts = timestamp or datetime.now(IST)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=IST)
            fallback_reading = fallback_src.fetch_snapshot(station_name, ts)
            if fallback_reading:
                fallback_reading.source = "Open-Meteo_Simulated"
            return fallback_reading
