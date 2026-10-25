import { Bot, Crown, LogOut, Swords, Trophy } from 'lucide-react'
import type { TournamentStateView } from './guessWhoTypes'

type Props = {
  tournament: TournamentStateView
  error: string | null
  onClose: () => void
  onEndRound: () => void
  onExit: () => void
}

/**
 * Panel en vivo del administrador durante y después del torneo (issue #102):
 * quién va ganando, métricas por persona y las partidas de la ronda en curso.
 */
export function TournamentModeratorPanel({ tournament, error, onClose, onEndRound, onExit }: Props) {
  const ranking = [...tournament.participants].sort(
    (a, b) => b.points - a.points || a.wrongAccusations - b.wrongAccusations || a.displayName.localeCompare(b.displayName),
  )
  const finished = tournament.phase === 'FINISHED'
  const winner = tournament.participants.find((p) => p.userId === tournament.winnerUserId)
  const playing = tournament.liveMatches.filter((m) => m.phase === 'PLAYING').length

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-[1200px] flex-col gap-5 p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">Panel del administrador</p>
            <h2 className="text-[22px] font-bold tracking-tight text-text-h">{tournament.gameTitle}</h2>
            <p className="text-[12.5px] text-text">
              Código <strong className="tracking-widest">{tournament.code}</strong> ·{' '}
              {finished ? 'Torneo terminado' : `Ronda ${tournament.currentRound} de ${tournament.totalRounds} · ${playing} partidas en curso`}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-text-h" onClick={onExit}>
              <LogOut className="h-4 w-4" strokeWidth={2} />
              Salir del panel
            </button>
            {!finished && (
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-[13px] font-semibold text-text-h"
                title="Termina las partidas sin acabar de esta ronda (sin puntos) y pasa a la siguiente"
                onClick={() => {
                  if (window.confirm('¿Cerrar la ronda ahora? Las partidas sin terminar quedan sin ganador.')) onEndRound()
                }}
              >
                {tournament.currentRound >= tournament.totalRounds ? 'Terminar torneo' : 'Cerrar ronda'}
              </button>
            )}
            <button type="button" className="rounded-lg border border-danger/40 px-3 py-2 text-[13px] font-semibold text-danger" onClick={onClose}>
              Cerrar torneo
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {finished && winner && (
          <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <Trophy className="h-7 w-7 text-accent" strokeWidth={1.75} />
            <p className="text-[16px] font-semibold text-text-h">Ganó el torneo {winner.displayName} con {winner.points} puntos</p>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="rounded-2xl border border-border p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
              <Crown className="h-4 w-4 text-accent" strokeWidth={2} />
              Clasificación
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <thead className="text-text">
                  <tr>
                    <th className="py-1.5 pr-2">#</th>
                    <th className="pr-2">Participante</th>
                    <th className="pr-2 text-right">Pts</th>
                    <th className="pr-2 text-right">G</th>
                    <th className="pr-2 text-right">P</th>
                    <th className="pr-2 text-right">Preguntas</th>
                    <th className="pr-2 text-right">Fallos</th>
                    <th className="text-right">Vs bot</th>
                  </tr>
                </thead>
                <tbody className="text-text-h">
                  {ranking.map((participant, index) => (
                    <tr key={participant.userId} className="border-t border-border/60">
                      <td className="py-1.5 pr-2 font-semibold">{index + 1}</td>
                      <td className="pr-2 font-medium">{participant.displayName}</td>
                      <td className="pr-2 text-right font-semibold">{participant.points}</td>
                      <td className="pr-2 text-right">{participant.wins}</td>
                      <td className="pr-2 text-right">{participant.losses}</td>
                      <td className="pr-2 text-right">{participant.questionsAsked}</td>
                      <td className="pr-2 text-right">{participant.wrongAccusations}</td>
                      <td className="text-right">{participant.botMatches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11.5px] text-text">G = ganadas · P = perdidas · Fallos = acusaciones equivocadas (desempata: menos es mejor)</p>
          </section>

          <section className="rounded-2xl border border-border p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
              <Swords className="h-4 w-4 text-accent" strokeWidth={2} />
              Partidas de la ronda {tournament.currentRound}
            </p>
            <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto">
              {tournament.liveMatches.map((match) => (
                <div key={match.matchCode} className="rounded-lg bg-code-bg px-3 py-2 text-[12.5px] text-text-h">
                  <p className="flex items-center gap-1.5 font-medium">
                    {match.vsBot && <Bot className="h-3.5 w-3.5 text-accent" strokeWidth={2} />}
                    {match.players.map((p) => p.displayName).join(' vs ')}
                  </p>
                  <p className="text-[11.5px] text-text">
                    {match.phase === 'FINISHED'
                      ? `Ganó ${match.players.find((p) => p.userId === match.winnerUserId)?.displayName ?? '—'}`
                      : `Turno de ${match.players.find((p) => p.userId === match.activePlayerUserId)?.displayName ?? '—'} · descartes ${match.players
                          .map((p) => `${p.discardedCount}/${match.totalCards}`)
                          .join(' · ')}`}
                  </p>
                </div>
              ))}
              {tournament.liveMatches.length === 0 && <p className="text-[13px] text-text">Sin partidas todavía.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
