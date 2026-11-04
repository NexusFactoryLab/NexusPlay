import { describe, expect, it } from 'vitest'
import { SAMPLE_STUDENTS, SAMPLE_UNIVERSITIES, buildLandingRanking } from './landingData'

const student = {
  rank: 1,
  name: 'Ana G.',
  university: 'U. Prueba',
  institutionType: 'UNIVERSITY' as const,
  program: 'Medicina',
  points: 800,
  gamesPlayed: 2,
  avatarConfig: { top: 'bob' },
}
const university = { rank: 1, name: 'U. Prueba', institutionType: 'UNIVERSITY' as const, players: 3, gamesPlayed: 5, points: 1700 }

describe('buildLandingRanking', () => {
  it('usa los datos de ejemplo cuando el servidor no responde', () => {
    const ranking = buildLandingRanking(null)
    expect(ranking.students).toBe(SAMPLE_STUDENTS)
    expect(ranking.studentsAreSample && ranking.universitiesAreSample).toBe(true)
    expect(ranking.updatedAt).toBeNull()
  })

  it('usa los datos de ejemplo cuando la base está vacía', () => {
    const ranking = buildLandingRanking({ students: [], universities: [] })
    expect(ranking.students).toBe(SAMPLE_STUDENTS)
    expect(ranking.universities).toBe(SAMPLE_UNIVERSITIES)
    expect(ranking.studentsAreSample && ranking.universitiesAreSample).toBe(true)
  })

  it('usa los datos reales en cuanto hay uno solo, con tipo y programa', () => {
    const ranking = buildLandingRanking({ students: [student], universities: [university], updatedAt: '2026-11-03T05:00:00.000Z' })
    expect(ranking.studentsAreSample || ranking.universitiesAreSample).toBe(false)
    expect(ranking.students).toHaveLength(1)
    expect(ranking.students[0]).toMatchObject({
      name: 'Ana G.',
      university: 'U. Prueba',
      institutionType: 'UNIVERSITY',
      program: 'Medicina',
      points: 800,
    })
    expect(ranking.students[0].avatar).not.toBeNull()
    expect(ranking.universities[0]).toMatchObject({ name: 'U. Prueba', institutionType: 'UNIVERSITY', players: 3, matches: 5, points: 1700 })
    expect(ranking.updatedAt).toBe('2026-11-03T05:00:00.000Z')
  })

  it('tolera un servidor sin la migración: sin tipo ni programa queda en null', () => {
    const legacyStudent = { rank: 1, name: 'Ana G.', university: 'U. Prueba', points: 800, gamesPlayed: 2, avatarConfig: null }
    const legacyUniversity = { rank: 1, name: 'U. Prueba', players: 3, gamesPlayed: 5, points: 1700 }
    const ranking = buildLandingRanking({ students: [legacyStudent], universities: [legacyUniversity] })
    expect(ranking.students[0]).toMatchObject({ institutionType: null, program: null })
    expect(ranking.universities[0].institutionType).toBeNull()
  })

  it('un tipo desconocido o un programa en blanco se tratan como ausentes', () => {
    const ranking = buildLandingRanking({
      students: [{ ...student, institutionType: 'KINDER' as never, program: '   ' }],
      universities: [{ ...university, institutionType: 'school' as never }],
    })
    expect(ranking.students[0]).toMatchObject({ institutionType: null, program: null })
    expect(ranking.universities[0].institutionType).toBeNull()
  })

  it('mezcla: estudiantes reales con instituciones de ejemplo si solo falta una lista', () => {
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

describe('datos de ejemplo', () => {
  it('incluyen universidades, colegios y otro tipo, para que cada filtro muestre algo', () => {
    const studentTypes = new Set(SAMPLE_STUDENTS.map((s) => s.institutionType))
    const institutionTypes = new Set(SAMPLE_UNIVERSITIES.map((u) => u.institutionType))
    for (const type of ['UNIVERSITY', 'SCHOOL', 'OTHER']) {
      expect(studentTypes.has(type as never)).toBe(true)
      expect(institutionTypes.has(type as never)).toBe(true)
    }
  })

  it('vienen ordenados de mayor a menor puntaje', () => {
    const sorted = (values: number[]) => values.every((v, i) => i === 0 || values[i - 1] >= v)
    expect(sorted(SAMPLE_STUDENTS.map((s) => s.points))).toBe(true)
    expect(sorted(SAMPLE_UNIVERSITIES.map((u) => u.points))).toBe(true)
  })
})
