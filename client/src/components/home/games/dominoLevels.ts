import type { DominoLevel } from './dominoTypes'

/** Textos de cada nivel de Dominexo: una sola fuente para el lobby, las instrucciones y la sala. */
export const DOMINO_LEVEL_INFO: Record<DominoLevel, { label: string; description: string }> = {
  EASY: {
    label: 'Fácil',
    description: 'Enfocado principalmente a niños: aprender jugando, con ejemplos a la vista.',
  },
  MEDIUM: {
    label: 'Intermedio',
    description: 'Estudiantes de colegio de grados superiores: se responde una pregunta antes de colocar cada ficha.',
  },
  ADVANCED: {
    label: 'Universitario',
    description: 'Razonamiento con casos y aplicaciones de cada concepto.',
  },
}

export const DOMINO_LEVEL_ORDER: DominoLevel[] = ['EASY', 'MEDIUM', 'ADVANCED']

/** Milisegundos que la línea de retroalimentación queda visible tras colocar una ficha. */
export const DOMINO_FEEDBACK_MS = 2800
