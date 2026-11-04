import type { CSSProperties } from 'react'
import './tournamentCelebration.css'

const COLORS = ['#ff7a1a', '#06b6d4', '#ff4f9a', '#ffc83d', '#7b5cff', '#22c55e']
const PIECES = 36

// Posiciones y tiempos fijos (sin Math.random): el mismo render siempre da el mismo confeti.
const pieces = Array.from({ length: PIECES }, (_, index) => ({
  left: `${(index * 97) % 100}%`,
  color: COLORS[index % COLORS.length],
  delay: (index * 83) % 900,
  fall: 2600 + ((index * 131) % 1400),
  drift: ((index * 53) % 160) - 80,
  spin: 360 + ((index * 71) % 540),
}))

/** Lluvia de confeti de una sola pasada: celebra el final del torneo sin quedarse en pantalla. */
export function TournamentConfetti() {
  return (
    <div className="tournament-confetti" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="tournament-confetti__piece"
          style={
            {
              left: piece.left,
              background: piece.color,
              '--delay': `${piece.delay}ms`,
              '--fall-ms': `${piece.fall}ms`,
              '--drift': `${piece.drift}px`,
              '--spin': `${piece.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
