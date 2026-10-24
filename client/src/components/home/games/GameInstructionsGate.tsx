import { useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Modal } from './Modal'
import type { InstructionKind } from './gameInstructions'
import { InteractiveTutorial } from './tutorials/InteractiveTutorial'
import { tutorialStepsFor } from './tutorials/gameTutorials'

const SEEN_KEY_PREFIX = 'nexusplay:guia-vista:'

/** Si esta guía ya se vio antes en este navegador (para ofrecer saltarla). Nunca lanza. */
function wasSeen(kind: InstructionKind): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY_PREFIX + kind) === '1'
  } catch {
    return false
  }
}

function markSeen(kind: InstructionKind): void {
  try {
    window.localStorage.setItem(SEEN_KEY_PREFIX + kind, '1')
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): solo no se recuerda.
  }
}

const GAME_NAMES: Record<InstructionKind, string> = {
  PAIRS: 'MatchMente',
  OPPOSITES: 'MatchMente: opuestos',
  GUESS_WHO: 'Identidad Oculta',
  GUESS_WHO_GROUP: 'el torneo de Identidad Oculta',
  DOMINO: 'Dominexo',
  MAZE_COLLECTOR: 'el Camión Reciclador',
  SNAKES_LADDERS: 'Escaleras y Serpientes',
  DUAL_QUEST: 'Dual Quest',
  DUAL_QUEST_PIXI: 'Lumen y Gota',
  TRUE_FALSE_MAZE: 'el Laberinto Verdadero o Falso',
}

/**
 * El juego no se monta hasta continuar: no hay relojes, controles ni salas activos detrás.
 *
 * La guía es un mini tutorial jugable (ver tutorials/): cada paso pide hacer
 * el movimiento que enseña en un pedazo del juego real. Arriba a la derecha
 * siempre está "Saltar guía", para quien ya jugó antes (si esta guía ya se
 * vio en este navegador, el botón lo dice). El Laberinto V/F y el Camión
 * abren el mismo tutorial desde su propio botón de guía, dentro del juego.
 */
export function GameInstructionsGate({ kind, children }: { kind: InstructionKind; children: ReactNode }) {
  const [accepted, setAccepted] = useState(false)
  const [seenBefore] = useState(() => wasSeen(kind))
  if (accepted) return children
  const onContinue = () => {
    markSeen(kind)
    setAccepted(true)
  }
  return (
    <Modal onClose={onContinue} maxWidthClassName="max-w-[640px]" maxHeightClassName="max-h-[calc(100dvh-24px)]" ariaLabel={`Cómo jugar a ${GAME_NAMES[kind]}`}>
      <div className="space-y-3" data-game-instructions={kind}>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-accent/12 via-accent/5 to-transparent px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">Mini tutorial</p>
            <h2 className="text-[20px] leading-tight font-bold tracking-tight text-text-h">Aprende a jugar {GAME_NAMES[kind]}</h2>
          </div>
          <button
            type="button"
            data-skip-guide
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-[12.5px] font-semibold text-text-h transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
            onClick={onContinue}
          >
            {seenBefore ? 'Ya lo jugué · Saltar guía' : 'Saltar guía'}
            <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
        <InteractiveTutorial steps={tutorialStepsFor(kind)} onFinish={onContinue} />
      </div>
    </Modal>
  )
}
