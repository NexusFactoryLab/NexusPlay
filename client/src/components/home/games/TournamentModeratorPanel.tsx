import { useEffect, useRef, useState } from 'react'
import { Bot, Crown, LogOut, Medal, Radio, Swords, Trophy } from 'lucide-react'
import { useFlip } from '../../../hooks/useFlip'
import type { TournamentStateView } from './guessWhoTypes'

type Props = {
  tournament: TournamentStateView
  error: string | null
  onClose: () => void
  onEndRound: () => void
  onExit: () => void
}

const MEDAL_TONES = ['text-[#d4a017]', 'text-[#9aa3b2]', 'text-[#b4753c]']

/** Puntos con un "latido" cada vez que cambian, para que se note quién acaba de sumar. */
function Points({ value }: { value: number }) {
  const previous = useRef(value)
  const [bump, setBump] = useState(0)
  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value
      setBump((current) => current + 1)
    }
  }, [value])
  return (
    <span key={bump} className={bump > 0 ? 'value-bump' : undefined}>
      {value}
    </span>
  )
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
  const roundsDone = finished ? tournament.totalRounds : Math.max(0, tournament.currentRound - 1)
  const progress = Math.round((roundsDone / tournament.totalRounds) * 100)
  const rowsRef = useFlip<HTMLDivElement>()

  return (
    <div className="page-fade fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-[1200px] flex-col gap-5 p-5 sm:p-8">
        <header className="stagger-in flex flex-wrap items-start justify-between gap-3" style={{ '--stagger': 0 } as React.CSSProperties}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">Panel del administrador</p>
            <h2 className="truncate text-[24px] font-bold tracking-tight text-text-h">{tournament.gameTitle}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-text">
              <span>
                Código <strong className="tracking-widest text-text-h">{tournament.code}</strong>
              </span>
              <span aria-hidden="true">·</span>
              {finished ? (
                <span>Torneo terminado</span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="live-dot" aria-hidden="true" />
                  Ronda {tournament.currentRound} de {tournament.totalRounds} · {playing} en juego
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50"
              onClick={onExit}
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              Salir del panel
            </button>
            {!finished && (
              <button
                type="button"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50"
                title="Termina las partidas sin acabar de esta ronda (sin puntos) y pasa a la siguiente"
                onClick={() => {
                  if (window.confirm('¿Cerrar la ronda ahora? Las partidas sin terminar quedan sin ganador.')) onEndRound()
                }}
              >
                {tournament.currentRound >= tournament.totalRounds ? 'Terminar torneo' : 'Cerrar ronda'}
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-danger/40 px-3 py-2 text-[13px] font-semibold text-danger transition-all duration-200 hover:-translate-y-0.5 hover:bg-danger/10"
              onClick={onClose}
            >
              Cerrar torneo
            </button>
          </div>
        </header>

        <div className="stagger-in" style={{ '--stagger': 1 } as React.CSSProperties}>
          <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-medium text-text">
            <span>Avance del torneo</span>
            <span>
              {roundsDone} / {tournament.totalRounds} rondas
            </span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {finished && winner && (
          <div
            className="stagger-in flex items-center gap-4 rounded-2xl border border-accent/30 p-4"
            style={{ '--stagger': 2, background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent-2) 8%, transparent))' } as React.CSSProperties}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white animate-[trophy-pop-in_0.6s_cubic-bezier(0.16,1,0.3,1)]"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            >
              <Trophy className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <p className="text-[16px] font-semibold text-text-h">
              Ganó el torneo {winner.displayName} con {winner.points} {winner.points === 1 ? 'punto' : 'puntos'}
            </p>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="stagger-in rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)]" style={{ '--stagger': 3 } as React.CSSProperties}>
            <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
              <Crown className="h-4 w-4 text-accent" strokeWidth={2} />
              Clasificación
            </p>
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[36px_minmax(0,1fr)_repeat(6,56px)] gap-x-2 px-2 pb-1.5 text-[11.5px] font-medium text-text">
                  <span>#</span>
                  <span>Participante</span>
                  <span className="text-right">Pts</span>
                  <span className="text-right">G</span>
                  <span className="text-right">P</span>
                  <span className="text-right">Preg.</span>
                  <span className="text-right">Fallos</span>
                  <span className="text-right">Bot</span>
                </div>
                <div ref={rowsRef} className="relative flex flex-col gap-1">
                  {ranking.map((participant, index) => (
                    <div
                      key={participant.userId}
                      data-flip-key={participant.userId}
                      className={`rank-row grid grid-cols-[36px_minmax(0,1fr)_repeat(6,56px)] items-center gap-x-2 rounded-lg px-2 py-1.5 text-[12.5px] text-text-h ${
                        index < 3 && participant.points > 0 ? 'rank-row--top' : ''
                      }`}
                    >
                      <span className="font-semibold">
                        {index < 3 && participant.points > 0 ? (
                          <Medal className={`h-4 w-4 ${MEDAL_TONES[index]}`} strokeWidth={2.25} aria-label={`Puesto ${index + 1}`} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className="truncate font-medium">{participant.displayName}</span>
                      <span className="text-right font-bold">
                        <Points value={participant.points} />
                      </span>
                      <span className="text-right">{participant.wins}</span>
                      <span className="text-right">{participant.losses}</span>
                      <span className="text-right">{participant.questionsAsked}</span>
                      <span className="text-right">{participant.wrongAccusations}</span>
                      <span className="text-right">{participant.botMatches}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[11.5px] text-text">
              G = ganadas · P = perdidas · Fallos = acusaciones equivocadas (desempata: menos es mejor) · Bot = partidas contra el bot
            </p>
          </section>

          <section className="stagger-in rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)]" style={{ '--stagger': 4 } as React.CSSProperties}>
            <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
              <Swords className="h-4 w-4 text-accent" strokeWidth={2} />
              Partidas de la ronda {tournament.currentRound}
            </p>
            <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1">
              {tournament.liveMatches.map((match, index) => {
                const active = match.players.find((p) => p.userId === match.activePlayerUserId)
                return (
                  <div
                    key={match.matchCode}
                    className="stagger-in rounded-xl border border-border/70 bg-code-bg/60 px-3 py-2 text-[12.5px] text-text-h transition-colors duration-300 hover:border-accent/40"
                    style={{ '--stagger': index } as React.CSSProperties}
                  >
                    <p className="flex items-center gap-1.5 font-medium">
                      {match.vsBot && <Bot className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />}
                      <span className="truncate">{match.players.map((p) => p.displayName).join(' vs ')}</span>
                    </p>
                    {match.phase === 'FINISHED' ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-text">
                        <Trophy className="h-3 w-3 text-accent" strokeWidth={2} />
                        {match.players.find((p) => p.userId === match.winnerUserId)?.displayName
                          ? `Ganó ${match.players.find((p) => p.userId === match.winnerUserId)?.displayName}`
                          : 'Cerrada sin ganador'}
                      </p>
                    ) : (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-text">
                        <Radio className="h-3 w-3 text-accent" strokeWidth={2} />
                        <span className="truncate">
                          Turno de {active?.displayName ?? '—'} · descartes {match.players.map((p) => `${p.discardedCount}/${match.totalCards}`).join(' · ')}
                        </span>
                      </p>
                    )}
                  </div>
                )
              })}
              {tournament.liveMatches.length === 0 && <p className="text-[13px] text-text">Sin partidas todavía.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
