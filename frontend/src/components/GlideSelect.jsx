import React, { useRef, useEffect, useState } from 'react';

/**
 * GlideSelect — Inspired by @react-bits/GlideSelect-JS-CSS
 * Features:
 * - Fluid sliding active indicator pill
 * - Segmented tab layout
 * - Brand teal active background (#235347)
 */
export default function GlideSelect({ options = [], value, onChange, className = '' }) {
  const containerRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const activeIndex = options.findIndex((opt) => opt.value === value);
    if (activeIndex === -1) return;

    const children = containerRef.current.children;
    const activeElement = children[activeIndex + 1]; // +1 because index 0 is indicator
    if (activeElement) {
      setIndicatorStyle({
        left: activeElement.offsetLeft,
        width: activeElement.offsetWidth,
      });
    }
  }, [value, options]);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Language selection"
      className={`relative flex items-center bg-[#131417] p-1 rounded-lg border border-white/5 select-none ${className}`}
    >
      {/* Sliding Active Pill */}
      <div
        style={{
          transform: `translateX(${indicatorStyle.left}px)`,
          width: `${indicatorStyle.width}px`,
          transition: 'transform 0.26s cubic-bezier(0.4, 0, 0.2, 1), width 0.26s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="absolute top-1 bottom-1 left-0 rounded-md bg-[#235347] shadow-sm pointer-events-none"
      />

      {/* Selectable Options */}
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 flex-1 py-1.5 px-3 text-xs font-semibold text-center transition-colors duration-150 rounded-md ${
              isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
