import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, Sun, X } from 'lucide-react'
import type { NearMirror } from './engine/DuoGame'

const ANGLES = 4

/**
 * Panel del espejo: aparece al acercarse. Cerrado es un botón «Girar espejo»
 * (o la tecla E); abierto muestra ◀ ▶ para girarlo, su posición y si la luz
 * ya llega. Las flechas del teclado giran y Esc o E lo cierran.
 */
export function DuoMirrorPanel({
  mirror,
  open,
  touch,
  onOpen,
  onClose,
  onRotate,
}: {
  mirror: NearMirror
  open: boolean
  touch: boolean
  onOpen: () => void
  onClose: () => void
  onRotate: (dir: 1 | -1) => void
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (event.code === 'KeyE') {
        event.preventDefault()
        if (open) onClose()
        else onOpen()
        return
      }
      if (!open) return
      if (event.code === 'Escape') onClose()
      else if (event.code === 'ArrowLeft' || event.code === 'KeyA' || event.code === 'KeyQ') onRotate(-1)
      else if (event.code === 'ArrowRight' || event.code === 'KeyD') onRotate(1)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpen, onClose, onRotate])

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="absolute bottom-28 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-amber-300 bg-slate-900/90 px-4 py-2 text-[15px] font-bold text-amber-100 shadow-xl sm:bottom-8"
        data-testid="duo-mirror-open"
      >
        <Sun className="h-5 w-5 text-amber-300" /> Girar espejo {!touch && <kbd className="rounded bg-slate-700 px-1.5 text-[12px]">E</kbd>}
      </button>
    )
  }

  const status = mirror.aligned ? (mirror.lit ? '¡La luz pasa por este espejo!' : 'Bien orientado: falta que la luz llegue hasta aquí.') : 'Gíralo hasta que la luz siga su camino.'
  return (
    <div className="absolute bottom-4 left-1/2 z-30 w-[min(340px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border-2 border-amber-300 bg-slate-900/95 p-3 text-white shadow-2xl" role="dialog" aria-label="Girar espejo" data-testid="duo-mirror-panel">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[14px] font-bold text-amber-200">
          <Sun className="h-4 w-4" /> Espejo solar
        </p>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 hover:bg-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => onRotate(-1)} aria-label="Girar a la izquierda" className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-95">
          <ChevronLeft className="h-8 w-8" strokeWidth={3} />
        </button>
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative h-14 w-14 rounded-full border-2 border-slate-500" aria-label={`Posición ${mirror.angle + 1} de ${ANGLES}`} data-angle={mirror.angle}>
            <span
              className={`absolute left-1/2 top-1/2 h-1.5 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-200 ${mirror.aligned ? 'bg-amber-300' : 'bg-sky-300'}`}
              style={{ transform: `translate(-50%, -50%) rotate(${-45 + mirror.angle * 45}deg)` }}
            />
          </div>
          <div className="flex gap-1">
            {Array.from({ length: ANGLES }, (_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === mirror.angle ? 'bg-amber-300' : 'bg-slate-600'}`} />
            ))}
          </div>
        </div>
        <button type="button" onClick={() => onRotate(1)} aria-label="Girar a la derecha" className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-95">
          <ChevronRight className="h-8 w-8" strokeWidth={3} />
        </button>
      </div>
      <p className={`mt-2 text-center text-[13px] font-semibold ${mirror.aligned ? 'text-amber-200' : 'text-slate-300'}`} role="status">
        {status}
      </p>
      {!touch && <p className="mt-1 text-center text-[11px] text-slate-400">← → para girar · E o Esc para cerrar</p>}
    </div>
  )
}
