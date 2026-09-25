import React, { createContext, useCallback, useContext, useMemo, useState } from "react"
import { dictionaries, LANGUAGE_COOKIE } from "./dictionaries"

const LanguageContext = createContext(null)

export function LanguageProvider({
  initialLanguage = "en",
  children,
}) {
  const [language, setLanguageState] = useState(() => {
    try {
      const match = document.cookie.match(new RegExp(`(^| )${LANGUAGE_COOKIE}=([^;]+)`))
      if (match && dictionaries[match[2]]) return match[2]
    } catch (_) {}
    return initialLanguage
  })

  const setLanguage = useCallback((next) => {
    setLanguageState(next)
    try {
      document.documentElement.lang = next
      document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    } catch (_) {}
  }, [])

  const value = useMemo(
    () => ({ language, t: dictionaries[language] || dictionaries.en, setLanguage }),
    [language, setLanguage],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    return {
      language: "en",
      t: dictionaries.en,
      setLanguage: () => {},
    }
  }
  return context
}
