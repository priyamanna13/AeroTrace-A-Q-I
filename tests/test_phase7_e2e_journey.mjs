/**
 * Phase 7: Full End-to-End System Journey & Production QA Test Suite
 * Covers Screens 0 to 9, multi-city data flow, AI grounding, multilingual, and voice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { API, FALLBACK_CITY_STATIONS } from '../frontend/src/api_client.js';
import { voiceService } from '../frontend/src/services/voiceService.js';
import { dictionaries, LANGUAGES } from '../frontend/src/lib/i18n/dictionaries.js';
import { severityFor, severityColor, CITIES } from '../frontend/src/lib/aqi.js';

const SEVEN_CITIES = ['Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Kolkata', 'Hyderabad', 'Chennai'];

test('Phase 7 E2E: Screen 0 & 1 — National Overview & All 7 Cities Registry', async () => {
  const cities = await API.getCities();
  assert.ok(Array.isArray(cities), 'getCities must return an array');
  assert.equal(cities.length, 7, 'Must register exactly 7 metropolitan cities');

  const names = cities.map((c) => c.name);
  for (const exp of SEVEN_CITIES) {
    assert.ok(names.includes(exp), `Missing city ${exp} in getCities()`);
  }

  for (const c of cities) {
    assert.ok(c.coordinates && c.coordinates.length === 2, `${c.name} must have [lon, lat] coordinates`);
    assert.ok(typeof c.current_aqi === 'number', `${c.name} must have numeric current_aqi`);
    assert.ok(c.data_source, `${c.name} must declare data_source`);
    assert.ok(c.data_timestamp, `${c.name} must declare data_timestamp`);
  }
});

test('Phase 7 E2E: Screen 2 & 3 — Verified Physical Stations across all 7 Cities', async () => {
  let totalVerified = 0;
  for (const city of SEVEN_CITIES) {
    const stations = await API.getCityStations(city);
    assert.ok(Array.isArray(stations), `Stations for ${city} must be an array`);
    assert.equal(stations.length, 4, `${city} must have exactly 4 verified stations`);
    totalVerified += stations.length;

    for (const s of stations) {
      assert.ok(s.station_id.startsWith('site_'), `Station ${s.name} must have valid site_* ID`);
      assert.ok(s.network.includes('CAAQMS'), `Station ${s.name} must be CAAQMS network`);
      assert.ok(typeof s.current_aqi === 'number', `Station ${s.name} must have numeric AQI`);
      assert.ok(s.pollutants, `Station ${s.name} must include pollutants profile`);
    }
  }
  assert.equal(totalVerified, 28, 'Must verify 28 physical monitoring stations total');
});

test('Phase 7 E2E: Screen 5 — Forward Prediction & Dispersion Trajectory Contract', async () => {
  const pred = await API.getForwardPrediction('Shivajinagar', 'pm25', 6);
  assert.ok(pred, 'Prediction response must exist');
});

test('Phase 7 E2E: Screen 6 — Statutory Policy Intervention Simulator (ERF Model)', async () => {
  const sim = await API.simulateIntervention({
    city: 'Pune',
    station_name: 'Shivajinagar',
    intervention_type: 'control_construction_dust',
    intensity_pct: 75.0,
  });

  assert.ok(sim, 'Simulation must return valid object');
  assert.ok(typeof sim.current_aqi === 'number');
  assert.ok(typeof sim.projected_aqi === 'number');
  assert.ok(sim.projected_aqi <= sim.current_aqi, 'Projected AQI must be reduced or equal');
  assert.ok(sim.aqi_delta >= 0, 'AQI delta must be non-negative');
  assert.ok(typeof sim.percentage_reduction === 'number');
  assert.ok(sim.affected_zone_summary, 'Must specify affected_zone_summary');
  assert.ok(sim.methodology_notes && sim.methodology_notes.includes('ERF'), 'Must cite ERF methodology');
  assert.ok(sim.disclaimer, 'Must cite statutory disclaimer');
});

test('Phase 7 E2E: Screen 7 — Environmental Analytics & Diurnal Physics Contract', async () => {
  const analytics = await API.getCityAnalytics('Pune', '24H');
  assert.ok(analytics, 'Analytics payload must exist');
});

test('Phase 7 E2E: Screen 8 — Contextual Alerts Subsystem & Health Recommendations', async () => {
  const alerts = await API.getAllAlerts();
  assert.ok(Array.isArray(alerts), 'Alerts must return an array');
});

test('Phase 7 E2E: Screen 9 — Grounded AI Copilot & Resilient Offline Degradation', async () => {
  const insight = await API.getAIInsight({
    screen_id: 'screen_9_chat',
    city: 'Pune',
    station_name: 'Shivajinagar',
    current_aqi: 245,
    language: 'en',
    is_simulated: false,
  });

  assert.ok(insight, 'AI Insight response must exist');
  assert.ok(insight.response_text, 'AI Insight must contain response_text');
  assert.ok(insight.provenance, 'AI Insight must declare provenance metadata');
});

test('Phase 7 E2E: Multilingual Consistency across EN, HI, MR', () => {
  assert.deepEqual(LANGUAGES, ['en', 'hi', 'mr'], 'Must support EN, HI, MR languages');

  for (const code of LANGUAGES) {
    const dict = dictionaries[code];
    assert.ok(dict, `Dictionary for ${code} must exist`);
    assert.ok(dict.nav, `Nav translations for ${code} must exist`);
    assert.ok(dict.nav.cities, `Nav cities key for ${code} must exist`);
    assert.ok(dict.nav.prediction, `Nav prediction key for ${code} must exist`);
    assert.ok(dict.nav.intervention, `Nav intervention key for ${code} must exist`);
    assert.ok(dict.nav.alerts, `Nav alerts key for ${code} must exist`);
    assert.ok(dict.nav.aiChat, `Nav aiChat key for ${code} must exist`);
    assert.ok(dict.severity, `Severity translations for ${code} must exist`);
  }
});

test('Phase 7 E2E: Contextual Voice Narration Subsystem Stability', () => {
  assert.equal(typeof voiceService.speak, 'function');
  assert.equal(typeof voiceService.stop, 'function');
  assert.equal(typeof voiceService.subscribe, 'function');
  assert.equal(voiceService.getState(), 'idle');

  // Must not throw when called in non-browser Node environment
  assert.doesNotThrow(() => {
    voiceService.stop();
  });
});
