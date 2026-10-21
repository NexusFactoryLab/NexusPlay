/**
 * Despertador caricaturesco para «Segundos por turno» (issue #80): campanas,
 * patitas y una carita, en los colores de acento del tema.
 */
export function CartoonClock({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`${className} motion-safe:animate-[clock-wiggle_2.4s_ease-in-out_infinite]`} aria-hidden="true">
      {/* Campanas y martillo */}
      <path d="M8 18a9 9 0 0 1 14-9z" fill="var(--accent-2)" stroke="var(--text-h)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M56 18a9 9 0 0 0-14-9z" fill="var(--accent-2)" stroke="var(--text-h)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 6v5" stroke="var(--text-h)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="5" r="2.5" fill="var(--accent-2)" stroke="var(--text-h)" strokeWidth="2" />
      {/* Patitas */}
      <path d="M17 53l-4 7M47 53l4 7" stroke="var(--text-h)" strokeWidth="3" strokeLinecap="round" />
      {/* Cuerpo y esfera */}
      <circle cx="32" cy="35" r="22" fill="var(--accent)" stroke="var(--text-h)" strokeWidth="2.5" />
      <circle cx="32" cy="35" r="16.5" fill="#fffdf6" stroke="var(--text-h)" strokeWidth="2" />
      {/* Marcas de las horas */}
      <g stroke="var(--text-h)" strokeWidth="2" strokeLinecap="round">
        <path d="M32 20.5v2.5M32 47v2.5M17.5 35H20M44 35h2.5" />
      </g>
      {/* Carita */}
      <circle cx="26.5" cy="31" r="1.8" fill="var(--text-h)" />
      <circle cx="37.5" cy="31" r="1.8" fill="var(--text-h)" />
      <circle cx="24" cy="36" r="2" fill="#ff8fa3" opacity="0.7" />
      <circle cx="40" cy="36" r="2" fill="#ff8fa3" opacity="0.7" />
      <path d="M28 39q4 3.5 8 0" fill="none" stroke="var(--text-h)" strokeWidth="2" strokeLinecap="round" />
      {/* Manecillas */}
      <path d="M32 35l7-8" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="35" r="1.8" fill="var(--accent)" />
      {/* Brillo */}
      <path d="M17 26a17 17 0 0 1 6-8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}
