import { useState } from 'react'
import { Check } from 'lucide-react'
import { Modal } from './Modal'
import type { GameSummary } from '../../../services/game.service'
import type { SaveTournamentSettingsInput, TournamentSettings } from '../../../services/tournament-settings.service'
import {
  TOURNAMENT_GAME_LABEL,
  TOURNAMENT_LEVEL_DETAIL,
  TOURNAMENT_LEVEL_INFO,
  TOURNAMENT_LEVEL_ORDER,
  type TournamentGameType,
  type TournamentLevel,
} from './tournamentLevels'

/** Deben coincidir con los límites del servidor (tournament-settings.repository.port.ts). */
export const TOURNAMENT_MAX_PARTICIPANTS = 40
export const TOURNAMENT_MAX_ROUNDS = 10
export const TOURNAMENT_MAX_GAMES = 5
const MIN_PARTICIPANTS = 2
const DEFAULT_ROUNDS = 3

type Props = {
  /** Juegos publicados que admiten torneo. */
  games: GameSummary[]
  loading: boolean
  /** Torneo habilitado hoy, para editarlo; `null` si no hay. */
  current: TournamentSettings | null
  saving: boolean
  onSubmit: (settings: SaveTournamentSettingsInput) => void
  onDisable: () => void
  onCancel: () => void
}

function clamp(value: number, min: number, max: number, fallback: number) {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback
}

/**
 * Habilitar el torneo (administrador): qué juegos entran y con qué complejidad
 * cada uno, el cupo y las rondas. En cada ronda se sortea uno de los juegos
 * elegidos al azar, para que no se vuelva monótono. Al guardar, el Inicio le
 * ofrece a todos entrar con código y el administrador abre la sala desde ahí.
 */
export function TournamentSettingsModal({ games, loading, current, saving, onSubmit, onDisable, onCancel }: Props) {
  const [picks, setPicks] = useState<{ gameId: string; level: TournamentLevel }[]>(
    () => current?.games.map(({ gameId, level }) => ({ gameId, level })) ?? [],
  )
  const [maxText, setMaxText] = useState(String(current?.maxParticipants || TOURNAMENT_MAX_PARTICIPANTS))
  const [roundsText, setRoundsText] = useState(String(current?.totalRounds || DEFAULT_ROUNDS))

  const levelOf = (gameId: string) => picks.find((pick) => pick.gameId === gameId)?.level

  function toggle(gameId: string) {
    setPicks((existing) => {
      if (existing.some((pick) => pick.gameId === gameId)) return existing.filter((pick) => pick.gameId !== gameId)
      if (existing.length >= TOURNAMENT_MAX_GAMES) return existing
      return [...existing, { gameId, level: 'MEDIUM' as const }]
    })
  }

  function setLevel(gameId: string, level: TournamentLevel) {
    setPicks((existing) => existing.map((pick) => (pick.gameId === gameId ? { ...pick, level } : pick)))
  }

  function applyToAll(level: TournamentLevel) {
    setPicks((existing) => existing.map((pick) => ({ ...pick, level })))
  }

  const canSave = picks.length > 0 && !saving
  const atLimit = picks.length >= TOURNAMENT_MAX_GAMES

  return (
    <Modal onClose={onCancel} maxWidthClassName="max-w-[620px]" ariaLabel="Habilitar torneo">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">Administrador</p>
          <h2 className="mt-1 text-[22px] font-bold tracking-tight text-text-h">
            {current?.enabled ? 'Editar torneo' : 'Habilitar torneo'}
          </h2>
          <p className="mt-0.5 text-[13px] text-text">
            Elige los juegos del torneo y la complejidad de cada uno. En cada ronda se sortea uno de ellos al azar y nunca se repite el de la ronda anterior (con 2 o más juegos), para que no se vuelva monótono.
          </p>
        </div>

        <section className="rounded-2xl border border-border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-text-h">
              Juegos y complejidad{' '}
              <span className="font-normal text-text">
                ({picks.length}/{TOURNAMENT_MAX_GAMES})
              </span>
            </p>
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

          {loading && <p className="text-[13px] text-text">Cargando juegos…</p>}
          {!loading && games.length === 0 && (
            <p className="text-[13px] text-text">
              No hay juegos publicados de ¿Quién Es? o Dominó. Publica alguno para armar el torneo.
            </p>
          )}

          <ul className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1">
            {games.map((game, index) => {
              const level = levelOf(game.id)
              const blocked = level === undefined && atLimit
              return (
                <li
                  key={game.id}
                  className={`stagger-in rounded-xl border p-3 transition-colors duration-200 ${
                    level ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/30'
                  } ${blocked ? 'opacity-50' : ''}`}
                  style={{ '--stagger': index } as React.CSSProperties}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 text-left disabled:cursor-not-allowed"
                    aria-pressed={level !== undefined}
                    disabled={blocked}
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
          {atLimit && <p className="mt-2 text-[11.5px] text-text">Máximo {TOURNAMENT_MAX_GAMES} juegos por torneo.</p>}
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
              onChange={(event) => setRoundsText(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-text-h outline-none transition-colors duration-200 focus:border-accent"
            />
            <span className="mt-1 block text-[11.5px] font-normal text-text">Quien quede impar juega contra el bot</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {current?.enabled && (
            <button
              type="button"
              disabled={saving}
              className="rounded-lg border border-danger/50 px-4 py-2.5 text-[14px] font-medium text-danger transition-all duration-200 hover:bg-danger/10 disabled:opacity-60"
              onClick={onDisable}
            >
              Deshabilitar
            </button>
          )}
          <button
            type="button"
            className="min-w-[110px] flex-1 rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSave}
            className="min-w-[160px] flex-1 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_14px_26px_-10px_var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            onClick={() =>
              onSubmit({
                games: picks,
                maxParticipants: clamp(Number(maxText), MIN_PARTICIPANTS, TOURNAMENT_MAX_PARTICIPANTS, TOURNAMENT_MAX_PARTICIPANTS),
                totalRounds: clamp(Number(roundsText), 1, TOURNAMENT_MAX_ROUNDS, DEFAULT_ROUNDS),
              })
            }
          >
            {picks.length === 0 ? 'Elige al menos un juego' : saving ? 'Guardando…' : current?.enabled ? 'Guardar cambios' : 'Habilitar torneo'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
