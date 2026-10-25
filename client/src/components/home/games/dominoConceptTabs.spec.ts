import { describe, expect, it } from 'vitest'
import { emptyConcept, type ConceptDraft, type QuestionDraft } from './dominoContentDraft'
import {
  addQuestionForLevel,
  compactLevelChips,
  questionsForLevel,
  removeEffect,
  removeQuestionFromLevel,
  setShared,
  tabForWarning,
  tabHint,
  tabStatus,
} from './dominoConceptTabs'

const q = (text: string, levels?: QuestionDraft['levels']): QuestionDraft => ({
  text,
  options: ['A', 'B', 'C'],
  correctIndex: 0,
  explanation: 'e',
  ...(levels ? { levels } : {}),
})

const concept = (over: Partial<ConceptDraft> = {}): ConceptDraft => ({
  ...emptyConcept(0),
  label: 'Sol',
  definition: 'Estrella.',
  example: 'El sol de la mañana.',
  application: 'Un caso real.',
  questions: [q('compartida'), q('solo M', ['MEDIUM']), q('solo U', ['ADVANCED'])],
  ...over,
})

describe('questionsForLevel (qué ve cada pestaña)', () => {
  it('Intermedio: las marcadas MEDIUM y las compartidas; Universitario: ADVANCED y compartidas', () => {
    const c = concept()
    expect(questionsForLevel(c, 'MEDIUM').map((e) => e.question.text)).toEqual(['compartida', 'solo M'])
    expect(questionsForLevel(c, 'ADVANCED').map((e) => e.question.text)).toEqual(['compartida', 'solo U'])
  })

  it('conserva la posición en el banco y marca las compartidas', () => {
    const list = questionsForLevel(concept(), 'ADVANCED')
    expect(list.map((e) => e.index)).toEqual([0, 2])
    expect(list.map((e) => e.shared)).toEqual([true, false])
  })

  it('preguntas sin levels (juegos viejos) salen en las dos pestañas', () => {
    const c = concept({ questions: [q('vieja')] })
    expect(questionsForLevel(c, 'MEDIUM')).toHaveLength(1)
    expect(questionsForLevel(c, 'ADVANCED')).toHaveLength(1)
  })
})

describe('compartir / dejar de compartir', () => {
  it('compartir quita la marca (sirve para ambos) y dejar de compartir deja solo el nivel actual', () => {
    const c = concept()
    const shared = setShared(c, 1, 'MEDIUM', true)
    expect(shared.questions[1]).not.toHaveProperty('levels')
    expect(questionsForLevel(shared, 'ADVANCED').map((e) => e.question.text)).toContain('solo M')
    const exclusive = setShared(shared, 1, 'ADVANCED', false)
    expect(exclusive.questions[1].levels).toEqual(['ADVANCED'])
  })

  it('desde la pestaña donde no está la pregunta no hace nada', () => {
    const c = concept()
    expect(setShared(c, 1, 'ADVANCED', true)).toBe(c)
  })

  it('una pregunta nunca queda sin nivel: dejar de compartir conserva el de la pestaña actual', () => {
    const c = concept()
    for (const from of ['MEDIUM', 'ADVANCED'] as const) {
      const out = setShared(c, 0, from, false)
      expect(out.questions[0].levels).toEqual([from])
    }
  })
})

describe('añadir y quitar', () => {
  it('la pregunta nueva nace exclusiva del nivel de la pestaña', () => {
    const c = addQuestionForLevel(concept({ questions: [q('a')] }), 'ADVANCED')
    expect(c.questions[1].levels).toEqual(['ADVANCED'])
  })

  it('respeta el máximo de 6 preguntas', () => {
    const six = concept({ questions: Array.from({ length: 6 }, (_, i) => q(`p${i}`)) })
    expect(addQuestionForLevel(six, 'MEDIUM')).toBe(six)
  })

  it('quitar una compartida solo la saca de esa pestaña', () => {
    const c = concept()
    expect(removeEffect(c, 0, 'MEDIUM')).toBe('unshare')
    const out = removeQuestionFromLevel(c, 0, 'MEDIUM')
    expect(out.questions).toHaveLength(3)
    expect(out.questions[0].levels).toEqual(['ADVANCED'])
    expect(questionsForLevel(out, 'MEDIUM').map((e) => e.question.text)).not.toContain('compartida')
  })

  it('quitar una exclusiva la elimina', () => {
    const c = concept()
    expect(removeEffect(c, 1, 'MEDIUM')).toBe('delete')
    expect(removeQuestionFromLevel(c, 1, 'MEDIUM').questions.map((x) => x.text)).toEqual(['compartida', 'solo U'])
  })

  it('no se puede quitar la única pregunta del concepto', () => {
    const c = concept({ questions: [q('única', ['MEDIUM'])] })
    expect(removeEffect(c, 0, 'MEDIUM')).toBe('blocked')
    expect(removeQuestionFromLevel(c, 0, 'MEDIUM')).toBe(c)
  })
})

describe('estado de cada pestaña', () => {
  it('concepto completo: todas ok', () => {
    const c = concept()
    expect(['CONCEPT', 'EASY', 'MEDIUM', 'ADVANCED'].map((t) => tabStatus(c, t as never))).toEqual(['ok', 'ok', 'ok', 'ok'])
  })

  it('sin caso: Universitario avisa y lo dice', () => {
    const c = concept({ application: '' })
    expect(tabStatus(c, 'ADVANCED')).toBe('warn')
    expect(tabHint(c, 'ADVANCED')).toBe('Falta el caso de aplicación')
    expect(tabStatus(c, 'MEDIUM')).toBe('ok')
  })

  it('sin preguntas de un nivel o con una incompleta avisa en ESA pestaña', () => {
    const onlyM = concept({ questions: [q('m', ['MEDIUM'])] })
    expect(tabStatus(onlyM, 'ADVANCED')).toBe('warn')
    expect(tabHint(onlyM, 'ADVANCED')).toBe('Falta una pregunta de Universitario')
    const incomplete = concept({ questions: [{ ...q('x'), text: '' }] })
    expect(tabHint(incomplete, 'MEDIUM')).toBe('Hay una pregunta incompleta')
  })

  it('Fácil avisa sin ejemplo y Concepto sin nombre', () => {
    expect(tabStatus(concept({ example: '' }), 'EASY')).toBe('warn')
    expect(tabHint(concept({ label: '' }), 'CONCEPT')).toBe('Falta el nombre')
  })
})

describe('tabForWarning (nunca la misma pestaña para dos niveles)', () => {
  it('lleva a la pestaña del nivel mencionado', () => {
    expect(tabForWarning('Sin caso para Universitario')).toBe('ADVANCED')
    expect(tabForWarning('Sin pregunta para Intermedio')).toBe('MEDIUM')
    expect(tabForWarning('Sin ejemplo')).toBe('EASY')
    expect(tabForWarning('Pocas opciones')).toBe('MEDIUM')
    expect(tabForWarning('Opciones desbalanceadas')).toBe('MEDIUM')
    // Un aviso de opciones parecidas no se desvía por el texto de las opciones.
    expect(tabForWarning('Opciones parecidas: "Universitario" y "Universitaria"')).toBe('MEDIUM')
    expect(tabForWarning('Caso poco concreto: parece una definición')).toBe('ADVANCED')
    expect(tabForWarning('Ícono repetido')).toBe('CONCEPT')
  })
})

describe('compactLevelChips', () => {
  const six = (over: (i: number) => Partial<ConceptDraft> = () => ({})) => Array.from({ length: 6 }, (_, i) => concept({ label: `C${i}`, ...over(i) }))

  it('todo completo: tres chips con ✓', () => {
    expect(compactLevelChips(six()).map((c) => c.text)).toEqual(['Fácil ✓', 'Intermedio ✓', 'Universitario ✓'])
  })

  it('con faltantes muestra ⚠ y cuántos conceptos', () => {
    const chips = compactLevelChips(six((i) => (i < 3 ? { application: '' } : {})))
    expect(chips[2]).toMatchObject({ ok: false, count: 3, text: 'Universitario ⚠ 3' })
    expect(chips[1].ok).toBe(true)
  })
})
