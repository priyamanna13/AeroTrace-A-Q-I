import React from 'react'
import { CITY_POSITIONS, IndiaGeography, MAP_HEIGHT, MAP_WIDTH } from '@/components/india-geography'
import { NationalOverview } from '@/components/national-overview'
import { LanguageProvider } from '@/lib/i18n/language-provider'

export default function Screen1NationalOverview() {
  return (
    <LanguageProvider>
      <NationalOverview
        geography={<IndiaGeography />}
        geometry={{ width: MAP_WIDTH, height: MAP_HEIGHT, positions: CITY_POSITIONS }}
      />
    </LanguageProvider>
  )
}
