import { describe, expect, it } from 'vitest'
import { emptyConcept, toConceptDraft, toConceptInputs, type ConceptDraft, type QuestionDraft } from './dominoContentDraft'
import {
  conceptLevelWarnings,
  creationLevelNotice,
  firstGapIndex,
  levelStatuses,
  questionLevelsOf,
  toggleQuestionLevel,
} from './dominoLevelsDraft'
import { levelAvailability } from './dominoLevels'

const question = (levels?: QuestionDraft['levels']): QuestionDraft => ({
  text: '¿Qué es?',
  options: ['A', 'B', 'C'],
  correctIndex: 0,
  explanation: 'Porque sí.',
  ...(levels ? { levels } : {}),
})

const concept = (i: number, over: Partial<ConceptDraft> = {}): ConceptDraft => ({
  ...emptyConcept(i),
  label: `C${i}`,
  application: 'Un caso real.',
  questions: [question(['MEDIUM']), question(['ADVANCED'])],
  ...over,
})

const six = (over: (i: number) => Partial<ConceptDraft> = () => ({})) => Array.from({ length: 6 }, (_, i) => concept(i, over(i)))

describe('levelStatuses', () => {
  it('todo completo: Intermedio y Universitario disponibles', () => {
    const s = levelStatuses(six())
    expect(s.MEDIUM.available && s.ADVANCED.available).toBe(true)
    expect(creationLevelNotice(six())).toBeNull()
  })

  it('legado sin casos: Universitario no disponible y se cuentan los conceptos', () => {
    const s = levelStatuses(six(() => ({ application: '', questions: [question()] })))
    expect(s.MEDIUM.available).toBe(true)
    expect(s.ADVANCED.available).toBe(false)
    expect(s.ADVANCED.details).toEqual(['faltan casos de aplicación en 6 conceptos'])
  })

  it('solo faltan algunos casos: singular y primer concepto', () => {
    const list = six((i) => (i === 3 ? { application: '  ' } : {}))
    const s = levelStatuses(list)
    expect(s.ADVANCED.details).toEqual(['faltan casos de aplicación en 1 concepto'])
    expect(s.ADVANCED.conceptIndexes).toEqual([3])
    expect(firstGapIndex(list, 'ADVANCED')).toBe(3)
    expect(firstGapIndex(list, 'MEDIUM')).toBeNull()
  })

  it('preguntas solo de un nivel dejan sin el otro', () => {
    const list = six((i) => (i === 1 ? { questions: [question(['MEDIUM'])] } : {}))
    const s = levelStatuses(list)
    expect(s.ADVANCED.details).toEqual(['faltan preguntas para Universitario en 1 concepto'])
    const onlyAdv = six((i) => (i === 2 ? { questions: [question(['ADVANCED'])] } : {}))
    expect(levelStatuses(onlyAdv).MEDIUM.conceptIndexes).toEqual([2])
  })

  it('pregunta sin levels sirve para ambos', () => {
    expect(levelStatuses(six(() => ({ questions: [question()] }))).ADVANCED.available).toBe(true)
  })
})

describe('creationLevelNotice (aviso previo a crear)', () => {
  it('mensaje por nivel faltante y primer concepto a completar', () => {
    const list = six((i) => (i >= 2 ? { application: '' } : {}))
    const notice = creationLevelNotice(list)!
    expect(notice.missing).toEqual(['ADVANCED'])
    expect(notice.messages).toEqual(['El nivel Universitario no estará disponible: faltan casos de aplicación en 4 conceptos.'])
    expect(notice.firstConceptIndex).toBe(2)
  })

  it('puede avisar de más de un nivel', () => {
    const list = six(() => ({ application: '', questions: [question(['MEDIUM'])] }))
    list[0] = concept(0, { questions: [question(['ADVANCED'])] })
    const notice = creationLevelNotice(list)!
    expect(notice.missing).toEqual(['MEDIUM', 'ADVANCED'])
    expect(notice.messages[0]).toContain('El nivel Intermedio no estará disponible')
    expect(notice.messages[1]).toContain('faltan casos de aplicación en 5 conceptos')
    expect(notice.firstConceptIndex).toBe(0)
  })
})

describe('niveles de la pregunta', () => {
  it('sin levels son ambos; toggle quita uno y vuelve a "ausente" al marcar ambos', () => {
    const q = question()
    expect(questionLevelsOf(q)).toEqual(['MEDIUM', 'ADVANCED'])
    const onlyMedium = toggleQuestionLevel(q, 'ADVANCED')
    expect(onlyMedium.levels).toEqual(['MEDIUM'])
    expect(toggleQuestionLevel(onlyMedium, 'ADVANCED')).not.toHaveProperty('levels')
  })

  it('no permite dejar la pregunta sin ningún nivel', () => {
    const onlyMedium = question(['MEDIUM'])
    expect(toggleQuestionLevel(onlyMedium, 'MEDIUM')).toBe(onlyMedium)
  })

  it('levels sobrevive al borrador guardado y al payload; ambos niveles no se envía', () => {
    const c = concept(0, { questions: [question(['ADVANCED']), question()] })
    const restored = toConceptDraft(JSON.parse(JSON.stringify(c)), 0)
    expect(restored.questions[0].levels).toEqual(['ADVANCED'])
    const payload = toConceptInputs([{ ...restored, label: 'X' }])[0].questions![0]
    expect(payload.levels).toEqual(['ADVANCED'])
    expect(toConceptInputs([restored])[0].questions![1]).not.toHaveProperty('levels')
  })

  it('levels inválido o con ambos se descarta al restaurar', () => {
    const raw = { label: 'A', questions: [{ text: 't', options: ['a', 'b', 'c'], correctIndex: 0, explanation: 'e', levels: ['MEDIUM', 'ADVANCED'] }] }
    expect(toConceptDraft(raw, 0).questions[0]).not.toHaveProperty('levels')
    const bad = { ...raw, questions: [{ ...raw.questions[0], levels: ['EASY', 5] }] }
    expect(toConceptDraft(bad, 0).questions[0]).not.toHaveProperty('levels')
  })
})

describe('conceptLevelWarnings', () => {
  it('lista lo que falta en el concepto', () => {
    expect(conceptLevelWarnings(concept(0))).toEqual([])
    expect(conceptLevelWarnings(concept(0, { application: '', questions: [question(['MEDIUM'])] }))).toEqual([
      'Sin pregunta para Universitario',
      'Sin caso para Universitario',
    ])
  })
})

describe('levelAvailability (vista de la sala)', () => {
  it('sala anterior sin dato: todo disponible', () => {
    expect(levelAvailability(undefined, 'ADVANCED')).toEqual({ available: true, reason: null })
  })
  it('nivel no disponible trae su motivo', () => {
    const views = { ADVANCED: { available: false, reason: 'Este juego no trae casos de aplicación' } }
    expect(levelAvailability(views, 'ADVANCED')).toEqual({ available: false, reason: 'Este juego no trae casos de aplicación' })
    expect(levelAvailability(views, 'MEDIUM').available).toBe(true)
  })
})
