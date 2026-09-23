import { TRANSLATIONS, LANG_OPTIONS } from '../frontend/src/i18n/translations.js';
import { API } from '../frontend/src/api_client.js';
import { voiceService } from '../frontend/src/services/voiceService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('\n--- 1. Testing I18N Dictionaries & Language Support ---');
assert(LANG_OPTIONS.length === 3, '3 languages configured (EN, HI, MR)');
const requiredLangs = ['en', 'hi', 'mr'];
for (const l of requiredLangs) {
  assert(Boolean(TRANSLATIONS[l]), `Language dictionary exists: ${l}`);
  assert(Boolean(TRANSLATIONS[l]?.nav?.brand), `Nav brand exists for ${l}`);
  assert(Boolean(TRANSLATIONS[l]?.screen1?.title), `Screen 1 title exists for ${l}`);
  assert(Boolean(TRANSLATIONS[l]?.screen2?.verifiedStations), `Screen 2 verifiedStations exists for ${l}`);
  assert(Boolean(TRANSLATIONS[l]?.screen3?.titleSuffix), `Screen 3 titleSuffix exists for ${l}`);
  assert(Boolean(TRANSLATIONS[l]?.common?.categories?.Moderate), `Common category Moderate exists for ${l}`);
}

console.log('\n--- 2. Testing 7 Target Cities & Station Integrity ---');
const cities = await API.getCities();
assert(Array.isArray(cities) && cities.length === 7, `Expected 7 target cities, got ${cities?.length}`);

const expectedCities = ['Bengaluru', 'Chennai', 'Delhi', 'Hyderabad', 'Kolkata', 'Mumbai', 'Pune'];
for (const cityName of expectedCities) {
  const cityFound = cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
  assert(Boolean(cityFound), `City entry present in getCities(): ${cityName}`);
  
  const stations = await API.getCityStations(cityName);
  assert(Array.isArray(stations) && stations.length > 0, `${cityName} has ${stations?.length} verified stations`);
  
  for (const st of stations) {
    assert(Boolean(st.name && st.station_id), `Station has valid name & ID: ${cityName} -> ${st.name} (${st.station_id})`);
    assert(Array.isArray(st.coordinates) && st.coordinates.length === 2, `Station ${st.name} has valid coordinates: [${st.coordinates}]`);
    assert(Boolean(st.current_aqi && st.dominant_pollutant), `Station ${st.name} has AQI ${st.current_aqi} (${st.dominant_pollutant})`);
  }
}

console.log('\n--- 3. Testing City Overview Contract ---');
for (const cityName of ['Mumbai', 'Pune', 'Delhi']) {
  const overview = await API.getCityOverview(cityName);
  assert(overview?.city?.toLowerCase() === cityName.toLowerCase(), `Overview returned for ${cityName}`);
  assert(typeof overview?.current_aqi === 'number', `${cityName} mean AQI is number: ${overview?.current_aqi}`);
  assert(overview?.station_count > 0, `${cityName} station count > 0 (${overview?.station_count})`);
}

console.log('\n--- 4. Testing AI Service & Voice Integration ---');
assert(typeof voiceService.speak === 'function', 'voiceService.speak() is a function');
assert(typeof voiceService.stop === 'function', 'voiceService.stop() is a function');
assert(voiceService.getState() === 'idle', `voiceService initial state is 'idle' (got ${voiceService.getState()})`);

const insight = await API.getAIInsight({ screen_id: 'screen_2', city: 'Mumbai', current_aqi: 145 });
assert(Boolean(insight?.response_text), 'AI insight returns response_text');
assert(Boolean(insight?.provenance), `AI insight returns provenance: ${insight?.provenance}`);

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
