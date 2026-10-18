import { Bot, Dices, Flame, Ghost, Layers, Puzzle, UserRoundSearch } from 'lucide-react'
import type { CreationDraftSummary } from '../../../services/game-creation-draft.service'
import { modeColorForGameType } from './gameModeVisuals'
import { draftTypeLabel, expiryNotice, relativeTimeEs } from './creationDraftSupport'

const ICON_BY_GAME_TYPE: Record<string, typeof Layers> = {
  MEMORY_MATCH: Layers,
  GUESS_WHO: UserRoundSearch,
  DOMINO: Puzzle,
  MAZE_COLLECTOR: Ghost,
  SNAKES_LADDERS: Dices,
  DUAL_QUEST: Flame,
  TRUE_FALSE_MAZE: Bot,
}

/** Parte izquierda de la fila de un borrador: ícono del tipo, nombre, tipo, tiempo relativo y vencimiento. */
export function CreationDraftIdentity({ draft, now }: { draft: CreationDraftSummary; now: Date }) {
  const Icon = ICON_BY_GAME_TYPE[draft.gameType] ?? Layers
  const notice = expiryNotice(draft.updatedAt, now)
  return (
    <>
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: modeColorForGameType(draft.gameType) }}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-text-h">{draft.gameName || 'Juego sin nombre'}</p>
        <p className="text-[12px] text-text">
          {draftTypeLabel(draft.gameType, draft.mode)} · {relativeTimeEs(draft.updatedAt, now)}
        </p>
        {notice && <p className="text-[12px] font-semibold text-danger">{notice}</p>}
      </div>
    </>
  )
}
