import { useEffect, useMemo, useState } from 'react'
import { Check, DoorOpen, Flag, Gamepad2, Pencil, PowerOff, Shuffle, Swords, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import { listGames, type GameSummary } from '../../../services/game.service'
import {
  clearTournamentSettings,
  getTournamentSettings,
  saveTournamentSettings,
  type TournamentSettings,
} from '../../../services/tournament-settings.service'
import { listTournamentHistory, type TournamentHistoryItem } from '../../../services/tournament-history.service'
import { ApiError } from '../../../utils/http'
import { TournamentConfirmModal } from './TournamentConfirmModal'
import { TournamentGamePicker, levelDetail } from './TournamentGamePicker'
import { historyTitle } from './tournamentHistoryReport'
import { TOURNAMENT_GAME_LABEL, TOURNAMENT_LEVEL_INFO, TOURNAMENT_LEVEL_ORDER, type TournamentGameType, type TournamentLevel } from './tournamentLevels'
import {
  TOURNAMENT_DEFAULT_ROUNDS,
  TOURNAMENT_MAX_GAMES,
  TOURNAMENT_MAX_PARTICIPANTS,
  TOURNAMENT_MAX_ROUNDS,
  TOURNAMENT_MIN_PARTICIPANTS,
  clampInt,
  findOpenRoom,
  setAllLevels,
  setPickLevel,
  togglePick,
  tournamentCandidates,
  type TournamentPick,
} from './tournamentSetup'
import './tournamentSetup.css'

export type SetupView = 'prepare' | 'open'

type StepsProps = {
  view: SetupView
  /** Hay un torneo preparado: sin él, «Abre la sala» todavía no se puede visitar. */
  prepared: boolean
  onGo: (view: SetupView) => void
}

/**
 * Los dos pasos de un torneo, y cada uno es un lugar real de esta pantalla: «Prepara» (elegir juegos) y
 * «Abre la sala» (el torneo ya listo). La barra se llena al pasar al segundo.
 */
export function TournamentSetupSteps({ view, prepared, onGo }: StepsProps) {
  const preparedDone = prepared && view === 'open'
  return (
    <ol className="tsu-steps m-0 list-none p-0" aria-label="Pasos para un torneo">
      <li>
        <button type="button" className="tsu-step" aria-current={view === 'prepare' ? 'step' : undefined} data-done={preparedDone} onClick={() => onGo('prepare')}>
          <span className="tsu-step__dot" aria-hidden="true">
            {preparedDone ? <Check className="tsu-pop h-4 w-4" strokeWidth={3} /> : 1}
          </span>
          <span>
            <span className="tsu-step__title">Prepara</span>
            <span className="tsu-step__hint">Elige los juegos y las reglas</span>
          </span>
        </button>
      </li>
      <li className="tsu-steps__bar" data-filled={view === 'open'} aria-hidden="true" />
      <li>
        <button
          type="button"
          className="tsu-step"
          aria-current={view === 'open' ? 'step' : undefined}
          disabled={!prepared}
          title={prepared ? undefined : 'Primero prepara el torneo'}
          onClick={() => onGo('open')}
        >
          <span className="tsu-step__dot" aria-hidden="true">
            2
          </span>
          <span>
            <span className="tsu-step__title">Abre la sala</span>
            <span className="tsu-step__hint">Comparte el código y modera</span>
          </span>
        </button>
      </li>
    </ol>
  )
}

function LevelChip({ level }: { level: TournamentLevel }) {
  return <span className={`tsu-chip tsu-lv--${level.toLowerCase()}`}>{TOURNAMENT_LEVEL_INFO[level].label}</span>
}

type NumberFieldProps = { id: string; label: string; hint: string; value: string; min: number; max: number; fallback: number; onChange: (value: string) => void }

/** Número con − y +, para no depender de las flechitas diminutas del navegador. */
function NumberField({ id, label, hint, value, min, max, fallback, onChange }: NumberFieldProps) {
  const current = clampInt(Number(value), min, max, fallback)
  return (
    <div className="tsu-field">
      <div>
        <label htmlFor={id}>{label}</label>
        <small>{hint}</small>
      </div>
      <div className="tsu-stepper">
        <button type="button" aria-label={`Menos ${label.toLowerCase()}`} disabled={current <= min} onClick={() => onChange(String(current - 1))}>
          −
        </button>
        <input id={id} type="text" inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={() => onChange(String(current))} />
        <button type="button" aria-label={`Más ${label.toLowerCase()}`} disabled={current >= max} onClick={() => onChange(String(current + 1))}>
          +
        </button>
      </div>
    </div>
  )
}

/**
 * Torneos del administrador (issue #147), pestaña «Preparar y abrir»: en dos pasos, sin ventanas emergentes.
 * 1) Elegir los juegos en una cuadrícula con buscador y filtros, y fijar rondas y cupo. 2) Ver el torneo
 * preparado y abrir la sala. También es el lugar para volver a una sala abierta y para deshabilitar el torneo.
 */
export function TournamentSetupPanel() {
  const { token } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [games, setGames] = useState<GameSummary[]>([])
  const [gamesLoading, setGamesLoading] = useState(true)
  const [tournament, setTournament] = useState<TournamentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<SetupView>('prepare')
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [picks, setPicks] = useState<TournamentPick[]>([])
  const [roundsText, setRoundsText] = useState(String(TOURNAMENT_DEFAULT_ROUNDS))
  const [maxText, setMaxText] = useState(String(TOURNAMENT_MAX_PARTICIPANTS))
  const [saving, setSaving] = useState(false)
  const [confirmingDisable, setConfirmingDisable] = useState(false)
  const [openRoom, setOpenRoom] = useState<TournamentHistoryItem | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    listGames(token, { community: true, pageSize: 200 })
      .then((result) => {
        if (!cancelled) setGames(result.items)
      })
      .catch(() => {
        if (!cancelled) setGames([])
      })
      .finally(() => {
        if (!cancelled) setGamesLoading(false)
      })
    listTournamentHistory(token)
      .then((items) => {
        if (!cancelled) setOpenRoom(findOpenRoom(items))
      })
      .catch(() => {
        if (!cancelled) setOpenRoom(null)
      })
    getTournamentSettings(token)
      .then((settings) => {
        if (cancelled) return
        setTournament(settings)
        if (settings.enabled) {
          loadForm(settings)
          setView('open')
        }
      })
      .catch(() => {
        if (!cancelled) setTournament(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const candidates = useMemo(() => tournamentCandidates(games), [games])
  const gameById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games])
  const prepared = tournament?.enabled === true

  function loadForm(settings: TournamentSettings) {
    setPicks(settings.games.map(({ gameId, level }) => ({ gameId, level })))
    setRoundsText(String(settings.totalRounds || TOURNAMENT_DEFAULT_ROUNDS))
    setMaxText(String(settings.maxParticipants || TOURNAMENT_MAX_PARTICIPANTS))
  }

  function go(next: SetupView) {
    if (next === view) return
    if (next === 'prepare' && tournament?.enabled) loadForm(tournament)
    setDirection(next === 'open' ? 'next' : 'prev')
    setView(next)
  }

  async function save() {
    if (!token || saving || picks.length === 0) return
    setSaving(true)
    try {
      const saved = await saveTournamentSettings(token, {
        games: picks,
        maxParticipants: clampInt(Number(maxText), TOURNAMENT_MIN_PARTICIPANTS, TOURNAMENT_MAX_PARTICIPANTS, TOURNAMENT_MAX_PARTICIPANTS),
        totalRounds: clampInt(Number(roundsText), 1, TOURNAMENT_MAX_ROUNDS, TOURNAMENT_DEFAULT_ROUNDS),
      })
      setTournament(saved)
      setDirection('next')
      setView('open')
      showToast('Torneo preparado. Ya puedes abrir la sala.', 'success')
    } catch (err: unknown) {
      showToast(err instanceof ApiError ? err.message : 'No se pudo guardar el torneo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function disable() {
    if (!token || saving) return
    setSaving(true)
    try {
      await clearTournamentSettings(token)
      setTournament(null)
      setPicks([])
      setDirection('prev')
      setView('prepare')
      showToast('Torneo deshabilitado.', 'success')
    } catch (err: unknown) {
      showToast(err instanceof ApiError ? err.message : 'No se pudo deshabilitar el torneo.', 'error')
    } finally {
      setSaving(false)
      setConfirmingDisable(false)
    }
  }

  const slide = direction === 'next' ? 'tsu-slide-next' : 'tsu-slide-prev'

  return (
    <div className="tsu flex flex-col gap-5">
      <TournamentSetupSteps view={view} prepared={prepared} onGo={go} />

      {openRoom && (
        <section className="tsu-live tsu-rise" aria-labelledby="sala-abierta">
          <p className="tsu-eyebrow">
            <span className="tsu-dot" aria-hidden="true" />
            {openRoom.status === 'RUNNING' ? 'Torneo en curso' : 'Sala abierta, esperando participantes'}
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 id="sala-abierta" className="tsu-h break-words text-[18px]">
                {historyTitle(openRoom)}
              </h2>
              <p className="text-[12.5px]">
                Código {openRoom.code} · {openRoom.participants} {openRoom.participants === 1 ? 'participante' : 'participantes'}
                {openRoom.status === 'RUNNING' ? ` · ronda ${openRoom.roundsStarted} de ${openRoom.totalRounds}` : ''}
              </p>
            </div>
            <button type="button" className="tsu-btn tsu-btn--primary" onClick={() => navigate(`/quien-es/torneo/${encodeURIComponent(openRoom.code)}`)}>
              <DoorOpen className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              Volver a la sala
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-[13px]">Cargando…</p>
      ) : view === 'prepare' ? (
        <div key="prepare" className={`tsu-layout ${slide}`}>
          <section aria-labelledby="elige-juegos">
            <h2 id="elige-juegos" className="tsu-h mb-1 text-[18px]">
              Elige los juegos del torneo
            </h2>
            <p className="mb-4 text-[13px]">Toca un juego para sumarlo y escoge su complejidad. Cada ronda se juega con uno de ellos, sorteado al azar y sin repetir el anterior.</p>
            <TournamentGamePicker
              games={candidates}
              loading={gamesLoading}
              picks={picks}
              onToggle={(gameId) => setPicks((current) => togglePick(current, gameId))}
              onLevel={(gameId, level) => setPicks((current) => setPickLevel(current, gameId, level))}
            />
          </section>

          <aside className="tsu-aside tsu-box flex flex-col gap-4" aria-labelledby="tu-torneo">
            <div>
              <h2 id="tu-torneo" className="tsu-h flex items-center gap-2 text-[16px]">
                Tu torneo
                <span key={picks.length} className="tsu-count tsu-bump">
                  {picks.length}/{TOURNAMENT_MAX_GAMES}
                </span>
              </h2>
              {picks.length === 0 ? (
                <p className="mt-2 text-[13px]">Aún no has elegido juegos. Elige de 1 a {TOURNAMENT_MAX_GAMES} en la cuadrícula.</p>
              ) : (
                <ul className="tsu-picked">
                  {picks.map((pick) => {
                    const game = gameById.get(pick.gameId)
                    return (
                      <li key={pick.gameId} className="tsu-enter">
                        <span title={game?.title}>{game?.title ?? 'Juego'}</span>
                        <LevelChip level={pick.level} />
                        <button type="button" className="tsu-x" aria-label={`Quitar ${game?.title ?? 'juego'}`} onClick={() => setPicks((current) => togglePick(current, pick.gameId))}>
                          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {picks.length > 1 && (
              <div className="tsu-all">
                Todos en:
                {TOURNAMENT_LEVEL_ORDER.map((level) => (
                  <button key={level} type="button" onClick={() => setPicks((current) => setAllLevels(current, level))}>
                    {TOURNAMENT_LEVEL_INFO[level].label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-[var(--tsu-line)] pt-4">
              <NumberField id="torneo-rondas" label="Rondas" hint="Quien quede impar juega contra el bot" value={roundsText} min={1} max={TOURNAMENT_MAX_ROUNDS} fallback={TOURNAMENT_DEFAULT_ROUNDS} onChange={setRoundsText} />
              <NumberField id="torneo-cupo" label="Cupo máximo" hint={`Hasta ${TOURNAMENT_MAX_PARTICIPANTS} personas`} value={maxText} min={TOURNAMENT_MIN_PARTICIPANTS} max={TOURNAMENT_MAX_PARTICIPANTS} fallback={TOURNAMENT_MAX_PARTICIPANTS} onChange={setMaxText} />
            </div>

            <div className="flex flex-col gap-2">
              <button type="button" className="tsu-btn tsu-btn--primary tsu-btn--block" disabled={picks.length === 0 || saving} onClick={save}>
                {picks.length === 0 ? 'Elige al menos un juego' : saving ? 'Guardando…' : prepared ? 'Guardar cambios' : 'Guardar y continuar'}
              </button>
              {prepared && (
                <button type="button" className="tsu-btn tsu-btn--block" onClick={() => go('open')}>
                  Cancelar
                </button>
              )}
            </div>
          </aside>
        </div>
      ) : (
        tournament && (
          <div key="open" className={`tsu-layout ${slide}`}>
            <section className="tsu-box flex flex-col gap-5" aria-labelledby="torneo-preparado">
              <div>
                <p className="tsu-eyebrow">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                  Torneo preparado
                </p>
                <h2 id="torneo-preparado" className="tsu-h mt-1 text-[20px]">
                  Tu torneo está listo para abrirse
                </h2>
              </div>

              <div className="tsu-stats">
                {[
                  { icon: Gamepad2, value: tournament.games.length, label: tournament.games.length === 1 ? 'juego' : 'juegos' },
                  { icon: Flag, value: tournament.totalRounds, label: tournament.totalRounds === 1 ? 'ronda' : 'rondas' },
                  { icon: Users, value: tournament.maxParticipants, label: 'cupo máximo' },
                ].map((stat, index) => (
                  <div key={stat.label} className="tsu-stat tsu-rise" style={{ '--i': index } as React.CSSProperties}>
                    <stat.icon strokeWidth={2} aria-hidden="true" />
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="tsu-h mb-2 text-[14px]">Juegos del torneo</h3>
                <ul className="tsu-minis">
                  {tournament.games.map((game, index) => {
                    const full = gameById.get(game.gameId)
                    return (
                      <li key={game.gameId} className="tsu-mini tsu-rise" style={{ '--i': index + 3 } as React.CSSProperties} title={levelDetail(game.gameType, game.level)}>
                        <span
                          className="tsu-mini__cover"
                          style={{ backgroundColor: full?.theme.primaryColor ?? 'var(--tsu-field)', backgroundImage: full?.theme.coverImageUrl ? `url(${full.theme.coverImageUrl})` : undefined }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="tsu-mini__name block">{game.title}</span>
                          <span className="tsu-mini__meta">
                            <span className="tsu-chip">{TOURNAMENT_GAME_LABEL[game.gameType as TournamentGameType] ?? game.gameType}</span>
                            <LevelChip level={game.level} />
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <p className="flex items-start gap-2 text-[12.5px]">
                <Shuffle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--tsu-pick)' }} strokeWidth={2} aria-hidden="true" />
                Cada ronda se juega con uno de estos juegos, sorteado al azar. Durante el torneo puedes elegir cuál sigue.
              </p>
            </section>

            <aside className="tsu-aside tsu-box flex flex-col gap-3" aria-labelledby="abre-sala">
              <div>
                <p className="tsu-eyebrow">Paso 2</p>
                <h2 id="abre-sala" className="tsu-h mt-1 text-[18px]">
                  Abre la sala
                </h2>
                <p className="mt-1 text-[13px]">Se genera un código para que tu grupo entre. Allí pones un nombre al torneo si quieres, lo inicias y lo moderas.</p>
              </div>
              <button type="button" className="tsu-btn tsu-btn--primary tsu-btn--block" onClick={() => navigate('/quien-es/torneo?crear=1')}>
                <DoorOpen className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                Abrir sala del torneo
              </button>
              <button type="button" className="tsu-btn tsu-btn--block" onClick={() => go('prepare')}>
                <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Cambiar la preparación
              </button>
              <div className="mt-1 border-t border-[var(--tsu-line)] pt-3">
                <button type="button" className="tsu-btn tsu-btn--danger tsu-btn--block" disabled={saving} onClick={() => setConfirmingDisable(true)}>
                  <PowerOff className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  Deshabilitar torneo
                </button>
                <p className="mt-2 text-[12px]">Mientras esté preparado, el Inicio muestra a todos el acceso con código. Deshabilítalo cuando termines la prueba.</p>
              </div>
            </aside>
          </div>
        )
      )}

      {!loading && !prepared && view === 'prepare' && picks.length === 0 && !gamesLoading && candidates.length > 0 && (
        <p className="flex items-center gap-2 text-[12.5px]">
          <Swords className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          El torneo es una fase de prueba: lo preparas, lo abres y, al terminar, lo deshabilitas.
        </p>
      )}

      {confirmingDisable && (
        <TournamentConfirmModal
          title="¿Deshabilitar el torneo?"
          message="El Inicio dejará de mostrar a todos el acceso con código. Los torneos ya jugados siguen en el historial; podrás volver a prepararlo cuando quieras."
          confirmLabel="Deshabilitar"
          onCancel={() => setConfirmingDisable(false)}
          onConfirm={disable}
        />
      )}
    </div>
  )
}
