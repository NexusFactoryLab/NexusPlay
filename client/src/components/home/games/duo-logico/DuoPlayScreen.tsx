import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleHelp, DoorOpen, Gem, Heart, LogOut, MessageCircle, Smile, Sparkles } from 'lucide-react'
import { GameGuide } from '../tutorial/GameGuide'
import { duoGuideSteps } from './duoGuideSteps'
import { ChatPanel } from '../ChatPanel'
import { DuoGame, type NearMirror } from './engine/DuoGame'
import { DuoMirrorPanel } from './DuoMirrorPanel'
import { EMOTE_TEXT } from './engine/characterView'
import { DuoQuestionPanel } from './DuoQuestionPanel'
import { DuoTouchControls } from './DuoTouchControls'
import { DuoEndScreen } from './DuoEndScreen'
import { CHARACTERS } from './duoCharacters'
import { duoLevel } from './shared/levels/index'
import { DUO_EMOTES, otherRole, type DuoRole } from './shared/duoTypes'
import type { DuoRoomView } from './shared/duoProtocol'
import type { DeathCause } from './shared/duoPhysics'
import type { useDuoRoom } from './useDuoRoom'
import { PlayerWaitOverlay } from '../PlayerWaitOverlay'

const CAUSE_TEXT: Record<DeathCause, string> = {
  lava: 'en la lava',
  water: 'en el agua',
  sludge: 'en el lodo tóxico',
  thorns: 'en las espinas',
  electric: 'en la barrera',
  press: 'en la prensa',
  fall: 'al caer',
}

type Toast = { id: number; text: string; tone: 'info' | 'good' | 'bad' }

function usePrefersTouch(): boolean {
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches)
  useEffect(() => {
    const mq = window.matchMedia?.('(pointer: coarse)')
    if (!mq) return
    const onChange = () => setTouch(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return touch
}

/** La partida en curso: el canvas del juego y todo lo que va encima. */
export function DuoPlayScreen({
  duo,
  room,
  selfUserId,
  onExit,
}: {
  duo: ReturnType<typeof useDuoRoom>
  room: DuoRoomView
  selfUserId: string | null
  onExit: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<DuoGame | null>(null)
  const me = room.you ?? 'FIRE'
  const partnerRole = otherRole(me)
  const partner = room.players.find((p) => p.role === partnerRole)
  const level = duoLevel(room.levelId)
  const touch = usePrefersTouch()
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const [emotesOpen, setEmotesOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [readCount, setReadCount] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [nearMirror, setNearMirror] = useState<NearMirror | null>(null)
  const [mirrorOpen, setMirrorOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const { setRealtimeListener, sendState, sendEmote } = duo

  const names = useMemo(() => {
    const byRole = {} as Record<DuoRole, string>
    for (const p of room.players) byRole[p.role] = p.displayName
    byRole.FIRE ??= 'Compañero'
    byRole.WATER ??= 'Compañero'
    return byRole
    // Los nombres no cambian durante la partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.code])

  const toast = useCallback((text: string, tone: Toast['tone']) => {
    const id = ++toastId.current
    setToasts((current) => [...current.slice(-2), { id, text, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 2800)
  }, [])

  // El motor se crea una vez por sala y personaje.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const game = new DuoGame({
      level,
      role: me,
      names,
      sendState,
      onFainted: (role, cause) => {
        const who = role === me ? 'Te apagaste' : `${CHARACTERS[role].name} se apagó`
        toast(`${who}${cause ? ' ' + CAUSE_TEXT[cause] : ''}. Vuelve al último punto seguro.`, 'bad')
      },
      onNearMirror: (mirror) => {
        setNearMirror(mirror)
        if (!mirror) setMirrorOpen(false)
      },
    })
    gameRef.current = game
    void game.mount(host)
    setRealtimeListener({
      onSnapshot: (snapshot, receivedAt) => game.applySnapshot(snapshot, receivedAt),
      onPeer: (peer, receivedAt) => game.applyPeer(peer, receivedAt),
      onEmote: (role, emote) => game.showEmote(role, emote),
    })
    return () => {
      setRealtimeListener(null)
      game.destroy()
      gameRef.current = null
    }
  }, [level, me, names, sendState, setRealtimeListener, toast])

  useEffect(() => {
    gameRef.current?.setPhase(room.phase, room.runId)
  }, [room.phase, room.runId, level])

  // Con el panel del espejo abierto el personaje se queda quieto (las flechas giran el espejo).
  const panelOpen = mirrorOpen && !!nearMirror && room.phase === 'PLAYING'
  useEffect(() => {
    gameRef.current?.setFrozen(panelOpen)
  }, [panelOpen])

  const skew = room.serverNow - Date.now()
  useEffect(() => {
    gameRef.current?.setClockSkew(skew)
    // Basta con la primera vista: después manda el reloj de las posiciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // Avisos del servidor (fichas, puertas, gemas, llaves, banderas) como mensajes cortos.
  const seenNotices = useRef(new Set<number>())
  useEffect(() => {
    for (const n of duo.notices) {
      if (seenNotices.current.has(n.id)) continue
      seenNotices.current.add(n.id)
      if (n.kind === 'coin') {
        const who = n.by === me ? 'Encontraste' : `${CHARACTERS[n.by].name} encontró`
        toast(`✨ ${who} una ficha: +1 pista para la próxima Puerta del Saber`, 'good')
      } else if (n.kind === 'gate-opened') {
        toast('🚪 ¡La Puerta del Saber se abrió! Sigan adelante', 'good')
      } else if (n.kind === 'gem') {
        toast(`💎 ${n.by === me ? 'Encontraste' : `${CHARACTERS[n.by].name} encontró`} una gema`, 'good')
      } else if (n.kind === 'key') {
        toast(`🔑 ${n.by === me ? 'Tienes la llave: llévala a su puerta' : `${CHARACTERS[n.by].name} tiene la llave`}`, 'info')
      } else if (n.kind === 'key-lost') {
        toast('🔑 La llave volvió a su lugar', 'bad')
      } else if (n.kind === 'lock') {
        toast('🔓 ¡La puerta con candado se abrió!', 'good')
      } else if (n.kind === 'flag') {
        toast('🚩 Punto de control: si se apagan, vuelven aquí', 'info')
      }
    }
  }, [duo.notices, me, toast])

  // Reloj para la cuenta regresiva.
  const needsClock = room.phase === 'COUNTDOWN'
  useEffect(() => {
    if (!needsClock) return
    const timer = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [needsClock])
  const clockSkew = useMemo(() => room.serverNow - Date.now(), [room.serverNow])
  // El compañero se desconectó: la misma ventana de espera que en los demás juegos (issue #120).
  const partnerWait = useMemo(
    () => (room.waitingPartnerUntil ? { names: [partner?.displayName ?? 'tu compañero'], deadline: room.waitingPartnerUntil - clockSkew } : null),
    [room.waitingPartnerUntil, partner?.displayName, clockSkew],
  )

  // Atajos de emotes: teclas 1 a 6.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const index = Number(event.key) - 1
      if (index >= 0 && index < DUO_EMOTES.length && room.phase === 'PLAYING') sendEmote(DUO_EMOTES[index])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [room.phase, sendEmote])

  const unread = Math.max(0, duo.messages.length - readCount)
  const countdown = room.countdownEndsAt ? Math.max(0, Math.ceil((room.countdownEndsAt - (now + clockSkew)) / 1000)) : null
  const ended = room.phase === 'VICTORY' || room.phase === 'DEFEAT' || room.phase === 'ABANDONED'
  const inQuestion = room.phase === 'QUESTION' || room.phase === 'REVEAL'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950 text-white select-none" data-duo-phase={room.phase}>
      <div ref={hostRef} className="absolute inset-0" />

      {/* Barra superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-slate-900/80 px-3 py-2 shadow-lg backdrop-blur">
          <img src={CHARACTERS[me].portrait} alt="" className="h-8 w-8 object-contain" />
          <div className="leading-tight">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300" data-testid="duo-level-title">{room.levelTitle}</p>
            <p className="text-[13px] font-bold">{CHARACTERS[me].name} · Tú</p>
            <p className="text-[11px] text-slate-300 [@media(max-height:520px)]:hidden">con {partner?.displayName ?? '…'} {partner && !partner.connected && '(desconectado)'}</p>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-slate-900/80 px-3 py-2 shadow-lg backdrop-blur" aria-label="Progreso">
          <span className="flex items-center gap-0.5" aria-label={`${room.hearts} de ${room.maxHearts} corazones`} data-testid="duo-hearts">
            {Array.from({ length: room.maxHearts }, (_, i) => (
              <Heart key={i} className={`h-5 w-5 ${i < room.hearts ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} strokeWidth={2.2} />
            ))}
          </span>
          <span className="flex items-center gap-1 text-[13px] font-semibold" title="Puertas del Saber abiertas">
            <DoorOpen className="h-4 w-4 text-violet-300" /> {room.gatesOpened}/{room.gatesTotal}
          </span>
          <span className="flex items-center gap-1 text-[13px] font-semibold" title="Fichas de pista">
            <Sparkles className="h-4 w-4 text-amber-300" /> {room.coinsCollected}/{room.coinsTotal}
          </span>
          {room.gemsTotal > 0 && (
            <span className="flex items-center gap-1 text-[13px] font-semibold" title="Gemas (rojas de Lumen, azules de Gota, verdes de los dos)" data-testid="duo-gems">
              <Gem className="h-4 w-4 text-emerald-300" /> {room.gemsCollected}/{room.gemsTotal}
            </span>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/80 shadow-lg backdrop-blur hover:bg-slate-800 [@media(max-height:520px)]:h-9 [@media(max-height:520px)]:w-9"
            aria-label="Cómo jugar"
          >
            <CircleHelp className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setEmotesOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/80 shadow-lg backdrop-blur hover:bg-slate-800 [@media(max-height:520px)]:h-9 [@media(max-height:520px)]:w-9"
            aria-label="Mensajes rápidos"
            aria-expanded={emotesOpen}
          >
            <Smile className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setChatOpen((v) => !v)
              setReadCount(duo.messages.length)
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/80 shadow-lg backdrop-blur hover:bg-slate-800 [@media(max-height:520px)]:h-9 [@media(max-height:520px)]:w-9"
            aria-label="Chat"
          >
            <MessageCircle className="h-5 w-5" />
            {!chatOpen && unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-slate-900/80 px-3 text-[13px] font-semibold shadow-lg backdrop-blur hover:bg-slate-800 [@media(max-height:520px)]:h-9"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {emotesOpen && (
        <div className="absolute right-2 top-16 z-20 grid w-[230px] grid-cols-2 gap-1.5 rounded-2xl bg-slate-900/95 p-2 shadow-xl sm:right-3">
          {DUO_EMOTES.map((emote, i) => (
            <button
              key={emote}
              type="button"
              disabled={room.phase !== 'PLAYING'}
              onClick={() => {
                sendEmote(emote)
                setEmotesOpen(false)
              }}
              className="rounded-xl bg-slate-800 px-2 py-2 text-left text-[13px] font-semibold hover:bg-slate-700 disabled:opacity-40"
            >
              {EMOTE_TEXT[emote]} {!touch && <span className="text-[11px] text-slate-400">({i + 1})</span>}
            </button>
          ))}
        </div>
      )}

      {chatOpen && (
        <div className="absolute bottom-3 right-3 z-30 flex h-[min(420px,70dvh)] w-[min(340px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl bg-surface text-text shadow-2xl">
          <ChatPanel
            inline
            messages={duo.messages}
            selfUserId={selfUserId}
            onSend={duo.sendChat}
            onClose={() => {
              setChatOpen(false)
              setReadCount(duo.messages.length)
            }}
          />
        </div>
      )}

      {/* Avisos cortos */}
      <div className="pointer-events-none absolute inset-x-0 top-16 flex flex-col items-center gap-1.5 px-3" aria-live="polite">
        {toasts.map((t) => (
          <p
            key={t.id}
            className={`animate-[fade-in-up_0.25s_ease-out] rounded-full px-4 py-1.5 text-center text-[14px] font-bold shadow-lg ${
              t.tone === 'good' ? 'bg-emerald-600/95' : t.tone === 'bad' ? 'bg-rose-700/95' : 'bg-slate-800/95'
            }`}
          >
            {t.text}
          </p>
        ))}
      </div>

      {room.phase === 'COUNTDOWN' && countdown !== null && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40">
          <p className="text-[18px] font-bold drop-shadow">¡Prepárense!</p>
          <p key={countdown} className="animate-[fade-in-up_0.3s_ease-out] text-[96px] font-black leading-none drop-shadow-lg">
            {countdown > 0 ? countdown : '¡Ya!'}
          </p>
          <p className="mt-2 max-w-[420px] px-4 text-center text-[15px] font-semibold drop-shadow">
            Lleguen juntos a los pedestales de la Puerta del Saber: cada uno se para en el de su elemento.
          </p>
        </div>
      )}

      {partnerWait && !ended && <PlayerWaitOverlay wait={partnerWait} onLeave={onExit} />}

      {inQuestion && <DuoQuestionPanel room={room} onAnswer={duo.answer} messages={duo.messages} selfUserId={selfUserId} onSendChat={duo.sendChat} />}

      {ended && <DuoEndScreen room={room} onRetry={duo.retry} onExit={onExit} />}

      {nearMirror && room.phase === 'PLAYING' && (
        <DuoMirrorPanel
          mirror={nearMirror}
          open={panelOpen}
          touch={touch}
          onOpen={() => setMirrorOpen(true)}
          onClose={() => setMirrorOpen(false)}
          onRotate={(dir) => duo.rotateMirror(nearMirror.id, dir)}
        />
      )}

      {/* En celular vertical se ve muy poco del escenario: se sugiere acostarlo. */}
      {touch && (
        <p className="pointer-events-none absolute inset-x-3 bottom-28 z-10 hidden rounded-2xl bg-slate-900/90 px-4 py-2 text-center text-[13px] font-semibold text-amber-200 shadow-lg portrait:block">
          📱↻ Gira el celular para ver más del escenario
        </p>
      )}

      {guideOpen && <GameGuide steps={duoGuideSteps()} label="Guía rápida" ariaLabel="Guía de Dúo Lógico" dataAttr="DUAL_QUEST_PIXI" accent="amber" onClose={() => setGuideOpen(false)} />}

      {touch && room.phase === 'PLAYING' && !panelOpen && <DuoTouchControls onChange={(key, down) => gameRef.current?.input.setTouch(key, down)} />}
    </div>
  )
}
