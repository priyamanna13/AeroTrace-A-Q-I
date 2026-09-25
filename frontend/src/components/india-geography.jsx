import React from "react"
import mapData from "@/lib/india-map-data.json"

export function IndiaGeography() {
  return (
    <g>
      <path d={mapData.graticule} fill="none" stroke="var(--map-graticule)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <g>
        {mapData.neighbours.map((country) => (
          <path
            key={country.name}
            d={country.d}
            fill="var(--map-neighbour)"
            stroke="var(--map-neighbour-stroke)"
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      <path d={mapData.outline} fill="var(--map-shadow)" transform="translate(6 12)" filter="url(#india-shadow)" />
      <g>
        {mapData.states.map((state) => (
          <path
            key={state.name}
            d={state.d}
            className="fill-[var(--map-land)] transition-[fill] duration-200 hover:fill-[var(--map-land-hover)]"
          />
        ))}
      </g>
      <path
        d={mapData.borders}
        fill="none"
        stroke="var(--map-state-border)"
        strokeWidth={0.9}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      <path
        d={mapData.outline}
        fill="none"
        stroke="var(--map-outline)"
        strokeWidth={1.4}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    </g>
  )
}

export const MAP_WIDTH = mapData.width
export const MAP_HEIGHT = mapData.height
export const CITY_POSITIONS = mapData.cities
