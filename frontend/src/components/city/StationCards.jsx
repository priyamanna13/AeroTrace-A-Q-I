import React from "react"
import { useNavigate } from "react-router-dom"
import { ArrowUpRight } from "lucide-react"
import { severityColor, severityFor } from "@/lib/aqi"
import { useLanguage } from "@/lib/i18n/language-provider"

/**
 * StationCards — MONITORED STATIONS for Screen 2.
 * Exactly the city's verified stations, one card each, restrained content:
 * name, current AQI, category, updated/source line. Click → Screen 3.
 */
export function StationCards({ cityId, stations, loading }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const cityLabel = t.cities[cityId] || cityId

  // Direct navigation: station click opens the existing Forensic/Wind Plume UI
  // with the station already active. Back returns to City Intelligence.
  const openStation = (station) => {
    navigate(`/investigate/${encodeURIComponent(station.name)}?city=${encodeURIComponent(cityLabel)}`)
  }

  return (
    <section aria-labelledby="monitored-stations-heading">
      <div className="flex items-end justify-between gap-3 border-b border-border pb-3">
        <h2
          id="monitored-stations-heading"
          className="font-mono text-xs font-bold uppercase tracking-[0.2em]"
        >
          {t.cityScreen.stations}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {loading ? t.cityScreen.loadingStations : t.cityScreen.stationsMeta((stations || []).length)}
        </span>
      </div>

      {loading ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card/60 p-5" aria-hidden="true">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="mt-4 h-8 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-4 h-3 w-28 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : !stations || stations.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-8 text-center text-sm text-muted-foreground">
          {t.cityScreen.noStations(cityLabel)}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stations.map((station) => {
            const aqi = station.current_aqi
            const hasReading = aqi != null && Number.isFinite(Number(aqi))
            const severity = hasReading ? severityFor(Number(aqi)) : null
            const color = severity ? severityColor(severity) : "var(--muted-foreground)"
            const updated = station.data_timestamp
              ? new Date(station.data_timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : null
            const simulated = Boolean(station.is_simulated) || /SIMULATED/i.test(station.data_source || "")

            return (
              <button
                key={station.station_id || station.name}
                type="button"
                onClick={() => openStation(station)}
                aria-label={t.cityScreen.stationAria(
                  station.name,
                  hasReading ? Math.round(Number(aqi)) : "—",
                  severity ? t.severity[severity] : t.cityScreen.notAvailable,
                )}
                className="group relative flex flex-col rounded-xl border border-border bg-card/60 p-5 text-left transition-colors hover:border-teal/50 hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{station.name}</span>
                  <span
                    aria-hidden="true"
                    className="mt-1 size-2 rounded-full transition-transform duration-200 group-hover:scale-125"
                    style={{ background: color }}
                  />
                </div>

                <div className="mt-3 flex items-baseline gap-2.5">
                  <span className="font-display text-3xl font-bold leading-none tabular-nums" style={{ color }}>
                    {hasReading ? Math.round(Number(aqi)) : "—"}
                  </span>
                  <span className="text-xs font-semibold" style={{ color }}>
                    {severity ? t.severity[severity] : t.cityScreen.notAvailable}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="max-w-[18ch] truncate" title={station.data_source || undefined}>
                    {updated ? `U ${updated}` : ""}
                    {simulated ? " · SIM" : ""}
                  </span>
                  <span className="flex items-center gap-1 text-teal opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {t.cityScreen.viewStation}
                    <ArrowUpRight aria-hidden="true" className="size-3" />
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
