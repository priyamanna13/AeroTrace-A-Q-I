import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Screen0Landing() {
  const { t } = useI18n();

  const cities = [
    { name: 'Pune', state: 'Maharashtra', stations: 4, type: 'Forensic Baseline' },
    { name: 'Mumbai', state: 'Maharashtra', stations: 4, type: 'Coastal Airshed' },
    { name: 'Delhi', state: 'NCR', stations: 4, type: 'Northern Basin' },
    { name: 'Bengaluru', state: 'Karnataka', stations: 4, type: 'Plateau Urban' },
    { name: 'Kolkata', state: 'West Bengal', stations: 4, type: 'Delta Plains' },
    { name: 'Hyderabad', state: 'Telangana', stations: 4, type: 'Deccan Interior' },
    { name: 'Chennai', state: 'Tamil Nadu', stations: 4, type: 'Southern Coastal' },
  ];

  const journeySteps = [
    { num: '01', title: t('landing.step1Title'), desc: t('landing.step1Desc'), link: '/national', icon: '🌐' },
    { num: '02', title: t('landing.step2Title'), desc: t('landing.step2Desc'), link: '/city/Pune', icon: '🏙️' },
    { num: '03', title: t('landing.step3Title'), desc: t('landing.step3Desc'), link: '/station/Shivajinagar', icon: '📍' },
    { num: '04', title: t('landing.step4Title'), desc: t('landing.step4Desc'), link: '/investigate/Shivajinagar', icon: '🔬', highlight: true },
    { num: '05', title: t('landing.step5Title'), desc: t('landing.step5Desc'), link: '/prediction', icon: '📈' },
    { num: '06', title: t('landing.metricsIntervention'), desc: t('screen6.phaseNotice'), link: '/intervention', icon: '🛡️' },
  ];

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#08080a] text-zinc-100 flex flex-col items-center px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero Section */}
      <div className="max-w-4xl w-full text-center space-y-6 pt-4 sm:pt-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 text-xs font-semibold tracking-wide shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {t('landing.badge')}
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-zinc-200 to-zinc-500 leading-tight">
          {t('landing.heroTitle')}
        </h1>

        <p className="text-lg sm:text-xl font-medium text-emerald-400/90 max-w-2xl mx-auto">
          {t('landing.heroTagline')}
        </p>

        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          {t('landing.heroDescription')}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            to="/national"
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50 hover:scale-[1.02] active:scale-[0.98]"
          >
            {t('landing.ctaNational')}
          </Link>
          <Link
            to="/investigate/Shivajinagar"
            className="px-6 py-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 font-semibold text-sm transition-all duration-200 hover:border-zinc-500 hover:scale-[1.02] active:scale-[0.98]"
          >
            {t('landing.ctaInvestigation')}
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="max-w-5xl w-full grid grid-cols-2 md:grid-cols-4 gap-4 mt-14">
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-sm">
          <div className="text-2xl font-mono font-bold text-white">7</div>
          <div className="text-xs text-zinc-400 mt-1">{t('landing.metricsCities')}</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-sm">
          <div className="text-2xl font-mono font-bold text-emerald-400">30s</div>
          <div className="text-xs text-zinc-400 mt-1">{t('landing.metricsCadence')}</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-sm">
          <div className="text-2xl font-mono font-bold text-amber-400">Gaussian</div>
          <div className="text-xs text-zinc-400 mt-1">{t('landing.metricsAttribution')}</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-sm">
          <div className="text-2xl font-mono font-bold text-cyan-400">Sandbox</div>
          <div className="text-xs text-zinc-400 mt-1">{t('landing.metricsIntervention')}</div>
        </div>
      </div>

      {/* Spatial Journey Framework */}
      <div className="max-w-5xl w-full mt-16 space-y-6">
        <div className="border-b border-zinc-800 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🗺️</span> {t('landing.journeyTitle')}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {t('landing.journeyDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {journeySteps.map((step) => (
            <Link
              key={step.num}
              to={step.link}
              className={`p-5 rounded-xl border transition-all duration-200 block text-left group ${
                step.highlight
                  ? 'bg-zinc-900/70 border-emerald-500/40 hover:border-emerald-500 shadow-md shadow-emerald-950/20'
                  : 'bg-zinc-950/50 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{step.icon}</span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 group-hover:text-emerald-400">
                  {step.num}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-white mt-3">
                {step.title}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {step.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Initial 7 Cities Airshed Coverage */}
      <div className="max-w-5xl w-full mt-14 mb-8">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            {t('landing.targetRegionsTitle')}
          </h3>
          <span className="text-xs text-zinc-400 font-mono">{t('landing.cascadeNotice')}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {cities.map((c) => (
            <Link
              key={c.name}
              to={`/city/${c.name}`}
              className="p-3 rounded-lg bg-zinc-900/30 hover:bg-zinc-800/50 border border-zinc-800/60 hover:border-zinc-600 transition-all text-left block"
            >
              <div className="font-semibold text-xs text-zinc-200">{c.name}</div>
              <div className="text-[10px] text-zinc-400">{c.state}</div>
              <div className="text-[9px] text-emerald-400 font-mono mt-1">{c.type}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
