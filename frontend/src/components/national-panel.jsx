import React, { useEffect, useState } from "react"
import { Volume2, Square } from "lucide-react"
import { CITIES, NATIONAL_AQI, severityColor, severityFor } from "@/lib/aqi"
import { useLanguage } from "@/lib/i18n/language-provider"
import { voiceService } from "@/services/voiceService"
import { useVoicePreference } from "@/hooks/use-voice-preference"
import { cn } from "@/lib/utils"

export function NationalPanel({
  activeCity,
  hoveredCity,
  onHover,
  onSelect,
}) {
  const { t } = useLanguage()
  const nationalSeverity = severityFor(NATIONAL_AQI)

  return (
    <section
      aria-labelledby="national-heading"
      className="flex flex-col gap-8 lg:h-full lg:min-h-0 lg:gap-[2.4vh]"
    >
      <div className="flex flex-col gap-4 lg:gap-[1.2vh]">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-teal">{t.kicker}</p>
        <h1
          id="national-heading"
          className="heading-primary text-balance text-4xl font-bold leading-[1.05] md:text-5xl lg:text-[clamp(1.75rem,min(5.4vh,3.6vw),3.75rem)]"
        >
          {t.heading}
        </h1>
        <p className="max-w-md border-l-2 border-copper pl-4 text-pretty text-base font-medium leading-relaxed text-muted-foreground md:text-lg lg:text-[clamp(0.8125rem,2vh,1.0625rem)] lg:leading-snug">
          {t.description}
        </p>
        <ListenControl text={t.description} />
      </div>

      {/* AQI Summary Card with explicit generous padding to keep content well inside container borders */}
      <div
        className="aqi-summary-card flex flex-col rounded-2xl border border-border bg-card shadow-sm"
        style={{
          padding: '1.75rem 2rem',
          gap: '1.25rem',
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t.overallAqi}
          </span>
          <span className="rounded-full border border-copper/50 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-copper">
            {t.demoData}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          {/* UI sans for data numerals (readability pass) — display serif stays on headings */}
          <span className="text-6xl font-bold leading-none tabular-nums md:text-7xl lg:text-[clamp(2.5rem,7.5vh,4.5rem)]">
            {NATIONAL_AQI}
          </span>
          <span className="flex items-center gap-2.5 text-lg font-semibold" style={{ color: severityColor(nationalSeverity) }}>
            <span aria-hidden="true" className="size-3 rounded-full" style={{ background: severityColor(nationalSeverity) }} />
            {t.severity[nationalSeverity]}
          </span>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground pt-1">
          <div className="flex gap-2.5">
            <dt>{t.updated}</dt>
            <dd className="text-foreground font-semibold">{t.updatedValue}</dd>
          </div>
          <div className="flex gap-2.5">
            <dt>{t.source}</dt>
            <dd className="text-foreground font-semibold">CPCB</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col lg:min-h-0 lg:flex-1">
        <div className="flex items-end justify-between gap-3 border-b border-border pb-3 lg:pb-[1vh]">
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.2em]">{t.citiesMonitored(CITIES.length)}</h2>
          <span className="text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t.demoSignals}</span>
        </div>
        <ol className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          {CITIES.map((city, index) => {
            const severity = severityFor(city.aqi)
            const highlighted = hoveredCity === city.id || activeCity === city.id
            return (
              <li key={city.id} className="border-b border-border lg:flex lg:min-h-0 lg:flex-1 lg:basis-0">
                <button
                  type="button"
                  aria-pressed={activeCity === city.id}
                  aria-label={t.map.cityAria(t.cities[city.id], city.aqi, t.severity[severity])}
                  onMouseEnter={() => onHover(city.id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(city.id)}
                  onBlur={() => onHover(null)}
                  onClick={() => onSelect(city.id)}
                  className={cn(
                    "group flex w-full items-center gap-4 px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring lg:max-h-12 lg:py-0 lg:text-[clamp(0.8125rem,2vh,1rem)]",
                    highlighted ? "bg-muted" : "hover:bg-muted",
                  )}
                >
                  <span className="w-6 font-mono text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  <span className="flex-1 font-semibold">{t.cities[city.id]}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{t.severity[severity]}</span>
                  <span className="w-10 text-right text-sm font-semibold tabular-nums">{city.aqi}</span>
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: severityColor(severity) }} />
                </button>
              </li>
            )
          })}
        </ol>
        <p className="pt-3 text-xs leading-relaxed text-muted-foreground lg:shrink-0 lg:pt-[1vh] lg:text-[11px] lg:leading-snug">
          {t.dataNote}
        </p>
      </div>
    </section>
  )
}

/**
 * ListenControl — compact editorial read-aloud button for descriptive content.
 * Reuses the existing voiceService (Web Speech API, en-IN/hi-IN/mr-IN).
 * Fails gracefully (disabled + tooltip) when TTS is unavailable.
 */
export function ListenControl({ text, disabled = false, lang, className = "listen-control mt-3 self-start", style }) {
  const { t, language: contextLanguage } = useLanguage()
  const { enabled } = useVoicePreference()
  const [voiceState, setVoiceState] = useState("idle")
  const supported = typeof window !== "undefined" && Boolean(window.speechSynthesis)

  useEffect(() => {
    const unsubscribe = voiceService.subscribe((state) => setVoiceState(state))
    return () => {
      unsubscribe()
    }
  }, [])

  // The voice language follows the CURRENTLY DISPLAYED insight (explicit lang prop
  // wins; otherwise the global language context). Display and speech never diverge.
  const language = lang || contextLanguage
  const playing = voiceState === "playing" || voiceState === "loading"
  const active = playing && enabled
  const cannotSpeak = disabled || !text

  const handleToggle = () => {
    if (active) {
      voiceService.stop()
    } else if (enabled && !cannotSpeak) {
      voiceService.speak(text, { lang: language })
    }
  }

  const cs = t.cityScreen || {}

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={!supported || !enabled || cannotSpeak}
      title={!supported ? cs.voiceUnavailable || "Read-aloud unavailable" : !enabled ? cs.voiceOffNote || "Voice read-aloud is off — enable it in Settings" : undefined}
      data-state={active ? "playing" : "idle"}
      aria-label={active ? cs.stop || "Stop" : cs.listen || "Listen"}
      className={className}
      style={style}
    >
      {active ? (
        <Square aria-hidden="true" className="size-3" />
      ) : (
        <Volume2 aria-hidden="true" className="size-3.5" />
      )}
      {active ? cs.stop || "Stop" : cs.listen || "Listen"}
    </button>
  )
}

/**
 * VoicePreferenceSelect — Settings control for read-aloud on/off.
 * Reuses the GlideSelect visual language and the persisted voice preference hook.
 */
export function VoicePreferenceSelect() {
  const { t } = useLanguage()
  const { pref, setPref } = useVoicePreference()
  const cs = t.cityScreen || {}

  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {cs.voicePref || "Voice Read-aloud"}
      </span>
      <div role="radiogroup" aria-label={cs.voicePref || "Voice Read-aloud"} className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/60 p-1.5">
        {["on", "off"].map((value) => {
          const selected = pref === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPref(value)}
              className={cn(
                "min-h-9 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "on" ? cs.voiceOn || "On" : cs.voiceOff || "Off"}
            </button>
          )
        })}
      </div>
    </div>
  )
}
