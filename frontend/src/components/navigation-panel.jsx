import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { BarChart3, ChevronDown, LayoutDashboard, Map, Menu, MessageSquare, Settings, X, Building2, Globe } from "lucide-react"
import { GlideSelect } from "@/components/glide-select"
import { useThemeTransition } from "@/hooks/use-theme-transition"
import { CITIES, severityColor, severityFor } from "@/lib/aqi"
import { dictionaries, LANGUAGES } from "@/lib/i18n/dictionaries"
import { useLanguage } from "@/lib/i18n/language-provider"
import { VoicePreferenceSelect } from "@/components/national-panel"
import { cn } from "@/lib/utils"

function Expandable({
  icon,
  label,
  meta,
  children,
}) {
  const [open, setOpen] = useState(false)
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-[15px]">{label}</span>
        {meta && <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{meta}</span>}
        <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform duration-300", open && "rotate-180")} />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pt-2">{children}</div>
        </div>
      </div>
    </li>
  )
}

export function NavigationPanel({
  onSelectCity,
  onNotice,
}) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { t, language, setLanguage } = useLanguage()
  const { theme, changeTheme } = useThemeTransition()

  // Handle escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const placeholder = (label) => {
    setOpen(false)
    onNotice(t.nav.comingSoon(label))
  }

  const linkClass =
    "flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left text-[15px] font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"

  return (
    <>
      <button
        type="button"
        aria-label={t.nav.openNav}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid size-12 place-items-center rounded-xl border border-border bg-card/80 text-foreground backdrop-blur transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.nav.navigation}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-popover text-popover-foreground shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] animate-in slide-in-from-right"
          >
            <div className="flex items-center justify-between border-b border-border px-7 py-5">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {t.nav.navigation}
              </h2>
              <button
                type="button"
                aria-label={t.nav.closeNav}
                onClick={() => setOpen(false)}
                className="grid size-10 place-items-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label={t.nav.navigation} className="flex-1 overflow-y-auto px-6 py-6">
              <ul className="flex flex-col gap-3">
                {/* Landing page link */}
                <li>
                  <button
                    type="button"
                    className={linkClass}
                    onClick={() => {
                      setOpen(false)
                      navigate("/")
                    }}
                  >
                    <Globe className="size-5 text-muted-foreground" aria-hidden="true" />
                    <span>Landing Page</span>
                  </button>
                </li>

                <li>
                  <button
                    type="button"
                    aria-current="page"
                    className={cn(linkClass, "bg-accent text-accent-foreground")}
                    onClick={() => setOpen(false)}
                  >
                    <LayoutDashboard className="size-5" aria-hidden="true" />
                    <span>{t.nav.dashboard}</span>
                  </button>
                </li>

                <Expandable icon={<Building2 className="size-5" />} label={t.nav.cities} meta={t.nav.locations(CITIES.length)}>
                  <ul className="flex flex-col border-l-2 border-border/80 pl-4 py-2 gap-1.5">
                    {CITIES.map((city) => (
                      <li key={city.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false)
                            onSelectCity(city.id)
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <span>{t.cities[city.id]}</span>
                          <span className="flex items-center gap-2 font-mono text-xs tabular-nums text-muted-foreground">
                            {city.aqi}
                            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: severityColor(severityFor(city.aqi)) }} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Expandable>

                <li>
                  <button type="button" className={linkClass} onClick={() => {
                    setOpen(false)
                    navigate("/national")
                  }}>
                    <Map className="size-5 text-muted-foreground" aria-hidden="true" />
                    <span>{t.nav.liveMap}</span>
                  </button>
                </li>

                <li>
                  <button type="button" className={linkClass} onClick={() => placeholder(t.nav.analytics)}>
                    <BarChart3 className="size-5 text-muted-foreground" aria-hidden="true" />
                    <span>{t.nav.analytics}</span>
                  </button>
                </li>

                <li>
                  <button type="button" className={linkClass} onClick={() => placeholder(t.nav.aiChat)}>
                    <MessageSquare className="size-5 text-muted-foreground" aria-hidden="true" />
                    <span>{t.nav.aiChat}</span>
                  </button>
                </li>

                <Expandable icon={<Settings className="size-5" />} label={t.nav.settings} meta={t.nav.preferences}>
                  <div className="flex flex-col gap-6 pt-3 pb-3">
                    <div className="flex flex-col gap-2.5">
                      <span className="font-mono text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground">
                        {t.nav.language}
                      </span>
                      <GlideSelect
                        label={t.nav.language}
                        value={language}
                        onChange={setLanguage}
                        options={LANGUAGES.map((code) => ({ value: code, label: dictionaries[code].languageName, lang: code }))}
                      />
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <span className="font-mono text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground">
                        {t.nav.theme}
                      </span>
                      <GlideSelect
                        label={t.nav.theme}
                        value={theme}
                        onChange={changeTheme}
                        options={[
                          { value: "light", label: t.nav.light },
                          { value: "dark", label: t.nav.dark },
                        ]}
                      />
                    </div>
                    <VoicePreferenceSelect />
                  </div>
                </Expandable>
              </ul>
            </nav>

            <p className="border-t border-border px-7 py-5 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {t.nav.footnote}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
