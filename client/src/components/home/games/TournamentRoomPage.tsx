import { GameInstructionsGate } from './GameInstructionsGate'
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
import { AvatarCircle } from '../../avatar/AvatarCircle'
import { AvatarFigure } from '../../avatar/AvatarFigure'
import { usePlayersAvatars } from '../../avatar/usePlayersAvatars'
import { MIN_DISCARDS_TO_ACCUSE } from './guessWhoTypes'
import { TOURNAMENT_LEVEL_INFO } from './tournamentLevels'

/** Cuánto se ve el anuncio de emparejamiento; el aviso se desvanece justo al cumplirse (`.overlay-timed`). */
const PAIRING_OVERLAY_MS = 3200
/** Espera antes de entrar a la partida de Dominó o a la misión: es lo que dura su anuncio. */
const MATCH_ENTRY_DELAY_MS = 2600
const MAZE_ENTRY_DELAY_MS = MATCH_ENTRY_DELAY_MS
/** Cuánto se ve la clasificación al terminar la partida (issue #131): nunca más de 5 s. */
const STANDINGS_OVERLAY_MS = 4500
const PLAYED_ROUND_KEY_PREFIX = 'nexusplay:torneo-ronda-jugada:'
const GUIDE_SEEN_KEY_PREFIX = 'nexusplay:torneo-guia-vista:'

/** Última ronda en la que esta persona tuvo partida (0 = ninguna pendiente de mostrar). */
function readPlayedRound(code: string): number {
  try {
    return Number(window.sessionStorage.getItem(PLAYED_ROUND_KEY_PREFIX + code)) || 0
  } catch {
    return 0
  }
}

function writePlayedRound(code: string, round: number): void {
  try {
    window.sessionStorage.setItem(PLAYED_ROUND_KEY_PREFIX + code, String(round))
  } catch {
    // Sin almacenamiento: solo no se recuerda.
  }
}

function wasTournamentGuideSeen(code: string): boolean {
  try {
    return window.sessionStorage.getItem(GUIDE_SEEN_KEY_PREFIX + code) === '1'
  } catch {
    return false
  }
}

function markTournamentGuideSeen(code: string): void {
  try {
    window.sessionStorage.setItem(GUIDE_SEEN_KEY_PREFIX + code, '1')
  } catch {
    // Sin almacenamiento: solo no se recuerda.
  }
}

/**
 * Sala de torneo por puntos, moderado por un administrador ("¿Quién Es?" grupal) en página propia (ruta
 * `/quien-es/torneo/:code?`, ver App.tsx), mismo criterio que
 * GuessWhoRoomPage/DominoRoomPage: reconecta al torneo en curso vía el
 * código en la URL, y no deja el Sidebar/header de HomeLayout montado detrás.
 *
 * Antes de entrar se muestra la guía corta del torneo (`GameInstructionsGate`), sin nada de los juegos;
 * también se puede abrir a demanda desde la sala de espera.
 */
export function TournamentRoomPage() {
  const { code } = useParams<{ code?: string }>()
  // Se decide una sola vez al montar: si ya se vio en este torneo, se entra directo.
  const [guideAlreadySeen] = useState(() => (code ? wasTournamentGuideSeen(code.toUpperCase()) : false))
  if (guideAlreadySeen) return <TournamentSession />
  return (
    <GameInstructionsGate kind={'GUESS_WHO_GROUP'}>
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
  const [showStandings, setShowStandings] = useState(false)

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
    }, PAIRING_OVERLAY_MS)
    return () => clearTimeout(timeout)
  }, [pairingAnnouncement, clearPairingAnnouncement])

  // Al terminar su partida la persona ve quién va de primero (máx. 5 s). Se recuerda la ronda en la que
  // jugó (sobrevive a ir y volver de la página del juego); al verla sin esa partida, se muestra y se olvida.
  const myRound = tournament?.myMatch?.round ?? 0
  useEffect(() => {
    if (!tournament || tournament.isModerator || tournament.phase !== 'RUNNING') return
    const playedRound = readPlayedRound(tournament.code)
    if (myRound) {
      // Con partida de una ronda distinta a la recordada (p. ej. la siguiente): se muestra la de la anterior.
      if (playedRound && playedRound !== myRound) setShowStandings(true)
      writePlayedRound(tournament.code, myRound)
    } else if (playedRound) {
      writePlayedRound(tournament.code, 0)
      setShowStandings(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRound, tournament?.code, tournament?.phase])
  useEffect(() => {
    if (!showStandings) return
    const timeout = setTimeout(() => setShowStandings(false), STANDINGS_OVERLAY_MS)
    return () => clearTimeout(timeout)
  }, [showStandings])

  // La guía del torneo se ve una sola vez por torneo: al volver de un juego no se repite.
  useEffect(() => {
    if (tournament?.code) markTournamentGuideSeen(tournament.code)
  }, [tournament?.code])

  // Dominó: cada partida del torneo es una sala de dominó real. Se muestra el anuncio del duelo y se entra
  // a ella; al terminar, la pantalla del torneo vuelve a recibir a la persona.
  const dominoMatch =
    tournament?.myMatch?.gameType === 'DOMINO' && tournament.myMatch.phase === 'PLAYING' ? tournament.myMatch : null
  useEffect(() => {
    if (!dominoMatch?.dominoRoomCode || !tournament || showStandings) return
    const target = `/domino/sala/${encodeURIComponent(dominoMatch.dominoRoomCode)}?torneo=${encodeURIComponent(tournament.code)}`
    const timeout = setTimeout(() => navigate(target), MATCH_ENTRY_DELAY_MS)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominoMatch?.matchCode, showStandings])

  // Misión Galáctica: cada persona juega sola, en su propia pantalla. Se avisa y se entra a ella.
  const mazeMatch =
    tournament?.myMatch?.gameType === 'TRUE_FALSE_MAZE' && tournament.myMatch.phase === 'PLAYING' ? tournament.myMatch : null
  useEffect(() => {
    if (!mazeMatch || !tournament || showStandings) return
    const target = `/laberinto-vf/torneo/${encodeURIComponent(tournament.code)}`
    const timeout = setTimeout(() => navigate(target), MAZE_ENTRY_DELAY_MS)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mazeMatch?.matchCode, showStandings])

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
          durationMs={MATCH_ENTRY_DELAY_MS}
        />
      )}
      {mazeMatch && <MazeRoundAnnouncement round={mazeMatch.round} title={mazeMatch.gameTitle} />}
      {showStandings && (
        <StandingsOverlay participants={tournament.participants} selfUserId={user?.id ?? null} round={Math.max(tournament.currentRound - (tournament.myMatch ? 1 : 0), 1)} />
      )}
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

/**
 * Quién va de primero y los 3 que le siguen, con sus personajes; si nadie tiene puntos, lo dice.
 * Se desvanece solo (`.overlay-timed`).
 */
function StandingsOverlay({
  participants,
  selfUserId,
  round,
}: {
  participants: NonNullable<ReturnType<typeof useGuessWhoTournament>['tournament']>['participants']
  selfUserId: string | null
  round: number
}) {
  const ranked = [...participants].sort((a, b) => b.points - a.points || b.wins - a.wins)
  const leader = ranked[0]
  const nobodyScored = !leader || leader.points === 0
  const chasers = ranked.slice(1, 4)
  const shown = nobodyScored ? ranked.slice(0, 4) : [leader, ...chasers]
  const avatars = usePlayersAvatars(shown.map((p) => p.userId).filter((id) => !id.startsWith('bot:')))
  const nameOf = (p: { userId: string; displayName: string }) => `${p.displayName}${p.userId === selfUserId ? ' (tú)' : ''}`
  const leaderAvatar = leader ? avatars[leader.userId] : null
  const pts = (n: number) => `${n} ${n === 1 ? 'punto' : 'puntos'}`

  return (
    <div
      className="overlay-timed fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 bg-black/80 px-5 text-center text-white backdrop-blur-md"
      style={{ '--overlay-ms': `${STANDINGS_OVERLAY_MS}ms` } as React.CSSProperties}
      role="status"
    >
      <p className="stagger-in text-[13px] font-semibold tracking-[0.22em] text-white/70 uppercase">Fin de la ronda {round}</p>
      {nobodyScored ? (
        <>
          <div className="flex items-end justify-center -space-x-3" aria-hidden="true">
            {shown.map((p, index) => (
              <div key={p.userId} className="chip-pop" style={{ '--stagger': index } as React.CSSProperties}>
                <AvatarCircle config={avatars[p.userId]} name={p.displayName} className="h-16 w-16 border-[3px] border-white/30 text-[20px] shadow-lg" />
              </div>
            ))}
          </div>
          <p className="stagger-in text-[22px] font-bold sm:text-[28px]" style={{ '--stagger': 2 } as React.CSSProperties}>
            Nadie ha sumado puntos todavía
          </p>
          <p className="stagger-in text-[14px] text-white/75" style={{ '--stagger': 3 } as React.CSSProperties}>
            ¡La primera victoria te pone arriba!
          </p>
        </>
      ) : (
        <>
          <div className="chip-pop flex flex-col items-center gap-1">
            <Crown className="h-9 w-9 text-amber-300 drop-shadow animate-[trophy-pop-in_0.6s_cubic-bezier(0.16,1,0.3,1)]" strokeWidth={2} aria-hidden="true" />
            {leaderAvatar ? (
              <AvatarFigure config={leaderAvatar} className="w-[120px] drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)] sm:w-[150px]" />
            ) : (
              <AvatarCircle config={null} name={leader.displayName} className="h-24 w-24 text-[30px] shadow-lg" />
            )}
            <p className="text-[12px] font-semibold tracking-[0.18em] text-amber-300 uppercase">Va de primero</p>
            <p className="max-w-[320px] truncate text-[26px] font-bold sm:text-[32px]">{nameOf(leader)}</p>
            <span className="rounded-full bg-amber-400/25 px-3 py-0.5 text-[14px] font-bold text-amber-100">{pts(leader.points)}</span>
          </div>
          {chasers.length > 0 && (
            <ol className="flex w-full max-w-[460px] items-start justify-center gap-3">
              {chasers.map((p, index) => (
                <li
                  key={p.userId}
                  className="chip-pop flex min-w-0 flex-1 flex-col items-center gap-1"
                  style={{ '--stagger': index + 2 } as React.CSSProperties}
                >
                  <span className="relative">
                    <AvatarCircle config={avatars[p.userId]} name={p.displayName} className="h-14 w-14 border-2 border-white/30 text-[18px] shadow-lg" />
                    <span className="absolute -right-1.5 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[12px] font-extrabold text-slate-900">
                      {index + 2}
                    </span>
                  </span>
                  <span className="w-full truncate text-[12.5px] font-semibold">{nameOf(p)}</span>
                  <span className="text-[11.5px] text-white/70">{pts(p.points)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}

/** Aviso de una ronda de Misión Galáctica: no hay pareja, cada persona juega sola. */
function MazeRoundAnnouncement({ round, title }: { round: number; title: string }) {
  return (
    <div
      className="overlay-timed fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-black/75 px-5 text-center text-white backdrop-blur-md"
      style={{ '--overlay-ms': `${MAZE_ENTRY_DELAY_MS}ms` } as React.CSSProperties}
    >
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
  durationMs = PAIRING_OVERLAY_MS,
}: {
  announcement: { round: number; pairing: { userId: string; displayName: string }[] }
  selfUserId: string | null
  /** Cuánto se muestra: coincide con el temporizador que lo retira o que navega a la partida. */
  durationMs?: number
}) {
  const self = announcement.pairing.find((p) => p.userId === selfUserId)
  const rival = announcement.pairing.find((p) => p.userId !== selfUserId)
  const rivalIsBot = rival?.userId.startsWith('bot:') === true

  return (
    <div
      className="overlay-timed fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-black/75 px-5 text-center backdrop-blur-md"
      style={{ '--overlay-ms': `${durationMs}ms` } as React.CSSProperties}
    >
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
