import { DOMINO_LEVEL_INFO, DOMINO_LEVEL_ORDER } from './dominoLevels'
import type { DominoLevel } from './dominoTypes'

type Props = {
  level: DominoLevel
  isHost: boolean
  disabled: boolean
  onChange: (level: DominoLevel) => void
}

/**
 * Selector de nivel del lobby: el anfitrión elige, el invitado solo lo ve
 * (antes de marcarse listo). Se monta en el espacio `settings` del lobby.
 */
export function DominoLevelPicker({ level, isHost, disabled, onChange }: Props) {
  return (
    <div className="rounded-[22px] border border-border bg-surface p-4 shadow-[var(--shadow)]" data-domino-level-picker>
      <p className="mb-2 text-[13px] font-semibold text-text-h">Nivel</p>
      {isHost ? (
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Nivel de la partida">
          {DOMINO_LEVEL_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={level === option}
              disabled={disabled}
              onClick={() => level !== option && onChange(option)}
              className={`rounded-lg border px-3 py-1.5 text-left text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                level === option ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-h hover:border-accent/40'
              }`}
            >
              {DOMINO_LEVEL_INFO[option].label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-text">
          Nivel: <strong className="text-text-h">{DOMINO_LEVEL_INFO[level].label}</strong> (lo define quien creó la sala).
        </p>
      )}
      <p className="mt-2 text-[11.5px] leading-snug text-text">{DOMINO_LEVEL_INFO[level].description}</p>
    </div>
  )
}
