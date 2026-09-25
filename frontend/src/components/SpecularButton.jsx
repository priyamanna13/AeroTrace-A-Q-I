import React, { useRef, useState } from 'react';

/**
 * SpecularButton — Inspired by @react-bits/SpecularButton-JS-CSS
 * Features:
 * - Dynamic cursor-tracking specular highlight
 * - Deep teal gradient base (#235347 -> #063F47)
 * - Tactile press and specular reflection
 */
export default function SpecularButton({
  children,
  onClick,
  className = '',
}) {
  const buttonRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50, active: false });

  const handleMouseMove = (e) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y, active: true });
  };

  const handleMouseLeave = () => {
    setMousePos((prev) => ({ ...prev, active: false }));
  };

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        background: 'linear-gradient(180deg, #2a6154 0%, #235347 40%, #063F47 100%)',
        boxShadow: mousePos.active
          ? '0 6px 24px rgba(35, 83, 71, 0.45), 0 0 14px rgba(52, 211, 153, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.3)'
          : '0 4px 16px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.22)',
        border: '1px solid rgba(52, 211, 153, 0.35)',
      }}
      className={`relative overflow-hidden w-[145px] h-[48px] rounded-[10px] font-ui text-[15px] font-semibold text-white tracking-wide transition-all duration-200 active:scale-[0.98] select-none cursor-pointer flex items-center justify-center ${className}`}
    >
      {/* Specular cursor follower */}
      {mousePos.active && (
        <div
          style={{
            position: 'absolute',
            left: `${mousePos.x}%`,
            top: `${mousePos.y}%`,
            transform: 'translate(-50%, -50%)',
            width: '130px',
            height: '130px',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Traveling specular sheen */}
      <div className="specular-sheen" />

      {/* Button content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}
