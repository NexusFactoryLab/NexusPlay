import { CircleHelp, Layers, Rocket } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TOURNAMENT_GAME_LABEL, TOURNAMENT_LEVEL_INFO } from './tournamentLevels'
import type { TournamentGameType, TournamentLevel } from './tournamentLevels'
import './tournamentReveal.css'

/** Mismos iconos que usa la guía del torneo para cada juego. */
const GAME_ICON: Record<TournamentGameType, LucideIcon> = {
  GUESS_WHO: CircleHelp,
  DOMINO: Layers,
  TRUE_FALSE_MAZE: Rocket,
}

export type RevealedGame = { title: string; level: TournamentLevel; gameType: TournamentGameType }

/**
 * Revela el juego que salió sorteado para la ronda (issue #147): tres tarjetas «?» se
 * barajan y la del centro se voltea mostrando el juego. Va dentro de los avisos de ronda,
 * que ya se desvanecen solos; con `prefers-reduced-motion` aparece ya revelado.
 */
export function TournamentRoundReveal({ game }: { game: RevealedGame }) {
  const Icon = GAME_ICON[game.gameType]
  const level = TOURNAMENT_LEVEL_INFO[game.level]
  return (
    <div className="round-reveal" data-round-reveal={game.gameType}>
      <span className="sr-only">
        Esta ronda: {game.title}, {TOURNAMENT_GAME_LABEL[game.gameType]}, nivel {level.label}.
      </span>
      <div className="round-reveal__cards" aria-hidden="true">
        <span className="round-reveal__card round-reveal__card--side">?</span>
        <span className="round-reveal__card round-reveal__card--main">
          <span className="round-reveal__face round-reveal__face--back">?</span>
          <span className="round-reveal__face round-reveal__face--front">
            <Icon className="h-9 w-9" strokeWidth={1.75} />
            <span className="line-clamp-2 text-[15px] leading-tight font-bold">{game.title}</span>
          </span>
        </span>
        <span className="round-reveal__card round-reveal__card--side" style={{ animationDelay: '0.08s' }}>
          ?
        </span>
      </div>
      <p className="text-[13px] font-medium text-white/85" aria-hidden="true">
        {TOURNAMENT_GAME_LABEL[game.gameType]} · <span className="rounded-full bg-white/15 px-2 py-0.5 text-[12px] font-semibold">{level.label}</span>
      </p>
    </div>
  )
}
