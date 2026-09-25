import React, { useCallback, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { IndiaMap } from "@/components/india-map"
import { NationalPanel } from "@/components/national-panel"
import { NavigationPanel } from "@/components/navigation-panel"
import { BrandMark } from "@/components/site-header"
import { useLanguage } from "@/lib/i18n/language-provider"

export function NationalOverview({ geography, geometry }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [selectedCity, setSelectedCity] = useState(null)
  const [hoveredCity, setHoveredCity] = useState(null)
  const [notice, setNotice] = useState(null)
  const noticeTimer = useRef(null)
  const mapRef = useRef(null)

  const showNotice = useCallback((message) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = setTimeout(() => setNotice(null), 3200)
  }, [])

  const selectCity = useCallback((id) => {
    setSelectedCity((current) => (current === id ? null : id))
    if (window.matchMedia("(max-width: 1023px)").matches) {
      mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  const openCityIntelligence = useCallback((id) => {
    navigate(`/city/${id}`)
  }, [navigate])

  return (
    <div
      className="relative min-h-dvh national-grid-layout lg:grid lg:h-dvh lg:overflow-hidden bg-background text-foreground"
      style={{ gridTemplateColumns: 'minmax(400px, 36%) 1fr' }}
    >
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 lg:px-10">
        <div className="pointer-events-auto">
          <BrandMark />
        </div>
        <div className="pointer-events-auto">
          <NavigationPanel onSelectCity={selectCity} onNotice={showNotice} />
        </div>
      </header>

      <main className="contents">
        <div
          className="border-border px-6 pb-10 national-panel-layout lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden lg:border-r lg:px-10"
          style={{ paddingTop: 'max(5.5rem, 12vh)', paddingBottom: '2.5vh' }}
        >
          <NationalPanel activeCity={selectedCity} hoveredCity={hoveredCity} onHover={setHoveredCity} onSelect={selectCity} />
        </div>

        <div ref={mapRef} className="h-[85svh] min-h-[560px] scroll-mt-0 lg:h-full lg:min-h-0">
          <IndiaMap
            geography={geography}
            geometry={geometry}
            selectedCity={selectedCity}
            hoveredCity={hoveredCity}
            onHover={setHoveredCity}
            onSelect={selectCity}
            onReset={() => setSelectedCity(null)}
            onOpenCity={openCityIntelligence}
          />
        </div>
      </main>

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {notice && (
          <p className="rounded-full border border-border bg-popover px-5 py-2.5 text-sm font-semibold text-popover-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2">
            {notice}
          </p>
        )}
      </div>
    </div>
  )
}
