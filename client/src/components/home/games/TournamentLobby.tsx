import { useState } from 'react'
import { Copy, Link, LogOut, Play, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Modal } from './Modal'
import type { TournamentStateView } from './guessWhoTypes'

type Props = {
  tournament: TournamentStateView
  error: string | null
  onUpdateTurnDuration: (seconds: number) => void
  onStart: () => void
  onClose: () => void
  onExit: () => void
}

/**
 * Sala de espera del torneo (issue #102). El administrador (moderador) ve el
 * código, el enlace y el QR para repartirlos, elige los segundos por turno y
 * decide cuándo arrancar; los participantes solo ven quién ya entró y esperan.
 */
export function TournamentLobby({ tournament, error, onUpdateTurnDuration, onStart, onClose, onExit }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const [turnText, setTurnText] = useState(String(tournament.turnDurationSeconds))
  const [seenTurn, setSeenTurn] = useState(tournament.turnDurationSeconds)
  if (seenTurn !== tournament.turnDurationSeconds) {
    setSeenTurn(tournament.turnDurationSeconds)
    setTurnText(String(tournament.turnDurationSeconds))
  }

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

  function commitTurn() {
    const parsed = Number(turnText)
    if (Number.isInteger(parsed) && parsed >= 5 && parsed <= 120) onUpdateTurnDuration(parsed)
    else setTurnText(String(tournament.turnDurationSeconds))
  }

  return (
    <Modal onClose={tournament.isModerator ? onClose : onExit} maxWidthClassName="max-w-[760px]" ariaLabel="Sala de espera del torneo">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
              {tournament.isModerator ? 'Torneo · Administrador' : 'Torneo'}
            </p>
            <h2 className="mt-1 text-[22px] font-bold tracking-tight text-text-h">{tournament.gameTitle}</h2>
            <p className="text-[12.5px] text-text">
              {tournament.totalRounds} rondas · puntos por partida ganada
              {tournament.gameTitles.length > 1 ? ` · un juego por ronda: ${tournament.gameTitles.join(' → ')}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-medium text-text-h"
            onClick={onExit}
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            Salir
          </button>
        </div>

        {tournament.isModerator && (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-surface p-4">
            <div className="flex min-w-0 flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-text">
                <span className="font-medium text-text-h">Código:</span>
                <code className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-1 text-[24px] font-semibold tracking-widest text-accent">
                  {tournament.code}
                </code>
                <button type="button" aria-label="Copiar código" className="rounded-lg border border-border p-2" onClick={() => copy(tournament.code, 'Código copiado')}>
                  <Copy className="h-4 w-4" strokeWidth={2} />
                </button>
                <button type="button" aria-label="Copiar enlace" className="rounded-lg border border-border p-2" onClick={() => copy(invitationUrl, 'Enlace copiado')}>
                  <Link className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <p className="truncate text-[12px] text-text">{invitationUrl}</p>
              <label className="flex items-center gap-2 text-[13px] text-text-h">
                Segundos por turno
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={turnText}
                  onChange={(event) => setTurnText(event.target.value)}
                  onBlur={commitTurn}
                  onKeyDown={(event) => event.key === 'Enter' && commitTurn()}
                  className="w-20 rounded-lg border border-border bg-bg px-2 py-1 text-[14px] text-text-h"
                />
              </label>
              {copied && <p className="text-[12px] font-medium text-accent" role="status">{copied}</p>}
            </div>
            <QRCodeSVG value={invitationUrl} size={120} />
          </div>
        )}

        <div className="rounded-2xl border border-border p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-text-h">
            <Users className="h-4 w-4 text-accent" strokeWidth={2} />
            {tournament.participants.length} / {tournament.maxParticipants} participantes
          </p>
          {tournament.participants.length === 0 ? (
            <p className="text-[13px] text-text">Aún no ha entrado nadie.</p>
          ) : (
            <div className="grid max-h-[260px] grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
              {tournament.participants.map((participant) => (
                <span key={participant.userId} className="truncate rounded-lg bg-code-bg px-3 py-1.5 text-[12.5px] font-medium text-text-h">
                  {participant.displayName}
                  {participant.isSelf ? ' (tú)' : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {tournament.isModerator ? (
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h" onClick={onClose}>
              Cerrar torneo
            </button>
            <button
              type="button"
              disabled={!canStart}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              onClick={onStart}
            >
              <Play className="h-4 w-4" strokeWidth={2} />
              {canStart ? `Iniciar con ${tournament.participants.length} participantes` : 'Se necesitan al menos 2 participantes'}
            </button>
          </div>
        ) : (
          <p className="text-center text-[14px] font-medium text-text-h">Esperando a que el administrador inicie el torneo…</p>
        )}
      </div>
    </Modal>
  )
}
