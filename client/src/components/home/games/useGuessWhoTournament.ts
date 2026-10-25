import type { GuessWhoChatMessage } from './guessWhoTypes'
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { TournamentLevel } from './tournamentLevels'
import type { TournamentMatchStateView, TournamentPairingAnnouncement, TournamentStateView } from './guessWhoTypes'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

/**
 * Conexión de socket para el modo grupo (torneo eliminatorio) de "¿Quién
 * Es?". Espeja el patrón de useGuessWhoRoom (un socket por montaje), pero
 * habla los eventos `tournament:*` en vez de `room:*` — el servidor los
 * mantiene separados para no chocar con las salas 1v1 sueltas.
 */
export function useGuessWhoTournament(token: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [messages, setMessages] = useState<GuessWhoChatMessage[]>([])
  const waitingCodeRef = useRef<string | null>(null)
  const [tournament, setTournament] = useState<TournamentStateView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(true)
  const [pairingAnnouncement, setPairingAnnouncement] = useState<TournamentPairingAnnouncement | null>(null)
  const [closed, setClosed] = useState(false)
  const [matchAccusationFailedMessage, setMatchAccusationFailedMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    const socket = io(`${API_URL}/rooms`, {
      auth: { token },
      transports: ['websocket'],
    })
    socketRef.current = socket
    socket.on('tournament:chat-message', (message: GuessWhoChatMessage) => setMessages(current => [...current, message]))

    socket.on('connect', () => {
      setConnecting(false)
      // Reingresar al lobby tras reconectar; el servidor exige confirmar de nuevo.
      if (waitingCodeRef.current) socket.emit('tournament:join', { code: waitingCodeRef.current })
    })
    socket.on('disconnect', () => setConnecting(true))
    socket.on('tournament:state', (state: TournamentStateView) => {
      waitingCodeRef.current = state.phase === 'WAITING' ? state.code : null
      setTournament(state)
      setError(null)
    })
    // El administrador cerró el torneo: todos salen de la sala.
    socket.on('tournament:closed', () => {
      waitingCodeRef.current = null
      setTournament(null)
      setClosed(true)
    })
    socket.on('room:error', (payload: { message: string }) => setError(payload.message))
    // Anuncio de emparejamiento al arrancar una ronda: se muestra brevemente
    // "Tu compañero es: [nombre]" antes de que el match arranque de lleno.
    socket.on('tournament:pairing-announced', (payload: TournamentPairingAnnouncement) => {
      setPairingAnnouncement(payload)
    })
    // El servidor emite esto en cada acción dentro de un match (descartar,
    // pasar turno, acusación fallida) para no tener que reconstruir y
    // reenviar el torneo entero por cada jugada — sin este listener el
    // tablero se queda congelado en el reparto inicial aunque el servidor
    // sí siga procesando las jugadas.
    socket.on('tournament:match-state', (matchState: TournamentMatchStateView) => {
      setTournament((current) => (current ? { ...current, myMatch: matchState } : current))
    })
    socket.on(
      'tournament:match-accusation-result',
      (payload: { matchCode: string; accuserUserId: string; correct: boolean }) => {
        if (payload.correct) return
        setMatchAccusationFailedMessage('Bandera equivocada.')
      },
    )

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  const createTournament = useCallback(
    (games: { gameId: string; level: TournamentLevel }[], maxParticipants: number, totalRounds: number) => {
      socketRef.current?.emit('tournament:create', { games, maxParticipants, totalRounds })
    },
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  const startTournament = useCallback(() => {
    socketRef.current?.emit('tournament:start')
  }, [])

  const endRound = useCallback(() => {
    socketRef.current?.emit('tournament:end-round')
  }, [])

  const closeTournament = useCallback(() => {
    socketRef.current?.emit('tournament:close')
  }, [])

  const joinTournament = useCallback((code: string) => {
    waitingCodeRef.current = code
    if (socketRef.current?.connected) socketRef.current.emit('tournament:join', { code })
  }, [])

  const sendChatMessage = useCallback((text: string) => {
    if (socketRef.current?.connected && text.trim()) socketRef.current.emit('tournament:chat', { text: text.trim() })
  }, [])

  const sendMatchMessage = useCallback((text: string) => {
    if (socketRef.current?.connected && text.trim()) socketRef.current.emit('tournament:match-chat', { text: text.trim() })
  }, [])
  const askQuestion = useCallback((questionId: string) => {
    if (socketRef.current?.connected) socketRef.current.emit('tournament:match-question', { questionId })
  }, [])
  const answerQuestion = useCallback((requestId: string, answer: boolean) => {
    if (socketRef.current?.connected) socketRef.current.emit('tournament:match-answer', { requestId, answer })
  }, [])

  const updateTurnDuration = useCallback((turnDurationSeconds: number) => {
    socketRef.current?.emit('tournament:update-turn-duration', { turnDurationSeconds })
  }, [])

  const leaveTournament = useCallback(() => {
    waitingCodeRef.current = null
    setMessages([])
    socketRef.current?.emit('tournament:leave')
    setTournament(null)
  }, [])

  const discardMatchCard = useCallback((cardId: string) => {
    socketRef.current?.emit('tournament:match-discard', { cardId })
  }, [])

  const accuseMatchCard = useCallback((cardId: string) => {
    socketRef.current?.emit('tournament:match-accuse', { cardId })
  }, [])

  const passMatchTurn = useCallback(() => {
    socketRef.current?.emit('tournament:match-pass-turn')
  }, [])

  return {
    sendMatchMessage,
    askQuestion,
    answerQuestion,
    messages,
    sendChatMessage,
    tournament,
    error,
    connecting,
    pairingAnnouncement,
    clearPairingAnnouncement: () => setPairingAnnouncement(null),
    matchAccusationFailedMessage,
    clearMatchAccusationFailedMessage: () => setMatchAccusationFailedMessage(null),
    createTournament,
    clearError,
    joinTournament,
    startTournament,
    closeTournament,
    endRound,
    closed,
    updateTurnDuration,
    leaveTournament,
    discardMatchCard,
    accuseMatchCard,
    passMatchTurn,
  }
}
