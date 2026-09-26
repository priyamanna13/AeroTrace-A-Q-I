import React, { useEffect, useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { CITIES, severityColor, severityFor } from "@/lib/aqi"
import { useLanguage } from "@/lib/i18n/language-provider"
import { cn } from "@/lib/utils"

const CITY_IDS = ["pune", "mumbai", "delhi", "bengaluru", "kolkata", "hyderabad", "chennai"]

export function CitySelector({ cityId, onChange }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const cities = CITY_IDS.map((id) => CITIES.find((c) => c.id === id)).filter(Boolean)
  const active = cities.find((c) => c.id === cityId) || cities[1] // Mumbai default

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.cityScreen.changeCityAria(t.cities[active.id])}
        onClick={() => setOpen((value) => !value)}
        className="group flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-2.5 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="font-display text-2xl font-bold leading-none tracking-tight md:text-3xl">
          {t.cities[active.id]}
        </span>
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full"
          style={{ background: severityColor(severityFor(active.aqi)) }}
        />
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t.cityScreen.selectCity}
          className="absolute left-0 top-[calc(100%+8px)] z-40 w-60 overflow-hidden rounded-xl border border-border bg-popover py-1.5 shadow-2xl"
        >
          {cities.map((city) => {
            const selected = city.id === active.id
            return (
              <li key={city.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    if (!selected) onChange(city.id)
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    selected && "text-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ background: severityColor(severityFor(city.aqi)) }}
                  />
                  <span className="flex-1">{t.cities[city.id]}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{city.aqi}</span>
                  {selected && <Check aria-hidden="true" className="size-3.5 text-copper" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
