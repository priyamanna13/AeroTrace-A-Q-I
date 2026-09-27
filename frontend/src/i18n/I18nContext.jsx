import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { TRANSLATIONS, LANG_OPTIONS, SOURCE_NAME_I18N, PRE_ALERT_ADVISORIES_I18N } from './translations';
import { getLanguage, setLanguage, subscribeLanguage } from '../lib/i18n/language-store';

const I18nContext = createContext(null);

/**
 * ROOT-CAUSE FIX: this legacy provider used to own a SECOND language state
 * (localStorage) parallel to the newer LanguageProvider (cookie). The two
 * never synchronized — changing language in Settings (useLanguage) did not
 * affect this system and vice versa, and the Settings drawer's selector was a
 * no-op on bare screens with no provider above it.
 *
 * Both systems now delegate to the shared language store. The provider keeps
 * the context shape for existing consumers but holds no state of its own.
 */
export function I18nProvider({ children }) {
  const lang = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);

  const value = useMemo(() => {
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

    return {
      lang,
      setLang: setLanguage,
      t,
      languages: LANG_OPTIONS,
      translateSourceName,
      translateAdvisory,
    };
  }, [lang]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Store-backed fallback so components outside the provider still work.
    const lang = getLanguage();
    return {
      lang,
      setLang: setLanguage,
      t: (keyPath, fallback = '') => fallback || keyPath,
      languages: LANG_OPTIONS,
      translateSourceName: (name) => name,
      translateAdvisory: (text) => text,
    };
  }
  return context;
}
