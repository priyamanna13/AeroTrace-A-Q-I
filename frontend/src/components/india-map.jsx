import React from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { CITIES, SEVERITY_BANDS, severityColor, severityFor } from "@/lib/aqi"
import { useLanguage } from "@/lib/i18n/language-provider"
import { cn } from "@/lib/utils"

const ZOOM = 2.6
const PIN_SCALE = 1.4
const PIN_PATH = "M0 0 C-3 -8 -13 -15 -13 -27 A13 13 0 1 1 13 -27 C13 -15 3 -8 0 0Z"

export function IndiaMap({
  geography,
  geometry,
  selectedCity,
  hoveredCity,
  onHover,
  onSelect,
  onReset,
  onOpenCity,
}) {
  const { t } = useLanguage()
  const { width, height, positions } = geometry
  const focus = selectedCity ? positions[selectedCity] : null
  const scale = focus ? ZOOM : 1
  const zoomTransform = focus
    ? `translate(${width / 2 - ZOOM * focus.x}px, ${height / 2 - ZOOM * focus.y}px) scale(${ZOOM})`
    : "translate(0px, 0px) scale(1)"
  const selected = CITIES.find((city) => city.id === selectedCity)

  return (
    <div className="relative size-full overflow-hidden bg-[var(--map-water)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 55% 60% at 50% 52%, var(--map-glow), transparent 70%)" }}
      />

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-labelledby="india-map-title india-map-desc"
        className="absolute inset-0 size-full"
        style={{
          maskImage: "radial-gradient(ellipse 80% 75% at 50% 50%, black 70%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 75% at 50% 50%, black 70%, transparent 100%)",
        }}
      >
        <title id="india-map-title">{t.map.title}</title>
        <desc id="india-map-desc">{t.map.description}</desc>
        <defs>
          <filter id="india-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        <g
          style={{ transform: zoomTransform, transition: "transform 900ms cubic-bezier(0.65, 0, 0.35, 1)" }}
          onClick={(event) => {
            if (event.target === event.currentTarget || !event.target.closest("[data-pin]")) {
              if (selectedCity) onReset()
            }
          }}
        >
          {geography}

          {CITIES.map((city) => {
            const point = positions[city.id]
            if (!point) return null
            const severity = severityFor(city.aqi)
            const color = severityColor(severity)
            const isActive = selectedCity === city.id
            const isHovered = hoveredCity === city.id
            const dimmed = selectedCity !== null && !isActive
            const right = city.labelSide === "right"
            const name = t.cities[city.id]

            return (
              <g key={city.id} transform={`translate(${point.x} ${point.y})`}>
                <g
                  data-pin
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  aria-label={t.map.cityAria(name, city.aqi, t.severity[severity])}
                  onMouseEnter={() => onHover(city.id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(city.id)}
                  onBlur={() => onHover(null)}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelect(city.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onSelect(city.id)
                    }
                  }}
                  className="cursor-pointer outline-none [&:focus-visible_.pin-ring]:opacity-100"
                  style={{
                    transform: `scale(${(PIN_SCALE * (isActive || isHovered ? 1.18 : 1)) / scale})`,
                    transition: "transform 900ms cubic-bezier(0.65, 0, 0.35, 1), opacity 400ms",
                    opacity: dimmed ? 0.35 : 1,
                  }}
                >
                  <circle r={isActive ? 22 : 16} fill={color} opacity={0.22} className={cn(isActive && "animate-pulse")} />
                  <circle className="pin-ring opacity-0 transition-opacity" cy={-27} r={20} fill="none" stroke="var(--ring)" strokeWidth={2.5} />
                  <path d={PIN_PATH} fill={color} stroke="var(--pin-ring)" strokeWidth={2.5} />
                  <circle cy={-27} r={5} fill="var(--pin-ring)" />
                  <text
                    x={right ? 20 : -20}
                    y={-30}
                    textAnchor={right ? "start" : "end"}
                    className="fill-foreground font-sans"
                    style={{ paintOrder: "stroke", stroke: "var(--label-bg)", strokeWidth: 5, strokeLinejoin: "round" }}
                  >
                    <tspan fontSize={17} fontWeight={700}>
                      {name}
                    </tspan>
                    <tspan x={right ? 20 : -20} dy={19} fontSize={13} fontWeight={600} className="font-mono" style={{ fill: color }}>
                      AQI {city.aqi}
                    </tspan>
                  </text>
                </g>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute left-6 top-24 flex flex-col gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] lg:left-8 lg:top-8">
        <p className="flex items-center gap-2">
          <span>{t.map.india}</span>
          <span aria-hidden="true" className="text-copper">
            {"→"}
          </span>
          <span className="text-teal">{selected ? t.cities[selected.id] : t.map.chooseCity}</span>
        </p>
        <p className="text-muted-foreground">{t.map.nextInFlow}</p>
      </div>

      {selected && (
        <div className="absolute bottom-16 left-4 right-4 z-10 flex flex-col gap-4 rounded-2xl border border-border bg-card/95 p-5 shadow-xl backdrop-blur animate-in fade-in slide-in-from-bottom-4 duration-500 sm:right-auto sm:w-80 lg:left-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t.map.india}</p>
              <h2 className="font-display text-3xl font-bold leading-tight">{t.cities[selected.id]}</h2>
            </div>
            <div className="text-right">
              <p className="font-display text-4xl font-bold leading-none tabular-nums">{selected.aqi}</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: severityColor(severityFor(selected.aqi)) }}>
                {t.severity[severityFor(selected.aqi)]}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReset}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t.map.returnToIndia}
            </button>
            <button
              type="button"
              onClick={() => onOpenCity(selected.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t.map.openCity}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <ul
        aria-label={t.map.legend}
        className="absolute inset-x-0 bottom-4 flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 font-mono text-[11px] text-muted-foreground lg:justify-end lg:px-8"
      >
        {SEVERITY_BANDS.map((band) => (
          <li key={band.key} className="flex items-center gap-1.5" title={t.severity[band.key]}>
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: severityColor(band.key) }} />
            <span className="sr-only">{t.severity[band.key]}: </span>
            {band.range}
          </li>
        ))}
      </ul>
    </div>
  )
}
