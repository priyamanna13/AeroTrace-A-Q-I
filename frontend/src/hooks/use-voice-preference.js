import { useCallback, useEffect, useState } from "react"
import { voiceService } from "@/services/voiceService"

const VOICE_PREF_KEY = "aerotrace-voice"

/** Read the persisted read-aloud preference ('on' | 'off'). Defaults to 'on'. */
export function readVoicePreference() {
  try {
    return localStorage.getItem(VOICE_PREF_KEY) === "off" ? "off" : "on"
  } catch (_) {
    return "on"
  }
}

/**
 * useVoicePreference — persisted Voice Preference (read-aloud on/off).
 * Reuses the existing voiceService + localStorage pattern (aerotrace-theme /
 * aerotrace-lang). 'off' stops any active speech and blocks new speak() calls
 * from Listen controls. No backend involved.
 */
export function useVoicePreference() {
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
    } catch (_) {}
  }, [])

  return { pref, setPref, enabled: pref === "on" }
}
