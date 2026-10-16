import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import type { ReactNode } from 'react'

type AdvancedSettingsProps = {
  /** Qué hay adentro, en pocas palabras (ej. "Dificultad y tablero"). */
  summary?: string
  children: ReactNode
}

/**
 * Ajustes finos plegados por defecto: el usuario novato ve solo lo esencial y
 * los valores por defecto del formulario siguen aplicándose aunque no abra
 * nada. El contenido queda montado (sus valores no se pierden al plegar).
 */
export function AdvancedSettings({ summary = 'Ajustes avanzados', children }: AdvancedSettingsProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[13.5px] font-semibold text-text-h"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          {summary} <span className="font-normal text-text">· opcional</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.4}
        />
      </button>
      <div id={panelId} className="nx-collapse" data-open={open} aria-hidden={!open} inert={!open}>
        <div>
          <div className="flex flex-col gap-4 px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
