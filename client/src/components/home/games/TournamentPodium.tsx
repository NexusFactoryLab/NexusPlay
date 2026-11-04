import { Crown } from 'lucide-react'
import { AvatarCircle } from '../../avatar/AvatarCircle'
import { AvatarFigure } from '../../avatar/AvatarFigure'
import type { AvatarConfig } from '../../../services/avatar.service'
import type { TournamentParticipantView } from './guessWhoTypes'
import { PointsValue } from './PointsValue'

type Props = {
  /** Clasificación completa, ya ordenada (ver `rankParticipants`). */
  ranking: TournamentParticipantView[]
  avatars: Record<string, AvatarConfig | null>
  finished: boolean
}

/** Orden visual del podio: 2.º a la izquierda, 1.º al centro, 3.º a la derecha. */
const PLACES = [
  { rank: 2, block: 'h-[84px]', figure: 'w-[92px] sm:w-[112px]', tone: 'from-[#8f99ab] to-[#6b7487]' },
  { rank: 1, block: 'h-[124px]', figure: 'w-[112px] sm:w-[140px]', tone: 'from-[#c58f10] to-[#9a6e08]' },
  { rank: 3, block: 'h-[60px]', figure: 'w-[84px] sm:w-[100px]', tone: 'from-[#a8692f] to-[#7e4b1e]' },
] as const

/**
 * Podio en vivo del torneo (issue #102): los tres con más puntos, con su avatar,
 * su nombre y su puntaje. Solo sube quien ya sumó: con todos en 0 no hay podio
 * que armar. Cada vez que cambia el ranking, quien llega a un puesto aparece
 * con un pequeño salto y el puntaje late al subir.
 */
export function TournamentPodium({ ranking, avatars, finished }: Props) {
  const scorers = ranking.filter((participant) => participant.points > 0)

  if (scorers.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
        <div className="flex -space-x-2" aria-hidden="true">
          {ranking.slice(0, 5).map((participant) => (
            <AvatarCircle
              key={participant.userId}
              config={avatars[participant.userId]}
              name={participant.displayName}
              className="h-9 w-9 border-2 border-surface text-[12px]"
            />
          ))}
        </div>
        <p className="text-[13.5px] font-semibold text-text-h">El podio se arma con el primer punto</p>
        <p className="max-w-[300px] text-[12px] text-text">Apenas alguien gane su primera partida, aparece aquí con su avatar.</p>
      </div>
    )
  }

  return (
    <div className="flex items-end justify-center gap-2 pt-2 sm:gap-4" role="list" aria-label="Podio del torneo">
      {PLACES.map((place, slot) => {
        const participant = scorers[place.rank - 1]
        const avatar = participant ? avatars[participant.userId] : null
        return (
          <div key={place.rank} role="listitem" className="flex min-w-0 flex-1 flex-col items-center justify-end">
            {participant ? (
              // La clave es la persona: si cambia de puesto, esta ficha entra de nuevo con su salto.
              <div key={participant.userId} className="chip-pop flex w-full min-w-0 flex-col items-center gap-1 pb-2 text-center">
                {place.rank === 1 && (
                  <Crown
                    className={`h-6 w-6 text-[#d4a017] drop-shadow ${finished ? 'animate-[trophy-pop-in_0.6s_cubic-bezier(0.16,1,0.3,1)]' : ''}`}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                )}
                {avatar ? (
                  <AvatarFigure config={avatar} className={`${place.figure} drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)]`} />
                ) : (
                  <AvatarCircle
                    config={null}
                    name={participant.displayName}
                    className={`${place.rank === 1 ? 'h-20 w-20 text-[24px]' : 'h-16 w-16 text-[20px]'} shadow-md`}
                  />
                )}
                <p className="w-full truncate text-[13.5px] font-semibold text-text-h" title={participant.displayName}>
                  {participant.displayName}
                </p>
                <span className="inline-flex items-baseline gap-1 rounded-full bg-accent/20 px-2.5 py-0.5 text-[13px] font-bold text-text-h">
                  <PointsValue value={participant.points} />
                  <span className="text-[10.5px] font-semibold opacity-80">{participant.points === 1 ? 'pt' : 'pts'}</span>
                </span>
              </div>
            ) : (
              <p className="pb-3 text-[12px] text-text/60" aria-label={`Puesto ${place.rank} libre`}>
                —
              </p>
            )}
            <div
              className={`stagger-in flex w-full items-start justify-center rounded-t-xl bg-gradient-to-b pt-2 text-[22px] font-extrabold text-white/95 shadow-[inset_0_2px_0_rgba(255,255,255,0.28)] ${place.block} ${place.tone}`}
              style={{ '--stagger': slot } as React.CSSProperties}
              aria-hidden="true"
            >
              {place.rank}
            </div>
          </div>
        )
      })}
    </div>
  )
}
