import { GraduationCap, Play } from 'lucide-react'

/**
 * Cierre de la guía visual (issue #93): «¿Deseas jugar un tutorial?».
 * Sí abre el tutorial jugable sobre el juego de verdad; No entra directo.
 */
export function TutorialQuestion({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div
      role="group"
      aria-label="¿Deseas jugar un tutorial?"
      className="flex w-full flex-col gap-2.5 rounded-2xl border border-accent/35 bg-accent/5 p-3 sm:flex-row sm:items-center"
    >
      <p className="flex min-w-0 flex-1 items-center gap-2.5 text-[14.5px] leading-tight font-bold text-text-h">
        <GraduationCap className="h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
        <span>
          ¿Deseas jugar un tutorial?
          <span className="mt-0.5 block text-[12px] font-medium text-text/75">Practicas en el juego de verdad, paso a paso.</span>
        </span>
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          autoFocus
          onClick={onYes}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_22px_-12px_var(--accent)] transition-transform hover:-translate-y-0.5 sm:flex-none"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2, var(--accent)))' }}
        >
          Sí
        </button>
        <button
          type="button"
          onClick={onNo}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold text-text-h transition-colors hover:border-accent hover:text-accent sm:flex-none"
        >
          <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" /> No, ir al juego
        </button>
      </div>
    </div>
  )
}
