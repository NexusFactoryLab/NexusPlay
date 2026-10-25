import { describe, expect, it } from 'vitest'
import { emptyConcept, toConceptDraft, type ConceptDraft } from './dominoContentDraft'
import {
  approveConcept,
  canDiscard,
  discardConcept,
  editConcept,
  markAsAiGenerated,
  nextPendingIndex,
  pendingIndexes,
  reviewBlockIssue,
  reviewProgress,
  reviewStatusOf,
} from './dominoReview'

function concepts(count: number): ConceptDraft[] {
  return Array.from({ length: count }, (_, i) => ({ ...emptyConcept(i), label: `Concepto ${i}` }))
}

describe('markAsAiGenerated', () => {
  it('marca todos como pendientes y adjunta advertencias sin duplicados', () => {
    const marked = markAsAiGenerated(concepts(6), [
      { conceptIndex: 1, label: 'Concepto 1', message: 'Pocas opciones' },
      { conceptIndex: 1, label: 'Concepto 1', message: 'Pocas opciones' },
      { conceptIndex: 1, label: 'Concepto 1', message: 'Ícono repetido' },
      { conceptIndex: 2, label: 'Otro nombre', message: 'Sin ejemplo' },
    ])
    expect(marked.every((c) => c.review === 'pending')).toBe(true)
    expect(marked[1].aiWarnings).toEqual(['Pocas opciones', 'Ícono repetido'])
    expect(marked[2].aiWarnings).toBeUndefined()
    expect(marked[0].aiWarnings).toBeUndefined()
  })
})

describe('estados y progreso', () => {
  it('sin review => no pasa por revisión y no cuenta en el progreso', () => {
    const list = concepts(6)
    expect(reviewStatusOf(list[0])).toBe('none')
    expect(reviewProgress(list)).toEqual({ total: 0, reviewed: 0, pending: 0, complete: true })
  })

  it('cuenta revisados sobre los generados por IA', () => {
    let list = markAsAiGenerated(concepts(6))
    expect(reviewProgress(list)).toMatchObject({ total: 6, reviewed: 0, pending: 6, complete: false })
    list = approveConcept(list, 0)
    list = approveConcept(list, 3)
    expect(reviewProgress(list)).toMatchObject({ total: 6, reviewed: 2, pending: 4, complete: false })
    expect(pendingIndexes(list)).toEqual([1, 2, 4, 5])
  })

  it('mezcla: los escritos a mano no entran en el total', () => {
    const list = [...markAsAiGenerated(concepts(3)), ...concepts(3)]
    expect(reviewProgress(list)).toMatchObject({ total: 3, pending: 3 })
  })

  it('aprobar un concepto manual lo deja igual', () => {
    const list = concepts(6)
    expect(approveConcept(list, 2)[2]).toEqual(list[2])
  })

  it('aprobar con índice fuera de rango no cambia nada', () => {
    const list = markAsAiGenerated(concepts(6))
    expect(approveConcept(list, 99)).toBe(list)
  })
})

describe('editar cuenta como aprobar', () => {
  it('un concepto pendiente editado queda aprobado con los cambios', () => {
    const list = markAsAiGenerated(concepts(6))
    const out = editConcept(list, 2, { ...list[2], label: 'Corregido' })
    expect(out[2]).toMatchObject({ label: 'Corregido', review: 'approved' })
    expect(reviewProgress(out).pending).toBe(5)
  })

  it('un concepto manual editado sigue sin revisión', () => {
    const list = concepts(6)
    expect(editConcept(list, 0, { ...list[0], label: 'X' })[0].review).toBeUndefined()
  })
})

describe('descartar', () => {
  it('quita el concepto si quedan al menos 6', () => {
    const list = markAsAiGenerated(concepts(8))
    const out = discardConcept(list, 1)
    expect(out.discarded).toBe(true)
    expect(out.concepts).toHaveLength(7)
    expect(out.concepts.map((c) => c.label)).not.toContain('Concepto 1')
  })

  it('no deja menos de 6 conceptos', () => {
    const list = markAsAiGenerated(concepts(6))
    expect(canDiscard(list)).toBe(false)
    const out = discardConcept(list, 0)
    expect(out.discarded).toBe(false)
    expect(out.concepts).toBe(list)
  })

  it('índice inválido no descarta', () => {
    expect(discardConcept(concepts(8), -1).discarded).toBe(false)
  })
})

describe('bloqueo de creación', () => {
  it('sin pendientes no bloquea (manuales y borradores viejos)', () => {
    expect(reviewBlockIssue(concepts(6))).toBeNull()
    const old = [0, 1, 2, 3, 4, 5].map((i) => toConceptDraft({ label: `C${i}`, icon: 'star', color: '#22c55e' }, i))
    expect(reviewBlockIssue(old)).toBeNull()
    expect(reviewProgress(old).complete).toBe(true)
  })

  it('con pendientes bloquea, nombra los que faltan y apunta al primero', () => {
    let list = markAsAiGenerated(concepts(6))
    list = approveConcept(list, 0)
    const issue = reviewBlockIssue(list)!
    expect(issue.conceptIndex).toBe(1)
    expect(issue.message).toContain('5 conceptos generados por IA')
    expect(issue.message).toContain('"Concepto 1"')
  })

  it('con uno solo usa singular y con muchos abrevia', () => {
    let list = markAsAiGenerated(concepts(10))
    expect(reviewBlockIssue(list)!.message).toContain('y 6 más')
    for (let i = 1; i < 10; i += 1) list = approveConcept(list, i)
    expect(reviewBlockIssue(list)!.message).toContain('1 concepto generado por IA')
  })

  it('se libera al aprobar todos', () => {
    let list = markAsAiGenerated(concepts(6))
    for (let i = 0; i < 6; i += 1) list = approveConcept(list, i)
    expect(reviewBlockIssue(list)).toBeNull()
  })
})

describe('nextPendingIndex', () => {
  it('salta al siguiente pendiente y da la vuelta', () => {
    let list = markAsAiGenerated(concepts(6))
    list = approveConcept(approveConcept(list, 1), 2)
    expect(nextPendingIndex(list, 0)).toBe(3)
    expect(nextPendingIndex(list, 5)).toBe(0)
  })

  it('devuelve null si no queda ninguno', () => {
    expect(nextPendingIndex(concepts(6), 0)).toBeNull()
  })
})

describe('compatibilidad con el borrador automático', () => {
  it('conserva review y advertencias al restaurar', () => {
    const saved = JSON.parse(
      JSON.stringify(markAsAiGenerated(concepts(6), [{ conceptIndex: 0, message: 'Pocas opciones' }])),
    ) as unknown[]
    const restored = saved.map((raw, i) => toConceptDraft(raw, i))
    expect(restored[0]).toMatchObject({ review: 'pending', aiWarnings: ['Pocas opciones'] })
    expect(reviewProgress(restored).pending).toBe(6)
  })

  it('ignora valores de review desconocidos', () => {
    expect(toConceptDraft({ label: 'A', review: 'raro', aiWarnings: [1, 'ok'] }, 0)).toMatchObject({ aiWarnings: ['ok'] })
    expect(toConceptDraft({ label: 'A', review: 'raro' }, 0).review).toBeUndefined()
  })
})
