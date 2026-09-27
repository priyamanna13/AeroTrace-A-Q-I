import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Mic, Send } from "lucide-react"
import { BrandMark } from "@/components/site-header"
import { NavigationPanel } from "@/components/navigation-panel"
import { CitySelector } from "@/components/city/CitySelector"
import { ListenControl } from "@/components/national-panel"
import { API } from "@/api_client"
import { CITY_IDS, cityEnName, severityColor, severityFor } from "@/lib/aqi"
import { askAssistant, PROVENANCE } from "@/lib/ai-assistant"
import { LanguageProvider, useLanguage } from "@/lib/i18n/language-provider"
import { cn } from "@/lib/utils"

const REFRESH_MS = 30000

/* ── Provenance badge — controlled severity color, minimal borders ──────── */

const PROV_STYLE = {
  [PROVENANCE.observed]: { color: "text-teal", border: "border-teal/40", key: "provObserved", note: "provNoteObserved" },
  [PROVENANCE.derived]: { color: "text-foreground/80", border: "border-border", key: "provDerived", note: "provNoteDerived" },
  [PROVENANCE.prediction]: { color: "text-copper", border: "border-copper/40", key: "provPrediction", note: "provNotePrediction" },
}

function ProvenanceBadge({ provenance, a }) {
  const style = PROV_STYLE[provenance] || PROV_STYLE[PROVENANCE.derived]
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em]",
        style.color,
        style.border,
      )}
    >
      {a[style.key]}
    </span>
  )
}

/* ── AI response — structured, compact, NOT a giant bubble ──────────────── */

function AiResponse({ message, a }) {
  return (
    <div className="max-w-[36rem]">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {a.aiTag}
        </span>
        <ProvenanceBadge provenance={message.provenance} a={a} />
      </div>
      <p className="mt-1.5 border-l-2 border-border pl-3 text-sm leading-relaxed text-foreground/90">
        {message.content}
      </p>
      <div className="mt-2">
        <ListenControl text={message.content} lang={message.lang} className="listen-control self-start" />
      </div>
    </div>
  )
}

/* ── Screen content ──────────────────────────────────────────────────────── */

function AiContent() {
  const params = useParams()
  const navigate = useNavigate()
  const { t, language } = useLanguage()
  const a = t.aiScreen

  const rawCity = String(params.cityName || "pune").toLowerCase()
  const cityId = CITY_IDS.includes(rawCity) ? rawCity : "pune"
  const cityNameLabel = cityEnName(cityId)

  // Stations are stored together with the city they belong to, so switching
  // cities immediately drops stale stations instead of flashing the previous
  // city's list under the new name (glitch seen on city switch).
  const [stationData, setStationData] = useState({ city: null, list: [] })
  const [stationName, setStationName] = useState(null)

  // One isolated refresh cycle per city — same pattern as Screens 5/8.
  // No synchronous setState in the effect body: the fetch resolves into a
  // callback, so the first paint renders the empty/context-less state.
  useEffect(() => {
    let isMounted = true
    const load = () => {
      API.getCityStations(cityNameLabel)
        .then((list) => {
          if (!isMounted) return
          setStationData({ city: cityNameLabel, list: Array.isArray(list) ? list : [] })
        })
        .catch(() => {
          if (!isMounted) return
          setStationData({ city: cityNameLabel, list: [] })
        })
    }
    load()
    const interval = setInterval(load, REFRESH_MS)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [cityNameLabel])

  const stations = useMemo(
    () => (stationData.city === cityNameLabel ? stationData.list : []),
    [stationData, cityNameLabel],
  )

  const station = useMemo(() => {
    if (stationName) {
      const match = stations.find((s) => s.name === stationName)
      if (match) return match
    }
    return stations[0] || null
  }, [stations, stationName])

  const stationOptions = useMemo(
    () => stations.map((s) => ({ value: s.name, label: s.name })),
    [stations],
  )

  // Context bar — always reflects the current city/station/AQI/pollutant.
  const contextAqi = station?.current_aqi != null ? Math.round(Number(station.current_aqi)) : null

  // ── Conversation state. Messages carry their language + provenance so the
  // transcript stays stable across language switches (each turn re-renders in
  // the language it was given, and Listen reads exactly what is displayed).
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const micSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  const [micState, setMicState] = useState("idle") // idle | listening
  const recognitionRef = useRef(null)
  const scrollRef = useRef(null)

  // Auto-scroll to the latest turn.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  const ask = (question) => {
    const q = String(question || "").trim()
    if (!q || thinking) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: q, lang: language }])
    setThinking(true)
    // Small delay so the loading state is perceivable; the answer itself is
    // computed from the already-loaded station context (no invented data).
    setTimeout(() => {
      const answer = askAssistant({ question: q, cityName: cityNameLabel, station, stations, t })
      setMessages((prev) => [...prev, { role: "assistant", ...answer, lang: language }])
      setThinking(false)
    }, 650)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    ask(input)
  }

  // Voice input — browser SpeechRecognition. `ask` lives in a ref so the
  // recognition callbacks always invoke the latest context without re-binding.
  const askRef = useRef(null)
  useEffect(() => {
    askRef.current = ask
  })

  useEffect(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) return undefined
    const rec = new SR()
    rec.lang = language === "hi" ? "hi-IN" : language === "mr" ? "mr-IN" : "en-IN"
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (event) => {
      const said = event.results?.[0]?.[0]?.transcript
      if (said) askRef.current?.(said)
    }
    rec.onend = () => setMicState((s) => (s === "listening" ? "idle" : s))
    rec.onerror = () => setMicState("idle")
    recognitionRef.current = rec
    return () => {
      try { rec.abort() } catch { /* noop */ }
      recognitionRef.current = null
    }
  }, [language])

  const toggleMic = () => {
    const rec = recognitionRef.current
    if (!rec) return
    if (micState === "listening") {
      rec.stop()
      setMicState("idle")
    } else {
      try { rec.start(); setMicState("listening") } catch { setMicState("idle") }
    }
  }

  const empty = messages.length === 0

  return (
    /* Full-viewport workspace: the page itself never scrolls — only the
       conversation transcript scrolls internally (spec §14). */
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* ── Global header: BrandMark + hamburger, NO horizontal navbar ── */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-4 lg:px-10">
        <div className="pointer-events-auto">
          <BrandMark />
        </div>
        <div className="pointer-events-auto">
          <NavigationPanel onSelectCity={(id) => navigate(`/city/${id}`)} />
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[880px] flex-1 flex-col px-5 pb-4 pt-1 sm:px-8">
        {/* ── Page introduction (compact so 100% zoom fits laptop viewports) ── */}
        <div className="flex flex-col gap-1" style={{ paddingTop: "clamp(4.25rem, 6vh, 4.75rem)" }}>
          <h1 className="heading-primary text-3xl font-bold leading-[1.05] md:text-4xl">{a.title}</h1>
          <p className="max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
            {a.description}
          </p>
        </div>

        {/* ── Context bar — FIXED 3-row structure, identical for every city ──
              Row 1: CONTEXT label + city selector
              Row 2: station pills (own full-width row, horizontal scroll)
              Row 3: LIVE DATA chip + AQI readout
              Placement no longer depends on city/station name lengths. */}
        <div className="mt-4 rounded-2xl border border-border bg-card/50 p-3">
          {/* Row 1 — city */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {a.contextLabel}
            </span>
            <CitySelector cityId={cityId} onChange={(id) => navigate(`/ai/${id}`)} />
          </div>

          {/* Row 2 — stations: single-line strip, scrolls horizontally when long */}
          {stationOptions.length > 0 && (
              <div
                role="radiogroup"
                aria-label={a.stationLabel}
                className="no-scrollbar mt-2 flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-muted/60 p-1"
              >
                {stationOptions.map((opt) => {
                  const selected = (station?.name || stationOptions[0]?.value) === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setStationName(opt.value)}
                      className={cn(
                        "shrink-0 whitespace-nowrap rounded-lg px-3 py-1 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}

          {/* Row 3 — live chip + AQI readout, always bottom-left */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-2">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-teal">
              <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-teal" />
              {a.liveChip}
            </span>
            {contextAqi != null && (
              <span className="font-mono text-xs font-semibold tabular-nums" style={{ color: severityColor(severityFor(contextAqi)) }}>
                AQI {contextAqi} · PM2.5 {station?.pollutants?.pm25 ?? "—"} µg/m³
              </span>
            )}
          </div>
        </div>

        {/* ── Conversation workspace — absorbs remaining viewport height ── */}
        <section aria-label={a.workspaceLabel} className="mt-4 flex min-h-0 flex-1 flex-col">
          {empty ? (
            /* ── Empty state — restrained, AeroTrace identity. Auto-margin
               centering: content stays vertically centered when there is room,
               and scrolls internally (never clipped, never the page) when the
               viewport is short. ── */
            <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto py-4 text-center">
              <img src="/images/logo.png" alt="" className="my-auto size-10 shrink-0 object-contain" />
              <h2 className="heading-primary mb-auto mt-1.5 text-base md:text-lg">{a.emptyTitle}</h2>
              <p className="mt-1 max-w-md shrink-0 text-[13px] leading-relaxed text-muted-foreground">
                {a.emptyLine1}
                <br />
                {a.emptyLine2}
              </p>
              <p className="mt-3 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {a.starterHeading}
              </p>
              <div className="mb-auto mt-2 flex max-w-lg flex-wrap justify-center gap-2">
                {a.starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm font-medium text-foreground/90 transition-colors hover:border-teal/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Transcript — user right, AI left, scrollable ── */
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[28rem] rounded-2xl rounded-tr-sm bg-muted/70 px-4 py-2.5 text-sm font-medium text-foreground">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <AiResponse key={i} message={m} a={a} />
                ),
              )}
              {thinking && (
                <div className="max-w-[36rem]" role="status">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {a.aiTag}
                  </span>
                  <p className="mt-1.5 flex items-center gap-2 border-l-2 border-border pl-3 text-sm text-muted-foreground">
                    <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-teal" />
                    {a.loading}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Quick context actions — question generators, not navigation ── */}
          <div className="mt-3 flex shrink-0 flex-wrap gap-2">
            {a.quickActions.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => ask(a.quickQuestions[i])}
                className="rounded-lg border border-border bg-card/40 px-3 py-1.5 font-mono text-[11px] font-semibold text-muted-foreground transition-colors hover:border-teal/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Chat input — multi-line, voice, send ── */}
          <form onSubmit={handleSubmit} className="mt-2.5 shrink-0 rounded-2xl border border-border bg-card/60 p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              rows={1}
              placeholder={a.inputPlaceholder}
              aria-label={a.inputAria}
              className="max-h-32 w-full resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-2">
              <span className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {micState === "listening" ? a.micListening : !micSupported ? a.micUnavailable : ""}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={a.micAria}
                  title={!micSupported ? a.micUnavailable : undefined}
                  disabled={!micSupported || thinking}
                  className={cn(
                    "grid size-9 place-items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    micState === "listening"
                      ? "border-teal bg-teal/15 text-teal"
                      : "border-border text-muted-foreground hover:border-teal/50 hover:text-foreground",
                  )}
                >
                  <Mic aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="submit"
                  aria-label={a.send}
                  disabled={!input.trim() || thinking}
                  className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Send aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}

export default function Screen9AiAssistant() {
  return (
    <LanguageProvider>
      <AiContent />
    </LanguageProvider>
  )
}
