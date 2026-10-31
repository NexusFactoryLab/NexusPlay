import { useMemo } from 'react'
import { AvatarCircle } from '../../avatar/AvatarCircle'
import { AvatarFigure } from '../../avatar/AvatarFigure'
import { usePlayersAvatars } from '../../avatar/usePlayersAvatars'
import type { TournamentStateView } from './guessWhoTypes'
import { PointsValue } from './PointsValue'
import { TournamentRoundsList } from './TournamentRoundsList'
import { TournamentStandingsList, ordinal } from './TournamentStandingsList'
import { rankParticipants } from './tournamentStats'

type Props = {
  tournament: TournamentStateView
  selfUserId: string | null
}

/** Cuántas partidas de la ronda en curso ya terminaron (para la barra de espera). */
export function roundProgress(tournament: Pick<TournamentStateView, 'rounds' | 'currentRound'>): { done: number; total: number } {
  const matches = tournament.rounds.find((round) => round.round === tournament.currentRound)?.matches ?? []
  return { done: matches.filter((match) => match.phase === 'FINISHED').length, total: matches.length }
}

/**
 * Lo que ve quien ya terminó su partida y espera a las demás (issue #131): su puesto y sus
 * puntos en grande con su personaje, cuántas partidas faltan y la clasificación con
 * personajes. El detalle de cada ronda queda plegado.
 */
export function TournamentRoundWaiting({ tournament, selfUserId }: Props) {
  const ranking = useMemo(() => rankParticipants(tournament.participants), [tournament.participants])
  const ids = useMemo(() => ranking.map((participant) => participant.userId), [ranking])
  const avatars = usePlayersAvatars(ids)
  const selfIndex = ranking.findIndex((participant) => participant.userId === selfUserId)
  const self = selfIndex >= 0 ? ranking[selfIndex] : null
  const { done, total } = roundProgress(tournament)
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const selfAvatar = self ? avatars[self.userId] : null

  return (
    <div className="stagger-in flex w-full max-w-[520px] flex-col items-center gap-5 py-4 text-center">
      <p className="text-[12px] font-semibold tracking-[0.2em] text-accent uppercase">
        Ronda {tournament.currentRound} de {tournament.totalRounds} · terminaste tu partida
      </p>

      {self && (
        <div className="flex flex-col items-center gap-1">
          {selfAvatar ? (
            <AvatarFigure config={selfAvatar} className="w-[104px] drop-shadow-[0_8px_14px_rgba(0,0,0,0.25)]" />
          ) : (
            <AvatarCircle config={null} name={self.displayName} className="h-20 w-20 text-[26px] shadow-md" />
          )}
          <p className="text-[34px] leading-none font-extrabold tracking-tight text-text-h">Vas {ordinal(selfIndex + 1)}</p>
          <span className="mt-1 inline-flex items-baseline gap-1 rounded-full bg-accent/15 px-3 py-0.5 text-[15px] font-bold text-text-h">
            <PointsValue value={self.points} />
            <span className="text-[11.5px] font-semibold opacity-80">{self.points === 1 ? 'punto' : 'puntos'}</span>
          </span>
        </div>
      )}

      <div className="w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-[var(--shadow)]">
        <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-text-h">
          <span className="flex items-center gap-2">
            <span className="live-dot" aria-hidden="true" />
            Esperando a las demás
          </span>
          <span>
            {done} de {total} {total === 1 ? 'partida terminada' : 'partidas terminadas'}
          </span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Partidas terminadas de la ronda">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="w-full">
        <p className="mb-2 text-left text-[13px] font-semibold text-text-h">Así va la clasificación</p>
        <TournamentStandingsList ranking={ranking} avatars={avatars} selfUserId={selfUserId} limit={5} />
      </div>

      <details className="w-full rounded-xl border border-border px-4 py-3 text-left">
        <summary className="cursor-pointer text-[13px] font-semibold text-text-h">Ver rondas anteriores</summary>
        <div className="mt-3">
          <TournamentRoundsList tournament={tournament} />
        </div>
      </details>
    </div>
  )
}
