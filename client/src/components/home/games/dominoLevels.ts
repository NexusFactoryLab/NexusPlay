import { GraduationCap, Sprout, Target, type LucideIcon } from 'lucide-react'
import type { DominoLevel } from './dominoTypes'

type LevelInfo = {
  label: string
  /** Una línea para tarjetas compactas. */
  short: string
  /** Detalle completo; solo se muestra bajo demanda o para el nivel seleccionado. */
  description: string
  icon: LucideIcon
  /** Color propio del nivel (verde, ámbar, violeta); se usa en iconos, bordes y fondos tenues, nunca para texto. */
  color: string
}

/** Textos de cada nivel de Dominexo: una sola fuente para el lobby, las instrucciones y la sala. */
export const DOMINO_LEVEL_INFO: Record<DominoLevel, LevelInfo> = {
  EASY: {
    label: 'Fácil',
    short: 'Aprende jugando',
    description: 'Enfocado principalmente a niños: aprender jugando, con ejemplos a la vista.',
    icon: Sprout,
    color: '#16a34a',
  },
  MEDIUM: {
    label: 'Intermedio',
    short: 'Responde para jugar',
    description: 'Estudiantes de colegio de grados superiores: se responde una pregunta antes de colocar cada ficha.',
    icon: Target,
    color: '#d97706',
  },
  ADVANCED: {
    label: 'Universitario',
    short: 'Casos y aplicaciones',
    description: 'Razonamiento con casos reales: se responde una pregunta con su caso antes de colocar cada ficha.',
    icon: GraduationCap,
    color: '#7c3aed',
  },
}

export const DOMINO_LEVEL_ORDER: DominoLevel[] = ['EASY', 'MEDIUM', 'ADVANCED']

export type DominoLevelAvailabilityView = Partial<Record<DominoLevel, { available: boolean; reason: string | null }>> | undefined

/** Disponibilidad de un nivel en la sala; sin dato (sala anterior) se considera disponible. */
export function levelAvailability(
  availableLevels: DominoLevelAvailabilityView,
  level: DominoLevel,
): { available: boolean; reason: string | null } {
  const entry = availableLevels?.[level]
  return entry ? { available: entry.available, reason: entry.available ? null : entry.reason } : { available: true, reason: null }
}

/** Duraciones de turno sugeridas como chips en el lobby. */
export const DOMINO_TURN_PRESETS = [15, 25, 30, 60] as const

/** Milisegundos que la línea de retroalimentación queda visible tras colocar una ficha. */
export const DOMINO_FEEDBACK_MS = 2800
