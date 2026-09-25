from datetime import datetime
from zoneinfo import ZoneInfo
import logging
from typing import Any

from .weather_sources.base import get_weather_source
from .pasquill import classify_stability

log = logging.getLogger(__name__)

def get_weather_context(city_name: str) -> dict[str, Any]:
    """Fetch live or simulated weather data and classify stability for AI context."""
    now = datetime.now(tz=ZoneInfo("Asia/Kolkata"))
    raw = None
    try:
        src = get_weather_source("live")
        raw = src.fetch_snapshot(city_name, now)
    except Exception as exc:
        log.warning(f"Live weather failed for {city_name}, falling back to mock: {exc}")
    
    if raw is None:
        try:
            src = get_weather_source("mock")
            raw = src.fetch_snapshot(city_name, now)
        except Exception as exc:
            log.error(f"Failed to fetch mock weather for {city_name}: {exc}")
            return {}
            
    if raw is None:
        return {}

    obs = raw.to_dict()
    is_daytime = 6 <= now.hour < 18
    pasquill = classify_stability(
        wind_speed_kmh=obs["wind_speed_kmh"],
        cloud_cover_oktas=obs["cloud_cover_oktas"],
        is_daytime=is_daytime,
        solar_elevation_deg=35.0 if is_daytime else -10.0,
    )
    
    return {
        "temperature_c": obs["temperature_c"],
        "relative_humidity_pct": obs["relative_humidity_pct"],
        "wind_speed_kmh": obs["wind_speed_kmh"],
        "wind_direction_deg": obs["wind_direction_deg"],
        "mixing_layer_height_m": obs["mixing_layer_height_m"],
        "pasquill_class": pasquill["pasquill_class"],
        "pasquill_label": pasquill["label"],
        "pasquill_description": pasquill["description"],
        "cloud_cover_oktas": obs["cloud_cover_oktas"],
    }

def format_weather_for_prompt(weather_data: dict[str, Any]) -> str:
    """Format the weather dictionary into a human-readable prompt block."""
    if not weather_data:
        return "Weather context unavailable."
    
    return (
        f"Atmospheric conditions: {weather_data['temperature_c']}°C, "
        f"{weather_data['relative_humidity_pct']}% humidity, "
        f"Wind: {weather_data['wind_speed_kmh']} km/h at {weather_data['wind_direction_deg']}°. "
        f"Boundary layer mixing height is {weather_data['mixing_layer_height_m']}m. "
        f"Stability: Class {weather_data['pasquill_class']} ({weather_data['pasquill_label']}) - {weather_data['pasquill_description']}"
    )
