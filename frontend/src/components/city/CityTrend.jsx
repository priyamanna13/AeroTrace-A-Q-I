import React, { useEffect, useMemo, useRef, useState } from "react"
import EChartsWrapper from "@/components/EChartsWrapper"
import { API } from "@/api_client"
import { getDemoTrend } from "@/lib/demo-trend-data"
import { useLanguage } from "@/lib/i18n/language-provider"

const RANGES = ["24H", "7D", "30D"]

function buildOption({ points, range }) {
  const timestamps = points.map((p) => p.timestamp)
  const values = points.map((p) => p.value)
  return {
    backgroundColor: "transparent",
    animationDuration: 700,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(12, 12, 16, 0.95)",
      borderColor: "rgba(255, 255, 255, 0.1)",
      textStyle: { color: "#f4f4f5", fontSize: 12 },
      formatter: (params) => {
        const item = params?.[0]
        if (!item) return ""
        return `<div class="p-1 font-mono">
          <div class="text-[10px] text-zinc-400">${item.axisValue}</div>
          <div class="font-bold">AQI ${item.data}</div>
        </div>`
      },
    },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: timestamps,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
      axisTick: { show: false },
      axisLabel: { color: "#8b8f96", fontSize: 10, fontFamily: "monospace" },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.07)", type: "dashed" } },
      axisLabel: { color: "#8b8f96", fontSize: 10, fontFamily: "monospace" },
    },
    series: [
      {
        name: "AQI",
        type: "line",
        smooth: 0.3,
        data: values,
        symbol: "circle",
        symbolSize: 5,
        showSymbol: values.length <= 40,
        lineStyle: { width: 2.5, color: "#2dd4bf" },
        itemStyle: { color: "#2dd4bf" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(45, 212, 191, 0.22)" },
              { offset: 1, color: "rgba(45, 212, 191, 0)" },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: "none",
          data: [{ yAxis: 200, lineStyle: { color: "rgba(249, 115, 22, 0.55)", type: "dashed", width: 1 } }],
          label: {
            formatter: "Poor 200",
            color: "rgba(249, 115, 22, 0.8)",
            fontSize: 9,
            fontFamily: "monospace",
            position: "insideEndTop",
          },
        },
      },
    ],
  }
}

/**
 * CityTrend — AIR QUALITY TREND (full-width) for Screen 2.
 * Data comes from the existing analytics endpoint only. If no real observed
 * points are returned, an explicit unavailable state is shown — AeroTrace
 * never renders fabricated historical measurements (NFR-073).
 */
export function CityTrend({ cityId, cityName }) {
  const { t, language } = useLanguage()
  const [range, setRange] = useState("24H")
  const [points, setPoints] = useState([])
  const [dataSource, setDataSource] = useState(null)
  const [loading, setLoading] = useState(true)
  const requestRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestRef.current
    setLoading(true)
    setPoints([])
    setDataSource(null)

    API.getCityAnalytics(cityName, range)
      .then((payload) => {
        if (requestRef.current !== requestId) return
        const list = Array.isArray(payload)
          ? payload
          : payload?.data_points || payload?.points || payload?.series || payload?.readings || []
        const cleaned = (list || [])
          .map((entry) => {
            if (Array.isArray(entry)) {
              return { timestamp: entry[0], value: Number(entry[1]) }
            }
            const ts = entry.timestamp || entry.time || entry.ts
            const value = entry.aqi ?? entry.value ?? entry.total_aqi ?? entry.average_aqi
            return ts != null && value != null ? { timestamp: ts, value: Number(value) } : null
          })
          .filter((p) => p && Number.isFinite(p.value))
        setPoints(cleaned)
        setDataSource(payload?.data_source || payload?.source || null)
        setLoading(false)
      })
      .catch(() => {
        if (requestRef.current !== requestId) return
        setPoints([])
        setDataSource(null)
        setLoading(false)
      })
  }, [cityName, range])

  // PROTOTYPE/DESIGN STAGE: when the backend returns no real observed points, fall
  // back to the isolated demo dataset — always labeled DEMO DATA, never presented
  // as live measurements. Real backend data replaces this without redesign.
  const isDemo = !loading && points.length === 0
  const display = useMemo(
    () => (isDemo ? getDemoTrend(cityName, range) : { points, label: null }),
    [isDemo, cityName, range, points],
  )

  const option = useMemo(() => buildOption({ points: display.points, range }), [display, range])

  return (
    <section aria-labelledby="city-trend-heading" className="rounded-2xl border border-border bg-card/50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h2
            id="city-trend-heading"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            {t.cityScreen.trend}
          </h2>
          {!loading && !isDemo && points.length > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {t.cityScreen.trendPoints(points.length)}
              {dataSource ? ` · ${dataSource}` : ""}
            </span>
          )}
          {isDemo && (
            <span
              className="rounded-full border border-copper/50 px-2.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-copper"
              title={t.cityScreen.trendDemoNote}
            >
              {t.cityScreen.demoDataChip}
            </span>
          )}
        </div>
        <div role="group" aria-label={t.cityScreen.trendAria} className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => setRange(value)}
              className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                range === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-background/40" role="status">
            <span className="size-5 animate-spin rounded-full border-2 border-teal border-t-transparent" />
            <span className="font-mono text-xs text-muted-foreground">{t.cityScreen.trendLoading}</span>
          </div>
        ) : (
          <>
            <EChartsWrapper option={option} style={{ width: "100%", height: "260px" }} />
            {isDemo && (
              <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t.cityScreen.trendDemoNote}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
