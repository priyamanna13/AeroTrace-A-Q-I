import React, { createContext, useMemo, useSyncExternalStore } from "react"
import { dictionaries } from "./dictionaries"
import { getLanguage, setLanguage, subscribeLanguage } from "./language-store"

const LanguageContext = createContext(null)

/**
 * ROOT-CAUSE FIX: previously each screen mounted its OWN LanguageProvider with
 * its own useState, so a language picked in the Settings drawer never reached
 * other components — and on bare screens like /investigate the Settings drawer
 * sat OUTSIDE every provider, making its setLanguage a silent no-op.
 *
 * The provider no longer holds state: it delegates to the shared language
 * store (see ./language-store), which both i18n systems consume. It is kept as
 * a component for compatibility with screens that render it.
 */
export function LanguageProvider({ children }) {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage)

  const value = useMemo(
    () => ({ language, t: dictionaries[language] || dictionaries.en, setLanguage }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

/**
 * Subscribe directly to the shared store instead of the context, so consumers
 * OUTSIDE a LanguageProvider (e.g. the Settings drawer in NavigationPanel on
 * bare routes) still get live language updates.
 */
export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage)
  return {
    language,
    t: dictionaries[language] || dictionaries.en,
    setLanguage,
  }
}
