import { GameInstructionsGate } from './GameInstructionsGate'
import { MultiplayerLobby } from './MultiplayerLobby'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Crosshair, Hand, LogOut, PackageOpen, RotateCcw, SkipForward, Trophy, Volume2, VolumeX } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { useDominoRoom } from './useDominoRoom'
import { iconForConcept, type DominoConcept, type DominoLevel } from './dominoTypes'
import { DominoSettingsPanel } from './DominoSettingsPanel'
import { DominoQuestionModal } from './DominoQuestionModal'
import { DOMINO_FEEDBACK_MS } from './dominoLevels'
import { dominoTileCategoryInk } from './dominoTileVisualTokens'
import { resolveDominoTooltipPlacement, type DominoTooltipPlacement } from './dominoConceptTooltip'
import type { DominoPlacedTileView, DominoRoomStateView, DominoTileView } from './dominoRoomTypes'
import type { DominoVisualOrientation, Point } from './dominoChainLayout'
import { DEFAULT_DOMINO_BOARD_RENDER_MODE, resolveDominoBoardPresentation } from './dominoBoardRenderMode'
import {
  canStartDominoMousePan,
  clampDominoManualCameraFocus,
  dominoCameraContentBounds,
  dominoEndDropZoneFocus,
  dominoBoardCameraTransform,
  dominoManualCameraFocusBounds,
  focusDominoBoardCamera,
  hasDominoBoardPanExceededThreshold,
  hasDominoManualCameraPanRange,
  manualDominoBoardCamera,
  panDominoManualCameraFocus,
  resolveDominoLogicalViewport,
  shouldShowDominoBoardPanHint,
  type DominoCameraFocusBounds,
  type DominoCameraDestination,
  type DominoCameraState,
} from './dominoBoardCamera'
import { DealCountdownOverlay, TurnBanner, TurnPopBanner, useCountdown } from './MatchBoard'
import { Modal } from './Modal'
import { DominoScenery, dominoSceneForTheme } from './DominoScenery'
import { DominoInfoCloud } from './DominoInfoCloud'
import { useTheme } from '../../../hooks/useTheme'

/**
 * Sala de Dominó 1v1 en tiempo real: página propia (ruta `/domino/sala/:code?`,
 * ver App.tsx) en vez de un pop-up, para que se pueda compartir/recargar el
 * link de una partida en curso — mismo criterio que se usó para "¿Quién Es?"
 * salvo que ahí la sala vive fuera del árbol de rutas; acá el pedido explícito
 * fue una página dedicada, así que sí es una <Route>.
 */
export function DominoRoomPage() {
  const [searchParams] = useSearchParams()
  // Dentro de un torneo se entra directo a la partida: la guía ya se puede ver desde la sala de espera del torneo.
  if (searchParams.get('torneo')) return <DominoRoomPageSession />
  return <GameInstructionsGate kind="DOMINO"><DominoRoomPageSession /></GameInstructionsGate>
}

function DominoRoomPageSession() {
  const { code: codeFromUrl } = useParams<{ code?: string }>()
  const [searchParams] = useSearchParams()
  const gameIdToCreate = searchParams.get('gameId')
  // Partida de un torneo (issue #102): sin revancha, y al terminar se vuelve al torneo.
  const tournamentCode = searchParams.get('torneo')
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const { theme } = useTheme()
  const scene = dominoSceneForTheme(theme)
  const {
    room,
    error,
    connecting,
    rematchRejectedMessage,
    dealCountdownMs,
    lastPlacedTileId,
    createRoom,
    joinRoom,
    setReady,
    messages,
    sendChatMessage,
    updateTurnDuration,
    updateLevel,
    answerQuestion,
    answerResult,
    dismissAnswerResult,
    playTile,
    drawTile,
    passTurn,
    voteRematch,
    leaveRoom,
  } = useDominoRoom(token)

  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [boardScale, setBoardScale] = useState(1)
  const [boardNeedsScroll, setBoardNeedsScroll] = useState(false)
  const [boardViewport, setBoardViewport] = useState({ width: 0, height: 0 })
  const [cameraState, setCameraState] = useState<DominoCameraState>({ mode: 'follow', destination: 'opening' })
  const [isBoardHelpOpen, setIsBoardHelpOpen] = useState(false)
  const [draggedTileId, setDraggedTileId] = useState<string | null>(null)
  const [isBoardPanning, setIsBoardPanning] = useState(false)
  const [isBoardPanHintVisible, setIsBoardPanHintVisible] = useState(false)
  const [isDominoSoundMuted, setIsDominoSoundMuted] = useState(() => {
    try {
      return localStorage.getItem('nexusplay-dominexo-sound-muted') === 'true'
    } catch {
      return false
    }
  })
  const boardViewportRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)
  const openingTileIdRef = useRef<string | null>(null)
  const boardPanHintRoomRef = useRef<string | null>(null)
  const boardPanHintTimerRef = useRef<number | null>(null)
  const boardPanGestureRef = useRef<{
    pointerId: number
    start: Point
    initialFocus: Point
    hasPanned: boolean
  } | null>(null)
  const suppressBoardClickRef = useRef(false)

  const remainingMs = useCountdown(room?.turnDeadline ?? null)

  useEffect(() => {
    if (!isBoardHelpOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsBoardHelpOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isBoardHelpOpen])

  // Arranque de la sala: si la URL trae ?gameId= crea una sala nueva; si trae
  // un código en el path, se une a esa sala. Se hace una sola vez (guard con
  // startedRef) para no reintentar en cada re-render del hook de socket.
  useEffect(() => {
    if (connecting || startedRef.current) return
    if (codeFromUrl) {
      startedRef.current = true
      joinRoom(codeFromUrl.toUpperCase())
    } else if (gameIdToCreate) {
      startedRef.current = true
      createRoom(gameIdToCreate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecting, codeFromUrl, gameIdToCreate])

  // En cuanto el servidor confirma el código de una sala recién creada, se
  // refleja en la URL vía react-router (reemplazando, sin agregar historial)
  // para que la sala sea compartible/recargable con ese link.
  useEffect(() => {
    if (room && !codeFromUrl) {
      navigate(`/domino/sala/${room.code}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.code])

  function handleExit() {
    leaveRoom()
    navigate(tournamentCode ? `/quien-es/torneo/${encodeURIComponent(tournamentCode)}` : '/')
  }

  // Terminada la partida del torneo, se vuelve solo a la pantalla del torneo (hay botón para hacerlo antes).
  const finishedInTournament = Boolean(tournamentCode) && room?.phase === 'FINISHED'
  useEffect(() => {
    if (!finishedInTournament || !tournamentCode) return
    const timeout = setTimeout(() => {
      leaveRoom()
      navigate(`/quien-es/torneo/${encodeURIComponent(tournamentCode)}`)
    }, 9000)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedInTournament, tournamentCode])

  function toggleDominoSound() {
    setIsDominoSoundMuted((muted) => {
      const nextMuted = !muted
      try {
        localStorage.setItem('nexusplay-dominexo-sound-muted', String(nextMuted))
      } catch {
        // La preferencia es local y opcional; la partida no depende de ella.
      }
      return nextMuted
    })
  }

  function handleJoinSubmit() {
    const code = joinCodeInput.trim().toUpperCase()
    if (!code) return
    startedRef.current = true
    joinRoom(code)
  }

  const self = room?.players.find((p) => p.isSelf)
  const opponent = room?.players.find((p) => !p.isSelf)
  const isMyTurn = room?.phase === 'PLAYING' && room.activePlayerUserId === user?.id
  const conceptOf = (id: number): DominoConcept => room!.concepts[id]
  const level: DominoLevel = room?.level ?? 'EASY'

  // Retroalimentación al colocar una ficha: línea breve con la definición, sin bloquear la jugada.
  const [feedback, setFeedback] = useState<{ key: string; lines: string[] } | null>(null)
  const lastBoardLengthRef = useRef(0)
  useEffect(() => {
    const boardNow = room?.board ?? []
    const grew = boardNow.length > lastBoardLengthRef.current
    lastBoardLengthRef.current = boardNow.length
    const placed = boardNow.find((tile) => tile.id === lastPlacedTileId)
    if (!grew || !placed || !room) return
    const lines: string[] = []
    for (const index of new Set([placed.left, placed.right])) {
      const concept = room.concepts[index]
      if (concept?.definition) lines.push(`${concept.label}: ${concept.definition}`)
    }
    if (lines.length === 0) return
    setFeedback({ key: placed.id, lines })
    const timer = setTimeout(() => setFeedback(null), DOMINO_FEEDBACK_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.board.length, lastPlacedTileId])

  // Pregunta de Intermedio: mientras el servidor la tiene pendiente (o hasta cerrar el resultado propio).
  const pendingQuestion = room?.pendingQuestion ?? null
  // Al responder, el estado ya no trae la pregunta pendiente: se conserva la última para mostrar el resultado sobre ella.
  const [lastQuestion, setLastQuestion] = useState<{ question: { text: string; options: string[] } } | null>(null)
  if (pendingQuestion?.question && lastQuestion?.question !== pendingQuestion.question) {
    setLastQuestion({ question: pendingQuestion.question })
  }
  const questionToShow = pendingQuestion?.question ?? (answerResult ? lastQuestion?.question ?? null : null)
  const questionConceptIndex = answerResult ? answerResult.conceptIndex : pendingQuestion?.conceptIndex ?? null
  const questionConcept = room && questionConceptIndex !== null ? room.concepts[questionConceptIndex] : undefined
  const questionIsSelf = answerResult ? true : pendingQuestion?.userId === user?.id

  const board = room?.board ?? []
  const leftEnd = board[0]?.left
  const rightEnd = board[board.length - 1]?.right
  const hand: DominoTileView[] = self?.hand ?? []
  const logicalBoardViewport = useMemo(() => resolveDominoLogicalViewport(boardViewport), [boardViewport])
  const boardPresentation = useMemo(
    () => resolveDominoBoardPresentation(DEFAULT_DOMINO_BOARD_RENDER_MODE, board, logicalBoardViewport, room?.openingTileId),
    [board, logicalBoardViewport, room?.openingTileId],
  )
  const manualCameraBounds = useMemo<DominoCameraFocusBounds | null>(() => {
    if (boardPresentation.kind !== 'bidirectional') return null
    return dominoManualCameraFocusBounds(
      boardViewport,
      logicalBoardViewport,
      dominoCameraContentBounds(boardPresentation.layout, logicalBoardViewport),
    )
  }, [boardPresentation, boardViewport, logicalBoardViewport])
  const boardCamera = useMemo(() => {
    if (boardPresentation.kind !== 'bidirectional') return null
    const opening = boardPresentation.layout.tiles.find((tile) => tile.id === room?.openingTileId)
    if (!opening) return null
    if (cameraState.mode === 'manual' && manualCameraBounds) {
      return manualDominoBoardCamera(boardViewport, logicalBoardViewport, cameraState.focus, manualCameraBounds)
    }
    const followDestination = cameraState.mode === 'follow' ? cameraState.destination : 'opening'
    const focus = followDestination === 'left'
      ? dominoEndDropZoneFocus(boardPresentation.layout.leftEnd)
      : followDestination === 'right'
        ? dominoEndDropZoneFocus(boardPresentation.layout.rightEnd)
        : { x: opening.x + opening.width / 2, y: opening.y + opening.height / 2 }
    return focusDominoBoardCamera(boardViewport, logicalBoardViewport, focus)
  }, [boardPresentation, boardViewport, cameraState, logicalBoardViewport, manualCameraBounds, room?.openingTileId])

  const cameraDestination = cameraState.mode === 'follow' ? cameraState.destination : null
  const hasManualPanRange = Boolean(manualCameraBounds && hasDominoManualCameraPanRange(manualCameraBounds))

  function showBoardPanHint() {
    if (boardPanHintTimerRef.current !== null) window.clearTimeout(boardPanHintTimerRef.current)
    setIsBoardPanHintVisible(true)
    boardPanHintTimerRef.current = window.setTimeout(() => {
      boardPanHintTimerRef.current = null
      setIsBoardPanHintVisible(false)
    }, 5000)
  }

  function hideBoardPanHint() {
    if (boardPanHintTimerRef.current !== null) {
      window.clearTimeout(boardPanHintTimerRef.current)
      boardPanHintTimerRef.current = null
    }
    setIsBoardPanHintVisible(false)
  }

  useEffect(() => () => {
    if (boardPanHintTimerRef.current !== null) window.clearTimeout(boardPanHintTimerRef.current)
  }, [])

  useEffect(() => {
    const roomCode = room?.code ?? null
    const isPlaying = room?.phase === 'PLAYING'
    const isViewportReady = boardViewport.width > 0 && boardViewport.height > 0
    if (!roomCode || !isPlaying || boardPresentation.kind !== 'bidirectional' || !isViewportReady) {
      return
    }
    if (!shouldShowDominoBoardPanHint(isPlaying, true, isViewportReady, boardPanHintRoomRef.current === roomCode)) return

    boardPanHintRoomRef.current = roomCode
    showBoardPanHint()
  }, [boardPresentation.kind, boardViewport.height, boardViewport.width, room?.code, room?.phase])

  const isBoardPanHintDisplayed = isBoardPanHintVisible && boardPresentation.kind === 'bidirectional'

  useEffect(() => {
    const openingTileId = room?.openingTileId ?? null
    if (openingTileId && openingTileId !== openingTileIdRef.current) {
      setCameraState({ mode: 'follow', destination: 'opening' })
    }
    openingTileIdRef.current = openingTileId
  }, [room?.openingTileId])

  useEffect(() => {
    if (!manualCameraBounds) return
    setCameraState((current) => {
      if (current.mode !== 'manual') return current
      const focus = clampDominoManualCameraFocus(current.focus, manualCameraBounds)
      return focus.x === current.focus.x && focus.y === current.focus.y ? current : { mode: 'manual', focus }
    })
  }, [manualCameraBounds])

  useEffect(() => () => {
    boardPanGestureRef.current = null
  }, [])

  function followBoardCamera(destination: DominoCameraDestination) {
    boardPanGestureRef.current = null
    setIsBoardPanning(false)
    setCameraState({ mode: 'follow', destination })
  }

  function finishBoardPanGesture(pointerId?: number, suppressClick = false) {
    const gesture = boardPanGestureRef.current
    if (!gesture || (pointerId !== undefined && gesture.pointerId !== pointerId)) return
    if (gesture.hasPanned && suppressClick) suppressBoardClickRef.current = true
    boardPanGestureRef.current = null
    setIsBoardPanning(false)
  }

  function handleBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (!canStartDominoMousePan({
      pointerType: event.pointerType,
      button: event.button,
      isExcludedTarget: Boolean(target.closest('[data-domino-pan-exclude]')),
      isCameraReady: Boolean(boardCamera && manualCameraBounds && hasManualPanRange),
    })) return
    if (!boardCamera || !manualCameraBounds) return
    const initialFocus = clampDominoManualCameraFocus({
      x: boardViewport.width / 2 - boardCamera.x,
      y: boardViewport.height / 2 - boardCamera.y,
    }, manualCameraBounds)
    boardPanGestureRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      initialFocus,
      hasPanned: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleBoardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = boardPanGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId || !manualCameraBounds) return
    const viewportDelta = { x: event.clientX - gesture.start.x, y: event.clientY - gesture.start.y }
    if (!gesture.hasPanned && !hasDominoBoardPanExceededThreshold(viewportDelta)) return

    if (!gesture.hasPanned) {
      gesture.hasPanned = true
      setIsBoardPanning(true)
      hideBoardPanHint()
    }
    event.preventDefault()
    setCameraState({
      mode: 'manual',
      focus: panDominoManualCameraFocus(gesture.initialFocus, viewportDelta, manualCameraBounds),
    })
  }

  function handleBoardPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    finishBoardPanGesture(event.pointerId, true)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function handleBoardPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    finishBoardPanGesture(event.pointerId)
  }

  function handleBoardClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressBoardClickRef.current) return
    suppressBoardClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  function tileMatchesEnd(tile: DominoTileView, end: number | undefined): boolean {
    if (end === undefined) return true
    return tile.a === end || tile.b === end
  }

  const hasValidMove =
    board.length === 0 ? hand.length > 0 : hand.some((t) => tileMatchesEnd(t, leftEnd) || tileMatchesEnd(t, rightEnd))

  const selectedTile = hand.find((t) => t.id === selectedTileId) ?? null
  const canPlaceLeft = selectedTile ? tileMatchesEnd(selectedTile, leftEnd) : false
  const canPlaceRight = selectedTile ? tileMatchesEnd(selectedTile, rightEnd) : false

  useEffect(() => {
    const viewport = boardViewportRef.current
    if (!viewport) return

    const updateScale = () => {
      setBoardViewport({ width: viewport.clientWidth, height: viewport.clientHeight })
      if (!board.length) {
        setBoardScale(1)
        setBoardNeedsScroll(false)
        return
      }
      const availableWidth = Math.max(1, viewport.clientWidth - 48)
      const tileWidth = board.reduce((total, tile) => total + (tile.isDouble ? 68 : 136), 0)
      const chainWidth = tileWidth + Math.max(0, board.length - 1) * 2 + 80
      const preferredScale = board.length === 1 ? 1.26 : board.length <= 3 ? 1.16 : board.length <= 5 ? 1.08 : 1
      const fitScale = availableWidth / chainWidth
      const nextScale = Math.min(preferredScale, Math.max(0.62, fitScale))

      setBoardScale((current) => Math.abs(current - nextScale) < 0.015 ? current : nextScale)
      setBoardNeedsScroll(fitScale < 0.62)
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [board])

  useEffect(() => {
    if (!rematchRejectedMessage) return
    const timeout = setTimeout(() => navigate('/'), 2800)
    return () => clearTimeout(timeout)
  }, [rematchRejectedMessage, navigate])

  function handleHandTileClick(tile: DominoTileView) {
    if (!isMyTurn) return
    if (selectedTileId === tile.id) {
      setSelectedTileId(null)
      return
    }
    if (board.length === 0) {
      playTile(tile.id, 'right')
      return
    }
    setSelectedTileId(tile.id)
  }

  function handleEndClick(side: 'left' | 'right') {
    const tileId = selectedTileId ?? draggedTileId
    if (!tileId) return
    playTile(tileId, side)
    setSelectedTileId(null)
    setDraggedTileId(null)
  }

  function handleRematchDecline() {
    voteRematch(false)
    navigate('/')
  }

  if (rematchRejectedMessage) {
    return (
      <Modal onClose={() => navigate('/')} maxWidthClassName="max-w-[420px]">
        <div className="flex flex-col items-center gap-3 py-4 text-center animate-[fade-in-up_0.3s_ease-out]">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/15 text-danger">
            <LogOut className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="text-[15px] font-semibold text-text-h">Saliste de la partida</p>
          <p className="text-[13px] text-text">{rematchRejectedMessage}</p>
          <button
            type="button"
            className="mt-2 w-full rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-transform hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            onClick={() => navigate('/')}
          >
            Entendido
          </button>
        </div>
      </Modal>
    )
  }

  // Partida de torneo a punto de repartirse: nada que configurar ni confirmar.
  if (tournamentCode && (!room || room.phase === 'WAITING')) {
    return (
      <div className="page-fade fixed inset-0 z-50 flex items-center justify-center bg-[#080F24] text-white">
        <p className="flex items-center gap-3 text-[15px] font-medium">
          <span className="live-dot" aria-hidden="true" />
          Preparando tu partida de Dominó…
        </p>
      </div>
    )
  }

  if (room?.phase === 'WAITING') return <MultiplayerLobby
    room={room} roomPath={`/domino/sala/${encodeURIComponent(room.code)}`} maxPlayers={2}
    isHost={Boolean(self?.isHost)} connecting={connecting} error={error}
    turnDurationSeconds={room.turnDurationSeconds} onUpdateTurnDuration={updateTurnDuration}
    large
    settingsPanel={<DominoSettingsPanel level={level} turnDurationSeconds={room.turnDurationSeconds} isHost={Boolean(self?.isHost)} disabled={connecting} onChangeLevel={updateLevel} onUpdateTurnDuration={updateTurnDuration} availableLevels={room.availableLevels} />}
    onReady={setReady} onExit={handleExit} messages={messages} onSend={sendChatMessage}
  >{dealCountdownMs !== null && <DealCountdownOverlay remainingMs={dealCountdownMs} />}</MultiplayerLobby>

  return (
    <div className={`domino-premium-room domino-room--${scene} fixed inset-0 z-50 overflow-y-auto bg-[#080F24]`}>
      <DominoScenery scene={scene} />
      {dealCountdownMs !== null && <DealCountdownOverlay remainingMs={dealCountdownMs} />}

      {room?.phase === 'PLAYING' && questionConcept && questionToShow && (
        <DominoQuestionModal
          concept={questionConcept}
          question={questionToShow}
          scenario={level === 'ADVANCED' ? questionConcept.application : undefined}
          isSelf={questionIsSelf}
          answeringDisplayName={room.players.find((p) => p.userId === pendingQuestion?.userId)?.displayName ?? 'tu rival'}
          result={answerResult}
          onAnswer={answerQuestion}
          onClose={dismissAnswerResult}
        />
      )}

      {feedback && (
        <div
          key={feedback.key}
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-[65] mx-auto w-[min(92vw,560px)] animate-[fade-in-up_0.3s_ease-out] rounded-xl border border-accent/40 bg-surface/95 px-4 py-2.5 text-center text-[13px] leading-snug text-text-h shadow-[var(--shadow)]"
        >
          {level === 'EASY' && <strong className="mr-1 text-accent">¡Muy bien!</strong>}
          {feedback.lines.join(' · ')}
        </div>
      )}

      <div className="domino-premium-shell relative z-10 mx-auto flex min-h-full w-full max-w-[1600px] flex-col p-3 sm:h-full sm:p-5">
        <header className={`domino-premium-header ${room?.phase === 'PLAYING' ? 'domino-premium-header--playing' : ''} mb-1.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-1.5 sm:flex-nowrap`}>
          {room?.phase === 'PLAYING' ? (
            <span className="sr-only">{room.gameTitle ?? 'Dominexo'}, sala en vivo. {isMyTurn ? 'Es tu turno.' : 'Es el turno del rival.'}</span>
          ) : (
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                {room?.gameTitle ?? 'Dominexo'}
              </p>
              <div className="flex items-center gap-1.5">
                <h1 className="text-[15px] font-bold tracking-tight text-text-h">Sala en vivo</h1>
                {room && <span className="domino-premium-status rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{room.phase === 'FINISHED' ? 'Finalizada' : 'Esperando'}</span>}
              </div>
            </div>
          )}
          {room && room.phase === 'PLAYING' && opponent && (
            <div className="domino-premium-match-facts" aria-label={`Rival: ${opponent.displayName}, ${opponent.handCount} fichas. Pozo: ${room.boneyardCount} fichas`}>
              <span className="domino-premium-match-fact">
                <small>Rival</small>
                <strong title={opponent.displayName}>{opponent.displayName}</strong>
                <b>{opponent.handCount}</b>
              </span>
              <span className="domino-premium-match-fact domino-premium-match-fact--boneyard">
                <small>Pozo</small>
                <b>{room.boneyardCount}</b>
              </span>
            </div>
          )}
          <div className="domino-premium-header-actions flex items-center gap-2">
          {room?.phase === 'PLAYING' && (
            <div className={`domino-premium-turn ${isMyTurn ? 'domino-premium-turn--self' : 'domino-premium-turn--rival'}`}>
              <span className="domino-premium-turn-dot" aria-hidden="true" />
              <TurnBanner isMyTurn={isMyTurn} remainingMs={remainingMs} turnDurationSeconds={room.turnDurationSeconds} variant="inline" />
            </div>
          )}
          {room?.phase === 'PLAYING' && (
            <button
              type="button"
              className={`domino-premium-sound flex items-center justify-center rounded-xl border px-3 py-2 text-[12px] font-semibold ${isDominoSoundMuted ? 'domino-premium-sound--muted' : ''}`}
              onClick={toggleDominoSound}
              aria-label={isDominoSoundMuted ? 'Activar sonidos de Dominexo' : 'Silenciar sonidos de Dominexo'}
              aria-pressed={isDominoSoundMuted}
              title={isDominoSoundMuted ? 'Activar sonidos' : 'Silenciar sonidos'}
            >
              {isDominoSoundMuted ? <VolumeX className="h-4 w-4" strokeWidth={2} /> : <Volume2 className="h-4 w-4" strokeWidth={2} />}
            </button>
          )}
          <button
            type="button"
            className="domino-premium-exit flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold"
            onClick={handleExit}
            aria-label="Salir de la sala"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            <span className="domino-premium-exit-label">Salir</span>
          </button>
          </div>
        </header>

        {error && (
          <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-[13px] text-danger">
            {error}
          </p>
        )}
        {rematchRejectedMessage && (
          <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-[13px] text-danger">
            {rematchRejectedMessage}
          </p>
        )}

        {!room && !codeFromUrl && !gameIdToCreate && (
          <div className="mx-auto flex w-full max-w-[380px] flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
            <p className="text-[14px] text-text-h">Ingresa el código de una sala de dominó para unirte:</p>
            <input
              value={joinCodeInput}
              onChange={(event) => setJoinCodeInput(event.target.value)}
              placeholder="Código de sala"
              className="rounded-lg border border-border bg-bg px-3.5 py-2.5 text-[14px] tracking-widest uppercase text-text-h"
              maxLength={6}
            />
            <button
              type="button"
              className="rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)]"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              onClick={handleJoinSubmit}
            >
              Unirme
            </button>
          </div>
        )}

        {!room && (codeFromUrl || gameIdToCreate) && (
          <p className="py-10 text-center text-[14px] text-text">Conectando a la sala…</p>
        )}


        {room && room.phase === 'PLAYING' && opponent && (
          <div className="domino-premium-game flex min-h-0 flex-1 flex-col gap-2">
            <TurnPopBanner isMyTurn={isMyTurn} opponentName={opponent.displayName} />

            <section className="domino-premium-stage flex min-h-0 flex-1 flex-col">
            {boardPresentation.kind === 'bidirectional' && (
              <div className="domino-board-camera-controls" role="group" aria-label="Navegación del tablero virtual">
                <div className="domino-board-camera-controls__header">
                  <span>Explorar tablero</span>
                  <div className="domino-board-camera-help">
                    <button
                      type="button"
                      aria-label="Cómo explorar el tablero"
                      aria-expanded={isBoardHelpOpen}
                      aria-controls="domino-board-navigation-help"
                      onClick={() => setIsBoardHelpOpen((open) => !open)}
                    >
                      <span aria-hidden="true">?</span>
                    </button>
                    {isBoardHelpOpen && (
                      <div id="domino-board-navigation-help" role="tooltip" className="domino-board-camera-help-popover">
                        <strong>Moverse por el tablero</strong>
                        <p>Arrastra el fondo de la mesa para explorar libremente la cadena. Usa Extremo A, Inicio y Extremo B para enfocar un punto y recuperar su seguimiento.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="domino-board-camera-controls__actions">
                  <button
                    type="button"
                    className="domino-board-camera-control"
                    aria-label="Ir al extremo A de la cadena"
                    aria-pressed={cameraDestination === 'left'}
                    onClick={() => followBoardCamera('left')}
                  >
                    <ChevronLeft aria-hidden="true" size={17} />
                    <span>Extremo A</span>
                  </button>
                  <button
                    type="button"
                    className="domino-board-camera-control"
                    aria-label="Centrar en la ficha inicial"
                    aria-pressed={cameraDestination === 'opening'}
                    onClick={() => followBoardCamera('opening')}
                  >
                    <Crosshair aria-hidden="true" size={15} />
                    <span>Inicio</span>
                  </button>
                  <button
                    type="button"
                    className="domino-board-camera-control"
                    aria-label="Ir al extremo B de la cadena"
                    aria-pressed={cameraDestination === 'right'}
                    onClick={() => followBoardCamera('right')}
                  >
                    <ChevronRight aria-hidden="true" size={17} />
                    <span>Extremo B</span>
                  </button>
                </div>
              </div>
            )}
            {/* Tablero */}
            <div ref={boardViewportRef} className="domino-premium-board flex min-h-[260px] flex-1 overflow-hidden p-3 sm:min-h-[340px] sm:p-5">
              <span className="domino-premium-board-mark" aria-hidden="true" />
              {isBoardPanHintDisplayed && (
                <div className="domino-board-pan-hint" role="status" aria-live="polite">
                  <div className="domino-board-pan-hint__content">
                    <div className="domino-board-pan-hint__gesture" aria-hidden="true">
                      <span className="domino-board-pan-hint__arrow domino-board-pan-hint__arrow--horizontal">↔</span>
                      <Hand className="domino-board-pan-hint__icon" size={58} strokeWidth={1.7} />
                      <span className="domino-board-pan-hint__arrow domino-board-pan-hint__arrow--vertical">↕</span>
                    </div>
                    <strong>¡Explora el tablero!</strong>
                    <span>Mantén presionado y arrastra el fondo para moverte</span>
                  </div>
                </div>
              )}
              {board.length === 0 ? (
                <p className="m-auto text-center text-[13px] text-text">
                  {isMyTurn ? 'Toca una ficha de tu mano para abrir la partida.' : 'Esperando la primera jugada…'}
                </p>
              ) : boardPresentation.kind !== 'linear' ? (
                <div
                  className={`domino-serpentine-stage${boardPresentation.kind === 'bidirectional' && hasManualPanRange ? ' domino-serpentine-stage--pannable' : ''}${isBoardPanning ? ' domino-serpentine-stage--panning' : ''}`}
                  onPointerDown={boardPresentation.kind === 'bidirectional' ? handleBoardPointerDown : undefined}
                  onPointerMove={boardPresentation.kind === 'bidirectional' ? handleBoardPointerMove : undefined}
                  onPointerUp={boardPresentation.kind === 'bidirectional' ? handleBoardPointerUp : undefined}
                  onPointerCancel={boardPresentation.kind === 'bidirectional' ? handleBoardPointerCancel : undefined}
                  onLostPointerCapture={boardPresentation.kind === 'bidirectional' ? () => finishBoardPanGesture() : undefined}
                  onClickCapture={boardPresentation.kind === 'bidirectional' ? handleBoardClickCapture : undefined}
                >
                  <div
                    className="domino-virtual-board-world"
                    style={boardPresentation.kind === 'bidirectional' && boardCamera
                      ? {
                          width: logicalBoardViewport.width,
                          height: logicalBoardViewport.height,
                          transform: dominoBoardCameraTransform(boardCamera),
                        }
                      : undefined}
                  >
                  {boardPresentation.layout.tiles.map((placement) => {
                    const placed = board[placement.index]
                    const visualOrientation = 'visualOrientation' in placement
                      ? placement.visualOrientation
                      : placement.orientation
                    return (
                      <div
                        key={placement.id}
                        className="domino-serpentine-tile"
                        data-domino-pan-exclude
                        style={{ left: placement.x, top: placement.y }}
                      >
                        <BoardTileView
                          placed={placed}
                          conceptOf={conceptOf}
                          justPlaced={placed.id === lastPlacedTileId}
                          orientation={visualOrientation}
                          articulation={placed.isDouble && visualOrientation === 'double-vertical'}
                        />
                      </div>
                    )
                  })}
                  <EndDropZone
                    active={isMyTurn && Boolean(selectedTile) && canPlaceLeft}
                    onClick={() => handleEndClick('left')}
                    onDrop={() => handleEndClick('left')}
                    visualPosition={{ x: boardPresentation.layout.leftEnd.x - 20, y: boardPresentation.layout.leftEnd.y - 34 }}
                    className="domino-serpentine-end"
                  />
                  <EndDropZone
                    active={isMyTurn && Boolean(selectedTile) && canPlaceRight}
                    onClick={() => handleEndClick('right')}
                    onDrop={() => handleEndClick('right')}
                    visualPosition={{ x: boardPresentation.layout.rightEnd.x - 20, y: boardPresentation.layout.rightEnd.y - 34 }}
                    className="domino-serpentine-end"
                  />
                  </div>
                </div>
              ) : (
                <div className={`domino-premium-chain-viewport flex min-h-[82px] w-full items-center ${boardNeedsScroll ? 'justify-start overflow-x-auto' : 'justify-center overflow-hidden'}`}>
                  <div
                    className={`domino-premium-chain flex w-max items-center gap-[2px] ${boardNeedsScroll ? 'domino-premium-chain--scroll mx-5' : ''}`}
                    style={{ transform: `scale(${boardScale})`, transformOrigin: 'center center' }}
                  >
                    <EndDropZone
                      active={isMyTurn && Boolean(selectedTile) && canPlaceLeft}
                      onClick={() => handleEndClick('left')}
                      onDrop={() => handleEndClick('left')}
                    />
                    {board.map((placed) => (
                      <BoardTileView
                        key={placed.id}
                        placed={placed}
                        conceptOf={conceptOf}
                        justPlaced={placed.id === lastPlacedTileId}
                      />
                    ))}
                    <EndDropZone
                      active={isMyTurn && Boolean(selectedTile) && canPlaceRight}
                      onClick={() => handleEndClick('right')}
                      onDrop={() => handleEndClick('right')}
                    />
                  </div>
                </div>
              )}
            </div>
            </section>

            {/* Acciones: robar / pasar, solo tienen efecto en tu turno */}
            <section className="domino-premium-hand-dock rounded-2xl border p-2.5 sm:p-2.5">
            <div className="domino-premium-hand-layout">
            <div className={`domino-premium-local-player ${isMyTurn ? 'domino-premium-local-player--active' : ''}`}>
              <span className="domino-premium-local-avatar" aria-hidden="true"><Hand className="h-3.5 w-3.5" strokeWidth={2} /></span>
              <span>
                <strong>Tú</strong>
                <small>{hand.length} fichas</small>
              </span>
            </div>
            <div className="domino-premium-actions flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-border px-3.5 py-1.5 text-[12.5px] font-medium text-text-h disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!isMyTurn || room.boneyardCount === 0 || hasValidMove}
                onClick={drawTile}
              >
                <PackageOpen className="h-4 w-4" strokeWidth={1.8} />
                Robar del pozo
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-3.5 py-1.5 text-[12.5px] font-medium text-text-h disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!isMyTurn || room.boneyardCount > 0 || hasValidMove}
                onClick={passTurn}
              >
                <SkipForward className="h-4 w-4" strokeWidth={1.8} />
                Pasar turno
              </button>
            </div>

            {/* Mano propia — fichas grandes y visualmente diferenciadas por
                concepto (ícono + color propios), animadas al entrar/jugar. */}
            <div className="domino-premium-hand-area">
              <div className="domino-premium-hand-scroll">
              <div className="domino-premium-hand-tiles flex gap-3">
                {hand.map((tile) => {
                  const playable = board.length === 0 || tileMatchesEnd(tile, leftEnd) || tileMatchesEnd(tile, rightEnd)
                  return (
                    <HandTileView
                      key={tile.id}
                      tile={tile}
                      selected={selectedTileId === tile.id}
                      state={!isMyTurn ? 'waiting' : selectedTileId === tile.id ? 'selected' : playable ? 'playable' : 'unavailable'}
                      conceptOf={conceptOf}
                      level={level}
                      onClick={() => handleHandTileClick(tile)}
                      onDragStart={() => {
                        setDraggedTileId(tile.id)
                        setSelectedTileId(tile.id)
                      }}
                    />
                  )
                })}
              </div>
              </div>
            </div>
            </div>
            </section>
          </div>
        )}

        {room && room.phase === 'FINISHED' && opponent && self && (
          <div className="domino-premium-finish flex flex-col items-center gap-4 py-6 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-white animate-[trophy-pop-in_0.5s_cubic-bezier(0.16,1,0.3,1)]"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            >
              <Trophy className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <p className="domino-premium-finish__result text-[18px] font-semibold animate-[fade-in-up_0.4s_ease-out_0.1s_backwards]">
              {room.winnerUserId === null
                ? 'Empate — bloqueo con las mismas fichas'
                : room.winnerUserId === user?.id
                  ? '¡Ganaste!'
                  : `Ganó ${opponent.displayName}`}
            </p>
            <p className="domino-premium-finish__detail text-[13px] animate-[fade-in-up_0.4s_ease-out_0.2s_backwards]">
              {room.endedByBlock
                ? 'La partida se bloqueó: nadie tenía jugada posible.'
                : 'Se quedó sin fichas primero.'}
            </p>

            <DominoLearningSummary room={room} level={level} />

            {tournamentCode ? (
              <div className="mt-2 flex flex-col items-center gap-2">
                <p className="domino-premium-finish__rematch text-[12.5px]">Volviendo al torneo…</p>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                  onClick={handleExit}
                >
                  Volver al torneo
                </button>
              </div>
            ) : (
            <div className="mt-2 flex flex-col items-center gap-2">
              <p className="domino-premium-finish__rematch text-[12.5px]">
                {self.hasVotedRematch
                  ? 'Esperando a que el rival acepte la revancha…'
                  : '¿Quieres una revancha?'}
              </p>
              {!self.hasVotedRematch && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)]"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                    onClick={() => voteRematch(true)}
                  >
                    <RotateCcw className="h-4 w-4" strokeWidth={2} />
                    Revancha
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h"
                    onClick={handleRematchDecline}
                  >
                    No, gracias
                  </button>
                </div>
              )}
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Pantalla de cierre con aprendizaje: conceptos vistos y, en Intermedio, los fallados con su explicación. */
function DominoLearningSummary({ room, level }: { room: DominoRoomStateView; level: DominoLevel }) {
  const seen = (room.seenConceptIndexes ?? []).map((index) => room.concepts[index]).filter(Boolean)
  const missed = room.missedConcepts ?? []
  if (seen.length === 0 && missed.length === 0) return null
  return (
    <div className="w-full max-w-[520px] rounded-2xl border border-border bg-surface/90 p-4 text-left" data-domino-learning>
      <p className="mb-2 text-[13px] font-semibold text-text-h">Lo que viste en la partida</p>
      <ul className="space-y-1 text-[12.5px] text-text">
        {seen.map((concept) => (
          <li key={concept.conceptId}>
            <strong className="text-text-h">{concept.label}</strong>
            {concept.definition ? `: ${concept.definition}` : ''}
          </li>
        ))}
      </ul>
      {level !== 'EASY' && missed.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-[13px] font-semibold text-rose-600">Para repasar (preguntas falladas)</p>
          <ul className="space-y-2 text-[12.5px] text-text">
            {missed.map((item, position) => {
              const concept = room.concepts[item.conceptIndex]
              return (
                <li key={`${item.conceptIndex}-${position}`}>
                  <strong className="text-text-h">{concept?.label}</strong>
                  {item.questionText ? ` — ${item.questionText}` : ''}
                  {item.explanation && <span className="block italic">{item.explanation}</span>}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

type DominoConceptTileSize ='board' | 'sm' | 'md' | 'lg'

export function dominoConceptHalfPresentation(size: DominoConceptTileSize) {
  if (size === 'board') {
    return {
      // La etiqueta del concepto siempre es visible en el tablero (el tooltip queda como apoyo).
      showLabel: true,
      sizing: 'domino-tile-half--board gap-0.5 px-1 py-1',
      iconSize: 'h-7 w-7 shrink-0',
      textSize: 'text-[8px] line-clamp-2',
    }
  }

  return {
    showLabel: true,
    sizing: size === 'lg' ? 'px-2 py-3.5 gap-1.5' : size === 'sm' ? 'px-1.5 py-2 gap-1' : 'px-1.5 py-2.5 gap-1',
    iconSize: size === 'lg' ? 'h-8 w-8' : size === 'sm' ? 'h-4.5 w-4.5' : 'h-6 w-6',
    textSize: size === 'lg' ? 'text-[11px]' : size === 'sm' ? 'text-[8.5px]' : 'text-[9.5px]',
  }
}

export function boardConceptAccessibility(label: string) {
  return { ariaLabel: `Concepto: ${label}` }
}

function ConceptHalf({ concept, size = 'md', level }: { concept: DominoConcept; size?: DominoConceptTileSize; level?: DominoLevel }) {
  if (size === 'board') return <BoardConceptHalf concept={concept} />

  const Icon = iconForConcept(concept.icon)
  const categoryInk = dominoTileCategoryInk(concept.color)
  const presentation = dominoConceptHalfPresentation(size)
  // Fácil: texto más grande. La explicación del concepto no va en la ficha: está en la nubecita (DominoInfoCloud).
  const textSize = level === 'EASY' ? 'text-[13px]' : presentation.textSize

  return (
    <div
      className={`domino-tile-half flex flex-1 flex-col items-center justify-center ${presentation.sizing}`}
      style={{ background: `color-mix(in srgb, ${concept.color} 10%, transparent)` }}
    >
      <Icon className={presentation.iconSize} style={{ color: categoryInk }} strokeWidth={2} aria-hidden="true" focusable="false" />
      {presentation.showLabel && <span className={`domino-tile-label w-full text-center font-semibold text-text-h leading-tight ${textSize}`}>{concept.label}</span>}
    </div>
  )
}

function BoardConceptHalf({ concept }: { concept: DominoConcept }) {
  const Icon = iconForConcept(concept.icon)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const tooltipId = useId()
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const presentation = dominoConceptHalfPresentation('board')
  const accessibility = boardConceptAccessibility(concept.label)
  const categoryInk = dominoTileCategoryInk(concept.color)

  return (
    <button
      ref={anchorRef}
      type="button"
      className={`domino-tile-half domino-board-concept flex flex-1 flex-col items-center justify-center ${presentation.sizing}`}
      aria-label={accessibility.ariaLabel}
      aria-describedby={tooltipOpen ? tooltipId : undefined}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setTooltipOpen(true) }}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse') setTooltipOpen(false) }}
      onPointerDown={(event) => { if (event.pointerType !== 'mouse') setTooltipOpen(true) }}
      onFocus={() => setTooltipOpen(true)}
      onBlur={() => setTooltipOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setTooltipOpen(false)
          event.currentTarget.blur()
        }
      }}
      style={{ '--domino-category-ink': categoryInk } as CSSProperties}
    >
      <Icon className={presentation.iconSize} style={{ color: categoryInk }} strokeWidth={2} aria-hidden="true" focusable="false" />
      {presentation.showLabel && <span className={`domino-tile-label w-full text-center font-semibold text-text-h leading-tight ${presentation.textSize}`} aria-hidden="true">{concept.label}</span>}
      <DominoConceptTooltip id={tooltipId} anchorRef={anchorRef} concept={concept} open={tooltipOpen} />
    </button>
  )
}

function DominoConceptTooltip({
  id,
  anchorRef,
  concept,
  open,
}: {
  id: string
  anchorRef: RefObject<HTMLButtonElement | null>
  concept: DominoConcept
  open: boolean
}) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const lastPlacement = useRef<DominoTooltipPlacement | undefined>(undefined)
  const [placement, setPlacement] = useState<DominoTooltipPlacement | undefined>(undefined)
  const Icon = iconForConcept(concept.icon)
  const categoryInk = dominoTileCategoryInk(concept.color)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tooltipRef.current) {
      setPlacement(undefined)
      return undefined
    }

    let animationFrame = 0
    const updatePlacement = () => {
      const anchor = anchorRef.current?.getBoundingClientRect()
      const tooltip = tooltipRef.current?.getBoundingClientRect()
      if (anchor && tooltip) {
        const next = resolveDominoTooltipPlacement(anchor, tooltip, { width: window.innerWidth, height: window.innerHeight })
        const previous = lastPlacement.current
        if (!previous || previous.left !== next.left || previous.top !== next.top || previous.side !== next.side) {
          lastPlacement.current = next
          setPlacement(next)
        }
      }
      animationFrame = window.requestAnimationFrame(updatePlacement)
    }

    updatePlacement()
    return () => window.cancelAnimationFrame(animationFrame)
  }, [anchorRef, open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={tooltipRef}
      id={id}
      role="tooltip"
      data-side={placement?.side ?? 'bottom'}
      className={`domino-concept-tooltip ${placement ? 'domino-concept-tooltip--visible' : ''}`}
      style={{ left: placement?.left ?? 0, top: placement?.top ?? 0, '--domino-tooltip-color': categoryInk } as CSSProperties}
    >
      <span className="domino-concept-tooltip__icon" aria-hidden="true"><Icon size={17} strokeWidth={2.25} /></span>
      <span>{concept.label}</span>
    </div>,
    document.body,
  )
}

export type BoardTilePresentation = {
  orientation: DominoVisualOrientation
  width: number
  height: number
  axis: 'row' | 'column'
}

export const BOARD_TILE_CONTENT = {
  padding: 4,
  icon: 28,
} as const

/** Espacio interno útil por mitad; permite validar etiquetas sin tocar la geometría. */
export function boardTileContentPresentation(orientation: DominoVisualOrientation) {
  const tile = boardTilePresentation(orientation.startsWith('double'), orientation)
  const vertical = orientation === 'vertical' || orientation === 'double-vertical'
  const contentHeight = vertical
    ? (tile.height - 6 - 3) / 2 - BOARD_TILE_CONTENT.padding * 2
    : tile.height - 6 - BOARD_TILE_CONTENT.padding * 2
  const contentWidth = vertical
    ? tile.width - 6 - BOARD_TILE_CONTENT.padding * 2
    : (tile.width - 6 - 3) / 2 - BOARD_TILE_CONTENT.padding * 2
  return {
    contentWidth,
    contentHeight,
    iconFits: contentWidth >= BOARD_TILE_CONTENT.icon && contentHeight >= BOARD_TILE_CONTENT.icon,
  }
}

/** Datos de presentación independientes del DOM; el valor predeterminado conserva la sala lineal. */
export function boardTilePresentation(
  isDouble: boolean,
  requested?: DominoVisualOrientation,
): BoardTilePresentation {
  const orientation = requested ?? (isDouble ? 'double-vertical' : 'horizontal')
  switch (orientation) {
    case 'vertical': return { orientation, width: 68, height: 136, axis: 'column' }
    case 'double-horizontal': return { orientation, width: 124, height: 68, axis: 'row' }
    case 'double-vertical': return { orientation, width: 68, height: 124, axis: 'column' }
    default: return { orientation: 'horizontal', width: 136, height: 68, axis: 'row' }
  }
}

/** Fichas de tablero orientables. No rota el contenido: reordena mitades y divisor. */
export function BoardTileView({
  placed,
  conceptOf,
  justPlaced,
  orientation,
  articulation = false,
}: {
  placed: DominoPlacedTileView
  conceptOf: (id: number) => DominoConcept
  justPlaced: boolean
  orientation?: DominoVisualOrientation
  articulation?: boolean
}) {
  const animation = justPlaced ? 'animate-[domino-tile-play-in_0.22s_cubic-bezier(0.16,1,0.3,1)_backwards]' : ''
  const presentation = boardTilePresentation(placed.isDouble, orientation)
  const vertical = presentation.axis === 'column'
  return (
    <div
      className={`domino-premium-tile domino-board-tile ${placed.isDouble ? 'domino-board-tile--double' : ''} ${articulation ? 'domino-board-tile--articulation' : ''} flex shrink-0 overflow-hidden rounded-lg border-[3px] ${vertical ? 'flex-col' : ''} ${animation}`}
      style={{ width: presentation.width, height: presentation.height }}
    >
      <ConceptHalf concept={conceptOf(placed.left)} size="board" />
      <div className={`domino-tile-divider ${vertical ? 'h-[3px] w-full' : 'h-full w-[3px]'}`} />
      <ConceptHalf concept={conceptOf(placed.right)} size="board" />
    </div>
  )
}

export function EndDropZone({
  active,
  onClick,
  onDrop,
  visualPosition,
  className = '',
}: {
  active: boolean
  onClick: () => void
  onDrop: () => void
  visualPosition?: Point
  className?: string
}) {
  return (
    <button
      type="button"
      data-domino-pan-exclude
      onClick={onClick}
      onDragOver={(event) => {
        if (active) event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (active) onDrop()
      }}
      aria-label="Colocar ficha en este extremo"
      className={`domino-end-drop-zone flex h-[68px] w-10 shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-[13px] font-semibold transition-all ${className} ${
        active
          ? 'domino-end-drop-zone--active border-accent bg-accent/10 text-accent hover:scale-105'
          : 'border-transparent text-transparent'
      }`}
      style={visualPosition ? { position: 'absolute', left: visualPosition.x, top: visualPosition.y } : undefined}
    >
      +
    </button>
  )
}

/** Fichas de mano notablemente más grandes que en el modo un-jugador, y con
 * borde/fondo tintados por concepto para que cada una se distinga a simple
 * vista sin tener que leer la etiqueta. */
function HandTileView({
  tile,
  selected,
  state,
  conceptOf,
  level,
  onClick,
  onDragStart,
}: {
  tile: DominoTileView
  level: DominoLevel
  selected: boolean
  state: 'waiting' | 'playable' | 'selected' | 'unavailable'
  conceptOf: (id: number) => DominoConcept
  onClick: () => void
  onDragStart: () => void
}) {
  const a = conceptOf(tile.a)
  const b = conceptOf(tile.b)
  const stateStyles = {
    waiting: 'domino-tile--waiting',
    playable: 'domino-tile--playable',
    selected: 'domino-tile--selected',
    unavailable: 'domino-tile--unavailable',
  }[state]

  return (
    <div className="domino-hand-wrap relative shrink-0">
      <button
        type="button"
        onClick={onClick}
        draggable={state !== 'waiting' && state !== 'unavailable'}
        onDragStart={(event) => {
          onDragStart()
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', tile.id)
        }}
        onDragEnd={() => {
          // The board keeps the click selection when a drag is cancelled.
        }}
        aria-pressed={selected}
        className={`domino-premium-tile domino-hand-tile flex h-[104px] w-[196px] shrink-0 overflow-hidden rounded-xl border-[3px] transition-all duration-200 ${stateStyles}`}
      >
        <ConceptHalf concept={a} size="lg" level={level} />
        <div className="domino-tile-divider w-[3px] self-stretch" style={{ background: `linear-gradient(${a.color}, ${b.color})` }} />
        <ConceptHalf concept={b} size="lg" level={level} />
      </button>
      {/* La explicación vive en una nubecita por lado, fuera del botón de la ficha (no se anidan botones). */}
      <DominoInfoCloud concept={a} level={level} className="absolute left-1.5 top-1.5 z-20" />
      <DominoInfoCloud concept={b} level={level} className="absolute right-1.5 top-1.5 z-20" />
    </div>
  )
}
