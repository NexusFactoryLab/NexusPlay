import { useState } from 'react'
import { Check } from 'lucide-react'
import { Modal } from './Modal'
import type { GameSummary } from '../../../services/game.service'
import {
  TOURNAMENT_GAME_LABEL,
  TOURNAMENT_LEVEL_DETAIL,
  TOURNAMENT_LEVEL_INFO,
  TOURNAMENT_LEVEL_ORDER,
  type TournamentGameType,
  type TournamentLevel,
} from './tournamentLevels'

/** Debe coincidir con los límites del gateway. */
export const TOURNAMENT_MAX_PARTICIPANTS = 40
export const TOURNAMENT_MAX_ROUNDS = 10
const MIN_PARTICIPANTS = 2
const DEFAULT_ROUNDS = 3

export type TournamentSetup = {
  games: { gameId: string; level: TournamentLevel }[]
  maxParticipants: number
  totalRounds: number
}

type Props = {
  games: GameSummary[]
  loading: boolean
  initialGameId: string | null
  onSubmit: (setup: TournamentSetup) => void
  onCancel: () => void
}

function clamp(value: number, min: number, max: number, fallback: number) {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback
}

/**
 * Armado del torneo (administrador): qué juegos entran, en qué orden y con
 * qué complejidad cada uno. Cada ronda usa el siguiente juego de la lista, así
 * la misma sesión sirve para niños, adolescentes o universitarios con solo
 * cambiar el nivel de cada juego.
 */
export function TournamentSetupForm({ games, loading, initialGameId, onSubmit, onCancel }: Props) {
  const [picks, setPicks] = useState<{ gameId: string; level: TournamentLevel }[]>(
    initialGameId ? [{ gameId: initialGameId, level: 'MEDIUM' }] : [],
  )
  const [maxText, setMaxText] = useState(String(TOURNAMENT_MAX_PARTICIPANTS))
  const [roundsText, setRoundsText] = useState(String(DEFAULT_ROUNDS))
  const [roundsTouched, setRoundsTouched] = useState(false)

  const titleOf = (gameId: string) => games.find((game) => game.id === gameId)?.title ?? 'Juego'
  const levelOf = (gameId: string) => picks.find((pick) => pick.gameId === gameId)?.level

  function toggle(gameId: string) {
    const exists = picks.some((pick) => pick.gameId === gameId)
    const next = exists ? picks.filter((pick) => pick.gameId !== gameId) : [...picks, { gameId, level: 'MEDIUM' as const }]
    setPicks(next)
    // Mientras no se toque a mano, las rondas siguen a la cantidad de juegos (mínimo 3).
    if (!roundsTouched) setRoundsText(String(Math.max(DEFAULT_ROUNDS, next.length)))
  }

  function setLevel(gameId: string, level: TournamentLevel) {
    setPicks((current) => current.map((pick) => (pick.gameId === gameId ? { ...pick, level } : pick)))
  }

  function applyToAll(level: TournamentLevel) {
    setPicks((current) => current.map((pick) => ({ ...pick, level })))
  }

  const canCreate = picks.length > 0

  return (
    <Modal onClose={onCancel} maxWidthClassName="max-w-[620px]" ariaLabel="Crear torneo">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">Administrador</p>
          <h2 className="mt-1 text-[22px] font-bold tracking-tight text-text-h">Crear torneo</h2>
          <p className="mt-0.5 text-[13px] text-text">
            Elige los juegos y la complejidad de cada uno. Cada ronda usa el siguiente juego de la lista.
          </p>
        </div>

        <section className="rounded-2xl border border-border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-text-h">Juegos y complejidad</p>
            {picks.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-text">
                Todos en:
                {TOURNAMENT_LEVEL_ORDER.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="rounded-full border border-border px-2.5 py-1 font-medium text-text-h transition-all duration-200 hover:border-accent/60 hover:text-accent"
                    onClick={() => applyToAll(level)}
                  >
                    {TOURNAMENT_LEVEL_INFO[level].audience}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && <p className="text-[13px] text-text">Cargando juegos habilitados…</p>}
          {!loading && games.length === 0 && (
            <p className="text-[13px] text-text">
              No hay juegos con el torneo habilitado. Habilítalos en Edición con «Habilitar torneo».
            </p>
          )}

          <ul className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
            {games.map((game, index) => {
              const level = levelOf(game.id)
              const order = picks.findIndex((pick) => pick.gameId === game.id)
              return (
                <li
                  key={game.id}
                  className={`stagger-in rounded-xl border p-3 transition-colors duration-200 ${
                    level ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/30'
                  }`}
                  style={{ '--stagger': index } as React.CSSProperties}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 text-left"
                    aria-pressed={level !== undefined}
                    onClick={() => toggle(game.id)}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                        level ? 'border-accent bg-accent text-white' : 'border-border'
                      }`}
                      aria-hidden="true"
                    >
                      {level && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-text-h">{game.title}</span>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-text">
                      {TOURNAMENT_GAME_LABEL[game.gameType as TournamentGameType] ?? game.gameType}
                    </span>
                    {level && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">Ronda {order + 1}</span>}
                  </button>

                  {level && (
                    <div className="mt-3 pl-8">
                      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={`Complejidad de ${game.title}`}>
                        {TOURNAMENT_LEVEL_ORDER.map((option) => {
                          const info = TOURNAMENT_LEVEL_INFO[option]
                          const active = option === level
                          return (
                            <button
                              key={option}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              className={`rounded-lg border px-2 py-1.5 text-center transition-all duration-200 ${
                                active ? `${info.tone} font-semibold` : 'border-border text-text hover:border-accent/40'
                              }`}
                              onClick={() => setLevel(game.id, option)}
                            >
                              <span className="block text-[12.5px] leading-tight">{info.label}</span>
                              <span className="block text-[10.5px] leading-tight opacity-80">{info.audience}</span>
                            </button>
                          )
                        })}
                      </div>
                      <p className="mt-1.5 text-[11.5px] text-text">
                        {TOURNAMENT_LEVEL_DETAIL[(game.gameType as TournamentGameType) in TOURNAMENT_LEVEL_DETAIL ? (game.gameType as TournamentGameType) : 'GUESS_WHO'][level]}
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <label className="rounded-xl border border-border p-3 text-[13px] font-medium text-text-h">
            Cupo máximo
            <input
              type="number"
              min={MIN_PARTICIPANTS}
              max={TOURNAMENT_MAX_PARTICIPANTS}
              value={maxText}
              onChange={(event) => setMaxText(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-text-h outline-none transition-colors duration-200 focus:border-accent"
            />
            <span className="mt-1 block text-[11.5px] font-normal text-text">Hasta {TOURNAMENT_MAX_PARTICIPANTS} personas</span>
          </label>
          <label className="rounded-xl border border-border p-3 text-[13px] font-medium text-text-h">
            Rondas
            <input
              type="number"
              min={1}
              max={TOURNAMENT_MAX_ROUNDS}
              value={roundsText}
              onChange={(event) => {
                setRoundsTouched(true)
                setRoundsText(event.target.value)
              }}
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-text-h outline-none transition-colors duration-200 focus:border-accent"
            />
            <span className="mt-1 block text-[11.5px] font-normal text-text">Quien quede impar juega contra el bot</span>
          </label>
        </div>

        {picks.length > 0 && (
          <p className="text-[12px] text-text">
            <span className="font-semibold text-text-h">Orden: </span>
            {Array.from({ length: clamp(Number(roundsText), 1, TOURNAMENT_MAX_ROUNDS, DEFAULT_ROUNDS) }, (_, round) => {
              const pick = picks[round % picks.length]
              return `${round + 1}. ${titleOf(pick.gameId)} (${TOURNAMENT_LEVEL_INFO[pick.level].label})`
            }).join('  ·  ')}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canCreate}
            className="flex-1 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_14px_26px_-10px_var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            onClick={() =>
              onSubmit({
                games: picks,
                maxParticipants: clamp(Number(maxText), MIN_PARTICIPANTS, TOURNAMENT_MAX_PARTICIPANTS, TOURNAMENT_MAX_PARTICIPANTS),
                totalRounds: clamp(Number(roundsText), 1, TOURNAMENT_MAX_ROUNDS, DEFAULT_ROUNDS),
              })
            }
          >
            {canCreate ? 'Crear sala' : 'Elige al menos un juego'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
