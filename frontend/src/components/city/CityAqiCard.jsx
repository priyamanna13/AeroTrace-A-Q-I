import React from "react"
import { severityColor, severityFor } from "@/lib/aqi"
import { useLanguage } from "@/lib/i18n/language-provider"

function formatClock(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function relativeAge(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return `${hours}h ago`
}

/**
 * CityAqiCard — "CITY AQI 142 Moderate / Updated / Source" block.
 * Data states: loading (skeleton), unavailable (explicit), stale (warning),
 * simulated (labeled per NFR-075 — never presented as live).
 */
export function CityAqiCard({ overview, loading }) {
  const { t } = useLanguage()

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/70 p-6" aria-busy="true">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-12 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-5 space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  const aqi = overview?.current_aqi
  const hasReading = aqi != null && Number.isFinite(Number(aqi))
  const severity = hasReading ? severityFor(Number(aqi)) : null
  const color = severity ? severityColor(severity) : null
  const isSimulated = Boolean(overview?.is_simulated) || /SIMULATED/i.test(overview?.data_source || "")
  const stale = Boolean(overview?.is_stale)
  const updated = formatClock(overview?.data_timestamp)
  const age = relativeAge(overview?.data_timestamp)
  const source = overview?.data_source

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t.cityScreen.cityAqi}
        </span>
        {isSimulated && (
          <span className="rounded-full border border-copper/50 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-copper">
            {t.cityScreen.simulatedLabel}
          </span>
        )}
      </div>

      {hasReading ? (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-display text-6xl font-bold leading-none tabular-nums">{Math.round(Number(aqi))}</span>
          <span
            className="flex items-center gap-2 text-lg font-semibold"
            style={{ color }}
          >
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: color }} />
            {overview?.aqi_category || t.severity[severity]}
          </span>
        </div>
      ) : (
        <div className="mt-3">
          <p className="font-display text-4xl font-bold leading-none text-muted-foreground">—</p>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">{t.cityScreen.notAvailable}</p>
        </div>
      )}

      <dl className="mt-5 flex flex-col gap-1.5 border-t border-border pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <div className="flex gap-2.5">
          <dt>{t.cityScreen.updated}:</dt>
          <dd className="font-semibold normal-case text-foreground">
            {updated ? `${updated}${age ? ` · ${age}` : ""}` : t.cityScreen.notAvailable}
          </dd>
        </div>
        <div className="flex gap-2.5">
          <dt>{t.cityScreen.source}:</dt>
          <dd className="max-w-[26ch] truncate font-semibold normal-case text-foreground" title={source || undefined}>
            {source || t.cityScreen.notAvailable}
          </dd>
        </div>
        {stale && <dd className="text-[10px] font-semibold normal-case text-copper">▲ {t.cityScreen.staleWarning}</dd>}
      </dl>
    </div>
  )
}
