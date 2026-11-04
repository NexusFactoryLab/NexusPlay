import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'

/**
 * Las cuatro flechas del teclado como teclitas en línea, para las indicaciones de movimiento
 * (W A S D también funcionan, pero lo que se muestra siempre son las flechas).
 */
export function ArrowKeysInline({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'h-9 w-9 rounded-lg border-b-4' : 'h-[1.45em] w-[1.45em] rounded-[5px] border-b-2'
  const icon = size === 'lg' ? 'h-5 w-5' : 'h-[0.85em] w-[0.85em]'
  return (
    <span className="inline-flex items-center gap-[0.2em] align-middle" role="img" aria-label="Flechas del teclado">
      {[ArrowLeft, ArrowUp, ArrowDown, ArrowRight].map((Icon, i) => (
        <span key={i} className={`inline-flex items-center justify-center border border-white/40 border-b-white/25 bg-white/15 text-white ${box}`}>
          <Icon className={icon} strokeWidth={3} aria-hidden="true" />
        </span>
      ))}
    </span>
  )
}
