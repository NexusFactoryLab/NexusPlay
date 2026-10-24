import { DOMINO_ICON_KEYS, MAX_DOMINO_CONCEPTS, MIN_DOMINO_CONCEPTS } from './dominoTypes'
import { DOMINO_TILE_SUGGESTED_COLORS } from './dominoTileVisualTokens'
import type { DominoConceptInput } from '../../../services/game.service'

/** Límites iguales a los del validador del servidor (domino.content-validator.ts). */
export const DOMINO_LIMITS = {
  definition: 300,
  example: 300,
  application: 400,
  questionText: 300,
  option: 120,
  explanation: 400,
  minOptions: 3,
  maxOptions: 4,
  maxQuestions: 6,
} as const

/** Una pregunta en edición. `correctIndex: null` = el creador aún no marcó la respuesta correcta. */
export type QuestionDraft = {
  text: string
  options: string[]
  correctIndex: number | null
  explanation: string
}

export type ConceptDraft = {
  label: string
  icon: string
  color: string
  /** Opcionales: Fácil (definición y ejemplo) y Universitario (caso de aplicación). */
  definition: string
  example: string
  application: string
  /** La primera pregunta es obligatoria; hasta 6 en total. */
  questions: QuestionDraft[]
}

export function emptyQuestion(): QuestionDraft {
  return { text: '', options: ['', '', ''], correctIndex: null, explanation: '' }
}

/** Paleta sugerida: colores bien diferenciables entre sí, para que las mitades de ficha no se confundan de un vistazo. */
export function emptyConcept(index: number): ConceptDraft {
  return {
    label: '',
    icon: DOMINO_ICON_KEYS[index % DOMINO_ICON_KEYS.length],
    color: DOMINO_TILE_SUGGESTED_COLORS[index % DOMINO_TILE_SUGGESTED_COLORS.length],
    definition: '',
    example: '',
    application: '',
    questions: [emptyQuestion()],
  }
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

function toQuestionDraft(raw: unknown): QuestionDraft | null {
  if (typeof raw !== 'object' || raw === null) return null
  const q = raw as Record<string, unknown>
  const options = Array.isArray(q.options) ? q.options.map(asText).slice(0, DOMINO_LIMITS.maxOptions) : []
  while (options.length < DOMINO_LIMITS.minOptions) options.push('')
  const correct =
    typeof q.correctIndex === 'number' && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < options.length
      ? q.correctIndex
      : null
  return { text: asText(q.text), options, correctIndex: correct, explanation: asText(q.explanation) }
}

/**
 * Normaliza un concepto venido de un borrador guardado, de una adaptación o de la IA.
 * Compatible hacia atrás: los borradores viejos solo traían label/icon/color (sin
 * preguntas) y se completan con una pregunta vacía; `question` suelta pasa a banco de 1.
 */
export function toConceptDraft(raw: unknown, index: number): ConceptDraft {
  const base = emptyConcept(index)
  if (typeof raw !== 'object' || raw === null) return base
  const r = raw as Record<string, unknown>
  const source = Array.isArray(r.questions) ? r.questions : r.question !== undefined && r.question !== null ? [r.question] : []
  const questions = source
    .map(toQuestionDraft)
    .filter((q): q is QuestionDraft => q !== null)
    .slice(0, DOMINO_LIMITS.maxQuestions)
  return {
    label: asText(r.label),
    icon: typeof r.icon === 'string' && DOMINO_ICON_KEYS.includes(r.icon) ? r.icon : base.icon,
    color: typeof r.color === 'string' && r.color ? r.color : base.color,
    definition: asText(r.definition),
    example: asText(r.example),
    application: asText(r.application),
    questions: questions.length > 0 ? questions : [emptyQuestion()],
  }
}

/** Resultado de validar la fase de contenido: mensaje y, si aplica, concepto y pregunta a enfocar. */
export type ContentIssue = { message: string; conceptIndex?: number; questionIndex?: number }

/** Validación de una pregunta; `null` si está completa. El mensaje nombra lo que falta. */
export function questionIssue(q: QuestionDraft): string | null {
  if (!q.text.trim()) return 'escribe el texto de la pregunta'
  if (q.text.trim().length > DOMINO_LIMITS.questionText) return `el texto de la pregunta supera ${DOMINO_LIMITS.questionText} caracteres`
  const filled = q.options.map((o) => o.trim())
  if (filled.some((o) => !o)) return 'completa todas las opciones o quita las que sobren'
  if (filled.length < DOMINO_LIMITS.minOptions || filled.length > DOMINO_LIMITS.maxOptions) return 'usa 3 o 4 opciones'
  if (filled.some((o) => o.length > DOMINO_LIMITS.option)) return `cada opción admite hasta ${DOMINO_LIMITS.option} caracteres`
  if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) return 'las opciones no pueden repetirse'
  if (q.correctIndex === null || q.correctIndex < 0 || q.correctIndex >= filled.length) return 'marca cuál es la respuesta correcta'
  if (!q.explanation.trim()) return 'escribe la explicación de la respuesta'
  if (q.explanation.trim().length > DOMINO_LIMITS.explanation) return `la explicación supera ${DOMINO_LIMITS.explanation} caracteres`
  return null
}

/** true si el concepto tiene nombre y su pregunta obligatoria completa (para marcar la tarjeta como lista). */
export function isConceptComplete(concept: ConceptDraft | undefined): boolean {
  return !!concept && !!concept.label.trim() && concept.questions.length > 0 && questionIssue(concept.questions[0]) === null
}

/**
 * Valida la fase de contenido: entre 6 y 10 conceptos con nombre único y, por cada
 * uno, al menos UNA pregunta completa (las extra, si existen, también deben estar completas).
 */
export function validateDominoConcepts(concepts: ConceptDraft[]): ContentIssue | null {
  if (concepts.length < MIN_DOMINO_CONCEPTS) return { message: `Necesitas al menos ${MIN_DOMINO_CONCEPTS} conceptos.` }
  if (concepts.length > MAX_DOMINO_CONCEPTS) return { message: `El dominó admite como máximo ${MAX_DOMINO_CONCEPTS} conceptos.` }
  const emptyAt = concepts.findIndex((c) => !c.label.trim())
  if (emptyAt !== -1) return { message: 'Cada concepto necesita un nombre antes de crear el juego.', conceptIndex: emptyAt }
  const labels = concepts.map((c) => c.label.trim().toLowerCase())
  const duplicateAt = labels.findIndex((label, i) => labels.indexOf(label) !== i)
  if (duplicateAt !== -1) return { message: 'No puede haber dos conceptos con el mismo nombre.', conceptIndex: duplicateAt }

  for (const [conceptIndex, concept] of concepts.entries()) {
    const name = concept.label.trim()
    for (const [field, max, title] of [
      ['definition', DOMINO_LIMITS.definition, 'La definición'],
      ['example', DOMINO_LIMITS.example, 'El ejemplo'],
      ['application', DOMINO_LIMITS.application, 'El caso de aplicación'],
    ] as const) {
      if (concept[field].trim().length > max) {
        return { message: `${title} de "${name}" supera ${max} caracteres.`, conceptIndex }
      }
    }
    if (concept.questions.length < 1) return { message: `"${name}" necesita al menos una pregunta.`, conceptIndex }
    const texts = new Set<string>()
    for (const [questionIndex, question] of concept.questions.entries()) {
      const issue = questionIssue(question)
      if (issue) {
        const which = questionIndex === 0 ? 'la pregunta obligatoria' : `la pregunta ${questionIndex + 1}`
        return { message: `En "${name}", en ${which}: ${issue}.`, conceptIndex, questionIndex }
      }
      const key = question.text.trim().toLowerCase().replace(/\s+/g, ' ')
      if (texts.has(key)) {
        return { message: `En "${name}" hay dos preguntas con el mismo texto (pregunta ${questionIndex + 1}).`, conceptIndex, questionIndex }
      }
      texts.add(key)
    }
  }
  return null
}

/** Payload de creación: solo manda los opcionales que se llenaron. */
export function toConceptInputs(concepts: ConceptDraft[]): DominoConceptInput[] {
  return concepts.map((c) => ({
    label: c.label.trim(),
    icon: c.icon,
    color: c.color,
    ...(c.definition.trim() ? { definition: c.definition.trim() } : {}),
    ...(c.example.trim() ? { example: c.example.trim() } : {}),
    ...(c.application.trim() ? { application: c.application.trim() } : {}),
    questions: c.questions.map((q) => ({
      text: q.text.trim(),
      options: q.options.map((o) => o.trim()),
      correctIndex: q.correctIndex as number,
      explanation: q.explanation.trim(),
    })),
  }))
}
