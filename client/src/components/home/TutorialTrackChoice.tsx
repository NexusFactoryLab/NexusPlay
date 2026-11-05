import { Compass, Zap } from 'lucide-react'

/**
 * Pantalla obligatoria (sin X, sin Escape) que abre el recorrido de
 * bienvenida de una cuenta nueva (issue #171): elige entre el Tutorial
 * Rápido (el mismo recorrido de siempre, con el texto más puntual) o el
 * Tutorial Completo (texto más completo de cada apartado y, para quien
 * puede crear juegos, una simulación de crear uno al final).
 */
export function TutorialTrackChoice({ includesDemo, onChoose }: { includesDemo: boolean; onChoose: (mode: 'quick' | 'complete') => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Elige tu tutorial"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
    >
      <div className="nx-stage-in w-full max-w-lg rounded-3xl border border-border bg-surface p-6 text-center shadow-[var(--shadow)] sm:p-8">
        <h1 className="text-2xl font-extrabold text-text-h">¿Cómo quieres conocer NexusPlay?</h1>
        <p className="mt-2 text-sm text-text/80">Antes de empezar, un recorrido corto por la página. Elige cómo prefieres verlo:</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onChoose('quick')}
            className="flex flex-col items-start gap-1.5 rounded-2xl border-2 border-border p-4 text-left transition-colors hover:border-accent"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg, var(--accent), var(--color-accent-2, var(--accent)))' }}>
              <Zap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-base font-bold text-text-h">Tutorial Rápido</span>
            <span className="text-sm text-text/80">Lo esencial de cada apartado: dónde está y qué hace.</span>
          </button>
          <button
            type="button"
            onClick={() => onChoose('complete')}
            className="flex flex-col items-start gap-1.5 rounded-2xl border-2 border-border p-4 text-left transition-colors hover:border-accent"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg, var(--accent), var(--color-accent-2, var(--accent)))' }}>
              <Compass className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-base font-bold text-text-h">Tutorial Completo</span>
            <span className="text-sm text-text/80">
              {includesDemo ? 'Todas las funciones de cada apartado y una simulación de crear un juego.' : 'Todas las funciones de cada apartado que puedes usar.'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
