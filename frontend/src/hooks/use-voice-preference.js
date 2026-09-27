import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { createElement } from "react"
import { voiceService } from "@/services/voiceService"

const VOICE_PREF_KEY = "aerotrace-voice"

/** Read the persisted read-aloud preference ('on' | 'off'). Defaults to 'on'. */
export function readVoicePreference() {
  try {
    return localStorage.getItem(VOICE_PREF_KEY) === "off" ? "off" : "on"
  } catch {
    return "on"
  }
}

/*
 * Voice preference is a CONTEXT, not per-component state. Previously every
 * ListenControl and the Settings toggle each held their own useState copy, so
 * toggling Settings never reached already-mounted Listen buttons (they only
 * picked it up after a remount/refresh). One provider = one shared value.
 */
const VoicePreferenceContext = createContext(null)

export function VoicePreferenceProvider({ children }) {
  const [pref, setPrefState] = useState(readVoicePreference)

  useEffect(() => {
    if (pref === "off") {
      voiceService.stop()
    }
  }, [pref])

  const setPref = useCallback((next) => {
    setPrefState(next)
    try {
      localStorage.setItem(VOICE_PREF_KEY, next)
    } catch {
      /* storage unavailable — preference stays session-only */
    }
  }, [])

  const value = useMemo(() => ({ pref, setPref, enabled: pref === "on" }), [pref, setPref])

  return createElement(VoicePreferenceContext.Provider, { value }, children)
}

export function useVoicePreference() {
  // Fall back to a local instance when no provider is mounted (e.g. isolated
  // tests / legacy pages) so the hook keeps working everywhere.
  const ctx = useContext(VoicePreferenceContext)
  const [localPref, setLocalPrefState] = useState(readVoicePreference)

  useEffect(() => {
    if (ctx) return
    if (localPref === "off") {
      voiceService.stop()
    }
  }, [ctx, localPref])

  const setLocalPref = useCallback((next) => {
    setLocalPrefState(next)
    try {
      localStorage.setItem(VOICE_PREF_KEY, next)
    } catch {
      /* storage unavailable — preference stays session-only */
    }
  }, [])

  if (ctx) return ctx
  return { pref: localPref, setPref: setLocalPref, enabled: localPref === "on" }
}
