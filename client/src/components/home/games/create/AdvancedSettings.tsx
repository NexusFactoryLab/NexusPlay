import { ChevronDown, SlidersHorizontal } from 'lucide-react'
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
    <div className="nx-card nx-collapsible" data-tone="2" data-open={open}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className="nx-collapsible-btn"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="nx-card-icon" aria-hidden="true">
          <SlidersHorizontal className="h-[19px] w-[19px]" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="nx-card-title block">{summary}</span>
          <span className="nx-card-sub block">Opcional · los valores por defecto ya funcionan bien</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.4}
        />
      </button>
      <div id={panelId} className="nx-collapse" data-open={open} aria-hidden={!open} inert={!open}>
        <div>
          <div className="nx-card-body nx-collapsible-body">{children}</div>
        </div>
      </div>
    </div>
  )
}
