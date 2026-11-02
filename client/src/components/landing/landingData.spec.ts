import { describe, expect, it } from 'vitest'
import { SAMPLE_STUDENTS, SAMPLE_UNIVERSITIES, buildLandingRanking } from './landingData'

const student = { rank: 1, name: 'Ana G.', university: 'U. Prueba', points: 800, gamesPlayed: 2, avatarConfig: { top: 'bob' } }
const university = { rank: 1, name: 'U. Prueba', players: 3, gamesPlayed: 5, points: 1700 }

describe('buildLandingRanking', () => {
  it('usa los datos de ejemplo cuando el servidor no responde', () => {
    const ranking = buildLandingRanking(null)
    expect(ranking.students).toBe(SAMPLE_STUDENTS)
    expect(ranking.studentsAreSample && ranking.universitiesAreSample).toBe(true)
  })

  it('usa los datos de ejemplo cuando la base está vacía', () => {
    const ranking = buildLandingRanking({ students: [], universities: [] })
    expect(ranking.students).toBe(SAMPLE_STUDENTS)
    expect(ranking.universities).toBe(SAMPLE_UNIVERSITIES)
    expect(ranking.studentsAreSample && ranking.universitiesAreSample).toBe(true)
  })

  it('usa los datos reales en cuanto hay uno solo', () => {
    const ranking = buildLandingRanking({ students: [student], universities: [university] })
    expect(ranking.studentsAreSample || ranking.universitiesAreSample).toBe(false)
    expect(ranking.students).toHaveLength(1)
    expect(ranking.students[0]).toMatchObject({ name: 'Ana G.', university: 'U. Prueba', career: null, points: 800 })
    expect(ranking.students[0].avatar).not.toBeNull()
    expect(ranking.universities[0]).toMatchObject({ name: 'U. Prueba', players: 3, matches: 5, points: 1700 })
  })

  it('mezcla: estudiantes reales con universidades de ejemplo si solo falta una lista', () => {
    const ranking = buildLandingRanking({ students: [student], universities: [] })
    expect(ranking.studentsAreSample).toBe(false)
    expect(ranking.universitiesAreSample).toBe(true)
    expect(ranking.universities).toBe(SAMPLE_UNIVERSITIES)
  })

  it('deja el avatar en null si la cuenta no tiene uno (se verán sus iniciales)', () => {
    const ranking = buildLandingRanking({ students: [{ ...student, avatarConfig: null }], universities: [] })
    expect(ranking.students[0].avatar).toBeNull()
  })
})
