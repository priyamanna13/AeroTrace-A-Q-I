import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import AiInsightCard from '../components/ai/AiInsightCard';

export default function Screen7Analytics() {
  const { t, lang } = useI18n();

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <Link to="/" className="hover:text-zinc-200">{t('nav.breadcrumbHome')}</Link>
          <span>/</span>
          <span className="text-emerald-400">{t('nav.analytics')}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              {t('screen7.tag')}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {t('screen7.title')}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
              Phase 1 Routing Skeleton
            </span>
            <span className="px-2.5 py-1 rounded bg-indigo-950/40 border border-indigo-800/40 text-indigo-400 font-mono">
              Phase 3 Milestone (Anish & Priya)
            </span>
          </div>
        </div>

        {/* Ownership Notice */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
          <span className="text-lg">📊</span>
          <div>
            <span className="font-semibold text-zinc-200">Phase 3 Deliverable:</span> {t('screen7.phaseNotice')}
          </div>
        </div>

        {/* AI Insight Card */}
        <AiInsightCard
          context={{
            screen_id: 'screen_7',
            city: 'Pune',
            range: '24H',
            language: lang,
            provenance: 'sensor_measurement',
          }}
        />
      </div>
    </div>
  );
}
