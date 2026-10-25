import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, User, Users, X } from 'lucide-react'
import { MULTI_MODE_COLOR, SOLO_MODE_COLOR, type GameModeFilter } from './gameModeVisuals'
import type { GameTypeFilterOption } from './GameFiltersPanel'

export type GameAreaFilterOption = {
  id: string
  name: string
  count: number
}

type GameFilterBarProps = {
  total: number
  shown: number
  typeOptions: GameTypeFilterOption[]
  activeTypes: Set<string>
  onToggleType: (gameType: string) => void
  onClearTypes: () => void
  soloCount: number
  multiCount: number
  /** `null` = cualquier cantidad de jugadores. */
  activeMode: GameModeFilter | null
  onModeChange: (mode: GameModeFilter | null) => void
  areaOptions: GameAreaFilterOption[]
  activeAreaId: string | null
  onAreaChange: (areaId: string | null) => void
  onClearAll: () => void
}

/**
 * Filtro siempre visible sobre la cuadrícula (issue #100). Reemplaza al botón
 * "Filtro" con ventana: las opciones se ven sin abrir nada, el resultado cambia
 * al instante y cada control dice con palabras simples qué hace.
 *   1. Tipo de juego: chips que se pueden combinar ("Todos" los quita).
 *   2. Cuántos juegan: 1 jugador o Multijugador.
 *   3. Área: lista desplegable.
 * El filtrado es en cliente sobre los juegos ya cargados.
 */
export function GameFilterBar({
  total,
  shown,
  typeOptions,
  activeTypes,
  onToggleType,
  onClearTypes,
  soloCount,
  multiCount,
  activeMode,
  onModeChange,
  areaOptions,
  activeAreaId,
  onAreaChange,
  onClearAll,
}: GameFilterBarProps) {
  const hasActiveFilters = activeTypes.size > 0 || activeMode !== null || activeAreaId !== null
  const showModes = soloCount > 0 && multiCount > 0
  const showAreas = areaOptions.length > 1

  return (
    <div className="flex flex-col gap-2.5" role="search" aria-label="Filtrar juegos">
      {typeOptions.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de juego">
          <Chip active={activeTypes.size === 0} onClick={onClearTypes}>
            Todos
          </Chip>
          {typeOptions.map((option) => (
            <Chip
              key={option.gameType}
              active={activeTypes.has(option.gameType)}
              onClick={() => onToggleType(option.gameType)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {showModes && (
            <FilterDropdown
              label="Jugadores"
              value={activeMode ?? ''}
              onChange={(value) => onModeChange(value === 'SOLO' || value === 'MULTI' ? value : null)}
              options={[
                { value: '', label: 'Todos' },
                {
                  value: 'SOLO',
                  label: '1 jugador',
                  count: soloCount,
                  icon: <User className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: SOLO_MODE_COLOR }} />,
                },
                {
                  value: 'MULTI',
                  label: 'Multijugador',
                  count: multiCount,
                  icon: <Users className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: MULTI_MODE_COLOR }} />,
                },
              ]}
            />
          )}

          {showAreas && (
            <FilterDropdown
              label="Área"
              value={activeAreaId ?? ''}
              onChange={(value) => onAreaChange(value || null)}
              options={[
                { value: '', label: 'Todas' },
                ...areaOptions.map((area) => ({ value: area.id, label: area.name, count: area.count })),
              ]}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <p className="text-[12.5px] text-text/70" aria-live="polite">
            {shown} {shown === 1 ? 'juego' : 'juegos'}
            {shown !== total ? ` de ${total}` : ''}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-medium text-accent hover:bg-accent/10"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              Quitar filtros
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${
        active ? 'bg-accent text-white' : 'bg-code-bg text-text-h hover:bg-border'
      }`}
    >
      {children}
    </button>
  )
}

type DropdownOption = { value: string; label: string; count?: number; icon?: ReactNode }

/**
 * Desplegable propio (no el <select> nativo, que no sigue el diseño): mismo
 * aspecto que el menú del perfil. Cierra con Escape o al tocar fuera.
 */
function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]
  const isFiltering = value !== ''

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${
          isFiltering ? 'bg-accent/10 text-accent' : 'bg-code-bg text-text-h hover:bg-border'
        }`}
      >
        <span className={isFiltering ? '' : 'text-text/70'}>{label}:</span>
        {selected.icon}
        <span className="max-w-[140px] truncate">{selected.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.5} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 z-30 mt-2 max-h-[280px] min-w-[200px] overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-[var(--shadow)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] hover:bg-code-bg ${
                  isSelected ? 'font-semibold text-accent' : 'text-text-h'
                }`}
              >
                {option.icon}
                <span className="flex-1 truncate">{option.label}</span>
                {option.count !== undefined && <span className="text-[12px] text-text/60">{option.count}</span>}
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
