import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Bot, Crown, Layers, LogOut, Medal, MonitorPlay, Radio, Swords, Trophy, Users } from 'lucide-react'
import { AvatarCircle } from '../../avatar/AvatarCircle'
import { usePlayersAvatars } from '../../avatar/usePlayersAvatars'
import type { AvatarConfig } from '../../../services/avatar.service'
import { useFlip } from '../../../hooks/useFlip'
import type { TournamentLiveMatch, TournamentStateView } from './guessWhoTypes'
import { PointsValue } from './PointsValue'
import { TournamentConfirmModal } from './TournamentConfirmModal'
import { TournamentProjector } from './TournamentProjector'
import { TournamentPodium } from './TournamentPodium'
import { TournamentPointsChart } from './TournamentPointsChart'
import { TOURNAMENT_GAME_LABEL, TOURNAMENT_LEVEL_INFO } from './tournamentLevels'
import { buildPointsHistory, rankParticipants } from './tournamentStats'

type Props = {
  tournament: TournamentStateView
  error: string | null
  onClose: () => void
  onEndRound: () => void
  onExit: () => void
}

const MEDAL_TONES = ['text-[#d4a017]', 'text-[#9aa3b2]', 'text-[#b4753c]']

const CARD = 'rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)]'

/** Punto de conexión de cada persona en su partida (issue #147). */
const CONNECTION_DOT = {
  connected: 'bg-emerald-500',
  waiting: 'animate-pulse bg-amber-500',
  away: 'bg-slate-400',
} as const

const CONNECTION_LABEL = {
  connected: 'conectada',
  waiting: 'se cayó su conexión, se la espera',
  away: 'aún no está en la partida',
} as const

const stagger = (index: number) => ({ '--stagger': index }) as React.CSSProperties

/** Avatar de una persona o, si es el bot, su icono (no tiene avatar). */
function PlayerAvatar({ userId, name, avatars, className }: { userId: string; name: string; avatars: Record<string, AvatarConfig | null>; className: string }) {
  if (userId.startsWith('bot:')) {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent ${className}`} aria-hidden="true">
        <Bot className="h-[60%] w-[60%]" strokeWidth={2} />
      </span>
    )
  }
  return <AvatarCircle config={avatars[userId]} name={name} className={className} />
}

function StatTile({ icon, label, value, caption, index }: { icon: ReactNode; label: string; value: ReactNode; caption: string; index: number }) {
  return (
    <div className={`stagger-in flex items-center gap-3 ${CARD} !p-3.5`} style={stagger(index)}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">{icon}</span>
      <div className="min-w-0">
        <p className="text-[12px] text-text">{label}</p>
        <p className="text-[22px] leading-tight font-bold tracking-tight text-text-h">{value}</p>
        <p className="truncate text-[11.5px] text-text">{caption}</p>
      </div>
    </div>
  )
}

/** Lo que pasa en una partida de la ronda: quién va, cómo va y cómo terminó. */
function MatchStatus({ match }: { match: TournamentLiveMatch }) {
  const nameOf = (userId: string | null) => match.players.find((p) => p.userId === userId)?.displayName
  if (match.gameType === 'TRUE_FALSE_MAZE' && match.maze) {
    const { answered, total, wrong } = match.maze
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0
    if (match.phase === 'FINISHED') {
      return (
        <p className="flex items-center gap-1.5 text-[11.5px] text-text">
          <Trophy className="h-3 w-3 shrink-0 text-accent" strokeWidth={2} />
          {match.winnerUserId
            ? 'Respondió todo bien: +1 punto'
            : wrong > 0
              ? `Sin punto: ${wrong} ${wrong === 1 ? 'error' : 'errores'}`
              : 'Sin punto: no terminó'}
        </p>
      )
    }
    return (
      <div className="flex items-center gap-2 text-[11.5px] text-text">
        <div className="progress-track min-w-0 flex-1" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Respuestas">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="shrink-0 tabular-nums">
          {answered}/{total}
          {wrong > 0 ? ` · ${wrong} ${wrong === 1 ? 'error' : 'errores'}` : ''}
        </span>
      </div>
    )
  }
  if (match.phase === 'FINISHED') {
    const winner = nameOf(match.winnerUserId)
    return (
      <p className="flex items-center gap-1.5 text-[11.5px] text-text">
        <Trophy className="h-3 w-3 shrink-0 text-accent" strokeWidth={2} />
        {winner ? `Ganó ${winner}` : 'Cerrada sin ganador'}
      </p>
    )
  }
  const active = nameOf(match.activePlayerUserId)
  return (
    <p className="flex items-center gap-1.5 text-[11.5px] text-text">
      <Radio className="h-3 w-3 shrink-0 text-accent" strokeWidth={2} />
      <span className="truncate">
        Turno de {active ?? '—'} ·{' '}
        {match.gameType === 'DOMINO'
          ? `fichas en mano ${match.players.map((p) => p.handCount ?? '—').join(' · ')}`
          : `descartes ${match.players.map((p) => `${p.discardedCount}/${match.totalCards}`).join(' · ')}`}
      </span>
    </p>
  )
}

/**
 * Panel en vivo del administrador durante y después del torneo (issue #102):
 * podio con avatares, gráfica de puntos por ronda, clasificación y las partidas
 * de la ronda en curso. Todo se recalcula con cada estado que llega por socket.
 */
export function TournamentModeratorPanel({ tournament, error, onClose, onEndRound, onExit }: Props) {
  const [confirming, setConfirming] = useState<'round' | 'close' | null>(null)
  const [projecting, setProjecting] = useState(false)
  const ranking = useMemo(() => rankParticipants(tournament.participants), [tournament.participants])
  const history = useMemo(() => buildPointsHistory(tournament), [tournament])
  const finished = tournament.phase === 'FINISHED'
  const winner = tournament.participants.find((p) => p.userId === tournament.winnerUserId)
  const playing = tournament.liveMatches.filter((m) => m.phase === 'PLAYING').length
  const waitingFor = tournament.liveMatches.flatMap((m) => (m.phase === 'PLAYING' ? m.players.filter((p) => p.connection?.state === 'waiting') : []))
  const roundsDone = finished ? tournament.totalRounds : Math.max(0, tournament.currentRound - 1)
  const progress = Math.round((roundsDone / tournament.totalRounds) * 100)
  const rowsRef = useFlip<HTMLDivElement>()
  const roundGame = tournament.currentRoundGame
  const roundInfo = roundGame ? TOURNAMENT_LEVEL_INFO[roundGame.level] : null
  const totalPoints = tournament.participants.reduce((sum, participant) => sum + participant.points, 0)
  const topPoints = Math.max(1, ...tournament.participants.map((participant) => participant.points))

  // Avatares de todas las personas que se ven en el panel (el bot no tiene).
  const avatarIds = useMemo(
    () =>
      [...new Set([...tournament.participants.map((p) => p.userId), ...tournament.liveMatches.flatMap((m) => m.players.map((p) => p.userId))])].filter(
        (id) => !id.startsWith('bot:'),
      ),
    [tournament.participants, tournament.liveMatches],
  )
  const avatars = usePlayersAvatars(avatarIds)

  return (
    <div className="page-fade fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-[1240px] flex-col gap-5 p-5 sm:p-8">
        <header className="stagger-in flex flex-wrap items-start justify-between gap-3" style={stagger(0)}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">Panel del administrador</p>
            <h2 className="truncate text-[26px] font-bold tracking-tight text-text-h">Torneo</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text">
              <span>
                Código <strong className="tracking-widest text-text-h">{tournament.code}</strong>
              </span>
              <span aria-hidden="true">·</span>
              {finished ? (
                <span>Torneo terminado</span>
              ) : (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span className="live-dot" aria-hidden="true" />
                  En vivo
                  {roundGame && roundInfo && (
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${roundInfo.tone}`}>
                      {roundGame.title} · {roundInfo.label} ({roundInfo.audience})
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-[13px] font-semibold text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent"
              title="Pantalla completa y oscura para mostrar el podio en el salón"
              onClick={() => setProjecting(true)}
            >
              <MonitorPlay className="h-4 w-4" strokeWidth={2} />
              Proyectar
            </button>
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
                onClick={() => setConfirming('round')}
              >
                {tournament.currentRound >= tournament.totalRounds ? 'Terminar torneo' : 'Cerrar ronda'}
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border border-danger/40 px-3 py-2 text-[13px] font-semibold text-danger transition-all duration-200 hover:-translate-y-0.5 hover:bg-danger/10"
              onClick={() => setConfirming('close')}
            >
              Cerrar torneo
            </button>
          </div>
        </header>

        {error && (
          <p className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {waitingFor.length > 0 && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px] text-text-h" role="status">
            <strong>Sin conexión:</strong> {waitingFor.map((player) => player.displayName).join(', ')}. Su partida está en pausa mientras vuelve{waitingFor.length === 1 ? '' : 'n'}.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile index={1} icon={<Users className="h-5 w-5" strokeWidth={2} />} label="Participantes" value={`${tournament.participants.length}/${tournament.maxParticipants}`} caption="en la sala" />
          <StatTile
            index={2}
            icon={<Layers className="h-5 w-5" strokeWidth={2} />}
            label="Ronda"
            value={`${finished ? tournament.totalRounds : tournament.currentRound}/${tournament.totalRounds}`}
            caption={finished ? 'Terminado' : roundGame ? roundGame.title : 'Sin iniciar'}
          />
          <StatTile
            index={3}
            icon={<Radio className="h-5 w-5" strokeWidth={2} />}
            label="Partidas en juego"
            value={playing}
            caption={finished ? 'ya terminaron todas' : `de ${tournament.liveMatches.length} en esta ronda`}
          />
          <StatTile index={4} icon={<Trophy className="h-5 w-5" strokeWidth={2} />} label="Puntos repartidos" value={totalPoints} caption={totalPoints === 1 ? 'punto en total' : 'puntos en total'} />
        </div>

        <div className="stagger-in" style={stagger(5)}>
          <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-medium text-text">
            <span>Avance del torneo</span>
            <span>
              {roundsDone} / {tournament.totalRounds} rondas
            </span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del torneo">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {finished && winner && (
          <div
            className="stagger-in flex items-center gap-4 rounded-2xl border border-accent/30 p-4"
            style={{ ...stagger(6), background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent-2) 8%, transparent))' }}
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

        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section className={`stagger-in ${CARD}`} style={stagger(6)} aria-labelledby="podio-titulo">
            <p id="podio-titulo" className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
              <Crown className="h-4 w-4 text-accent" strokeWidth={2} />
              Podio
              {!finished && <span className="live-dot ml-1" aria-hidden="true" />}
            </p>
            <TournamentPodium ranking={ranking} avatars={avatars} finished={finished} />
          </section>

          <section className={`stagger-in ${CARD}`} style={stagger(7)} aria-labelledby="grafica-titulo">
            <p id="grafica-titulo" className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
              <Swords className="h-4 w-4 text-accent" strokeWidth={2} />
              Puntos por ronda
            </p>
            <TournamentPointsChart
              history={history}
              ranking={ranking}
              totalRounds={tournament.totalRounds}
              currentRound={tournament.currentRound}
              finished={finished}
              avatars={avatars}
            />
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className={`stagger-in ${CARD}`} style={stagger(8)} aria-labelledby="clasificacion-titulo">
            <p id="clasificacion-titulo" className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
              <Medal className="h-4 w-4 text-accent" strokeWidth={2} />
              Clasificación
            </p>
            <div ref={rowsRef} className="relative flex flex-col gap-1.5">
              {ranking.map((participant, index) => {
                const medal = index < 3 && participant.points > 0
                return (
                  <div
                    key={participant.userId}
                    data-flip-key={participant.userId}
                    className={`rank-row flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-[12.5px] text-text-h ${medal ? 'rank-row--top' : 'hover:bg-code-bg/50'}`}
                  >
                    <span className="flex w-6 shrink-0 justify-center font-semibold">
                      {medal ? <Medal className={`h-[18px] w-[18px] ${MEDAL_TONES[index]}`} strokeWidth={2.25} aria-label={`Puesto ${index + 1}`} /> : index + 1}
                    </span>
                    <AvatarCircle config={avatars[participant.userId]} name={participant.displayName} className="h-9 w-9 text-[12px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">{participant.displayName}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="progress-track max-w-[220px] flex-1" aria-hidden="true">
                          <div className="progress-fill" style={{ width: `${Math.round((participant.points / topPoints) * 100)}%` }} />
                        </div>
                        <span className="hidden text-[11px] text-text sm:inline">
                          {participant.wins}G · {participant.losses}P
                        </span>
                      </div>
                    </div>
                    <div className="hidden shrink-0 items-center gap-1.5 text-[11px] text-text md:flex">
                      <span className="rounded-md bg-code-bg px-1.5 py-0.5" title="Preguntas hechas">
                        {participant.questionsAsked} preg.
                      </span>
                      <span className="rounded-md bg-code-bg px-1.5 py-0.5" title="Acusaciones equivocadas (desempata: menos es mejor)">
                        {participant.wrongAccusations} fallos
                      </span>
                      <span className="rounded-md bg-code-bg px-1.5 py-0.5" title="Partidas contra el bot">
                        {participant.botMatches} bot
                      </span>
                    </div>
                    <span className="w-[46px] shrink-0 text-right text-[18px] leading-none font-bold">
                      <PointsValue value={participant.points} />
                      <span className="block text-[10px] font-medium text-text">{participant.points === 1 ? 'punto' : 'puntos'}</span>
                    </span>
                  </div>
                )
              })}
              {ranking.length === 0 && <p className="text-[13px] text-text">Todavía no hay participantes.</p>}
            </div>
            <p className="mt-3 text-[11.5px] text-text">G = ganadas · P = perdidas · Fallos = acusaciones equivocadas (desempata: menos es mejor) · Bot = partidas contra el bot</p>
          </section>

          <section className={`stagger-in ${CARD}`} style={stagger(9)} aria-labelledby="partidas-titulo">
            <p id="partidas-titulo" className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
              <Swords className="h-4 w-4 text-accent" strokeWidth={2} />
              Partidas de la ronda {tournament.currentRound}
            </p>
            <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1">
              {tournament.liveMatches.map((match, index) => (
                <div
                  key={match.matchCode}
                  className={`stagger-in rounded-xl border border-border/70 bg-code-bg/60 px-3 py-2.5 text-[12.5px] text-text-h transition-colors duration-300 hover:border-accent/40 ${match.phase === 'FINISHED' ? 'opacity-80' : ''}`}
                  style={stagger(index)}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className="flex shrink-0 -space-x-2">
                      {match.players.map((player) => (
                        <span key={player.userId} className="relative">
                          <PlayerAvatar
                            userId={player.userId}
                            name={player.displayName}
                            avatars={avatars}
                            className="h-7 w-7 border-2 border-surface text-[10px]"
                          />
                          {match.phase === 'PLAYING' && player.connection && (
                            <span
                              className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${CONNECTION_DOT[player.connection.state]}`}
                              title={`${player.displayName}: ${CONNECTION_LABEL[player.connection.state]}`}
                              role="img"
                              aria-label={`${player.displayName}: ${CONNECTION_LABEL[player.connection.state]}`}
                            />
                          )}
                        </span>
                      ))}
                    </div>
                    <p className="min-w-0 flex-1 truncate font-medium">{match.players.map((p) => p.displayName).join(' vs ')}</p>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-text">
                      {TOURNAMENT_GAME_LABEL[match.gameType]}
                    </span>
                  </div>
                  <MatchStatus match={match} />
                </div>
              ))}
              {tournament.liveMatches.length === 0 && <p className="text-[13px] text-text">Sin partidas todavía.</p>}
            </div>
          </section>
        </div>
      </div>
      {projecting && <TournamentProjector tournament={tournament} onClose={() => setProjecting(false)} />}
      {confirming === 'round' && (
        <TournamentConfirmModal
          title={tournament.currentRound >= tournament.totalRounds ? '¿Terminar el torneo ahora?' : '¿Cerrar la ronda ahora?'}
          message={
            playing === 0
              ? 'Todas las partidas ya terminaron. Se pasa a lo siguiente.'
              : `${playing} ${playing === 1 ? 'partida sigue' : 'partidas siguen'} en juego y quedarán sin ganador ni puntos.`
          }
          confirmLabel={tournament.currentRound >= tournament.totalRounds ? 'Sí, terminar torneo' : 'Sí, cerrar ronda'}
          cancelLabel="Seguir jugando"
          onConfirm={() => {
            setConfirming(null)
            onEndRound()
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'close' && (
        <TournamentConfirmModal
          title="¿Cerrar el torneo?"
          message={`Se cierra para las ${tournament.participants.length} personas que participan y se pierden los ${totalPoints} ${totalPoints === 1 ? 'punto repartido' : 'puntos repartidos'}. No se puede deshacer.`}
          confirmLabel="Sí, cerrar torneo"
          cancelLabel="Volver al panel"
          onConfirm={() => {
            setConfirming(null)
            onClose()
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
