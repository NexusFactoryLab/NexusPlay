import { useEffect, useMemo, useState } from 'react'
import { CircleHelp, Copy, Link, LogOut, Play, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { AvatarCircle } from '../../avatar/AvatarCircle'
import { usePlayersAvatars } from '../../avatar/usePlayersAvatars'
import { Modal } from './Modal'
import type { TournamentStateView } from './guessWhoTypes'
import { GameInstructionsGate } from './GameInstructionsGate'
import { TOURNAMENT_GAME_LABEL, TOURNAMENT_LEVEL_INFO } from './tournamentLevels'
import { TournamentConfirmModal } from './TournamentConfirmModal'

type Props = {
  tournament: TournamentStateView
  error: string | null
  onStart: () => void
  onClose: () => void
  onExit: () => void
}

/**
 * Sala de espera del torneo (issue #102). El administrador (moderador) ve el
 * código, el enlace y el QR para repartirlos, elige los segundos por turno y
 * decide cuándo arrancar; los participantes solo ven quién ya entró y esperan.
 */
export function TournamentLobby({ tournament, error, onStart, onClose, onExit }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const avatars = usePlayersAvatars(useMemo(() => tournament.participants.map((p) => p.userId), [tournament.participants]))

  const invitationUrl = new URL(`/quien-es/torneo/${encodeURIComponent(tournament.code)}`, window.location.origin).href
  const canStart = tournament.participants.length >= 2

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
    } catch {
      setCopied('No se pudo copiar')
    }
    setTimeout(() => setCopied(null), 1800)
  }

  return (
    <Modal onClose={() => {}} dismissible={false} maxWidthClassName="max-w-[760px]" ariaLabel="Sala de espera del torneo">
      <div className="flex flex-col gap-4">
        <div className="stagger-in flex items-start justify-between gap-3" style={{ '--stagger': 0 } as React.CSSProperties}>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
              {tournament.isModerator ? 'Torneo · Administrador' : 'Torneo'}
            </p>
            <h2 className="mt-1 text-[22px] font-bold tracking-tight text-text-h">Torneo</h2>
            <p className="text-[12.5px] text-text">{tournament.totalRounds} rondas · 1 punto por ronda ganada</p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onExit}
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            Salir
          </button>
        </div>

        {tournament.isModerator && (
          <div className="stagger-in grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)]" style={{ '--stagger': 1 } as React.CSSProperties}>
            <div className="flex min-w-0 flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-text">
                <span className="font-medium text-text-h">Código:</span>
                <code className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-1 text-[24px] font-semibold tracking-widest text-accent">
                  {tournament.code}
                </code>
                <button type="button" aria-label="Copiar código" className="rounded-lg border border-border p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => copy(tournament.code, 'Código copiado')}>
                  <Copy className="h-4 w-4" strokeWidth={2} />
                </button>
                <button type="button" aria-label="Copiar enlace" className="rounded-lg border border-border p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => copy(invitationUrl, 'Enlace copiado')}>
                  <Link className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <p className="truncate text-[12px] text-text">{invitationUrl}</p>
              <p className={`h-4 text-[12px] font-medium text-accent transition-opacity duration-300 ${copied ? 'opacity-100' : 'opacity-0'}`} role="status">{copied ?? ''}</p>
            </div>
            <div className="rounded-xl bg-white p-2 shadow-[0_8px_24px_-12px_var(--accent)] transition-transform duration-300 hover:scale-105">
              <QRCodeSVG value={invitationUrl} size={112} />
            </div>
          </div>
        )}

        <div className="stagger-in rounded-2xl border border-border p-4" style={{ '--stagger': 2 } as React.CSSProperties}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
              <Users className="h-4 w-4 text-accent" strokeWidth={2} />
              Participantes
            </p>
            <p className="text-text-h" aria-label={`${tournament.participants.length} de ${tournament.maxParticipants} participantes`}>
              <span className="text-[34px] leading-none font-extrabold tabular-nums">{tournament.participants.length}</span>
              <span className="text-[14px] font-semibold text-text"> / {tournament.maxParticipants}</span>
            </p>
          </div>
          <div className="progress-track mb-3" role="progressbar" aria-valuenow={tournament.participants.length} aria-valuemin={0} aria-valuemax={tournament.maxParticipants}>
            <div className="progress-fill" style={{ width: `${Math.min(100, (tournament.participants.length / tournament.maxParticipants) * 100)}%` }} />
          </div>
          {tournament.participants.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px] text-text">
              <span className="live-dot" aria-hidden="true" />
              Esperando a que entre la primera persona…
            </p>
          ) : (
            <ul className="grid max-h-[300px] grid-cols-3 gap-x-2 gap-y-3 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
              {tournament.participants.map((participant) => (
                <li key={participant.userId} className="chip-pop flex min-w-0 flex-col items-center gap-1 text-center">
                  <span className="relative">
                    <AvatarCircle
                      config={avatars[participant.userId]}
                      name={participant.displayName}
                      className={`h-12 w-12 border-2 text-[15px] shadow-sm ${participant.isSelf ? 'border-accent' : 'border-surface'}`}
                    />
                  </span>
                  <span className={`w-full truncate text-[12px] font-medium ${participant.isSelf ? 'text-accent' : 'text-text-h'}`} title={participant.displayName}>
                    {participant.displayName}
                    {participant.isSelf ? ' (tú)' : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="stagger-in rounded-2xl border border-border p-4" style={{ '--stagger': 3 } as React.CSSProperties}>
          <p className="mb-1 text-[13px] font-semibold text-text-h">Juegos del torneo</p>
          <p className="mb-2.5 text-[12px] text-text">
            En cada ronda se sortea uno de estos juegos, y nunca toca el mismo dos veces seguidas. ¡Es una sorpresa!
          </p>
          <ul className="flex flex-col gap-1.5">
            {tournament.games.map((game, index) => {
              const info = TOURNAMENT_LEVEL_INFO[game.level]
              return (
                <li key={`${game.title}-${index}`} className="flex items-center gap-2 text-[12.5px] text-text-h">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {game.title} <span className="font-normal text-text">· {TOURNAMENT_GAME_LABEL[game.gameType]}</span>
                  </span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${info.tone}`}>
                    {info.label} · {info.audience}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        {error && (
          <p className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {tournament.isModerator ? (
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-danger/50 hover:text-danger active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => setConfirmingClose(true)}>
              Cerrar torneo
            </button>
            <button
              type="button"
              disabled={!canStart}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_14px_26px_-10px_var(--accent)] enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              onClick={onStart}
            >
              <Play className="h-4 w-4" strokeWidth={2} />
              {canStart ? `Iniciar con ${tournament.participants.length} participantes` : 'Se necesitan al menos 2 participantes'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <p className="flex items-center justify-center gap-2.5 text-center text-[14px] font-medium text-text-h">
              <span className="live-dot" aria-hidden="true" />
              Esperando a que el administrador inicie el torneo…
            </p>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent"
              onClick={() => setShowGuide(true)}
            >
              <CircleHelp className="h-4 w-4" strokeWidth={2} />
              ¿Cómo se juega?
            </button>
          </div>
        )}
      </div>
      {confirmingClose && (
        <TournamentConfirmModal
          title="¿Cerrar el torneo?"
          message={
            tournament.participants.length === 0
              ? 'Se cierra la sala y el código deja de funcionar. No se puede deshacer.'
              : `Se cierra la sala para las ${tournament.participants.length} ${tournament.participants.length === 1 ? 'persona que ya entró' : 'personas que ya entraron'} y el código deja de funcionar. No se puede deshacer.`
          }
          confirmLabel="Sí, cerrar torneo"
          cancelLabel="Seguir esperando"
          onConfirm={() => {
            setConfirmingClose(false)
            onClose()
          }}
          onCancel={() => setConfirmingClose(false)}
        />
      )}
      {showGuide && (
        <GameInstructionsGate kind="GUESS_WHO_GROUP">
          <CloseGuide onDone={() => setShowGuide(false)} />
        </GameInstructionsGate>
      )}
    </Modal>
  )
}

/** La guía se muestra hasta que la persona continúa; entonces se cierra sola. */
function CloseGuide({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    onDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
