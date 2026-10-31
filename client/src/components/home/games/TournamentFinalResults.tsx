import { useMemo } from 'react'
import { LogOut, Trophy } from 'lucide-react'
import { usePlayersAvatars } from '../../avatar/usePlayersAvatars'
import type { TournamentStateView } from './guessWhoTypes'
import { TournamentConfetti } from './TournamentConfetti'
import { TournamentPodium } from './TournamentPodium'
import { TournamentRoundsList } from './TournamentRoundsList'
import { TournamentStandingsList, ordinal } from './TournamentStandingsList'
import { rankParticipants } from './tournamentStats'

type Props = {
  tournament: TournamentStateView
  selfUserId: string | null
  onExit: () => void
}

/**
 * Final del torneo para quien jugó (issue #131): su puesto en grande, el podio con
 * personajes, la clasificación completa y confeti si quedó en los tres primeros.
 */
export function TournamentFinalResults({ tournament, selfUserId, onExit }: Props) {
  const ranking = useMemo(() => rankParticipants(tournament.participants), [tournament.participants])
  const ids = useMemo(() => ranking.map((participant) => participant.userId), [ranking])
  const avatars = usePlayersAvatars(ids)
  const selfIndex = ranking.findIndex((participant) => participant.userId === selfUserId)
  const self = selfIndex >= 0 ? ranking[selfIndex] : null
  const champion = ranking.find((participant) => participant.userId === tournament.winnerUserId) ?? ranking[0] ?? null
  const isChampion = Boolean(self && champion && self.userId === champion.userId)
  const onPodium = Boolean(self && selfIndex < 3 && self.points > 0)

  return (
    <div className="relative flex w-full max-w-[560px] flex-col items-center gap-5 py-4 text-center">
      {onPodium && <TournamentConfetti />}

      <span
        className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_14px_30px_-12px_var(--accent)] animate-[trophy-pop-in_0.6s_cubic-bezier(0.16,1,0.3,1)]"
        style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
      >
        <Trophy className="h-8 w-8" strokeWidth={1.75} />
      </span>

      <div className="stagger-in" style={{ '--stagger': 1 } as React.CSSProperties}>
        <p className="text-[12px] font-semibold tracking-[0.2em] text-accent uppercase">Torneo terminado</p>
        <p className="mt-1 text-[28px] leading-tight font-extrabold tracking-tight text-text-h">
          {isChampion ? '¡Ganaste el torneo!' : self ? `Quedaste ${ordinal(selfIndex + 1)}` : 'Terminó el torneo'}
        </p>
        {self && (
          <p className="mt-1 text-[14px] text-text">
            con {self.points} {self.points === 1 ? 'punto' : 'puntos'}
            {!isChampion && champion ? ` · Ganó ${champion.displayName}` : ''}
          </p>
        )}
      </div>

      <div className="w-full rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)]">
        <TournamentPodium ranking={ranking} avatars={avatars} finished />
      </div>

      <div className="w-full">
        <p className="mb-2 text-left text-[13px] font-semibold text-text-h">Clasificación final</p>
        <TournamentStandingsList ranking={ranking} avatars={avatars} selfUserId={selfUserId} />
      </div>

      <details className="w-full rounded-xl border border-border px-4 py-3 text-left">
        <summary className="cursor-pointer text-[13px] font-semibold text-text-h">Ver cómo fue cada ronda</summary>
        <div className="mt-3">
          <TournamentRoundsList tournament={tournament} />
        </div>
      </details>

      <button
        type="button"
        className="mt-1 flex items-center gap-2 rounded-lg px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_-10px_var(--accent)] active:translate-y-0"
        style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
        onClick={onExit}
      >
        <LogOut className="h-4 w-4" strokeWidth={2} />
        Salir
      </button>
    </div>
  )
}
