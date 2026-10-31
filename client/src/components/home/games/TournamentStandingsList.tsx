import { Medal } from 'lucide-react'
import { AvatarCircle } from '../../avatar/AvatarCircle'
import type { AvatarConfig } from '../../../services/avatar.service'
import type { TournamentParticipantView } from './guessWhoTypes'
import { PointsValue } from './PointsValue'

const MEDAL_TONES = ['text-[#d4a017]', 'text-[#8f99ab]', 'text-[#a8692f]'] as const

type Props = {
  /** Clasificación completa, ya ordenada (ver `rankParticipants`). */
  ranking: TournamentParticipantView[]
  avatars: Record<string, AvatarConfig | null>
  selfUserId: string | null
  /** Cuántas filas mostrar; tu propia fila siempre aparece, aunque quedes fuera del límite. */
  limit?: number
}

/** «3.º» — el ordinal en español. */
export function ordinal(position: number): string {
  return `${position}.º`
}

/** Clasificación con el personaje de cada quien: la tuya resaltada y siempre visible. */
export function TournamentStandingsList({ ranking, avatars, selfUserId, limit }: Props) {
  const selfIndex = ranking.findIndex((participant) => participant.userId === selfUserId)
  const shown = ranking.map((participant, index) => ({ participant, index })).filter(({ index }) => limit === undefined || index < limit || index === selfIndex)
  return (
    <ol className="flex w-full flex-col gap-1.5 text-left" aria-label="Clasificación del torneo">
      {shown.map(({ participant, index }, position) => {
        const isSelf = participant.userId === selfUserId
        const medal = index < 3 && participant.points > 0
        const gap = position > 0 && index - shown[position - 1].index > 1
        return (
          <li key={participant.userId} className="contents">
            {gap && (
              <span className="text-center text-[12px] leading-none text-text" aria-hidden="true">
                ⋮
              </span>
            )}
            <div
              className={`stagger-in flex items-center gap-3 rounded-xl border px-2.5 py-2 text-[13px] text-text-h ${
                isSelf ? 'border-accent/40 bg-accent/10' : 'border-transparent bg-code-bg/60'
              }`}
              style={{ '--stagger': position } as React.CSSProperties}
            >
              <span className="flex w-6 shrink-0 justify-center font-semibold">
                {medal ? <Medal className={`h-[18px] w-[18px] ${MEDAL_TONES[index]}`} strokeWidth={2.25} aria-label={`Puesto ${index + 1}`} /> : index + 1}
              </span>
              <AvatarCircle config={avatars[participant.userId]} name={participant.displayName} className="h-9 w-9 text-[12px]" />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {participant.displayName}
                {isSelf ? ' (tú)' : ''}
              </span>
              <span className="shrink-0 text-right text-[16px] leading-none font-bold">
                <PointsValue value={participant.points} />
                <span className="ml-1 text-[10.5px] font-medium text-text">{participant.points === 1 ? 'punto' : 'puntos'}</span>
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
