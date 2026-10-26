import { GameInstructionsGate } from './GameInstructionsGate'
import { GuessWhoTutorial } from './tutorial/GuessWhoTutorial'
import { ChatPanel } from './ChatPanel'
import { TournamentLobby } from './TournamentLobby'
import { TournamentModeratorPanel } from './TournamentModeratorPanel'
import { TournamentCodeEntry } from './TournamentCodeEntry'
import { TournamentCreateConfirm } from './TournamentCreateConfirm'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Bot, Crown, LogOut, Swords, Trophy } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { useGuessWhoTournament } from './useGuessWhoTournament'
import { Modal } from './Modal'
import { MatchBoard } from './MatchBoard'
import { MIN_DISCARDS_TO_ACCUSE } from './guessWhoTypes'
import { TOURNAMENT_LEVEL_INFO } from './tournamentLevels'

/**
 * Sala de torneo por puntos, moderado por un administrador ("¿Quién Es?" grupal) en página propia (ruta
 * `/quien-es/torneo/:code?`, ver App.tsx), mismo criterio que
 * GuessWhoRoomPage/DominoRoomPage: reconecta al torneo en curso vía el
 * código en la URL, y no deja el Sidebar/header de HomeLayout montado detrás.
 *
 * Antes de entrar se muestra la guía con el tutorial jugable (`GameInstructionsGate`);
 * también se puede abrir a demanda desde la sala de espera.
 */
export function TournamentRoomPage() {
  return (
    <GameInstructionsGate kind={'GUESS_WHO_GROUP'} tutorial={(onFinish) => <GuessWhoTutorial tournament onFinish={onFinish} />}>
      <TournamentSession />
    </GameInstructionsGate>
  )
}

function TournamentSession() {
  const { code: codeFromUrl } = useParams<{ code?: string }>()
  const [searchParams] = useSearchParams()
  // `?crear=1` (botón "Abrir sala del torneo" del Inicio): el administrador abre la sala con el torneo habilitado.
  const wantsToCreate = searchParams.get('crear') === '1'
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const {
    tournament,
    error,
    clearError,
    connecting,
    pairingAnnouncement,
    clearPairingAnnouncement,
    matchAccusationFailedMessage,
    clearMatchAccusationFailedMessage,
    createTournament,
    joinTournament,
    startTournament,
    closeTournament,
    endRound,
    closed,
    sendMatchMessage,
    askQuestion,
    answerQuestion,
    leaveTournament,
    discardMatchCard,
    accuseMatchCard,
    passMatchTurn,
  } = useGuessWhoTournament(token)

  const startedRef = useRef(false)
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [showPairingOverlay, setShowPairingOverlay] = useState(false)

  // Arranque de la sala: si la URL trae un código en el path, se une a esa
  // sala — mismo patrón de reconexión que Dominó/Escaleras/GuessWho.
  useEffect(() => {
    if (connecting || startedRef.current) return
    if (codeFromUrl) {
      startedRef.current = true
      joinTournament(codeFromUrl.toUpperCase())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecting, codeFromUrl])

  useEffect(() => {
    if (tournament && !codeFromUrl) {
      navigate(`/quien-es/torneo/${tournament.code}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.code])

  useEffect(() => {
    if (!pairingAnnouncement) return
    setShowPairingOverlay(true)
    const timeout = setTimeout(() => {
      setShowPairingOverlay(false)
      clearPairingAnnouncement()
    }, 3200)
    return () => clearTimeout(timeout)
  }, [pairingAnnouncement, clearPairingAnnouncement])

  // Dominó: cada partida del torneo es una sala de dominó real. Se muestra el anuncio del duelo y se entra
  // a ella; al terminar, la pantalla del torneo vuelve a recibir a la persona.
  const dominoMatch =
    tournament?.myMatch?.gameType === 'DOMINO' && tournament.myMatch.phase === 'PLAYING' ? tournament.myMatch : null
  useEffect(() => {
    if (!dominoMatch?.dominoRoomCode || !tournament) return
    const target = `/domino/sala/${encodeURIComponent(dominoMatch.dominoRoomCode)}?torneo=${encodeURIComponent(tournament.code)}`
    const timeout = setTimeout(() => navigate(target), 2600)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominoMatch?.matchCode])

  // Misión Galáctica: cada persona juega sola, en su propia pantalla. Se avisa y se entra a ella.
  const mazeMatch =
    tournament?.myMatch?.gameType === 'TRUE_FALSE_MAZE' && tournament.myMatch.phase === 'PLAYING' ? tournament.myMatch : null
  useEffect(() => {
    if (!mazeMatch || !tournament) return
    const target = `/laberinto-vf/torneo/${encodeURIComponent(tournament.code)}`
    const timeout = setTimeout(() => navigate(target), 2600)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mazeMatch?.matchCode])

  useEffect(() => {
    if (!matchAccusationFailedMessage) return
    const timeout = setTimeout(clearMatchAccusationFailedMessage, 3500)
    return () => clearTimeout(timeout)
  }, [matchAccusationFailedMessage, clearMatchAccusationFailedMessage])

  function handleExit() {
    leaveTournament()
    navigate('/')
  }

  function handleJoin(code: string) {
    clearError()
    startedRef.current = true
    joinTournament(code)
  }

  // Un código que no entró (no existe, ya inició, cupo lleno): se vuelve a la
  // casilla de código con el aviso, en vez de dejar al usuario atrapado.
  function handleRetry() {
    clearError()
    startedRef.current = false
    setJoinCodeInput('')
    navigate('/quien-es/torneo', { replace: true })
  }

  // El administrador cerró el torneo.
  if (closed) {
    return (
      <Modal onClose={() => navigate('/')}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-[15px] font-semibold text-text-h">El administrador cerró el torneo.</p>
          <button type="button" className="rounded-lg border border-border px-4 py-2 text-[14px] font-medium text-text-h" onClick={() => navigate('/')}>
            Volver al inicio
          </button>
        </div>
      </Modal>
    )
  }

  // Sin código en la URL ni `?crear=1`: solo cabe unirse con un código.
  if (!codeFromUrl && !wantsToCreate && !connecting && !tournament) {
    return (
      <div className="page-fade fixed inset-0 z-50 overflow-y-auto bg-bg">
        <div className="mx-auto flex min-h-full max-w-[460px] flex-col justify-center p-5 sm:p-8">
          <div className="stagger-in flex flex-col items-center gap-5 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow)]">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            >
              <Swords className="h-6 w-6" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-[20px] font-bold tracking-tight text-text-h">Entrar al torneo</h2>
              <p className="mt-1 text-[13px] text-text">Escribe el código de 6 caracteres que te dio el administrador.</p>
            </div>
            <TournamentCodeEntry value={joinCodeInput} onChange={setJoinCodeInput} onComplete={handleJoin} />
            <button
              type="button"
              className="w-full rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50"
              onClick={() => navigate('/')}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Con `?crear=1` y sin código todavía: el administrador confirma y abre la
  // sala con el torneo que habilitó en Edición — no aplica al unirse por código.
  if (wantsToCreate && !codeFromUrl && !tournament && !connecting && !startedRef.current) {
    return (
      <TournamentCreateConfirm
        onCancel={handleExit}
        onCreate={() => {
          startedRef.current = true
          createTournament()
        }}
      />
    )
  }

  if (connecting || !tournament) {
    // Intentó entrar y el servidor lo rechazó: explicación clara y salida directa.
    if (error && !connecting) {
      return (
        <Modal onClose={handleExit} maxWidthClassName="max-w-[420px]">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-[16px] font-semibold text-text-h">No pudimos entrar al torneo</p>
            <p className="text-[13.5px] text-danger" role="alert">
              {error}
            </p>
            <div className="flex w-full gap-2">
              <button type="button" className="flex-1 rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5" onClick={handleExit}>
                Volver al inicio
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                onClick={handleRetry}
              >
                Probar otro código
              </button>
            </div>
          </div>
        </Modal>
      )
    }
    return (
      <Modal onClose={handleExit}>
        <p className="flex items-center justify-center gap-2.5 py-2 text-[14px] text-text">
          <span className="live-dot" aria-hidden="true" />
          {codeFromUrl ? 'Uniéndote a la sala…' : 'Creando la sala…'}
        </p>
      </Modal>
    )
  }

  const self = tournament.participants.find((p) => p.isSelf)
  const tournamentWinnerName = tournament.participants.find((p) => p.userId === tournament.winnerUserId)?.displayName

  if (tournament.phase === 'WAITING') {
    return (
      <TournamentLobby
        tournament={tournament}
        error={error}
        onStart={startTournament}
        onClose={closeTournament}
        onExit={handleExit}
      />
    )
  }

  // El administrador no juega: ve el panel con la clasificación y las partidas en vivo.
  if (tournament.isModerator) {
    return <TournamentModeratorPanel tournament={tournament} error={error} onClose={closeTournament} onEndRound={endRound} onExit={handleExit} />
  }

  return (
    <div className="page-fade fixed inset-0 z-50 overflow-y-auto bg-bg">
      {dominoMatch && (
        <PairingAnnouncementOverlay
          announcement={{ round: dominoMatch.round, pairing: dominoMatch.players.map((p) => ({ userId: p.userId, displayName: p.displayName })) }}
          selfUserId={user?.id ?? null}
        />
      )}
      {mazeMatch && <MazeRoundAnnouncement round={mazeMatch.round} title={mazeMatch.gameTitle} />}
      {!dominoMatch && showPairingOverlay && pairingAnnouncement && (
        <PairingAnnouncementOverlay announcement={pairingAnnouncement} selfUserId={user?.id ?? null} />
      )}

      <div className={tournament.myMatch?.phase === 'PLAYING' ? 'guess-who-play-shell' : 'mx-auto flex min-h-full max-w-[1560px] flex-col p-5 sm:p-8'}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-[19px] tracking-tight text-text-h">
              {tournament.myMatch?.gameTitle ?? tournament.gameTitle}
              {tournament.myMatch && (
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TOURNAMENT_LEVEL_INFO[tournament.myMatch.level].tone}`}>
                  {TOURNAMENT_LEVEL_INFO[tournament.myMatch.level].label}
                </span>
              )}
            </h2>
            {tournament.phase === 'RUNNING' && (
              <div className="mt-1.5 flex items-center gap-3">
                <p className="text-[12.5px] text-text">
                  Ronda {tournament.currentRound} de {tournament.totalRounds}
                  {self ? ` · ${self.points} ${self.points === 1 ? 'punto' : 'puntos'}` : ''}
                </p>
                <div className="progress-track w-28" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${(tournament.currentRound / tournament.totalRounds) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent"
            onClick={handleExit}
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            Salir
          </button>
        </div>

        {error && (
          <p
            className="mb-4 rounded-lg border border-danger/35 bg-danger/10 px-[13px] py-[11px] text-sm leading-snug text-danger"
            role="alert"
          >
            {error}
          </p>
        )}

        {matchAccusationFailedMessage && (
          <p
            className="mb-4 rounded-lg border border-border bg-code-bg px-[13px] py-[11px] text-sm leading-snug text-text-h animate-[fade-in-up_0.2s_ease-out]"
            role="status"
          >
            {matchAccusationFailedMessage}{' '}
            {tournament.myMatch?.players.find((player) => player.userId === tournament.myMatch?.activePlayerUserId)?.displayName
              ? `Turno de ${tournament.myMatch.players.find((player) => player.userId === tournament.myMatch?.activePlayerUserId)?.displayName}.`
              : ''}
          </p>
        )}

        {tournament.phase === 'RUNNING' && tournament.myMatch && tournament.myMatch.gameType === 'GUESS_WHO' && self && (
          <RunningMatch
            error={error}
            onSend={sendMatchMessage}
            onAsk={askQuestion}
            onAnswer={answerQuestion}
            disconnected={connecting}
            match={tournament.myMatch}
            accusationMessage={matchAccusationFailedMessage ? 'Bandera equivocada' : null}
            discardMatchCard={discardMatchCard}
            accuseMatchCard={accuseMatchCard}
            passMatchTurn={passMatchTurn}
            selfUserId={user?.id ?? null}
          />
        )}

        {tournament.phase === 'RUNNING' && dominoMatch && (
          <div className="stagger-in flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-[16px] font-semibold text-text-h">Tu partida de Dominó está lista.</p>
            <button
              type="button"
              className="rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              onClick={() => navigate(`/domino/sala/${encodeURIComponent(dominoMatch.dominoRoomCode ?? '')}?torneo=${encodeURIComponent(tournament.code)}`)}
            >
              Ir a la partida
            </button>
          </div>
        )}

        {tournament.phase === 'RUNNING' && mazeMatch && (
          <div className="stagger-in flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-[16px] font-semibold text-text-h">Tu misión está lista.</p>
            <button
              type="button"
              className="rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              onClick={() => navigate(`/laberinto-vf/torneo/${encodeURIComponent(tournament.code)}`)}
            >
              Ir a la misión
            </button>
          </div>
        )}

        {tournament.phase === 'RUNNING' && !tournament.myMatch && (
          <div className="stagger-in flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-[16px] font-semibold text-text-h">Terminaste tu partida de la ronda {tournament.currentRound}.</p>
            <p className="flex items-center gap-2 text-[13px] text-text">
              <span className="live-dot" aria-hidden="true" />
              Esperando a que terminen las demás para empezar la siguiente…
            </p>
            <RoundsRanking tournament={tournament} selfUserId={user?.id ?? null} />
          </div>
        )}

        {tournament.phase === 'FINISHED' && (
          <div className="stagger-in flex flex-col items-center gap-4 py-6 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_14px_30px_-12px_var(--accent)] animate-[trophy-pop-in_0.6s_cubic-bezier(0.16,1,0.3,1)]"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            >
              <Trophy className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <p className="text-[18px] font-semibold text-text-h">
              {self?.userId === tournament.winnerUserId ? '¡Ganaste el torneo!' : `Ganó el torneo ${tournamentWinnerName}`}
            </p>
            <RoundsRanking tournament={tournament} selfUserId={user?.id ?? null} />
            <button
              type="button"
              className="mt-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_-10px_var(--accent)] active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              onClick={handleExit}
            >
              Salir
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function RunningMatch({
  error,
  onSend,
  onAsk,
  onAnswer,
  disconnected,
  match,
  accusationMessage,
  discardMatchCard,
  accuseMatchCard,
  passMatchTurn,
  selfUserId,
}: {
  error: string | null
  onSend: (text: string) => void
  onAsk: (questionId: string) => void
  onAnswer: (requestId: string, answer: boolean) => void
  disconnected: boolean
  match: NonNullable<ReturnType<typeof useGuessWhoTournament>['tournament']>['myMatch']
  accusationMessage?: string | null
  discardMatchCard: (cardId: string) => void
  accuseMatchCard: (cardId: string) => void
  passMatchTurn: () => void
  selfUserId: string | null
}) {
  if (!match) return null
  const self = match.players.find((p) => p.userId === selfUserId)
  const opponent = match.players.find((p) => p.userId !== selfUserId)
  if (!self || !opponent) return null

  const isMyTurn = match.phase === 'PLAYING' && match.activePlayerUserId === selfUserId
  const canAccuse = match.phase === 'PLAYING' && isMyTurn && self.discardedCardIds.length >= MIN_DISCARDS_TO_ACCUSE

  if (match.phase === 'PLAYING') {
    return (
      <div className="guess-who-play-panels">
      <div className="guess-who-play-board">
      <MatchBoard
        cards={match.cards}
        self={self}
        opponent={opponent}
        isMyTurn={isMyTurn}
        canAccuse={canAccuse}
        accusationMessage={accusationMessage}
        turnDeadline={match.turnDeadline}
        turnDurationSeconds={match.turnDurationSeconds}
        onDiscard={discardMatchCard}
        onAccuse={accuseMatchCard}
        onPassTurn={passMatchTurn}
      />
      </div>
      <ChatPanel key={match.matchCode} inline error={error} messages={match.guidedChat ?? []} selfUserId={selfUserId} onSend={onSend} disconnected={disconnected}
        guided={{ cards: match.cards, questions: match.suggestedQuestions ?? [], pending: match.pendingQuestion ?? null, isMyTurn, onAsk, onAnswer }} />
      </div>
    )
  }

  const winnerIsSelf = match.winnerUserId === selfUserId
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Trophy className="h-8 w-8 text-accent" strokeWidth={1.75} />
      <p className="text-[16px] font-semibold text-text-h">
        {winnerIsSelf ? '¡Ganaste esta ronda!' : `Ganó ${opponent.displayName}`}
      </p>
      <p className="text-[13px] text-text">Esperando a que termine la ronda…</p>
    </div>
  )
}

function RoundsRanking({
  tournament,
  selfUserId,
}: {
  tournament: NonNullable<ReturnType<typeof useGuessWhoTournament>['tournament']>
  selfUserId: string | null
}) {
  const ranked = [...tournament.participants].sort((a, b) => b.points - a.points)

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-4 text-left">
      <div className="rounded-xl border border-border p-4">
        <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
          <Crown className="h-4 w-4 text-accent" strokeWidth={2} />
          Clasificación
        </p>
        <div className="flex flex-col gap-1.5">
          {ranked.map((participant, index) => (
            <div
              key={participant.userId}
              className={`stagger-in flex items-center justify-between rounded-lg px-3 py-1.5 text-[12.5px] transition-colors duration-300 ${
                participant.userId === selfUserId ? 'bg-accent/10 ring-1 ring-accent/30' : 'bg-code-bg'
              }`}
              style={{ '--stagger': index } as React.CSSProperties}
            >
              <span className="font-medium text-text-h">
                {participant.displayName}
                {participant.userId === selfUserId ? ' (tú)' : ''}
              </span>
              <span className="text-text">
                {participant.points} pts · {participant.wins}G {participant.losses}P
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="mb-3 text-[13px] font-semibold text-text-h">Rondas</p>
        <div className="flex flex-col gap-2">
          {tournament.rounds.map((round) => (
            <div key={round.round} className="rounded-lg bg-code-bg px-3 py-2 text-[12px] text-text">
              <p className="mb-1 font-semibold text-text-h">Ronda {round.round}</p>
              {round.matches[0]?.gameType === 'TRUE_FALSE_MAZE' ? (
                <p>
                  Misión Galáctica: {round.matches.filter((match) => match.winnerUserId).length} de {round.matches.length}{' '}
                  respondieron todo bien
                  {round.matches.some((match) => match.phase !== 'FINISHED') ? ' (en curso)' : ''}
                </p>
              ) : (
                round.matches.map((match) => (
                  <p key={match.matchCode}>
                    {match.winnerUserId
                      ? `Ganó ${tournament.participants.find((p) => p.userId === match.winnerUserId)?.displayName ?? 'el bot'}${match.vsBot ? ' (vs bot)' : ''}`
                      : 'En curso'}
                  </p>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Aviso de una ronda de Misión Galáctica: no hay pareja, cada persona juega sola. */
function MazeRoundAnnouncement({ round, title }: { round: number; title: string }) {
  return (
    <div className="page-fade fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-black/75 px-5 text-center text-white backdrop-blur-md">
      <p className="stagger-in text-[13px] font-semibold tracking-[0.22em] text-white/70 uppercase">Ronda {round}</p>
      <p className="stagger-in text-[26px] font-bold sm:text-[32px]" style={{ '--stagger': 1 } as React.CSSProperties}>
        {title}
      </p>
      <p className="stagger-in max-w-[420px] text-[14px] text-white/80" style={{ '--stagger': 2 } as React.CSSProperties}>
        Juegas solo. Respondiendo <b>todas</b> bien sumas un punto.
      </p>
    </div>
  )
}

function PairingAnnouncementOverlay({
  announcement,
  selfUserId,
}: {
  announcement: { round: number; pairing: { userId: string; displayName: string }[] }
  selfUserId: string | null
}) {
  const self = announcement.pairing.find((p) => p.userId === selfUserId)
  const rival = announcement.pairing.find((p) => p.userId !== selfUserId)
  const rivalIsBot = rival?.userId.startsWith('bot:') === true

  return (
    <div className="page-fade fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-black/75 px-5 text-center backdrop-blur-md">
      <p className="stagger-in text-[13px] font-semibold tracking-[0.22em] text-white/70 uppercase">Ronda {announcement.round}</p>
      <div className="flex w-full max-w-[640px] items-center justify-center gap-4 sm:gap-8">
        <div className="versus-left min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/10 px-4 py-5 text-white">
          <p className="truncate text-[18px] font-bold sm:text-[22px]">{self?.displayName ?? 'Tú'}</p>
          <p className="text-[12px] text-white/60">Tú</p>
        </div>
        <span
          className="versus-badge flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-[0_10px_28px_-8px_var(--accent-2)]"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
        >
          <Swords className="h-6 w-6" strokeWidth={2} />
        </span>
        <div className="versus-right min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/10 px-4 py-5 text-white">
          <p className="flex items-center justify-center gap-1.5 truncate text-[18px] font-bold sm:text-[22px]">
            {rivalIsBot && <Bot className="h-5 w-5 shrink-0" strokeWidth={2} />}
            {rival?.displayName ?? '???'}
          </p>
          <p className="text-[12px] text-white/60">{rivalIsBot ? 'Rival automático' : 'Tu rival'}</p>
        </div>
      </div>
    </div>
  )
}
