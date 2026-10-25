import { MIN_DOMINO_CONCEPTS } from './dominoTypes'
import type { ConceptDraft, ContentIssue } from './dominoContentDraft'

/**
 * Lógica de la revisión del contenido de Dominexo generado por IA (funciones puras).
 *
 * Estados de un concepto:
 * - `pending`: lo generó la IA y el profesor aún no lo revisa.
 * - `approved`: aprobado (o editado, que cuenta como aprobar).
 * - sin `review`: no pasa por revisión (a mano, adaptado o borrador viejo): se trata como ya revisado.
 * - descartado: el concepto se quita de la lista (nunca por debajo del mínimo), así el
 *   borrador automático lo conserva simplemente al guardar la lista que queda.
 */

export type ReviewStatus = 'pending' | 'approved' | 'none'

/** Advertencia mínima que necesita esta lógica (la manda el servidor junto al borrador). */
export type ReviewWarningInput = { conceptIndex: number; label?: string; message: string }

export type ReviewProgress = {
  /** Conceptos que pasan por revisión (generados por IA). */
  total: number
  reviewed: number
  pending: number
  /** true si no queda nada por revisar (incluye el caso total = 0). */
  complete: boolean
}

export function reviewStatusOf(concept: ConceptDraft | undefined): ReviewStatus {
  if (!concept || !concept.review) return 'none'
  return concept.review
}

/**
 * Marca como pendientes los conceptos recién generados por IA y les adjunta sus
 * advertencias (casadas por posición y, si el servidor mandó el nombre, también por nombre).
 */
export function markAsAiGenerated(concepts: ConceptDraft[], warnings: ReviewWarningInput[] = []): ConceptDraft[] {
  return concepts.map((concept, index) => {
    const messages = warnings
      .filter((w) => w.conceptIndex === index && (w.label === undefined || w.label === concept.label))
      .map((w) => w.message)
    const unique = [...new Set(messages)]
    return { ...concept, review: 'pending', ...(unique.length > 0 ? { aiWarnings: unique } : {}) }
  })
}

function replaceAt(concepts: ConceptDraft[], index: number, update: (c: ConceptDraft) => ConceptDraft): ConceptDraft[] {
  if (index < 0 || index >= concepts.length) return concepts
  return concepts.map((concept, i) => (i === index ? update(concept) : concept))
}

/** Aprueba un concepto generado por IA; uno que no pasa por revisión queda igual. */
export function approveConcept(concepts: ConceptDraft[], index: number): ConceptDraft[] {
  return replaceAt(concepts, index, (c) => (c.review ? { ...c, review: 'approved' } : c))
}

/** Aplica la edición del profesor; si el concepto venía de la IA, editar cuenta como aprobar. */
export function editConcept(concepts: ConceptDraft[], index: number, next: ConceptDraft): ConceptDraft[] {
  return replaceAt(concepts, index, (c) => (c.review ? { ...next, review: 'approved' } : next))
}

/** Un concepto se puede descartar solo si quedan al menos `min` después de quitarlo. */
export function canDiscard(concepts: ConceptDraft[], min: number = MIN_DOMINO_CONCEPTS): boolean {
  return concepts.length > min
}

/** Descarta un concepto respetando el mínimo; si no se puede, devuelve la lista intacta. */
export function discardConcept(
  concepts: ConceptDraft[],
  index: number,
  min: number = MIN_DOMINO_CONCEPTS,
): { concepts: ConceptDraft[]; discarded: boolean } {
  if (index < 0 || index >= concepts.length || !canDiscard(concepts, min)) return { concepts, discarded: false }
  return { concepts: concepts.filter((_, i) => i !== index), discarded: true }
}

/** Índices de los conceptos de IA aún sin revisar, en orden. */
export function pendingIndexes(concepts: ConceptDraft[]): number[] {
  return concepts.flatMap((c, i) => (c.review === 'pending' ? [i] : []))
}

export function reviewProgress(concepts: ConceptDraft[]): ReviewProgress {
  const total = concepts.filter((c) => c.review !== undefined).length
  const pending = pendingIndexes(concepts).length
  return { total, reviewed: total - pending, pending, complete: pending === 0 }
}

/** Siguiente pendiente después de `from` (con vuelta al inicio); `null` si no queda ninguno. */
export function nextPendingIndex(concepts: ConceptDraft[], from: number): number | null {
  const pending = pendingIndexes(concepts)
  if (pending.length === 0) return null
  return pending.find((i) => i > from) ?? pending[0]
}

/**
 * Bloqueo de "Crear juego": mientras haya conceptos de IA sin revisar devuelve el motivo,
 * con el nombre de los que faltan y el primero para saltar a él. `null` si todo está revisado.
 */
export function reviewBlockIssue(concepts: ConceptDraft[]): ContentIssue | null {
  const pending = pendingIndexes(concepts)
  if (pending.length === 0) return null
  const names = pending.map((i) => concepts[i].label.trim() || `Concepto ${i + 1}`)
  const shown = names.slice(0, 4).map((n) => `"${n}"`).join(', ')
  const rest = names.length > 4 ? ` y ${names.length - 4} más` : ''
  const noun = pending.length === 1 ? 'concepto generado por IA' : 'conceptos generados por IA'
  return { message: `Falta revisar ${pending.length} ${noun}: ${shown}${rest}. Apruébalos, edítalos o descártalos.`, conceptIndex: pending[0] }
}
