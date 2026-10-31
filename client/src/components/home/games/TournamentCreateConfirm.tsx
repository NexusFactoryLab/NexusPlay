import { useEffect, useState } from 'react'
import { Shuffle } from 'lucide-react'
import { Modal } from './Modal'
import { useAuth } from '../../../hooks/useAuth'
import { getTournamentSettings, type TournamentSettings } from '../../../services/tournament-settings.service'
import { TOURNAMENT_GAME_LABEL, TOURNAMENT_LEVEL_INFO, type TournamentGameType } from './tournamentLevels'

type Props = {
  onCreate: () => void
  onCancel: () => void
}

/**
 * Antes de abrir la sala, el administrador ve con qué torneo va a abrirla: los
 * juegos, cupo y rondas que dejó habilitados en Edición. No se arma nada aquí.
 */
export function TournamentCreateConfirm({ onCreate, onCancel }: Props) {
  const { token } = useAuth()
  const [settings, setSettings] = useState<TournamentSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    getTournamentSettings(token)
      .then((result) => {
        if (!cancelled) setSettings(result)
      })
      .catch(() => {
        if (!cancelled) setSettings(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const enabled = settings?.enabled === true

  return (
    <Modal onClose={onCancel} maxWidthClassName="max-w-[520px]" ariaLabel="Abrir sala del torneo">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">Administrador</p>
          <h2 className="mt-1 text-[22px] font-bold tracking-tight text-text-h">Abrir sala del torneo</h2>
          <p className="mt-0.5 text-[13px] text-text">
            Se abre con lo que habilitaste en Edición. Los participantes entran con el código que te daremos.
          </p>
        </div>

        {loading && <p className="text-[13px] text-text">Cargando el torneo…</p>}
        {!loading && !enabled && (
          <p className="rounded-xl border border-border p-3 text-[13px] text-text">
            No hay un torneo habilitado. Habilítalo en Edición con «Habilitar torneo».
          </p>
        )}

        {enabled && settings && (
          <>
            <ul className="flex flex-col gap-2">
              {settings.games.map((game) => (
                <li key={game.gameId} className="flex items-center gap-3 rounded-xl border border-border p-3">
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
            <p className="flex items-center gap-2 text-[12.5px] text-text">
              <Shuffle className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
              {settings.totalRounds} {settings.totalRounds === 1 ? 'ronda' : 'rondas'}, cada una con un juego al azar · cupo de {settings.maxParticipants}
            </p>
          </>
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
            disabled={!enabled}
            className="flex-1 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            onClick={onCreate}
          >
            Crear sala
          </button>
        </div>
      </div>
    </Modal>
  )
}
