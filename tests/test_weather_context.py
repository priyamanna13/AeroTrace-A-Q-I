from app.weather_context import format_weather_for_prompt

def test_format_weather_for_prompt():
    weather_data = {
        "temperature_c": 25.5,
        "relative_humidity_pct": 60,
        "wind_speed_kmh": 15.0,
        "wind_direction_deg": 270,
        "mixing_layer_height_m": 1200,
        "pasquill_class": "C",
        "pasquill_label": "Slightly Unstable",
        "pasquill_description": "Moderate mechanical mixing.",
        "cloud_cover_oktas": 2
    }
    result = format_weather_for_prompt(weather_data)
    assert "25.5°C" in result
    assert "60%" in result
    assert "15.0 km/h" in result
    assert "270°" in result
    assert "1200m" in result
    assert "Class C" in result
    assert "Slightly Unstable" in result

def test_format_weather_empty():
    assert format_weather_for_prompt({}) == "Weather context unavailable."
