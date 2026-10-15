import { useState, type ReactNode } from 'react'
import { SlidersHorizontal, User, Users, X } from 'lucide-react'
import { MULTI_MODE_COLOR, SOLO_MODE_COLOR, type GameModeFilter } from './gameModeVisuals'
import { Modal } from './Modal'

export type GameTypeFilterOption = {
  gameType: string
  label: string
  count: number
}

type GameFiltersPanelProps = {
  /** Cantidad de juegos ya cargados por cada modo, para mostrar el conteo junto a la casilla (como en Mercado Libre/Amazon). */
  soloCount: number
  multiCount: number
  activeModes: Set<GameModeFilter>
  onToggleMode: (mode: GameModeFilter) => void
  typeOptions: GameTypeFilterOption[]
  activeTypes: Set<string>
  onToggleType: (gameType: string) => void
  onClear: () => void
}

/**
 * Filtro clásico de catálogo (issue #216): un botón "Filtro" que al hacer
 * click abre su propia ventana (Modal) con las casillas agrupadas por
 * sección (Modo de juego / Tipo de juego). Antes era un recuadro flotante
 * dentro del <main>: al abrirse alargaba el área desplazable y aparecía un
 * scroll hacia abajo (issue #47); como ventana queda encima de todo sin
 * mover la página. Se cierra con "Listo", la "X", Escape o tocando fuera. Varias casillas se combinan a la vez (OR dentro de cada
 * sección, AND entre secciones) y el filtrado es 100% en cliente sobre los
 * juegos ya cargados por GamesSection — no dispara peticiones nuevas.
 */
export function GameFiltersPanel({
  soloCount,
  multiCount,
  activeModes,
  onToggleMode,
  typeOptions,
  activeTypes,
  onToggleType,
  onClear,
}: GameFiltersPanelProps) {
  const [open, setOpen] = useState(false)
  const hasActiveFilters = activeModes.size > 0 || activeTypes.size > 0
  const activeCount = activeModes.size + activeTypes.size

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="game-filters-btn flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-h transition-colors hover:border-accent"
      >
        <SlidersHorizontal className="h-4 w-4" strokeWidth={2.5} />
        Filtro
        {hasActiveFilters && (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10.5px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} maxWidthClassName="max-w-[380px]" ariaLabelledBy="game-filters-title">
          <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2">
            <h2 id="game-filters-title" className="text-[20px] tracking-tight text-text-h">Filtro</h2>
            <button
              type="button"
              aria-label="Cerrar filtro"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-text hover:bg-code-bg hover:text-text-h"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClear}
              className="self-start text-[12px] font-medium text-accent hover:underline"
            >
              Limpiar filtros
            </button>
          )}

          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-text/70">Modo de juego</h3>
            <div className="flex flex-col gap-2">
              <FilterCheckbox
                label="1 jugador"
                count={soloCount}
                checked={activeModes.has('SOLO')}
                onChange={() => onToggleMode('SOLO')}
                icon={<User className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: SOLO_MODE_COLOR }} />}
              />
              <FilterCheckbox
                label="Multijugador"
                count={multiCount}
                checked={activeModes.has('MULTI')}
                onChange={() => onToggleMode('MULTI')}
                icon={<Users className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: MULTI_MODE_COLOR }} />}
              />
            </div>
          </div>

          {typeOptions.length > 0 && (
            <div>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-text/70">Tipo de juego</h3>
              <div className="scroll-fade flex max-h-[260px] flex-col gap-2 overflow-y-auto pr-1">
                {typeOptions.map((option) => (
                  <FilterCheckbox
                    key={option.gameType}
                    label={option.label}
                    count={option.count}
                    checked={activeTypes.has(option.gameType)}
                    onChange={() => onToggleType(option.gameType)}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            Listo
          </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function FilterCheckbox({
  label,
  count,
  checked,
  onChange,
  icon,
}: {
  label: string
  count: number
  checked: boolean
  onChange: () => void
  icon?: ReactNode
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-text-h">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-[15px] w-[15px] shrink-0 rounded border-border text-accent focus:ring-accent"
      />
      {icon}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[12px] text-text/60">{count}</span>
    </label>
  )
}
