import React, { useEffect, useState } from 'react';

/**
 * StaggeredText — Animated text reveal with guaranteed word spacing
 */
export default function StaggeredText({
  text = '',
  delay = 0,
  stagger = 28,
  className = '',
  as = 'div',
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const Component = as;
  const words = text.split(' ');

  return (
    <Component className={className}>
      {words.map((word, wIdx) => (
        <React.Fragment key={wIdx}>
          {wIdx > 0 && ' '}
          <span className="inline-block whitespace-nowrap">
            {word.split('').map((char, cIdx) => (
              <span
                key={cIdx}
                style={{
                  display: 'inline-block',
                  transition: `transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${(wIdx * 5 + cIdx) * stagger}ms, opacity 0.6s ease ${(wIdx * 5 + cIdx) * stagger}ms`,
                  transform: mounted ? 'translateY(0)' : 'translateY(14px)',
                  opacity: mounted ? 1 : 0,
                }}
              >
                {char}
              </span>
            ))}
          </span>
        </React.Fragment>
      ))}
    </Component>
  );
}
