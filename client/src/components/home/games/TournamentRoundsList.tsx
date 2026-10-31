import type { TournamentStateView } from './guessWhoTypes'

/** Qué pasó en cada ronda, en una línea por partida; la primera pista de quién ganó qué. */
export function TournamentRoundsList({ tournament }: { tournament: Pick<TournamentStateView, 'rounds' | 'participants'> }) {
  return (
    <div className="flex flex-col gap-2 text-left">
      {tournament.rounds.map((round) => (
        <div key={round.round} className="rounded-lg bg-code-bg px-3 py-2 text-[12px] text-text">
          <p className="mb-1 font-semibold text-text-h">Ronda {round.round}</p>
          {round.matches[0]?.gameType === 'TRUE_FALSE_MAZE' ? (
            <p>
              Misión Galáctica: {round.matches.filter((match) => match.winnerUserId).length} de {round.matches.length} respondieron todo bien
              {round.matches.some((match) => match.phase !== 'FINISHED') ? ' (en curso)' : ''}
            </p>
          ) : (
            round.matches.map((match) => (
              <p key={match.matchCode}>
                {match.winnerUserId
                  ? `Ganó ${tournament.participants.find((p) => p.userId === match.winnerUserId)?.displayName ?? 'el bot'}${match.vsBot ? ' (vs bot)' : ''}`
                  : match.phase === 'FINISHED'
                    ? 'Sin ganador'
                    : 'En curso'}
              </p>
            ))
          )}
        </div>
      ))}
    </div>
  )
}
