import { ArrowBigUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DuoInput } from './shared/duoTypes'

/**
 * Controles en pantalla para celular: mover a la izquierda (pulgar izquierdo)
 * y saltar a la derecha. Cada botón usa eventos de puntero con captura, así
 * deslizar el dedo fuera del botón no lo deja pegado.
 */
export function DuoTouchControls({ onChange }: { onChange: (key: keyof DuoInput, down: boolean) => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3 pb-[max(12px,env(safe-area-inset-bottom))]" data-testid="duo-touch">
      <div className="pointer-events-auto flex gap-2">
        <Pad label="Izquierda" k="left" onChange={onChange}>
          <ChevronLeft className="h-9 w-9" strokeWidth={3} />
        </Pad>
        <Pad label="Derecha" k="right" onChange={onChange}>
          <ChevronRight className="h-9 w-9" strokeWidth={3} />
        </Pad>
      </div>
      <div className="pointer-events-auto flex items-end gap-2">
        <Pad label="Bajar" k="down" onChange={onChange} small>
          <ChevronDown className="h-6 w-6" strokeWidth={3} />
        </Pad>
        <Pad label="Saltar" k="jump" onChange={onChange} big>
          <ArrowBigUp className="h-10 w-10" strokeWidth={2.5} />
        </Pad>
      </div>
    </div>
  )
}

function Pad({
  label,
  k,
  onChange,
  children,
  big = false,
  small = false,
}: {
  label: string
  k: keyof DuoInput
  onChange: (key: keyof DuoInput, down: boolean) => void
  children: ReactNode
  big?: boolean
  small?: boolean
}) {
  const size = big ? 'h-[84px] w-[84px]' : small ? 'h-[52px] w-[52px]' : 'h-[72px] w-[72px]'
  return (
    <button
      type="button"
      aria-label={label}
      className={`${size} flex touch-none items-center justify-center rounded-full border-2 border-white/40 bg-slate-900/55 text-white shadow-lg backdrop-blur active:scale-95 active:bg-white/30`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        onChange(k, true)
      }}
      onPointerUp={() => onChange(k, false)}
      onPointerCancel={() => onChange(k, false)}
      onLostPointerCapture={() => onChange(k, false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
  )
}
