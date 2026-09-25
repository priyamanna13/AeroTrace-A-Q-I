import React from "react"
import { Link } from "react-router-dom"
import { useLanguage } from "@/lib/i18n/language-provider"

export function BrandMark() {
  const { t } = useLanguage()
  return (
    <Link
      to="/"
      aria-label={t.nav.home}
      className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <img src="/images/logo.png" alt="" width={40} height={40} className="size-9 md:size-10 object-contain" />
      <span className="font-display text-xl font-bold tracking-tight md:text-2xl text-foreground" lang="en">
        AeroTrace A(<span className="text-copper">Q</span>)I
      </span>
    </Link>
  )
}
