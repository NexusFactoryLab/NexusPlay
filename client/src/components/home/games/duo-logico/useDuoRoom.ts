import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { GuessWhoChatMessage } from '../guessWhoTypes'
import { DUO_EVENTS, type DuoNotice, type DuoRoomView, type DuoServerMessages } from './shared/duoProtocol'
import type { DuoClientState, DuoEmote, DuoPeerState, DuoRole, DuoSnapshot } from './shared/duoTypes'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

/** Recibe lo que llega muchas veces por segundo sin pasar por el estado de React. */
export interface DuoRealtimeListener {
  onSnapshot(snapshot: DuoSnapshot, receivedAt: number): void
  /** La posición del compañero, reenviada por el servidor apenas llega. */
  onPeer(peer: DuoPeerState, receivedAt: number): void
  onEmote(role: DuoRole, emote: DuoEmote): void
}

export type DuoChatMessage = GuessWhoChatMessage & { role: DuoRole }

/**
 * Conexión a una sala de Dúo Lógico. La vista de la sala (`room`) va al
 * estado de React porque cambia poco; las posiciones (`duo:snapshot`, 20 por
 * segundo) van directo al motor del juego por `setRealtimeListener`.
 */
export function useDuoRoom(token: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const listenerRef = useRef<DuoRealtimeListener | null>(null)
  /** Sala a la que volver si se cae la conexión (o se recarga la página). */
  const codeRef = useRef<string | null>(null)
  const [room, setRoom] = useState<DuoRoomView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(true)
  const [messages, setMessages] = useState<DuoChatMessage[]>([])
  const [notices, setNotices] = useState<Array<DuoNotice & { id: number }>>([])
  const noticeId = useRef(0)

  useEffect(() => {
    if (!token) return
    const socket = io(`${API_URL}/rooms`, { auth: { token }, transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnecting(false)
      if (codeRef.current) socket.emit(DUO_EVENTS.join, { code: codeRef.current })
    })
    socket.on('disconnect', () => setConnecting(true))
    socket.on(DUO_EVENTS.room, (view: DuoServerMessages['duo:room']) => {
      codeRef.current = view.code
      setRoom(view)
      setError(null)
    })
    socket.on(DUO_EVENTS.snapshot, (snapshot: DuoServerMessages['duo:snapshot']) => {
      listenerRef.current?.onSnapshot(snapshot, Date.now())
    })
    socket.on(DUO_EVENTS.peer, (peer: DuoServerMessages['duo:peer']) => {
      listenerRef.current?.onPeer(peer, Date.now())
    })
    socket.on(DUO_EVENTS.emoteShown, ({ role, emote }: DuoServerMessages['duo:emote-shown']) => {
      listenerRef.current?.onEmote(role, emote)
    })
    socket.on(DUO_EVENTS.chatMessage, (message: DuoServerMessages['duo:chat-message']) => {
      setMessages((current) => [...current, message])
    })
    socket.on(DUO_EVENTS.notice, (notice: DuoServerMessages['duo:notice']) => {
      const id = ++noticeId.current
      setNotices((current) => [...current, { ...notice, id }])
      window.setTimeout(() => setNotices((current) => current.filter((n) => n.id !== id)), 3200)
    })
    socket.on('room:error', (payload: { message: string }) => setError(payload.message))

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  const emit = useCallback((event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload)
  }, [])

  const createRoom = useCallback((gameId: string, role: DuoRole) => emit(DUO_EVENTS.create, { gameId, role }), [emit])

  const joinRoom = useCallback((code: string) => {
    codeRef.current = code
    if (socketRef.current?.connected) socketRef.current.emit(DUO_EVENTS.join, { code })
  }, [])

  const leaveRoom = useCallback(() => {
    codeRef.current = null
    emit(DUO_EVENTS.leave)
    setRoom(null)
    setMessages([])
  }, [emit])

  const chooseRole = useCallback((role: DuoRole) => emit(DUO_EVENTS.role, { role }), [emit])
  const chooseLevel = useCallback((levelId: string) => emit(DUO_EVENTS.level, { levelId }), [emit])
  const rotateMirror = useCallback((mirrorId: string, dir: 1 | -1) => emit(DUO_EVENTS.mirror, { mirrorId, dir }), [emit])
  const setReady = useCallback((ready: boolean) => emit(DUO_EVENTS.ready, { ready }), [emit])
  const answer = useCallback((optionIndex: number) => emit(DUO_EVENTS.answer, { optionIndex }), [emit])
  const retry = useCallback(() => emit(DUO_EVENTS.retry, {}), [emit])
  const sendEmote = useCallback((emote: DuoEmote) => emit(DUO_EVENTS.emote, { emote }), [emit])
  const sendChat = useCallback((text: string) => {
    if (text.trim()) emit(DUO_EVENTS.chat, { text: text.trim() })
  }, [emit])
  /**
   * Posición propia: la manda el motor ~20 veces por segundo. Volátil: si se
   * pierde una, llega la siguiente; salvo `reliable` (al soltar una caja).
   */
  const sendState = useCallback((state: DuoClientState, reliable = false) => {
    const socket = socketRef.current
    if (!socket?.connected) return
    if (reliable) socket.emit(DUO_EVENTS.state, state)
    else socket.volatile.emit(DUO_EVENTS.state, state)
  }, [])
  const setRealtimeListener = useCallback((listener: DuoRealtimeListener | null) => {
    listenerRef.current = listener
  }, [])

  return {
    room,
    error,
    connecting,
    messages,
    notices,
    createRoom,
    joinRoom,
    leaveRoom,
    chooseRole,
    chooseLevel,
    rotateMirror,
    setReady,
    answer,
    retry,
    sendEmote,
    sendChat,
    sendState,
    setRealtimeListener,
  }
}
