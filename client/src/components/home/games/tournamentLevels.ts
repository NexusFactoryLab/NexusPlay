/** Complejidad de un juego dentro del torneo (issue #102). Debe coincidir con TOURNAMENT_LEVELS del servidor. */
export type TournamentLevel = 'EASY' | 'MEDIUM' | 'HARD'

/** Juegos que tienen torneo. */
export type TournamentGameType = 'GUESS_WHO' | 'DOMINO'

export const TOURNAMENT_GAME_LABEL: Record<TournamentGameType, string> = {
  GUESS_WHO: '¿Quién Es?',
  DOMINO: 'Dominó',
}

/** Qué cambia cada nivel en cada juego (el texto corto que ve el administrador al elegirlo). */
export const TOURNAMENT_LEVEL_DETAIL: Record<TournamentGameType, Record<TournamentLevel, string>> = {
  GUESS_WHO: {
    EASY: '12 tarjetas · 45 s por turno · bot básico',
    MEDIUM: '18 tarjetas · 30 s por turno · bot intermedio',
    HARD: '24 tarjetas · 20 s por turno · bot experto',
  },
  DOMINO: {
    EASY: 'Sin preguntas · fichas sueltas · bot al azar',
    MEDIUM: 'Pregunta antes de cada jugada · bot intermedio',
    HARD: 'Pregunta con caso de aplicación · bot experto',
  },
}

export const TOURNAMENT_LEVEL_ORDER: TournamentLevel[] = ['EASY', 'MEDIUM', 'HARD']

export const TOURNAMENT_LEVEL_INFO: Record<
  TournamentLevel,
  { label: string; audience: string; detail: string; tone: string }
> = {
  EASY: {
    label: 'Fácil',
    audience: 'Niños',
    detail: '12 tarjetas · 45 s por turno · bot básico',
    tone: 'text-[#16a34a] border-[#16a34a]/40 bg-[#16a34a]/10',
  },
  MEDIUM: {
    label: 'Medio',
    audience: 'Adolescentes',
    detail: '18 tarjetas · 30 s por turno · bot intermedio',
    tone: 'text-[#d97706] border-[#d97706]/40 bg-[#d97706]/10',
  },
  HARD: {
    label: 'Difícil',
    audience: 'Universitarios',
    detail: '24 tarjetas · 20 s por turno · bot experto',
    tone: 'text-[#dc2626] border-[#dc2626]/40 bg-[#dc2626]/10',
  },
}
