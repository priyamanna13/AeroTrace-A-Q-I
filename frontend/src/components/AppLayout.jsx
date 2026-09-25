import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import NavigationHeader from './NavigationHeader';
import { useI18n } from '../i18n';

export default function AppLayout() {
  const { t } = useI18n();
  const location = useLocation();
  const isLanding = location.pathname === '/' || location.pathname === '/landing';
  const isNational = location.pathname === '/national' || location.pathname === '/india';
  const isInvestigation = location.pathname.startsWith('/investigate');

  // Screen 0 (Landing) & Screen 1 (National Overview) are dedicated full-viewport single-screen experiences
  // with their own approved headers & navigation panels — render bare, no horizontal navbar/footer
  if (isLanding || isNational) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      <NavigationHeader />
      <main className="flex-1 w-full flex flex-col overflow-hidden">
        <Outlet />
      </main>
      {!isInvestigation && (
        <footer className="w-full bg-[#08080a] border-t border-zinc-900 py-4 px-4 sm:px-8 text-center text-xs text-zinc-400 font-mono flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>AeroTrace A-Q-I · Forensic Attribution Engine</span>
          </div>
          <div className="text-[11px] text-zinc-400">
            Source Transparency: CPCB CAAQMS Verified Stations + Open-Meteo Fallback Cascade
          </div>
          <div className="text-[11px] text-zinc-400">
            PJMT NGEC 2026
          </div>
        </footer>
      )}
    </div>
  );
}
