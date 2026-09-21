import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function NotFoundScreen() {
  const { t } = useI18n();
  const location = useLocation();

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="inline-block px-3 py-1 rounded-md bg-rose-950/40 border border-rose-800/50 text-rose-400 font-mono text-xs uppercase tracking-widest">
          HTTP 404 · Unmapped Coordinate
        </div>

        <h1 className="text-5xl font-black tracking-tight text-white">
          {t('common.notFoundTitle')}
        </h1>

        <p className="text-sm text-zinc-400 leading-relaxed">
          {t('common.notFoundDesc')}
        </p>

        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs font-mono text-zinc-400 break-all">
          Requested Path: <span className="text-amber-400">{location.pathname}</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors"
          >
            {t('common.returnHome')}
          </Link>
          <Link
            to="/investigate/Shivajinagar"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium text-xs transition-colors"
          >
            {t('common.goToInvestigation')}
          </Link>
        </div>
      </div>
    </div>
  );
}
