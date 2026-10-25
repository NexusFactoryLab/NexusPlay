import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { DOMINO_LEVEL_INFO, DOMINO_LEVEL_ORDER } from './dominoLevels'

/**
 * Los tres niveles como tarjetas compactas para la guía: icono, nombre y una
 * línea. El detalle de cada nivel queda bajo demanda ("Ver más").
 */
export function DominoLevelCards() {
  const [open, setOpen] = useState(false)
  const detailId = useId()
  return (
    <div className="relative space-y-2" data-domino-levels>
      <ul className="grid grid-cols-3 gap-2">
        {DOMINO_LEVEL_ORDER.map((level) => {
          const { label, short, icon: Icon, color } = DOMINO_LEVEL_INFO[level]
          return (
            <li
              key={level}
              className="flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2.5 text-center"
              style={{ borderColor: `color-mix(in srgb, ${color} 55%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
            >
              <Icon className="h-6 w-6" style={{ color }} strokeWidth={2.2} aria-hidden="true" />
              <span className="text-[14px] font-bold leading-tight text-text-h">{label}</span>
              <span className="text-[12px] leading-tight text-text">{short}</span>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((value) => !value)}
        className="mx-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-accent focus-visible:outline-2 focus-visible:outline-accent"
      >
        {open ? 'Ver menos' : 'Ver más'}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {/* grid-rows 0fr→1fr anima la altura sin medirla. */}
      <div
        id={detailId}
        className={`grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <ul className="min-h-0 space-y-1 overflow-hidden text-[12.5px] leading-snug text-text" aria-hidden={!open}>
          {DOMINO_LEVEL_ORDER.map((level) => (
            <li key={level}><strong className="text-text-h">{DOMINO_LEVEL_INFO[level].label}:</strong> {DOMINO_LEVEL_INFO[level].description}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
