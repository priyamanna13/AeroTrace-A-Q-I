import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS, LANG_OPTIONS, SOURCE_NAME_I18N, PRE_ALERT_ADVISORIES_I18N } from './translations';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem('aerotrace_lang');
      if (saved && ['en', 'hi', 'mr'].includes(saved)) {
        return saved;
      }
    } catch (_) {}
    return 'en';
  });

  const setLang = (newLang) => {
    if (!['en', 'hi', 'mr'].includes(newLang)) return;
    setLangState(newLang);
    try {
      localStorage.setItem('aerotrace_lang', newLang);
      document.documentElement.lang = newLang;
    } catch (_) {}
  };

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch (_) {}
  }, [lang]);

  /**
   * Translates a dot-notated key path (e.g. 'nav.brand', 'common.live')
   */
  const t = (keyPath, fallback = '') => {
    if (!keyPath) return fallback;
    const parts = keyPath.split('.');
    let current = TRANSLATIONS[lang];
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        // Fallback to English
        let enCurrent = TRANSLATIONS.en;
        for (const enPart of parts) {
          if (enCurrent && typeof enCurrent === 'object' && enPart in enCurrent) {
            enCurrent = enCurrent[enPart];
          } else {
            return fallback || keyPath;
          }
        }
        return enCurrent || fallback || keyPath;
      }
    }
    return typeof current === 'string' ? current : (fallback || keyPath);
  };

  const translateSourceName = (name) => {
    if (!name || lang === 'en') return name;
    if (SOURCE_NAME_I18N[name]?.[lang]) return SOURCE_NAME_I18N[name][lang];
    for (const [key, translations] of Object.entries(SOURCE_NAME_I18N)) {
      if (name.includes(key) || key.includes(name)) {
        if (translations[lang]) return translations[lang];
      }
    }
    return name;
  };

  const translateAdvisory = (text) => {
    if (!text || lang === 'en') return text;
    if (PRE_ALERT_ADVISORIES_I18N[text]?.[lang]) {
      return PRE_ALERT_ADVISORIES_I18N[text][lang];
    }
    return text;
  };

  const value = {
    lang,
    setLang,
    t,
    languages: LANG_OPTIONS,
    translateSourceName,
    translateAdvisory,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
