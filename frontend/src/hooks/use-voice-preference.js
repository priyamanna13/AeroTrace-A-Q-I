import { useCallback, useEffect, useSyncExternalStore } from "react"
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

// ── ONE shared preference store ──────────────────────────────────────────────
// Previously every useVoicePreference() call created its own useState copy, so
// toggling Voice in Settings only updated that component's copy — Listen
// controls elsewhere kept a stale snapshot until a full page reload. All hook
// consumers now subscribe to this single store via useSyncExternalStore, so a
// Settings change re-renders EVERY Listen control (and Settings) in one commit.
let currentPref = typeof window !== "undefined" ? readVoicePreference() : "on"
const listeners = new Set()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

function setSharedPref(next) {
  if (next !== "on" && next !== "off") return
  if (next === currentPref) return
  currentPref = next
  try {
    localStorage.setItem(VOICE_PREF_KEY, next)
  } catch (_) {}
  notifyListeners()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return currentPref
}

/**
 * useVoicePreference — persisted Voice Preference (read-aloud on/off).
 * Reuses the existing voiceService + localStorage pattern (aerotrace-theme /
 * aerotrace-lang). 'off' stops any active speech and blocks new speak() calls
 * from Listen controls. No backend involved.
 */
export function useVoicePreference() {
  const pref = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (pref === "off") {
      voiceService.stop()
    }
  }, [pref])

  const setPref = useCallback((next) => {
    setSharedPref(next)
  }, [])

  return { pref, setPref, enabled: pref === "on" }
}
