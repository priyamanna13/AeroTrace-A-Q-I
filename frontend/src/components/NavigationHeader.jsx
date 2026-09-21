import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function NavigationHeader() {
  const { lang, setLang, t, languages } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: '/', label: t('nav.landing'), exact: true },
    { to: '/national', label: t('nav.national') },
    { to: '/city/Pune', label: t('nav.city') },
    { to: '/station/Shivajinagar', label: t('nav.station') },
    { to: '/investigate/Shivajinagar', label: t('nav.investigation'), highlight: true },
    { to: '/prediction', label: t('nav.prediction') },
    { to: '/intervention', label: t('nav.intervention') },
    { to: '/analytics', label: t('nav.analytics') },
    { to: '/alerts', label: t('nav.alerts') },
    { to: '/ai', label: t('nav.ai') },
  ];

  return (
    <header className="w-full bg-[#08080a] border-b border-zinc-800/80 sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-sm group-hover:bg-emerald-500/20 transition-colors">
              AQ
            </div>
            <div>
              <span className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center gap-1.5">
                AeroTrace <span className="text-emerald-400 font-mono text-xs px-1 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">A-Q-I</span>
              </span>
              <span className="hidden sm:block text-[10px] text-zinc-400 tracking-wide font-medium">
                PJMT NGEC 2026
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden xl:flex items-center gap-1 overflow-x-auto no-scrollbar py-1" aria-label="Main Navigation">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.exact}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? link.highlight
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'bg-zinc-800 text-white border border-zinc-700'
                    : link.highlight
                      ? 'text-emerald-400/90 hover:bg-emerald-950/30 hover:text-emerald-300'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Section: Cadence Badge + Language Switcher + Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Live Cadence Indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>30s Refresh</span>
          </div>

          {/* Language Switcher */}
          <div
            className="flex items-center rounded-lg p-0.5 bg-zinc-900 border border-zinc-800"
            role="group"
            aria-label="Language selection"
          >
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                aria-pressed={lang === l.code}
                className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                  lang === l.code
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title={l.label}
              >
                {l.short}
              </button>
            ))}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#0a0a0d] border-b border-zinc-800 px-4 pt-2 pb-4 space-y-1">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60 text-xs text-zinc-400 font-mono">
            <span>AeroTrace Navigation</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              30s Cadence
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.exact}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-xs font-medium block ${
                    isActive
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
