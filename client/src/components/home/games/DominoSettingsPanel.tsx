import { useId, useState, type KeyboardEvent } from 'react'
import { Timer } from 'lucide-react'
import { DOMINO_LEVEL_INFO, DOMINO_LEVEL_ORDER, DOMINO_TURN_PRESETS } from './dominoLevels'
import type { DominoLevel } from './dominoTypes'

const MIN_TURN = 5
const MAX_TURN = 120

type Props = {
  level: DominoLevel
  turnDurationSeconds: number
  isHost: boolean
  disabled: boolean
  onChangeLevel: (level: DominoLevel) => void
  onUpdateTurnDuration: (seconds: number) => void
}

/**
 * Panel de ajustes unificado del lobby de Dominexo (nivel + segundos por turno).
 * El anfitrión ve controles; el invitado ve un resumen de solo lectura. Pensado
 * para leerse sin acercarse: texto ≥ 16 px, controles ≥ 48 px. Las animaciones
 * son transiciones CSS y se anulan con prefers-reduced-motion.
 */
export function DominoSettingsPanel({ level, turnDurationSeconds, isHost, disabled, onChangeLevel, onUpdateTurnDuration }: Props) {
  const info = DOMINO_LEVEL_INFO[level]
  const durationId = useId()
  const [durationText, setDurationText] = useState(String(turnDurationSeconds))
  const [previousDuration, setPreviousDuration] = useState(turnDurationSeconds)
  // Si el servidor cambia el valor (otro cambio o un nivel nuevo), el campo se sincroniza.
  if (previousDuration !== turnDurationSeconds) {
    setPreviousDuration(turnDurationSeconds)
    setDurationText(String(turnDurationSeconds))
  }

  function handleLevelKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = DOMINO_LEVEL_ORDER[(index + step + DOMINO_LEVEL_ORDER.length) % DOMINO_LEVEL_ORDER.length]
    onChangeLevel(next)
    // El foco sigue a la selección (patrón radiogroup).
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-level="${next}"]`)?.focus()
  }

  const description = (
    <p key={level} className="animate-[fade-in-up_0.25s_ease-out] text-[1rem] leading-relaxed text-text motion-reduce:animate-none" aria-live="polite">
      {info.description}
    </p>
  )

  if (!isHost) {
    const Icon = info.icon
    return (
      <section className="rounded-[22px] border border-border bg-surface p-5 shadow-[var(--shadow)]" aria-label="Ajustes de la partida" data-domino-settings="readonly">
        <p className="mb-3 text-[1rem] font-semibold text-text">Ajustes · los define quien creó la sala</p>
        <div className="flex items-start gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: `color-mix(in srgb, ${info.color} 16%, transparent)`, color: info.color }}
          >
            <Icon className="h-9 w-9" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[1.375rem] font-bold leading-tight text-text-h">Nivel {info.label}</p>
            {description}
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-[1.125rem] text-text">
          <Timer className="h-6 w-6 text-accent" aria-hidden="true" />
          <strong className="text-text-h tabular-nums">{turnDurationSeconds} s</strong> por turno
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-[22px] border border-border bg-surface p-5 shadow-[var(--shadow)]" aria-label="Ajustes de la partida" data-domino-settings="host">
      <p className="mb-3 text-[1.125rem] font-semibold text-text-h">Nivel</p>
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Nivel de la partida">
        {DOMINO_LEVEL_ORDER.map((option, index) => {
          const { label, icon: Icon, color } = DOMINO_LEVEL_INFO[option]
          const selected = option === level
          return (
            <button
              key={option}
              type="button"
              role="radio"
              data-level={option}
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => !selected && onChangeLevel(option)}
              onKeyDown={(event) => handleLevelKey(event, index)}
              className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border-2 px-2 py-3 text-[1.125rem] font-bold text-text-h transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
              style={{
                borderColor: selected ? color : 'var(--border)',
                background: selected ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
              }}
            >
              <Icon className={`h-8 w-8 transition-transform duration-200 motion-reduce:transition-none ${selected ? 'scale-110' : ''}`} style={{ color }} strokeWidth={2.2} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>
      <div className="mt-3 min-h-[3.5rem]">{description}</div>

      <div className="mt-4 border-t border-border pt-4">
        <label htmlFor={durationId} className="mb-3 flex items-center gap-2 text-[1.125rem] font-semibold text-text-h">
          <Timer className="h-6 w-6 text-accent" aria-hidden="true" />
          Segundos por turno
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {DOMINO_TURN_PRESETS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              aria-pressed={turnDurationSeconds === seconds}
              disabled={disabled}
              onClick={() => turnDurationSeconds !== seconds && onUpdateTurnDuration(seconds)}
              className={`min-h-[48px] min-w-[64px] rounded-full border-2 px-4 text-[1.0625rem] font-semibold tabular-nums transition-all duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 ${
                turnDurationSeconds === seconds ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text-h hover:border-accent/50'
              }`}
            >
              {seconds} s
            </button>
          ))}
          <input
            id={durationId}
            type="number"
            min={MIN_TURN}
            max={MAX_TURN}
            inputMode="numeric"
            disabled={disabled}
            value={durationText}
            className="min-h-[48px] w-[88px] rounded-xl border-2 border-border bg-bg px-2 text-center text-[1.125rem] font-bold tabular-nums text-text-h outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            onChange={(event) => {
              const raw = event.target.value
              setDurationText(raw)
              const parsed = Number(raw)
              if (raw.trim() !== '' && Number.isInteger(parsed) && parsed >= MIN_TURN && parsed <= MAX_TURN) onUpdateTurnDuration(parsed)
            }}
          />
        </div>
        <p className="mt-2 text-[0.9375rem] text-text">Entre {MIN_TURN} y {MAX_TURN} s. Si nadie actúa, el turno pasa solo.</p>
      </div>
    </section>
  )
}
