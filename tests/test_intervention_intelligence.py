from app.intervention_intelligence import generate_intervention_insight

def test_intervention_traffic():
    res = generate_intervention_insight("Traffic restriction", "en")
    assert "15-20%" in res["intervention_text"]
    assert "NO2" in res["intervention_text"]

def test_intervention_dust():
    res = generate_intervention_insight("Dust control", "en")
    assert "25-30%" in res["intervention_text"]
    assert "PM10" in res["intervention_text"]

def test_intervention_industry():
    res = generate_intervention_insight("Industrial curtailment", "hi")
    assert "35-40%" in res["intervention_text"]
    assert "SO2" in res["intervention_text"]

def test_intervention_other():
    res = generate_intervention_insight("Random action", "en")
    assert "Targeted enforcement" in res["intervention_text"]
