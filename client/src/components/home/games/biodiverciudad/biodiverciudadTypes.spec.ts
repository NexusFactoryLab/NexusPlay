import { describe, expect, it } from 'vitest'
import {
  newDilemmaOptionDraft,
  newQuestionDraft,
  newStationDraft,
  toStationInputs,
  validateStations,
  type StationDraft,
} from './biodiverciudadTypes'

function completeQuestion(n: number) {
  return newQuestionDraft({
    prompt: `Pregunta ${n} sobre ciudades sostenibles`,
    options: [`Uno ${n}`, `Dos ${n}`, `Tres ${n}`, `Cuatro ${n}`],
    correctIndex: 1,
    explanation: 'Porque lo dice el libro.',
    citationAuthor: 'Maddox',
    citationPage: '37',
  })
}

function completeStation(overrides: Partial<Omit<StationDraft, 'key'>> = {}) {
  return newStationDraft({
    region: 'Amazonia y Orinoquia',
    location: 'Leticia y Puerto Asís',
    challenge: 'Crecimiento urbano y saneamiento',
    reward: 'Certificado Amazónico',
    deliverable: 'Ficha de tres renglones',
    questions: [completeQuestion(1), completeQuestion(2), completeQuestion(3)],
    dilemmaScenario: 'Un escenario ficticio con suficiente texto.',
    dilemmaOptions: [
      newDilemmaOptionDraft({ label: 'Decisión no sostenible', sustainable: false }),
      newDilemmaOptionDraft({ label: 'Decisión sostenible', sustainable: true }),
    ],
    ...overrides,
  })
}

describe('validateStations', () => {
  it('acepta una estación completa', () => {
    expect(validateStations([completeStation()])).toBeNull()
  })

  it('una estación nueva está vacía y no pasa', () => {
    expect(validateStations([newStationDraft()])?.message).toMatch(/región/)
  })

  it('exige la cita del libro (autor y página) en cada pregunta', () => {
    const questions = [completeQuestion(1), completeQuestion(2), { ...completeQuestion(3), citationAuthor: '' }]
    expect(validateStations([completeStation({ questions })])?.message).toMatch(/autor de la cita/)

    const noPage = [completeQuestion(1), completeQuestion(2), { ...completeQuestion(3), citationPage: 'abc' }]
    expect(validateStations([completeStation({ questions: noPage })])?.message).toMatch(/página válida/)
  })

  it('exige marcar la opción correcta', () => {
    const questions = [completeQuestion(1), completeQuestion(2), { ...completeQuestion(3), correctIndex: null }]
    expect(validateStations([completeStation({ questions })])?.message).toMatch(/opción es la correcta/)
  })

  it('señala la estación que falla', () => {
    const result = validateStations([completeStation(), completeStation({ region: '' })])
    expect(result).toEqual({ message: 'Estación 2: escribe la región.', stationIndex: 1 })
  })

  it('exige un dilema con una decisión sostenible y una que no lo es', () => {
    const allGood = [
      newDilemmaOptionDraft({ label: 'Primera sostenible', sustainable: true }),
      newDilemmaOptionDraft({ label: 'Segunda sostenible', sustainable: true }),
    ]
    expect(validateStations([completeStation({ dilemmaOptions: allGood })])?.message).toMatch(/no sostenible/)

    const noneGood = allGood.map((option) => ({ ...option, sustainable: false }))
    expect(validateStations([completeStation({ dilemmaOptions: noneGood })])?.message).toMatch(/al menos una decisión sostenible/)
  })
})

describe('toStationInputs', () => {
  it('convierte la página a número y omite el fragmento vacío', () => {
    const [station] = toStationInputs([completeStation()])
    expect(station.questions[0].citation).toEqual({ author: 'Maddox', page: 37 })
    expect(station.dilemma.fictional).toBe(true)
  })
})
