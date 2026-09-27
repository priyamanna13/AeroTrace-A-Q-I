// ─── SHARED LANGUAGE STORE ────────────────────────────────────────────────────
// Single source of truth for the app language (en/hi/mr).
//
// ROOT-CAUSE FIX: the app previously had TWO independent language states —
// the legacy `useI18n` (I18nProvider at the App root, localStorage) and the
// newer `useLanguage` (per-screen LanguageProviders, cookie). The Settings
// drawer in NavigationPanel renders OUTSIDE every LanguageProvider on bare
// screens like /investigate, so its setLanguage was the no-op fallback and
// clicking हिन्दी/मराठी did nothing.
//
// Both systems now delegate to this module-level store (same pattern as the
// voice preference store), so a language change from ANY selector — Settings
// drawer, forensic panel EN/हिं/मर switch, legacy header — propagates live to
// every consumer without a page refresh.

const LISTENERS = new Set()
const LANGUAGES = ['en', 'hi', 'mr']
const LEGACY_KEY = 'aerotrace_lang' // legacy I18nContext localStorage key
const COOKIE_KEY = 'aerotrace-lang' // newer LanguageProvider cookie key

function readStored() {
  try {
    const saved = localStorage.getItem(LEGACY_KEY)
    if (saved && LANGUAGES.includes(saved)) return saved
  } catch (_) {}
  try {
    const match = document.cookie.match(new RegExp(`(^| )${COOKIE_KEY}=([^;]+)`))
    if (match && LANGUAGES.includes(match[2])) return match[2]
  } catch (_) {}
  return 'en'
}

let currentLanguage = readStored()

// Reflect the restored language on <html> as early as possible.
try {
  document.documentElement.lang = currentLanguage
} catch (_) {}

export function getLanguage() {
  return currentLanguage
}

export function subscribeLanguage(listener) {
  LISTENERS.add(listener)
  return () => LISTENERS.delete(listener)
}

export function setLanguage(next) {
  if (!LANGUAGES.includes(next) || next === currentLanguage) return
  currentLanguage = next
  try {
    localStorage.setItem(LEGACY_KEY, next)
    document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = next
  } catch (_) {}
  LISTENERS.forEach((listener) => listener())
}
