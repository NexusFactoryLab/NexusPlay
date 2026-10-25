import { emptyQuestion, DOMINO_LIMITS, questionIssue, type ConceptDraft, type QuestionDraft } from './dominoContentDraft'
import { LEVEL_NAMES, levelStatuses, questionLevelsOf, serves, type QuestionLevel } from './dominoLevelsDraft'

/**
 * Lógica pura del panel del concepto, con una pestaña por nivel:
 * Concepto (nombre, ícono, color, definición) · Fácil (ejemplo) · Intermedio (solo preguntas) ·
 * Universitario (caso de aplicación + preguntas). Una pregunta puede estar en las dos pestañas
 * de preguntas ("compartida"); `levels` ausente = compartida (compatibilidad).
 */

export type ConceptTab = 'CONCEPT' | 'EASY' | 'MEDIUM' | 'ADVANCED'
export const CONCEPT_TABS: readonly ConceptTab[] = ['CONCEPT', 'EASY', 'MEDIUM', 'ADVANCED']

export type TabStatus = 'ok' | 'warn'

export type LevelQuestion = { question: QuestionDraft; index: number; shared: boolean }

/** Preguntas que ve una pestaña de nivel (las marcadas para él o sin marca), con su posición en el banco. */
export function questionsForLevel(concept: ConceptDraft, level: QuestionLevel): LevelQuestion[] {
  return concept.questions.flatMap((question, index) =>
    serves(question, level) ? [{ question, index, shared: questionLevelsOf(question).length === 2 }] : [],
  )
}

const other = (level: QuestionLevel): QuestionLevel => (level === 'MEDIUM' ? 'ADVANCED' : 'MEDIUM')

/**
 * Comparte (o deja de compartir) una pregunta con el OTRO nivel, desde la pestaña `from`.
 * Como la pestaña actual siempre la contiene, la pregunta nunca queda sin ningún nivel.
 * Compartida = sin `levels` (sirve para ambos).
 */
export function setShared(concept: ConceptDraft, qIndex: number, from: QuestionLevel, shared: boolean): ConceptDraft {
  const question = concept.questions[qIndex]
  if (!question || !serves(question, from)) return concept
  const next: QuestionDraft = { ...question }
  if (shared) delete next.levels
  else next.levels = [from]
  return { ...concept, questions: concept.questions.map((q, i) => (i === qIndex ? next : q)) }
}

/** Nueva pregunta vacía exclusiva del nivel de la pestaña; respeta el máximo del banco. */
export function addQuestionForLevel(concept: ConceptDraft, level: QuestionLevel): ConceptDraft {
  if (concept.questions.length >= DOMINO_LIMITS.maxQuestions) return concept
  return { ...concept, questions: [...concept.questions, { ...emptyQuestion(), levels: [level] }] }
}

export type RemoveEffect = 'unshare' | 'delete' | 'blocked'

/**
 * Qué pasa al quitar una pregunta desde una pestaña (decisión de diseño):
 * - compartida -> 'unshare': solo sale de ESTA pestaña y sigue en la otra (no se pierde contenido);
 * - exclusiva -> 'delete': se elimina; salvo que sea la única pregunta del concepto ('blocked').
 */
export function removeEffect(concept: ConceptDraft, qIndex: number, level: QuestionLevel): RemoveEffect {
  const question = concept.questions[qIndex]
  if (!question || !serves(question, level)) return 'blocked'
  if (questionLevelsOf(question).length === 2) return 'unshare'
  return concept.questions.length > 1 ? 'delete' : 'blocked'
}

export function removeQuestionFromLevel(concept: ConceptDraft, qIndex: number, level: QuestionLevel): ConceptDraft {
  const effect = removeEffect(concept, qIndex, level)
  if (effect === 'blocked') return concept
  if (effect === 'unshare') {
    // Se queda solo en el otro nivel.
    return {
      ...concept,
      questions: concept.questions.map((q, i) => (i === qIndex ? { ...q, levels: [other(level)] } : q)),
    }
  }
  return { ...concept, questions: concept.questions.filter((_, i) => i !== qIndex) }
}

const filled = (value: string) => value.trim().length > 0

/** Punto de estado de cada pestaña: ✓ completo / ⚠ falta algo. */
export function tabStatus(concept: ConceptDraft, tab: ConceptTab): TabStatus {
  switch (tab) {
    case 'CONCEPT':
      return filled(concept.label) && filled(concept.definition) ? 'ok' : 'warn'
    case 'EASY':
      return filled(concept.example) ? 'ok' : 'warn'
    case 'MEDIUM': {
      const list = questionsForLevel(concept, 'MEDIUM')
      return list.length > 0 && list.every((e) => questionIssue(e.question) === null) ? 'ok' : 'warn'
    }
    case 'ADVANCED': {
      const list = questionsForLevel(concept, 'ADVANCED')
      return filled(concept.application) && list.length > 0 && list.every((e) => questionIssue(e.question) === null) ? 'ok' : 'warn'
    }
  }
}

/** Lo que falta en una pestaña, en una frase corta (vacío si está completa). */
export function tabHint(concept: ConceptDraft, tab: ConceptTab): string {
  if (tabStatus(concept, tab) === 'ok') return ''
  switch (tab) {
    case 'CONCEPT':
      return !filled(concept.label) ? 'Falta el nombre' : 'Falta la definición (recomendada)'
    case 'EASY':
      return 'Falta el ejemplo (recomendado)'
    case 'MEDIUM':
      return questionsForLevel(concept, 'MEDIUM').length === 0 ? 'Falta una pregunta de Intermedio' : 'Hay una pregunta incompleta'
    case 'ADVANCED':
      return !filled(concept.application)
        ? 'Falta el caso de aplicación'
        : questionsForLevel(concept, 'ADVANCED').length === 0
          ? 'Falta una pregunta de Universitario'
          : 'Hay una pregunta incompleta'
  }
}

/** Pestaña que abre una advertencia de texto (la de niveles lleva a SU nivel; el resto, a Concepto). */
export function tabForWarning(text: string): ConceptTab {
  if (/universitario/i.test(text)) return 'ADVANCED'
  if (/intermedio/i.test(text)) return 'MEDIUM'
  if (/ejemplo/i.test(text)) return 'EASY'
  return 'CONCEPT'
}

export type CompactLevelChip = {
  level: 'EASY' | 'MEDIUM' | 'ADVANCED'
  label: string
  ok: boolean
  /** Conceptos que impiden el nivel (0 si está completo; Fácil siempre 0). */
  count: number
  /** Texto del chip: "Fácil ✓" o "Universitario ⚠ 3". */
  text: string
}

/** Franja compacta de niveles: un chip por nivel con ✓ o ⚠ y el número de conceptos que faltan. */
export function compactLevelChips(concepts: ConceptDraft[]): CompactLevelChip[] {
  const statuses = levelStatuses(concepts)
  const chip = (level: CompactLevelChip['level'], ok: boolean, count: number): CompactLevelChip => ({
    level,
    label: LEVEL_NAMES[level],
    ok,
    count,
    text: ok ? `${LEVEL_NAMES[level]} ✓` : `${LEVEL_NAMES[level]} ⚠ ${count}`,
  })
  return [
    chip('EASY', true, 0),
    chip('MEDIUM', statuses.MEDIUM.available, statuses.MEDIUM.conceptIndexes.length),
    chip('ADVANCED', statuses.ADVANCED.available, statuses.ADVANCED.conceptIndexes.length),
  ]
}
