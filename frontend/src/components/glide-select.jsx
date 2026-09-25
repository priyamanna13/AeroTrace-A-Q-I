import React from "react"
import { cn } from "@/lib/utils"

export function GlideSelect({
  label,
  value,
  options,
  onChange,
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative grid rounded-xl border border-border bg-muted/60 p-1.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1.5 left-1.5 rounded-lg bg-primary shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
        style={{
          width: `calc((100% - 0.75rem) / ${options.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            lang={option.lang}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
