import { describe, expect, it } from 'vitest'
import {
  emptyConcept,
  emptyQuestion,
  isConceptComplete,
  questionIssue,
  toConceptDraft,
  toConceptInputs,
  validateDominoConcepts,
  type ConceptDraft,
  type QuestionDraft,
} from './dominoContentDraft'

const goodQuestion = (text = '¿Qué es?'): QuestionDraft => ({
  text,
  options: ['A', 'B', 'C'],
  correctIndex: 1,
  explanation: 'Porque sí.',
})

/** Seis conceptos completos con una pregunta cada uno. */
function validConcepts(): ConceptDraft[] {
  return Array.from({ length: 6 }, (_, i) => ({ ...emptyConcept(i), label: `Concepto ${i}`, questions: [goodQuestion()] }))
}

describe('questionIssue', () => {
  it('acepta una pregunta completa de 3 o 4 opciones', () => {
    expect(questionIssue(goodQuestion())).toBeNull()
    expect(questionIssue({ ...goodQuestion(), options: ['A', 'B', 'C', 'D'], correctIndex: 3 })).toBeNull()
  })

  it.each([
    ['sin texto', { text: ' ' }, /texto de la pregunta/],
    ['opción vacía', { options: ['A', '', 'C'] }, /opciones/],
    ['opciones repetidas', { options: ['A', 'a', 'C'] }, /repetirse/],
    ['sin respuesta correcta', { correctIndex: null }, /respuesta correcta/],
    ['sin explicación', { explanation: '' }, /explicación/],
    ['opción demasiado larga', { options: ['A', 'x'.repeat(121), 'C'] }, /120/],
  ])('rechaza %s', (_name, patch, message) => {
    expect(questionIssue({ ...goodQuestion(), ...patch } as QuestionDraft)).toMatch(message)
  })
})

describe('validateDominoConcepts', () => {
  it('acepta 6 conceptos con 1 pregunta completa cada uno', () => {
    expect(validateDominoConcepts(validConcepts())).toBeNull()
  })

  it('exige al menos 6 conceptos y nombres únicos', () => {
    expect(validateDominoConcepts(validConcepts().slice(0, 5))?.message).toMatch(/al menos 6/)
    const repeated = validConcepts()
    repeated[3].label = 'concepto 0'
    expect(validateDominoConcepts(repeated)).toMatchObject({ conceptIndex: 3, message: expect.stringMatching(/mismo nombre/) })
  })

  it('exige una pregunta completa por concepto y señala cuál y dónde', () => {
    const concepts = validConcepts()
    concepts[2].questions = [emptyQuestion()]
    const issue = validateDominoConcepts(concepts)
    expect(issue).toMatchObject({ conceptIndex: 2, questionIndex: 0 })
    expect(issue?.message).toContain('"Concepto 2"')
    expect(issue?.message).toContain('pregunta obligatoria')
  })

  it('las preguntas extra también deben estar completas y no repetirse', () => {
    const concepts = validConcepts()
    concepts[1].questions = [goodQuestion('Uno'), { ...goodQuestion('Dos'), correctIndex: null }]
    expect(validateDominoConcepts(concepts)).toMatchObject({ conceptIndex: 1, questionIndex: 1 })
    concepts[1].questions = [goodQuestion('Uno'), goodQuestion('  UNO ')]
    expect(validateDominoConcepts(concepts)?.message).toMatch(/mismo texto/)
  })

  it('los campos opcionales vacíos son válidos y los demasiado largos no', () => {
    const concepts = validConcepts()
    concepts[0].definition = ''
    expect(validateDominoConcepts(concepts)).toBeNull()
    concepts[0].application = 'x'.repeat(401)
    expect(validateDominoConcepts(concepts)).toMatchObject({ conceptIndex: 0, message: expect.stringMatching(/aplicación/) })
  })
})

describe('toConceptDraft (compatibilidad hacia atrás)', () => {
  it('un borrador viejo solo con label/icon/color gana una pregunta vacía', () => {
    const draft = toConceptDraft({ label: 'Sol', icon: 'sun', color: '#f59e0b' }, 0)
    expect(draft).toMatchObject({ label: 'Sol', icon: 'sun', definition: '', example: '', application: '' })
    expect(draft.questions).toEqual([emptyQuestion()])
    expect(isConceptComplete(draft)).toBe(false)
  })

  it('carga lo que genera la IA: campos opcionales y banco de preguntas', () => {
    const draft = toConceptDraft(
      {
        label: 'Sol', icon: 'sun', color: '#f59e0b', definition: 'D', example: 'E', application: 'A',
        questions: [{ text: 'Q1', options: ['a', 'b', 'c'], correctIndex: 2, explanation: 'x' }, { text: 'Q2', options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'y' }],
      },
      0,
    )
    expect(draft.definition).toBe('D')
    expect(draft.questions).toHaveLength(2)
    expect(draft.questions[0].correctIndex).toBe(2)
    expect(isConceptComplete(draft)).toBe(true)
  })

  it('convierte una question suelta en banco de 1, rellena opciones y descarta correctIndex inválido', () => {
    const draft = toConceptDraft({ label: 'X', question: { text: 'Q', options: ['a'], correctIndex: 9, explanation: 'e' } }, 1)
    expect(draft.questions[0].options).toHaveLength(3)
    expect(draft.questions[0].correctIndex).toBeNull()
  })

  it('ícono desconocido vuelve a uno del catálogo y el banco se acota a 6', () => {
    const q = (n: number) => ({ text: `Q${n}`, options: ['a', 'b', 'c'], correctIndex: 0, explanation: 'e' })
    const draft = toConceptDraft({ label: 'X', icon: 'noExiste', questions: Array.from({ length: 9 }, (_, n) => q(n)) }, 0)
    expect(draft.icon).not.toBe('noExiste')
    expect(draft.questions).toHaveLength(6)
  })
})

describe('toConceptInputs', () => {
  it('recorta textos, omite opcionales vacíos y envía las preguntas con respuesta correcta', () => {
    const concepts = validConcepts()
    concepts[0].definition = ' Def '
    const [first, second] = toConceptInputs(concepts)
    expect(first.definition).toBe('Def')
    expect(second).not.toHaveProperty('definition')
    expect(first.questions?.[0]).toEqual({ text: '¿Qué es?', options: ['A', 'B', 'C'], correctIndex: 1, explanation: 'Porque sí.' })
  })
})
