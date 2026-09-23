import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider } from './i18n';
import AppLayout from './components/AppLayout';

// Screen Components
import Screen0Landing from './screens/Screen0Landing';
import Screen1NationalOverview from './screens/Screen1NationalOverview';
import Screen2CityIntelligence from './screens/Screen2CityIntelligence';
import Screen3StationIntelligence from './screens/Screen3StationIntelligence';
import Screen4PollutionInvestigation from './screens/Screen4PollutionInvestigation';
import Screen5Prediction from './screens/Screen5Prediction';
import Screen6Intervention from './screens/Screen6Intervention';
import Screen7Analytics from './screens/Screen7Analytics';
import Screen8Alerts from './screens/Screen8Alerts';
import Screen9AiAssistant from './screens/Screen9AiAssistant';
import NotFoundScreen from './screens/NotFoundScreen';

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            {/* Screen 0: Landing Page Overview */}
            <Route index element={<Screen0Landing />} />
            <Route path="/landing" element={<Navigate to="/" replace />} />

            {/* Screen 1: India Map / National Overview */}
            <Route path="/national" element={<Screen1NationalOverview />} />
            <Route path="/india" element={<Navigate to="/national" replace />} />

            {/* Screen 2: City Intelligence */}
            <Route path="/city" element={<Navigate to="/city/Pune" replace />} />
            <Route path="/city/:cityName" element={<Screen2CityIntelligence />} />

            {/* Screen 3: Station Intelligence */}
            <Route path="/station" element={<Navigate to="/station/Shivajinagar" replace />} />
            <Route path="/station/:stationId" element={<Screen3StationIntelligence />} />

            {/* Screen 4: Pollution Forensic Investigation (Preserved Baseline Engine) */}
            <Route path="/investigate" element={<Navigate to="/investigate/Shivajinagar" replace />} />
            <Route path="/investigate/:stationId" element={<Screen4PollutionInvestigation />} />

            {/* Screen 5: Prediction & Atmospheric Dispersion */}
            <Route path="/prediction" element={<Screen5Prediction />} />

            {/* Screen 6: Impact & Policy Intervention */}
            <Route path="/intervention" element={<Screen6Intervention />} />

            {/* Screen 7: Analytics & Trends (Phase 3 Anish/Priya) */}
            <Route path="/analytics" element={<Screen7Analytics />} />

            {/* Screen 8: Alerts Feed (Phase 3 Anish) */}
            <Route path="/alerts" element={<Screen8Alerts />} />

            {/* Screen 9: AI Environmental Intelligence (Phase 5 Anish) */}
            <Route path="/ai" element={<Screen9AiAssistant />} />

            {/* 404 Not Found Catch-All */}
            <Route path="*" element={<NotFoundScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
