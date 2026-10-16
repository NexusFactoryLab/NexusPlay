import type { CSSProperties } from 'react'
import { GitCompareArrows, ImageIcon } from 'lucide-react'
import type { MemoryMatchMode } from './memoryMatchTypes'

type GameModePickerProps = {
  onClose: () => void
  onSelect: (mode: MemoryMatchMode) => void
}

const MODE_OPTIONS: Array<{
  mode: MemoryMatchMode
  title: string
  description: string
  icon: typeof ImageIcon
}> = [
  {
    mode: 'PAIRS',
    title: 'Pares',
    description: 'Cada carta con imagen se empareja con la carta que nombra ese concepto.',
    icon: ImageIcon,
  },
  {
    mode: 'OPPOSITES',
    title: 'Conceptos opuestos',
    description: 'Empareja un aspecto positivo con su contraparte negativa.',
    icon: GitCompareArrows,
  },
]

/** Primer paso al crear un juego de cartas: elegir la variante de la mecánica de memoria. */
export function GameModePicker({ onClose, onSelect }: GameModePickerProps) {
  return (
    <div className="mx-auto max-w-[900px] p-5 sm:p-8">
      <h2 className="mb-1 text-[20px] tracking-tight text-text-h">Juego de cartas</h2>
      <p className="mb-5 text-[13px] text-text">Elige cómo quieres que funcionen las parejas.</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODE_OPTIONS.map(({ mode, title, description, icon: Icon }, index) => (
          <button
            key={mode}
            type="button"
            title={description}
            style={{ '--i': index, '--tile-color': 'var(--accent)' } as CSSProperties}
            className="nx-tile nx-tile-in flex flex-col items-center gap-2 rounded-xl border border-border p-5 text-center hover:border-accent hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => onSelect(mode)}
          >
            <span
              className="nx-tile-icon flex h-14 w-14 items-center justify-center rounded-xl text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            >
              <Icon className="h-7 w-7" strokeWidth={2} />
            </span>
            <span className="text-[14px] font-semibold leading-tight text-text-h">{title}</span>
            <span className="text-[12.5px] leading-snug text-text">{description}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="mt-5 w-full rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h"
        onClick={onClose}
      >
        Cancelar
      </button>
    </div>
  )
}
