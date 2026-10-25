import type { ReactNode } from 'react'
import { User, Users, X } from 'lucide-react'
import {
  MULTI_MODE_COLOR,
  SOLO_MODE_COLOR,
  modeColorForGameType,
  type GameModeFilter,
} from './gameModeVisuals'
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
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3.5" role="search" aria-label="Filtrar juegos">
      {typeOptions.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-text/70">Tipo de juego</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de juego">
            <Chip active={activeTypes.size === 0} onClick={onClearTypes}>
              Todos <Count>{total}</Count>
            </Chip>
            {typeOptions.map((option) => (
              <Chip
                key={option.gameType}
                active={activeTypes.has(option.gameType)}
                onClick={() => onToggleType(option.gameType)}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: modeColorForGameType(option.gameType) }}
                  aria-hidden="true"
                />
                {option.label} <Count>{option.count}</Count>
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          {showModes && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-text/70">Cuántos juegan</span>
              <div className="flex gap-1 rounded-lg border border-border p-1" role="group" aria-label="Cuántos juegan">
                <Segment active={activeMode === null} onClick={() => onModeChange(null)}>
                  Todos
                </Segment>
                <Segment active={activeMode === 'SOLO'} onClick={() => onModeChange('SOLO')}>
                  <User className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: activeMode === 'SOLO' ? undefined : SOLO_MODE_COLOR }} />
                  1 jugador
                </Segment>
                <Segment active={activeMode === 'MULTI'} onClick={() => onModeChange('MULTI')}>
                  <Users className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: activeMode === 'MULTI' ? undefined : MULTI_MODE_COLOR }} />
                  Multijugador
                </Segment>
              </div>
            </div>
          )}

          {showAreas && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-text/70">Área</span>
              <select
                value={activeAreaId ?? ''}
                onChange={(event) => onAreaChange(event.target.value || null)}
                className="min-w-[180px] rounded-lg border border-border bg-surface px-3 py-[7px] text-[13px] text-text-h focus:border-accent focus:outline-none"
              >
                <option value="">Todas las áreas</option>
                {areaOptions.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({area.count})
                  </option>
                ))}
              </select>
            </label>
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
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
        active
          ? 'border-accent bg-accent text-white'
          : 'border-border bg-surface text-text-h hover:border-accent'
      }`}
    >
      {children}
    </button>
  )
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors ${
        active ? 'bg-accent text-white' : 'text-text hover:bg-code-bg hover:text-text-h'
      }`}
    >
      {children}
    </button>
  )
}

function Count({ children }: { children: ReactNode }) {
  return <span className="text-[11.5px] opacity-70">{children}</span>
}
