import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import GlideSelect from './GlideSelect';

/**
 * LandingHamburgerMenu — Top-right compact settings dropdown matching Figma
 * Contains ONLY:
 * 1. Appearance (Dark / Light)
 * 2. System Language (EN / HI / MR with GlideSelect)
 * 3. Live Map -> navigates to Screen 01 (/national)
 */
export default function LandingHamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [appearance, setAppearance] = useState('dark');
  const { lang, setLang } = useI18n();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const languageOptions = [
    { label: 'EN', value: 'en' },
    { label: 'HI', value: 'hi' },
    { label: 'MR', value: 'mr' },
  ];

  return (
    <div ref={menuRef} className="absolute top-6 right-6 sm:top-8 sm:right-10 z-50">
      {/* Hamburger Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Menu"
        aria-expanded={isOpen}
        className="w-10 h-10 rounded-lg bg-[#191A1E]/80 hover:bg-[#23242A] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-all duration-150 backdrop-blur-md shadow-lg active:scale-95"
      >
        {isOpen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Floating Settings Dropdown matching Figma */}
      {isOpen && (
        <div
          style={{
            background: 'rgba(25, 26, 30, 0.95)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          }}
          className="absolute right-0 mt-3 w-64 p-4 rounded-2xl backdrop-blur-xl border border-white/10 text-zinc-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Section 1: Appearance */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              APPEARANCE
            </div>
            <div className="flex bg-[#131417] p-1 rounded-lg border border-white/5">
              <button
                type="button"
                onClick={() => setAppearance('dark')}
                className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-colors ${
                  appearance === 'dark'
                    ? 'bg-[#2A2B30] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setAppearance('light')}
                className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-colors ${
                  appearance === 'light'
                    ? 'bg-[#2A2B30] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Light
              </button>
            </div>
          </div>

          {/* Section 2: System Language */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              SYSTEM LANGUAGE
            </div>
            <GlideSelect
              options={languageOptions}
              value={lang}
              onChange={(newLang) => setLang(newLang)}
            />
          </div>

          {/* Section 3: Live Map Navigation */}
          <div className="border-t border-white/5 pt-3">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/national');
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group text-left"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#C96A4A] shadow-[0_0_8px_#C96A4A] animate-pulse" />
                <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                  Live Map
                </span>
              </div>
              <span className="text-[11px] font-mono font-medium text-[#C96A4A] group-hover:underline">
                Screen 01
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
