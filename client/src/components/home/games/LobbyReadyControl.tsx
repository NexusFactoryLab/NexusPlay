import { CheckCircle2, Circle, Users } from 'lucide-react'
import type { AvatarConfig } from '../../../services/avatar.service'
import { AvatarCircle } from '../../avatar/AvatarCircle'

type Participant = { userId: string; displayName: string; isSelf: boolean; ready?: boolean; role?: string }

/**
 * Jugadores de la sala y confirmación «Listo para jugar» en un solo bloque
 * (issue #80): cada jugador sale con su avatar y si ya confirmó.
 */
export function LobbyReadyControl({ players, maxPlayers, avatars = {}, onReady, disconnected = false, requireEven = false, large = false }: {
  /** Letra ≥ 16 px y avatares/botones grandes (Dominexo). */
  large?: boolean
  players: Participant[]
  maxPlayers: number
  avatars?: Record<string, AvatarConfig | null | undefined>
  onReady: (ready: boolean) => void
  disconnected?: boolean
  requireEven?: boolean
}) {
  const self = players.find((player) => player.isSelf)
  const readyCount = players.filter((player) => player.ready).length
  const validCount = players.length >= 2 && (!requireEven || players.length % 2 === 0)
  return (
    <section aria-label="Confirmación de jugadores" className="rounded-[22px] border border-accent/30 bg-accent/5 p-3.5">
      <p className={`mb-2.5 flex items-center gap-2 font-semibold text-text-h ${large ? 'text-[1.125rem]' : 'text-[13px]'}`}>
        <Users className={`text-accent ${large ? 'h-6 w-6' : 'h-4 w-4'}`} strokeWidth={2} aria-hidden="true" />
        Jugadores en la sala ({players.length}/{maxPlayers})
      </p>
      <div className={`mb-2.5 flex flex-wrap gap-2 ${large ? 'gap-3' : ''}`} aria-live="polite">
        {players.map((player) => {
          const Icon = player.ready ? CheckCircle2 : Circle
          return <span key={player.userId} className={`inline-flex items-center gap-2 rounded-full border bg-surface py-1 pr-3 pl-1 font-medium text-text-h ${large ? 'gap-3 pr-5 text-[1rem]' : 'text-[12.5px]'} ${player.ready ? 'border-accent/60' : 'border-border'}`}>
            <AvatarCircle config={avatars[player.userId]} name={player.displayName} className={large ? 'h-14 w-14 text-[1.125rem]' : 'h-9 w-9 text-[12px]'} />
            <span>
              {player.role === 'FIRE' ? '🔥 ' : player.role === 'WATER' ? '💧 ' : ''}
              {player.displayName}{player.isSelf ? ' (tú)' : ''}
              <span className={`flex items-center gap-1 font-semibold ${large ? 'text-[0.9rem]' : 'text-[11px]'} ${player.ready ? 'text-accent' : 'text-text'}`}>
                <Icon className={large ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
                {player.ready ? 'Listo' : 'Sin confirmar'}
              </span>
            </span>
          </span>
        })}
      </div>
      <p className={`mb-2.5 text-text ${large ? 'text-[1rem]' : 'text-[12.5px]'}`} role="status">
        {disconnected ? 'Reconectando con la sala…' : !validCount
          ? requireEven ? 'Se necesitan 2, 4, 6, 8 o 10 jugadores para empezar.' : 'Esperando al segundo jugador…'
          : `${readyCount} de ${players.length} listos. Empieza cuando todos confirmen.`}
      </p>
      <button type="button" aria-pressed={Boolean(self?.ready)} disabled={!self || disconnected}
        onClick={() => onReady(!self?.ready)}
        className={`w-full rounded-xl px-4 font-bold transition-colors ${large ? 'min-h-[56px] text-[1.125rem]' : 'py-2.5 text-sm'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
          self?.ready ? 'border border-accent/40 bg-surface text-text-h hover:bg-accent/15' : 'text-white shadow-[0_10px_22px_-12px_var(--accent)]'
        }`}
        style={self?.ready ? undefined : { background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
        {self?.ready ? 'Cancelar mi confirmación' : 'Listo para jugar'}
      </button>
    </section>
  )
}
