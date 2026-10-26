import type { ConceptDraft, QuestionDraft } from './dominoContentDraft'

/**
 * Niveles de Dominexo según el contenido del formulario (espejo de dominoAvailableLevels del servidor,
 * pero con el detalle por concepto que necesita el aviso previo a crear). Funciones puras.
 *
 * - Fácil: siempre disponible.
 * - Intermedio: todo concepto necesita al menos una pregunta marcada para Intermedio.
 * - Universitario: todo concepto necesita caso de aplicación Y al menos una pregunta marcada para Universitario.
 * Una pregunta sin `levels` sirve para ambos.
 */

export type QuestionLevel = 'MEDIUM' | 'ADVANCED'
export const QUESTION_LEVELS: readonly QuestionLevel[] = ['MEDIUM', 'ADVANCED']

export const LEVEL_NAMES = { EASY: 'Fácil', MEDIUM: 'Intermedio', ADVANCED: 'Universitario' } as const

/** Niveles de una pregunta (ausente o vacío = ambos). */
export function questionLevelsOf(question: Pick<QuestionDraft, 'levels'>): QuestionLevel[] {
  return question.levels && question.levels.length > 0 ? QUESTION_LEVELS.filter((l) => question.levels!.includes(l)) : [...QUESTION_LEVELS]
}

export function serves(question: Pick<QuestionDraft, 'levels'>, level: QuestionLevel): boolean {
  return questionLevelsOf(question).includes(level)
}

/**
 * Alterna un nivel de la pregunta. Nunca deja la lista vacía (una pregunta debe servir a algún nivel):
 * quitar el único nivel marcado se ignora. Si quedan ambos se normaliza a "ausente" (sirve para ambos).
 */
export function toggleQuestionLevel(question: QuestionDraft, level: QuestionLevel): QuestionDraft {
  const current = questionLevelsOf(question)
  const next = current.includes(level) ? current.filter((l) => l !== level) : QUESTION_LEVELS.filter((l) => l === level || current.includes(l))
  if (next.length === 0) return question
  const { levels: _levels, ...rest } = question
  void _levels
  return next.length === QUESTION_LEVELS.length ? rest : { ...rest, levels: next }
}

const hasText = (value: string) => value.trim().length > 0

/** Qué le falta a un concepto para cada nivel. */
export type ConceptLevelGaps = { missingCase: boolean; noMediumQuestion: boolean; noAdvancedQuestion: boolean }

export function conceptLevelGaps(concept: ConceptDraft): ConceptLevelGaps {
  return {
    missingCase: !hasText(concept.application),
    noMediumQuestion: !concept.questions.some((q) => serves(q, 'MEDIUM')),
    noAdvancedQuestion: !concept.questions.some((q) => serves(q, 'ADVANCED')),
  }
}

/** Etiquetas cortas de lo que falta en un concepto (para tarjetas y revisión). */
export function conceptLevelWarnings(concept: ConceptDraft): string[] {
  const gaps = conceptLevelGaps(concept)
  const out: string[] = []
  if (gaps.noMediumQuestion) out.push('Sin pregunta para Intermedio')
  if (gaps.noAdvancedQuestion) out.push('Sin pregunta para Universitario')
  if (gaps.missingCase) out.push('Sin caso para Universitario')
  return out
}

export type LevelStatus = {
  level: 'MEDIUM' | 'ADVANCED'
  available: boolean
  /** Conceptos que impiden el nivel (en orden). */
  conceptIndexes: number[]
  /** Frases de qué falta, p. ej. "faltan casos de aplicación en 3 conceptos". */
  details: string[]
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Estado de Intermedio y Universitario con el detalle de lo que falta. Fácil siempre está disponible. */
export function levelStatuses(concepts: ConceptDraft[]): { MEDIUM: LevelStatus; ADVANCED: LevelStatus } {
  const gaps = concepts.map(conceptLevelGaps)
  const idx = (pick: (g: ConceptLevelGaps) => boolean) => gaps.flatMap((g, i) => (pick(g) ? [i] : []))

  const mediumIdx = idx((g) => g.noMediumQuestion)
  const caseIdx = idx((g) => g.missingCase)
  const advQuestionIdx = idx((g) => g.noAdvancedQuestion)

  const medium: LevelStatus = {
    level: 'MEDIUM',
    available: mediumIdx.length === 0,
    conceptIndexes: mediumIdx,
    details: mediumIdx.length ? [`faltan preguntas para Intermedio en ${count(mediumIdx.length, 'concepto', 'conceptos')}`] : [],
  }
  const advancedIdx = [...new Set([...caseIdx, ...advQuestionIdx])].sort((a, b) => a - b)
  const advancedDetails = [
    ...(caseIdx.length ? [`faltan casos de aplicación en ${count(caseIdx.length, 'concepto', 'conceptos')}`] : []),
    ...(advQuestionIdx.length ? [`faltan preguntas para Universitario en ${count(advQuestionIdx.length, 'concepto', 'conceptos')}`] : []),
  ]
  const advanced: LevelStatus = { level: 'ADVANCED', available: advancedIdx.length === 0, conceptIndexes: advancedIdx, details: advancedDetails }
  return { MEDIUM: medium, ADVANCED: advanced }
}

export type CreationLevelNotice = {
  /** Niveles que no quedarán disponibles. */
  missing: Array<'MEDIUM' | 'ADVANCED'>
  /** Un mensaje por nivel, listo para mostrar. */
  messages: string[]
  /** Primer concepto con faltante, al que lleva "Completar ahora". */
  firstConceptIndex: number
}

/** Aviso previo a crear: `null` si todos los niveles quedarán disponibles. */
export function creationLevelNotice(concepts: ConceptDraft[]): CreationLevelNotice | null {
  const statuses = levelStatuses(concepts)
  const missing = (['MEDIUM', 'ADVANCED'] as const).filter((level) => !statuses[level].available)
  if (missing.length === 0) return null
  const messages = missing.map((level) => `El nivel ${LEVEL_NAMES[level]} no estará disponible: ${statuses[level].details.join(' y ')}.`)
  const first = Math.min(...missing.flatMap((level) => statuses[level].conceptIndexes))
  return { missing, messages, firstConceptIndex: first }
}

/** Primer concepto con faltante de un nivel concreto (para "ir al primero incompleto"); `null` si no hay. */
export function firstGapIndex(concepts: ConceptDraft[], level: 'MEDIUM' | 'ADVANCED'): number | null {
  return levelStatuses(concepts)[level].conceptIndexes[0] ?? null
}
