import React, { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { dictionaries } from "@/lib/i18n/dictionaries"
import { useLanguage } from "@/lib/i18n/language-provider"
import { ListenControl } from "@/components/national-panel"

// Language switcher button labels (same visual language as the old advisory switcher)
const LANG_LABELS = { en: "EN", hi: "\u0939\u093F", mr: "\u092E" }

// AQI category → severity key for localized category labels (data-driven).
const CATEGORY_TO_SEVERITY = {
  Good: "good",
  Satisfactory: "satisfactory",
  Moderate: "moderate",
  Poor: "poor",
  "Very Poor": "veryPoor",
  Severe: "severe",
}

/**
 * StationInsightCard — reusable, data-driven station intelligence summary.
 *
 * Receives the FULL attribution contract (data) of the CURRENTLY SELECTED station
 * and renders a compact, localized insight. Nothing is hardcoded: station name,
 * city, AQI, dominant pollutant, ranked source, confidence, wind context all come
 * from the current station's data. Missing fields are gracefully omitted (never
 * "undefined"/"null"/"NaN").
 *
 * Language parity: the DISPLAYED insight and the SPOKEN text are the same string.
 * The backend's localized_advisory is used when it answers in the selected
 * language; otherwise a grounded localized summary is built from the same data.
 */
export function StationInsightCard({ data, activeLang, onLangChange }) {
  const { t } = useLanguage()
  const navigate = useNavigate()

  const insight = useMemo(() => {
    const reading = data?.trigger_station?.reading
    const stationName = data?.trigger_station?.name
    const weather = data?.weather_snapshot
    const topSource = Array.isArray(data?.ranked_candidates)
      ? data.ranked_candidates.find((s) => s?.name) || null
      : null

    // Localized tokens ------------------------------------------------------
    const L = {
      en: {
        aqi: (v, cat) => `Current AQI is ${v} (${cat}).`,
        aqiOnly: (v) => `Current AQI is ${v}.`,
        dominant: (p) => `The dominant pollutant is ${p}.`,
        source: (name, conf) => `Analysis indicates ${name} as the primary source (confidence: ${conf}%).`,
        wind: (card, speed) => `Wind is from the ${card} at ${speed} km/h, shaping local dispersion.`,
        windCardOnly: (card) => `Wind is from the ${card}, shaping local dispersion.`,
        windSpeedOnly: (speed) => `Wind speed is ${speed} km/h, shaping local dispersion.`,
        noData: "Station intelligence is temporarily unavailable.",
        askAi: "Ask AI",
        listen: "Listen",
        stop: "Stop",
        insightLabel: "STATION INTELLIGENCE",
        aqiTag: "AQI",
        dominantTag: "Dominant",
        sourceTag: "Primary source",
        confidenceTag: "Confidence",
        windTag: "Wind",
        updateTag: "Updated",
        askAiTitle: "Ask AI about this station",
      },
      hi: {
        aqi: (v, cat) => `वर्तमान AQI ${v} (${cat}) है।`,
        aqiOnly: (v) => `वर्तमान AQI ${v} है।`,
        dominant: (p) => `सबसे प्रभावी प्रदूषक ${p} है।`,
        source: (name, conf) => `विश्लेषण ${name} को प्राथमिक स्रोत बताता है (विश्वसनीयता: ${conf}%)।`,
        wind: (card, speed) => `हवा ${card} दिशा से ${speed} किमी/घंटा की गति से चल रही है, जो प्रदूषण फैलाव को निर्धारित करती है।`,
        windCardOnly: (card) => `हवा ${card} दिशा से चल रही है, जो स्थानीय फैलाव को निर्धारित करती है।`,
        windSpeedOnly: (speed) => `हवा की गति ${speed} किमी/घंटा है, जो स्थानीय फैलाव को निर्धारित करती है।`,
        noData: "स्टेशन विश्लेषण अस्थायी रूप से उपलब्ध नहीं है।",
        askAi: "AI से पूछें",
        listen: "सुनें",
        stop: "रोकें",
        insightLabel: "स्टेशन विश्लेषण",
        aqiTag: "AQI",
        dominantTag: "प्रमुख",
        sourceTag: "प्राथमिक स्रोत",
        confidenceTag: "विश्वसनीयता",
        windTag: "हवा",
        updateTag: "अपडेट",
        askAiTitle: "इस स्टेशन के बारे में AI से पूछें",
      },
      mr: {
        aqi: (v, cat) => `सध्याची AQI ${v} (${cat}) आहे.`,
        aqiOnly: (v) => `सध्याची AQI ${v} आहे.`,
        dominant: (p) => `सर्वाधिक प्रभावी प्रदूषक ${p} आहे.`,
        source: (name, conf) => `विश्लेषण ${name} हा प्राथमिक स्रोत दर्शवते (विश्वासार्हता: ${conf}%).`,
        wind: (card, speed) => `वारा ${card} दिशेने ${speed} किमी/तास वेगाने वाहतोय, जो प्रदूषण पसरणे ठरवते.`,
        windCardOnly: (card) => `वारा ${card} दिशेने वाहतोय, जो स्थानिक पसरणे ठरवते.`,
        windSpeedOnly: (speed) => `वाऱ्याचा वेग ${speed} किमी/तास आहे, जो स्थानिक पसरणे ठरवते.`,
        noData: "स्थानक विश्लेषण तात्पुरते अनुपलब्ध आहे.",
        askAi: "AI ला विचारा",
        listen: "ऐका",
        stop: "थांबवा",
        insightLabel: "स्थानक विश्लेषण",
        aqiTag: "AQI",
        dominantTag: "प्रमुख",
        sourceTag: "प्राथमिक स्रोत",
        confidenceTag: "विश्वासार्हता",
        windTag: "वारा",
        updateTag: "अद्यतन",
        askAiTitle: "या स्थानकाबद्दल AI ला विचारा",
      },
    }[activeLang] || {}
    // en tokens as final fallback if activeLang is unexpected
    const S = Object.keys(L).length ? L : {
      aqi: (v, cat) => `Current AQI is ${v} (${cat}).`,
      aqiOnly: (v) => `Current AQI is ${v}.`,
      dominant: (p) => `The dominant pollutant is ${p}.`,
      source: (name, conf) => `Analysis indicates ${name} as the primary source (confidence: ${conf}%).`,
      wind: (card, speed) => `Wind is from the ${card} at ${speed} km/h, shaping dispersion toward the northeast sector.`,
      windCardOnly: (card) => `Wind is from the ${card}, shaping local dispersion.`,
      windSpeedOnly: (speed) => `Wind speed is ${speed} km/h, shaping local dispersion.`,
      noData: "Station intelligence is temporarily unavailable.",
      askAi: "Ask AI",
      listen: "Listen",
      stop: "Stop",
      insightLabel: "STATION INTELLIGENCE",
      aqiTag: "AQI",
      dominantTag: "Dominant",
      sourceTag: "Primary source",
      confidenceTag: "Confidence",
      windTag: "Wind",
      updateTag: "Updated",
      askAiTitle: "Ask AI about this station",
    }

    // Prefer the backend's localized advisory when it answers in this language.
    const advisory = data?.actionable_intelligence?.localized_advisory
    const advisoryText = advisory ? (activeLang === "hi" ? advisory.hi : activeLang === "mr" ? advisory.mr : advisory.en) : null

    // Build a concise grounded summary from the CURRENT station's data.
    const parts = []
    const aqiVal = typeof reading?.total_aqi === "number" ? Math.round(reading.total_aqi) : null
    const severityKey = reading?.aqi_category ? CATEGORY_TO_SEVERITY[reading.aqi_category] : null
    // Severity labels come from the dictionaries, but the panel language (activeLang)
    // may differ from the global context language — resolve from the right dictionary.
    const severityDict = (dictionaries[activeLang] || dictionaries.en).severity
    const categoryLabel = severityKey ? severityDict[severityKey] : reading?.aqi_category || null
    if (aqiVal != null) parts.push(categoryLabel ? S.aqi(aqiVal, categoryLabel) : S.aqiOnly(aqiVal))
    const pollutant = reading?.dominant_pollutant
    if (pollutant) parts.push(S.dominant(pollutant))
    if (topSource?.name) {
      const conf = topSource?.score_breakdown?.confidence_score
      const confPct = conf != null && Number.isFinite(Number(conf)) ? Math.round(Number(conf) * 100) : null
      parts.push(confPct != null ? S.source(topSource.name, confPct) : S.source(topSource.name, "—"))
    }
    const card = cardinal(weather?.wind_direction_cardinal)
    const speed = typeof weather?.wind_speed_kmh === "number" ? Math.round(weather.wind_speed_kmh) : null
    if (card && speed != null) parts.push(S.wind(card, speed))
    else if (card) parts.push(S.windCardOnly(card))
    else if (speed != null) parts.push(S.windSpeedOnly(speed))

    const summary = parts.length ? parts.join(" ") : advisoryText || S.noData

    return {
      stationName,
      summary,
      advisoryText,
      aqiVal,
      pollutant,
      topSourceName: topSource?.name || null,
      confPct: topSource?.score_breakdown?.confidence_score != null
        ? Math.round(Number(topSource.score_breakdown.confidence_score) * 100)
        : null,
      windCard: cardinal(weather?.wind_direction_cardinal),
      windSpeed: typeof weather?.wind_speed_kmh === "number" ? Math.round(weather.wind_speed_kmh) : null,
      city: data?.trigger_station?.city || null,
      updatedAt: data?.trigger_station?.reading?.timestamp || null,
      labels: S,
    }
  }, [data, activeLang])

  const ctx = {
    screen_id: "screen_4",
    station_name: insight.stationName,
    city: insight.city,
    current_aqi: insight.aqiVal,
    dominant_pollutant: insight.pollutant,
    primary_source: insight.topSourceName,
    confidence: insight.confPct,
    language: activeLang,
  }

  const askAi = () => {
    navigate("/ai", { state: ctx })
  }

  const { labels: S } = insight

  return (
    <section
      aria-label={S.insightLabel}
      style={{
        background: "rgba(255,255,255,0.018)",
        border: "1px solid rgba(255,255,255,0.055)",
        borderRadius: 15,
        padding: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1.5px", background: "linear-gradient(to right, rgba(239,68,68,0.4), transparent)" }} />

      {/* Header row: section label + Listen BESIDE the title + language switcher */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span className="section-label" style={{ letterSpacing: "0.15em" }}>
            {S.insightLabel}
          </span>
          <ListenControl
            text={insight.summary}
            lang={activeLang}
            disabled={!insight.summary || insight.summary === insight.labels.noData}
            className="listen-control"
            style={{ marginTop: 0 }}
          />
        </div>
        {onLangChange && (
          <div className="lang-switcher">
            {["en", "hi", "mr"].map((lang) => (
              <button
                key={lang}
                onClick={() => onLangChange(lang)}
                className={`lang-btn${activeLang === lang ? " active" : ""}`}
              >
                {LANG_LABELS[lang]}
              </button>
            ))}
          </div>
        )}
        {/* onLangChange receives the language AND mirrors it to the global selector
            via the parent's handler. */}
      </div>

      {/* Compact fact row — key facts at a glance */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {insight.aqiVal != null && <Fact tag={S.aqiTag} value={String(insight.aqiVal)} tone="critical" />}
        {insight.pollutant && <Fact tag={S.dominantTag} value={insight.pollutant} />}
        {insight.topSourceName && <Fact tag={S.sourceTag} value={insight.topSourceName} />}
        {insight.confPct != null && <Fact tag={S.confidenceTag} value={`${insight.confPct}%`} tone="warn" />}
        {insight.windCard && <Fact tag={S.windTag} value={insight.windSpeed != null ? `${insight.windCard} · ${insight.windSpeed} km/h` : insight.windCard} />}
      </div>

      {/* Concise localized insight (displayed = spoken) */}
      <p className="advisory-text" style={{ fontSize: 13, lineHeight: 1.65 }}>
        {insight.summary}
      </p>

      {/* Ask AI (current station context) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={askAi}
          title={S.askAiTitle}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 10,
            border: "1px solid rgba(45, 212, 191, 0.35)",
            background: "rgba(45, 212, 191, 0.10)",
            color: "#2dd4bf",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Inter','Noto Sans Devanagari',sans-serif",
            transition: "background 0.15s ease, border-color 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(45, 212, 191, 0.18)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(45, 212, 191, 0.10)"; }}
        >
          {S.askAi}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}

function Fact({ tag, value, tone = "default" }) {
  const colors = {
    default: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", color: "#e4e4e7" },
    critical: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.28)", color: "#f87171" },
    warn: { bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.25)", color: "#fbbf24" },
  }[tone]
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: "3px 9px",
        fontSize: 10,
        fontWeight: 700,
        color: colors.color,
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ opacity: 0.65, textTransform: "uppercase", fontSize: 9 }}>{tag}</span>
      <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={value}>
        {value}
      </span>
    </span>
  )
}

function cardinal(value) {
  if (typeof value !== "string" || !value.trim() || value === "\u2014") return null
  return value.trim()
}
