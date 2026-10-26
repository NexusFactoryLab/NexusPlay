import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../../hooks/useAuth'
import { getGameBySlug, type GameDetail } from '../../../../services/game.service'
import { ApiError } from '../../../../utils/http'
import { GameInstructionsGate } from '../GameInstructionsGate'
import { MultiplayerLobby } from '../MultiplayerLobby'
import { useDuoRoom } from './useDuoRoom'
import { DuoPlayScreen } from './DuoPlayScreen'
import { CharacterCard } from './CharacterCard'
import type { DuoRole } from './shared/duoTypes'

/**
 * Dúo Lógico con sprites y sala en línea (issue #105).
 *  - `/dual-quest-pixi/:slug`: elegir personaje y crear la sala.
 *  - `/dual-quest-pixi/sala/:code`: unirse (o volver tras recargar) a una sala.
 */
export function DuoLogicoPage() {
  const { slug, code } = useParams<{ slug?: string; code?: string }>()
  return (
    <GameInstructionsGate key={slug ?? code} kind="DUAL_QUEST_PIXI">
      <DuoLogicoSession slug={slug} code={code} />
    </GameInstructionsGate>
  )
}

function DuoLogicoSession({ slug, code }: { slug?: string; code?: string }) {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const duo = useDuoRoom(token)
  const { room, connecting, joinRoom } = duo
  const [game, setGame] = useState<GameDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [role, setRole] = useState<DuoRole>('FIRE')
  const [creating, setCreating] = useState(false)
  const joined = useRef(false)

  useEffect(() => {
    if (!slug || !token) return
    let cancelled = false
    getGameBySlug(token, slug)
      .then((detail) => {
        if (cancelled) return
        if (detail.gameType !== 'DUAL_QUEST_PIXI') setLoadError(`"${detail.title}" no es un juego de Dúo Lógico.`)
        else setGame(detail)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError && err.status === 404 ? 'No encontramos ese juego: revisa el enlace.' : 'No se pudo cargar el juego.')
      })
    return () => {
      cancelled = true
    }
  }, [slug, token])

  useEffect(() => {
    if (!code || connecting || joined.current) return
    joined.current = true
    joinRoom(code.toUpperCase())
  }, [code, connecting, joinRoom])

  // Con la sala creada, la dirección pasa a ser la del código: recargar vuelve a la misma
  // sala. Se cambia sin navegar: una navegación montaría la página de nuevo y cortaría
  // la conexión (y con ella la sala recién creada).
  const roomCode = room?.code
  useEffect(() => {
    const path = roomCode ? `/dual-quest-pixi/sala/${roomCode}` : null
    if (path && window.location.pathname !== path) window.history.replaceState(window.history.state, '', path)
  }, [roomCode])

  function exit() {
    duo.leaveRoom()
    navigate('/')
  }

  if (room && room.phase === 'WAITING') {
    const me = room.players.find((p) => p.userId === user?.id)
    return (
      <MultiplayerLobby
        room={{
          gameTitle: room.gameTitle,
          code: room.code,
          players: room.players.map((p) => ({ userId: p.userId, displayName: p.displayName, isSelf: p.userId === user?.id, ready: p.ready, role: p.role === 'FIRE' ? 'Lumen' : 'Gota' })),
        }}
        roomPath={`/dual-quest-pixi/sala/${encodeURIComponent(room.code)}`}
        maxPlayers={2}
        isHost={room.players[0]?.userId === user?.id}
        connecting={connecting}
        error={duo.error}
        onReady={duo.setReady}
        onExit={exit}
        messages={duo.messages}
        onSend={duo.sendChat}
      >
        <div className="mb-3 rounded-[24px] border border-border/80 bg-surface p-3.5">
          <p className="mb-2 text-[13px] font-semibold text-text-h">
            Personajes {room.players.length < 2 ? '· elige el tuyo; tu compañero recibe el otro' : '· pueden intercambiarlos antes de estar listos'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['FIRE', 'WATER'] as const).map((r) => {
              const owner = room.players.find((p) => p.role === r)
              return (
                <CharacterCard
                  key={r}
                  role={r}
                  selected={me?.role === r}
                  owner={owner ? (owner.userId === user?.id ? 'Tú' : owner.displayName) : null}
                  onSelect={me && me.role !== r && !me.ready ? () => duo.chooseRole(r) : undefined}
                />
              )
            })}
          </div>
        </div>
      </MultiplayerLobby>
    )
  }

  if (room) {
    return <DuoPlayScreen duo={duo} room={room} selfUserId={user?.id ?? null} onExit={exit} />
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col justify-center gap-5 p-5 sm:p-8">
        <header>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">Dúo Lógico · en pareja</p>
          <h1 className="text-[24px] font-bold tracking-tight text-text-h">{game?.title ?? 'Dúo Lógico'}</h1>
          <p className="mt-1 text-[14px] text-text">
            Recorran el bosque juntos, superen los obstáculos y respondan bien los dos en cada Puerta del Saber.
          </p>
        </header>

        {(loadError || duo.error) && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-[14px] text-danger">
            {loadError ?? duo.error}
          </p>
        )}

        {code && !room && !duo.error && <p className="py-10 text-center text-[15px] text-text">Entrando a la sala {code.toUpperCase()}…</p>}

        {slug && !loadError && (
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-[16px] font-semibold text-text-h">¿Con quién quieres jugar?</h2>
            <div className="grid grid-cols-2 gap-3">
              <CharacterCard role="FIRE" selected={role === 'FIRE'} onSelect={() => setRole('FIRE')} />
              <CharacterCard role="WATER" selected={role === 'WATER'} onSelect={() => setRole('WATER')} />
            </div>
            <button
              type="button"
              disabled={!game || connecting || creating}
              onClick={() => {
                if (!game) return
                setCreating(true)
                duo.createRoom(game.id, role)
              }}
              className="mt-4 w-full rounded-xl px-4 py-3 text-[15px] font-bold text-white shadow-[0_8px_20px_-8px_var(--accent)] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            >
              {connecting ? 'Conectando…' : creating ? 'Creando sala…' : 'Crear sala e invitar a mi compañero'}
            </button>
          </section>
        )}

        <Link to="/" className="text-center text-[14px] font-medium text-accent hover:underline">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  )
}
