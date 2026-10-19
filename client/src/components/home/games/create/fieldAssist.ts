import { createContext } from 'react'

/**
 * Lógica pura y contextos de ayuda al llenado manual (issue #52): ejemplos,
 * validación amable al salir del campo y resumen de avance por fase.
 */

export type IdentityKind = 'title' | 'description'

export const MIN_IDENTITY_LENGTH: Record<IdentityKind, number> = { title: 3, description: 10 }

/** Detecta si una etiqueta es la del título o la descripción del juego. */
export function identityKind(label: string): IdentityKind | null {
  const text = label.trim().toLowerCase()
  if (/^(t[ií]tulo|nombre del juego)/.test(text)) return 'title'
  if (/^descripci[oó]n/.test(text)) return 'description'
  return null
}

export type FieldFeedback = { tone: 'ok' | 'hint'; text: string }

/** Mensaje corto y positivo al salir del campo; null si está vacío (no se regaña). */
export function identityFeedback(kind: IdentityKind, value: string): FieldFeedback | null {
  const length = value.trim().length
  if (length === 0) return null
  const missing = MIN_IDENTITY_LENGTH[kind] - length
  if (missing > 0) {
    return { tone: 'hint', text: `Casi: ${missing === 1 ? 'falta 1 carácter' : `faltan ${missing} caracteres`}.` }
  }
  return { tone: 'ok', text: kind === 'title' ? '¡Buen título!' : '¡Se entiende perfecto!' }
}

export type ExampleSet = { title: string; description: string }

const GENERIC_EXAMPLE: ExampleSet = {
  title: 'Repaso de la unidad 1',
  description: 'Un juego corto para repasar los conceptos clave de la clase.',
}

/** Ejemplos editables por tipo de juego (clave = título que muestra el formulario). */
const EXAMPLES: Record<string, ExampleSet> = {
  'MatchMente: parejas': {
    title: 'Animales y sus hábitats',
    description: 'Une cada animal con el lugar donde vive para repasar los ecosistemas.',
  },
  'MatchMente: conceptos opuestos': {
    title: 'Hábitos que cuidan el planeta',
    description: 'Une cada buena práctica ambiental con su contraparte que daña el entorno.',
  },
  'Identidad Oculta': {
    title: 'Adivina el país',
    description: 'Haz preguntas de sí o no para descubrir qué país escogió tu rival.',
  },
  Dominexo: {
    title: 'Dominó de la tabla periódica',
    description: 'Encadena cada elemento con su símbolo y gana quien se quede sin fichas.',
  },
  'Laberinto recolector': {
    title: 'Recicla en el laberinto',
    description: 'Recoge los residuos correctos y esquiva a los enemigos antes de que acabe el tiempo.',
  },
  'Escaleras y serpientes': {
    title: 'Escaleras de las matemáticas',
    description: 'Responde cada reto para avanzar por el tablero y llegar primero a la meta.',
  },
  'Dúo Lógico': {
    title: 'Fuego y Agua: misión lógica',
    description: 'Dos jugadores resuelven compuertas juntos para llegar a la salida del mapa.',
  },
  'Laberinto Verdadero o Falso': {
    title: 'Verdadero o falso: el cuerpo humano',
    description: 'Guía al robot a la sala correcta según si cada afirmación es verdadera o falsa.',
  },
}

export function examplesFor(gameTitle: string): ExampleSet {
  return EXAMPLES[gameTitle] ?? GENERIC_EXAMPLE
}

export type PhaseProgress = { ready: number; total: number }

export type ProgressSummary = {
  /** 0..1 */
  fraction: number
  label: string
  complete: boolean
  missing: number
}

export function summarizeProgress({ ready, total }: PhaseProgress): ProgressSummary {
  if (total <= 0) return { fraction: 0, label: '', complete: false, missing: 0 }
  const safeReady = Math.min(Math.max(ready, 0), total)
  const missing = total - safeReady
  return {
    fraction: safeReady / total,
    label: missing === 0 ? '¡Fase lista!' : `${safeReady} de ${total} listos`,
    complete: missing === 0,
    missing,
  }
}

/** Texto corto para junto al botón Siguiente: dice qué falta sin bloquear. */
export function missingHint(missing: number): string {
  if (missing <= 0) return 'Todo listo para continuar'
  return missing === 1 ? 'Te falta 1 campo' : `Te faltan ${missing} campos`
}

/** Ancho del segmento actual del header: nunca vacío para que se note que arrancó. */
export function headerSegmentFill(fraction: number): number {
  return Math.round((0.12 + 0.88 * Math.min(Math.max(fraction, 0), 1)) * 100) / 100
}

export type FieldAssistValue = { examples: ExampleSet }
/** Lo provee GameFormShell; TextField lo usa para ejemplos y feedback amable. */
export const FieldAssistContext = createContext<FieldAssistValue | null>(null)

/** Avance de la fase actual (campos obligatorios listos / total), medido por el shell. */
export const PhaseProgressContext = createContext<PhaseProgress | null>(null)
