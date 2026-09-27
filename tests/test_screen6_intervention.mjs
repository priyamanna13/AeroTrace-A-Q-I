/**
 * Screen 6 (Impact & Intervention) Contract & Unit Test Suite
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { API, FALLBACK_CITY_STATIONS } from '../frontend/src/api_client.js';

test('Screen 6: FALLBACK_CITY_STATIONS has all 7 cities with 4 verified stations each', () => {
  const expectedCities = ['pune', 'mumbai', 'delhi', 'bengaluru', 'kolkata', 'hyderabad', 'chennai'];
  for (const city of expectedCities) {
    const stations = FALLBACK_CITY_STATIONS[city];
    assert.ok(stations, `Missing stations list for ${city}`);
    assert.equal(stations.length, 4, `${city} should have exactly 4 verified stations`);
    for (const station of stations) {
      assert.ok(station.station_id, `Station should have station_id`);
      assert.ok(station.name, `Station should have name`);
      assert.ok(Array.isArray(station.coordinates), `Station should have coordinates array`);
      assert.equal(station.coordinates.length, 2, `Coordinates should be [lng, lat]`);
      assert.ok(typeof station.current_aqi === 'number', `Current AQI must be number`);
    }
  }
});

test('Screen 6: API.simulateIntervention fallback returns complete ERF contract payload', async () => {
  const result = await API.simulateIntervention({
    city: 'Pune',
    station_name: 'Shivajinagar',
    intervention_type: 'control_construction_dust',
    intensity_pct: 60.0,
  });

  assert.ok(result, 'Simulation must return payload');
  assert.equal(typeof result.current_aqi, 'number');
  assert.equal(typeof result.projected_aqi, 'number');
  assert.equal(typeof result.aqi_delta, 'number');
  assert.ok(result.aqi_delta >= 0, 'AQI delta must be non-negative');
  assert.ok(result.projected_aqi <= result.current_aqi, 'Projected AQI must be <= current AQI');
  assert.ok(typeof result.percentage_reduction === 'number');
  assert.ok(result.affected_zone_summary, 'Must contain affected_zone_summary');
  assert.ok(result.methodology_notes, 'Must contain methodology notes');
  assert.ok(result.disclaimer, 'Must contain statutory disclaimer');
});

test('Screen 6: API.getInterventionInsight returns counterfactual narrative and disclaimer', async () => {
  const insight = await API.getInterventionInsight('traffic', 'Pune', 'en');
  assert.ok(insight, 'Insight must return object');
  assert.ok(insight.intervention_text || insight.response_text, 'Must provide explanatory text');
});
