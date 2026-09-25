from app.prediction_intelligence import generate_prediction_insight
from unittest.mock import patch

@patch("app.prediction_intelligence.get_weather_context")
def test_generate_prediction_insight_stable(mock_get_weather):
    mock_get_weather.return_value = {"pasquill_class": "F", "wind_speed_kmh": 2.0}
    res = generate_prediction_insight("Pune", "en")
    assert "highly stable" in res["prediction_text"].lower() or "severe pollutant accumulation" in res["prediction_text"].lower()
    assert res["pasquill_class"] == "F"

@patch("app.prediction_intelligence.get_weather_context")
def test_generate_prediction_insight_unstable(mock_get_weather):
    mock_get_weather.return_value = {"pasquill_class": "B", "wind_speed_kmh": 15.0}
    res = generate_prediction_insight("Pune", "hi")
    assert "अस्थिर" in res["prediction_text"]
    assert res["pasquill_class"] == "B"
