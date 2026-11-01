import { useEffect, useMemo, useState } from 'react'
import { DoorOpen, Pencil, PowerOff, Shuffle, Swords } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import { listGames, type GameSummary } from '../../../services/game.service'
import {
  clearTournamentSettings,
  getTournamentSettings,
  saveTournamentSettings,
  type SaveTournamentSettingsInput,
  type TournamentSettings,
} from '../../../services/tournament-settings.service'
import { listTournamentHistory, type TournamentHistoryItem } from '../../../services/tournament-history.service'
import { ApiError } from '../../../utils/http'
import { historyTitle } from './tournamentHistoryReport'
import { TournamentConfirmModal } from './TournamentConfirmModal'
import { TournamentSettingsModal } from './TournamentSettingsModal'
import { TOURNAMENT_GAME_LABEL, TOURNAMENT_GAME_TYPES, TOURNAMENT_LEVEL_INFO, type TournamentGameType } from './tournamentLevels'

const STEPS = [
  { title: 'Prepara', text: 'Elige los juegos, la dificultad, el cupo y las rondas.' },
  { title: 'Abre y modera la sala', text: 'Pon un nombre si quieres, comparte el código y dirige las rondas desde la sala.' },
  { title: 'Revisa los resultados', text: 'Al terminar, mira la clasificación y descarga el reporte en el Historial.' },
] as const

/**
 * Los tres pasos de un torneo, para que quien llega por primera vez sepa por dónde empezar. Moderar ocurre dentro
 * de la sala, así que el único paso que lleva a otro lugar de esta sección es el último (`onOpenHistory`).
 */
export function TournamentSteps({ current, onOpenHistory }: { current: 0 | 1 | 2; onOpenHistory?: () => void }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="Pasos de un torneo">
      {STEPS.map((step, index) => {
        const body = (
          <>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                index === current ? 'bg-accent text-white' : 'bg-code-bg text-text'
              }`}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-[13px] font-semibold text-text-h">{step.title}</span>
              <span className="block text-[12px] leading-snug text-text">{step.text}</span>
            </span>
          </>
        )
        const box = `flex gap-3 rounded-xl border p-3 ${index === current ? 'border-accent/60 bg-accent/5' : 'border-border'}`
        return (
          <li key={step.title} aria-current={index === current ? 'step' : undefined}>
            {index === 2 && onOpenHistory ? (
              <button
                type="button"
                className={`${box} w-full transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
                onClick={onOpenHistory}
              >
                {body}
              </button>
            ) : (
              <div className={`${box} h-full`}>{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Una sala abierta hace más que esto sin terminar se da por perdida (p. ej. el servidor se reinició con ella en marcha). */
const ROOM_MAX_AGE_MS = 12 * 60 * 60 * 1000

/** La sala que el administrador tiene abierta ahora: la más reciente en espera o en curso, si es de hoy. */
export function findOpenRoom(items: TournamentHistoryItem[], now = Date.now()): TournamentHistoryItem | null {
  return (
    items.find((item) => (item.status === 'WAITING' || item.status === 'RUNNING') && now - new Date(item.createdAt).getTime() < ROOM_MAX_AGE_MS) ?? null
  )
}

/**
 * Preparar y abrir el torneo (issue #147). Antes vivía como un botón suelto en «Destacados» de Edición; ahora
 * es lo primero que ve el administrador en «Torneos»: qué torneo está preparado y cómo abrir la sala.
 */
export function TournamentSetupPanel() {
  const { token } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [games, setGames] = useState<GameSummary[]>([])
  const [gamesLoading, setGamesLoading] = useState(true)
  const [tournament, setTournament] = useState<TournamentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
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
        if (!cancelled) setTournament(settings)
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

  const tournamentGames = useMemo(
    () => games.filter((game) => game.status === 'PUBLISHED' && (TOURNAMENT_GAME_TYPES as readonly string[]).includes(game.gameType)),
    [games],
  )

  async function save(input: SaveTournamentSettingsInput) {
    if (!token || saving) return
    setSaving(true)
    try {
      setTournament(await saveTournamentSettings(token, input))
      setModalOpen(false)
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
      setModalOpen(false)
      showToast('Torneo deshabilitado.', 'success')
    } catch (err: unknown) {
      showToast(err instanceof ApiError ? err.message : 'No se pudo deshabilitar el torneo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const enabled = tournament?.enabled === true

  return (
    <div className="flex flex-col gap-4">
      <TournamentSteps current={openRoom ? 1 : enabled ? 1 : 0} onOpenHistory={() => navigate('/torneos/historial')} />

      {openRoom && (
        <section className="rounded-2xl border border-accent/50 bg-accent/5 p-4 sm:p-5" aria-labelledby="sala-abierta">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">
            <span className="live-dot" aria-hidden="true" />
            {openRoom.status === 'RUNNING' ? 'Torneo en curso' : 'Sala abierta, esperando participantes'}
          </p>
          <h2 id="sala-abierta" className="mt-1 text-[18px] font-bold tracking-tight text-text-h">
            {historyTitle(openRoom)}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-text">
            Código {openRoom.code} · {openRoom.participants} {openRoom.participants === 1 ? 'participante' : 'participantes'}
            {openRoom.status === 'RUNNING' ? ` · ronda ${openRoom.roundsStarted} de ${openRoom.totalRounds}` : ''}
          </p>
          <button
            type="button"
            className="mt-3 flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            onClick={() => navigate(`/quien-es/torneo/${encodeURIComponent(openRoom.code)}`)}
          >
            <DoorOpen className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            Volver a la sala
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="torneo-preparado">
        {loading ? (
          <p className="text-[13px] text-text">Cargando…</p>
        ) : enabled && tournament ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-accent-2 uppercase">
                <span className="h-2 w-2 rounded-full bg-accent-2" aria-hidden="true" />
                Torneo preparado
              </p>
              <h2 id="torneo-preparado" className="mt-1 text-[18px] font-bold tracking-tight text-text-h">
                {tournament.games.length} {tournament.games.length === 1 ? 'juego' : 'juegos'} · {tournament.totalRounds}{' '}
                {tournament.totalRounds === 1 ? 'ronda' : 'rondas'} · hasta {tournament.maxParticipants} participantes
              </h2>
              <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-text">
                <Shuffle className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} aria-hidden="true" />
                Cada ronda juega uno de estos juegos, sorteado al azar. Tú puedes elegirlo durante el torneo.
              </p>
            </div>

            <ul className="flex flex-col gap-2">
              {tournament.games.map((game) => (
                <li key={game.gameId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border p-3">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-text-h">{game.title}</span>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-text">
                    {TOURNAMENT_GAME_LABEL[game.gameType as TournamentGameType] ?? game.gameType}
                  </span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TOURNAMENT_LEVEL_INFO[game.level].tone}`}>
                    {TOURNAMENT_LEVEL_INFO[game.level].label}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                onClick={() => navigate('/quien-es/torneo?crear=1')}
              >
                <DoorOpen className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                Abrir sala del torneo
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-[14px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => setModalOpen(true)}
              >
                <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Cambiar la preparación
              </button>
              <button
                type="button"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2.5 text-[14px] font-semibold text-danger transition-all duration-200 hover:-translate-y-0.5 hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-60 sm:ml-auto"
                onClick={() => setConfirmingDisable(true)}
              >
                <PowerOff className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Deshabilitar torneo
              </button>
            </div>
            <p className="text-[12.5px] text-text">
              Mientras esté preparado, el Inicio muestra a todos el acceso con código. Deshabilítalo cuando termines la prueba.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <div>
              <h2 id="torneo-preparado" className="text-[18px] font-bold tracking-tight text-text-h">
                Aún no hay un torneo preparado
              </h2>
              <p className="mt-0.5 text-[13px] text-text">
                Elige los juegos y la dificultad. Mientras esté preparado, el Inicio muestra a todos el acceso con código.
              </p>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              onClick={() => setModalOpen(true)}
            >
              <Swords className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              Preparar torneo
            </button>
          </div>
        )}
      </section>

      {confirmingDisable && (
        <TournamentConfirmModal
          title="¿Deshabilitar el torneo?"
          message="El Inicio dejará de mostrar a todos el acceso con código. Los torneos ya jugados siguen en el historial; podrás volver a prepararlo cuando quieras."
          confirmLabel="Deshabilitar"
          onCancel={() => setConfirmingDisable(false)}
          onConfirm={async () => {
            await disable()
            setConfirmingDisable(false)
          }}
        />
      )}

      {modalOpen && (
        <TournamentSettingsModal
          games={tournamentGames}
          loading={gamesLoading}
          current={enabled ? tournament : null}
          saving={saving}
          onSubmit={save}
          onDisable={disable}
          onCancel={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
