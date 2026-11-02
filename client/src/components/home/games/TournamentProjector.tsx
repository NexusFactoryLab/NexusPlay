import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Crown, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { AvatarCircle } from '../../avatar/AvatarCircle'
import { AvatarFigure } from '../../avatar/AvatarFigure'
import { usePlayersAvatars } from '../../avatar/usePlayersAvatars'
import type { AvatarConfig } from '../../../services/avatar.service'
import type { TournamentParticipantView, TournamentStateView } from './guessWhoTypes'
import { TournamentConfetti } from './TournamentConfetti'
import { roundProgress } from './TournamentRoundWaiting'
import { TOURNAMENT_GAME_LABEL } from './tournamentLevels'
import { rankParticipants } from './tournamentStats'

type Props = {
  tournament: TournamentStateView
  onClose: () => void
}

/** Cuántas personas caben en el cuadro de participantes de la sala de espera. */
const LOBBY_AVATARS = 40
/** Quiénes se listan debajo del podio. */
const BELOW_PODIUM = 5

/** Enlace para unirse; lo mismo que la sala de espera del administrador. */
export function invitationUrlFor(code: string): string {
  return new URL(`/quien-es/torneo/${encodeURIComponent(code)}`, window.location.origin).href
}

/**
 * Modo proyector del administrador (issue #147): una pantalla completa, oscura y legible a
 * distancia para mostrar en el salón. En la sala de espera enseña el código y el QR enormes
 * con quienes van entrando; durante el torneo, el podio grande y el avance de la ronda.
 * Esc (o el botón) lo cierra; intenta pasar a pantalla completa y, si el navegador no deja,
 * se queda cubriendo la ventana.
 */
/** Se monta en el body: así cubre toda la ventana aunque se abra desde un modal. */
export function TournamentProjector(props: Props) {
  if (typeof document === 'undefined') return null
  return createPortal(<ProjectorScreen {...props} />, document.body)
}

export function ProjectorScreen({ tournament, onClose }: Props) {
  const ranking = useMemo(() => rankParticipants(tournament.participants), [tournament.participants])
  const ids = useMemo(() => ranking.map((participant) => participant.userId), [ranking])
  const avatars = usePlayersAvatars(ids)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    let enteredFullscreen = false
    try {
      void document.documentElement
        .requestFullscreen?.()
        .then(() => {
          enteredFullscreen = true
        })
        .catch(() => {})
    } catch {
      // Sin pantalla completa el modo igual cubre la ventana.
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    // Si se sale de pantalla completa con Esc del navegador, el modo también se cierra.
    const onFullscreenChange = () => {
      if (enteredFullscreen && !document.fullscreenElement) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [])

  const finished = tournament.phase === 'FINISHED'

  return (
    <div
      className="page-fade fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[#0b1020] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Modo proyector del torneo"
      data-projector={tournament.phase}
    >
      <button
        type="button"
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-[13px] font-medium text-white/90 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
        onClick={onClose}
      >
        <X className="h-4 w-4" strokeWidth={2} />
        Salir del modo proyector (Esc)
      </button>
      {finished && <TournamentConfetti />}
      {tournament.phase === 'WAITING' ? (
        <ProjectorLobby tournament={tournament} ranking={ranking} avatars={avatars} />
      ) : (
        <ProjectorLive tournament={tournament} ranking={ranking} avatars={avatars} />
      )}
    </div>
  )
}

type ViewProps = {
  tournament: TournamentStateView
  ranking: TournamentParticipantView[]
  avatars: Record<string, AvatarConfig | null>
}

function ProjectorLobby({ tournament, ranking, avatars }: ViewProps) {
  const url = invitationUrlFor(tournament.code)
  const host = new URL(url).host
  const shown = ranking.slice(0, LOBBY_AVATARS)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6 pt-16 sm:p-10 sm:pt-16">
      <div className="grid flex-1 items-center gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0 text-center md:text-left">
          <p className="text-[clamp(16px,2.2vw,30px)] font-semibold tracking-[0.2em] text-amber-300 uppercase">Únete al torneo</p>
          <p className="mt-2 text-[clamp(16px,2vw,28px)] text-white/80">
            Entra a <strong className="text-white">{host}</strong> y escribe el código
          </p>
          <p className="my-3 font-extrabold tracking-[0.14em] text-white tabular-nums" style={{ fontSize: 'clamp(56px, 13vw, 220px)', lineHeight: 1 }} aria-label={`Código ${tournament.code.split('').join(' ')}`}>
            {tournament.code}
          </p>
          <p className="text-[clamp(14px,1.6vw,22px)] text-white/70">o escanea el código QR con tu celular</p>
        </div>
        <div className="flex justify-center">
          <div className="rounded-3xl bg-white p-4 shadow-[0_30px_80px_-30px_var(--accent)]">
            <QRCodeSVG value={url} size={512} style={{ width: 'min(44vh, 36vw, 460px)', height: 'min(44vh, 36vw, 460px)' }} />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="mb-3 flex items-baseline gap-3">
          <span className="font-extrabold tabular-nums" style={{ fontSize: 'clamp(32px, 4.5vw, 64px)', lineHeight: 1 }}>
            {tournament.participants.length}
          </span>
          <span className="text-[clamp(14px,1.8vw,26px)] text-white/70">
            de {tournament.maxParticipants} {tournament.participants.length === 1 ? 'participante ya entró' : 'participantes ya entraron'}
          </span>
        </p>
        {shown.length === 0 ? (
          <p className="flex items-center gap-2 text-[clamp(14px,1.6vw,22px)] text-white/70">
            <span className="live-dot" aria-hidden="true" />
            Esperando a que entre la primera persona…
          </p>
        ) : (
          <ul className="flex flex-wrap gap-x-4 gap-y-3">
            {shown.map((participant) => (
              <li key={participant.userId} className="chip-pop flex w-[clamp(64px,7vw,110px)] min-w-0 flex-col items-center gap-1 text-center">
                <AvatarCircle config={avatars[participant.userId]} name={participant.displayName} className="h-[clamp(40px,5vw,72px)] w-[clamp(40px,5vw,72px)] border-2 border-white/30 text-[18px]" />
                <span className="w-full truncate text-[clamp(11px,1.1vw,16px)] font-medium">{participant.displayName}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Alturas del podio: 2.º a la izquierda, 1.º al centro, 3.º a la derecha. */
const PODIUM = [
  { rank: 2, block: 'h-[13vh]', figure: 'w-[clamp(100px,13vw,220px)]', tone: 'from-[#8f99ab] to-[#6b7487]' },
  { rank: 1, block: 'h-[20vh]', figure: 'w-[clamp(130px,17vw,290px)]', tone: 'from-[#e0a815] to-[#a87a08]' },
  { rank: 3, block: 'h-[9vh]', figure: 'w-[clamp(90px,11vw,190px)]', tone: 'from-[#b9772f] to-[#80501f]' },
] as const

function ProjectorLive({ tournament, ranking, avatars }: ViewProps) {
  const finished = tournament.phase === 'FINISHED'
  const scorers = ranking.filter((participant) => participant.points > 0)
  const champion = finished ? ranking.find((participant) => participant.userId === tournament.winnerUserId) ?? ranking[0] : null
  const { done, total } = roundProgress(tournament)
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const rest = ranking.slice(3, 3 + BELOW_PODIUM).filter((participant) => participant.points > 0)
  const game = tournament.currentRoundGame

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6 pt-16 sm:p-10 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[clamp(14px,1.6vw,24px)] font-semibold tracking-[0.2em] text-amber-300 uppercase">
            {finished ? 'Torneo terminado' : `Ronda ${tournament.currentRound} de ${tournament.totalRounds}`}
          </p>
          {finished && champion ? (
            <p className="mt-1 font-extrabold tracking-tight" style={{ fontSize: 'clamp(30px, 5vw, 76px)', lineHeight: 1.05 }}>
              ¡Ganó {champion.displayName}!
            </p>
          ) : (
            game && (
              <p className="mt-1 font-bold tracking-tight" style={{ fontSize: 'clamp(24px, 3.4vw, 52px)', lineHeight: 1.1 }}>
                {game.title} <span className="text-white/60">· {TOURNAMENT_GAME_LABEL[game.gameType]}</span>
              </p>
            )
          )}
        </div>
        {!finished && total > 0 && (
          <div className="w-[min(100%,360px)]">
            <p className="mb-1 flex justify-between text-[clamp(12px,1.3vw,18px)] text-white/80">
              <span>Partidas terminadas</span>
              <span className="tabular-nums">
                {done} de {total}
              </span>
            </p>
            <div className="progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Partidas terminadas de la ronda">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}
      </div>

      {scorers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Crown className="h-[clamp(48px,7vw,110px)] w-[clamp(48px,7vw,110px)] text-amber-300/80" strokeWidth={1.5} />
          <p className="font-bold" style={{ fontSize: 'clamp(24px, 3.6vw, 56px)' }}>
            Nadie ha sumado puntos todavía
          </p>
          <p className="text-[clamp(14px,1.8vw,26px)] text-white/70">¡La primera victoria se lleva el primer lugar!</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-end justify-center gap-3 sm:gap-6" role="list" aria-label="Podio del torneo">
          {PODIUM.map((place) => {
            const participant = scorers[place.rank - 1]
            if (!participant) return <div key={place.rank} className="flex-1" role="listitem" aria-hidden="true" />
            const avatar = avatars[participant.userId]
            return (
              <div key={place.rank} role="listitem" className="flex min-w-0 max-w-[28vw] flex-1 flex-col items-center justify-end">
                <div key={participant.userId} className="chip-pop flex w-full min-w-0 flex-col items-center gap-1 pb-2 text-center">
                  {place.rank === 1 && <Crown className="h-[clamp(28px,4vw,64px)] w-[clamp(28px,4vw,64px)] text-amber-300 drop-shadow" strokeWidth={2} aria-hidden="true" />}
                  {avatar ? (
                    <AvatarFigure config={avatar} className={`${place.figure} drop-shadow-[0_14px_20px_rgba(0,0,0,0.5)]`} />
                  ) : (
                    <AvatarCircle config={null} name={participant.displayName} className="h-[clamp(70px,9vw,150px)] w-[clamp(70px,9vw,150px)] text-[32px]" />
                  )}
                  <p className="w-full truncate font-bold" style={{ fontSize: 'clamp(16px, 2.2vw, 36px)' }} title={participant.displayName}>
                    {participant.displayName}
                  </p>
                  <span className="rounded-full bg-white/15 px-4 py-0.5 font-extrabold tabular-nums" style={{ fontSize: 'clamp(16px, 2.2vw, 36px)' }}>
                    {participant.points} {participant.points === 1 ? 'pt' : 'pts'}
                  </span>
                </div>
                <div
                  className={`flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 font-extrabold text-white/95 ${place.block} ${place.tone}`}
                  style={{ fontSize: 'clamp(22px, 3vw, 48px)' }}
                  aria-hidden="true"
                >
                  {place.rank}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {rest.length > 0 && (
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Siguientes puestos">
          {rest.map((participant, index) => (
            <li key={participant.userId} className="stagger-in flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2" style={{ '--stagger': index } as React.CSSProperties}>
              <span className="w-6 shrink-0 text-center font-bold text-white/70">{index + 4}</span>
              <AvatarCircle config={avatars[participant.userId]} name={participant.displayName} className="h-9 w-9 text-[12px]" />
              <span className="min-w-0 flex-1 truncate text-[clamp(13px,1.3vw,20px)] font-medium">{participant.displayName}</span>
              <span className="shrink-0 font-bold tabular-nums">{participant.points}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
