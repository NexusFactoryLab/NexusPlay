import { describe, expect, it } from 'vitest'
import { SAMPLE_STUDENTS, SAMPLE_UNIVERSITIES } from './landingData'
import {
  describeView,
  emptyFilterMessage,
  filterByInstitutionType,
  formatCountdown,
  msUntilNextCutoff,
  nextColombiaCutoff,
  studentDetail,
} from './rankingLogic'

describe('filtro por tipo de institución', () => {
  it('«Todos» devuelve todo, en el mismo orden (incluido «Otro» y sin clasificar)', () => {
    const items = [
      { id: 'a', institutionType: 'UNIVERSITY' as const },
      { id: 'b', institutionType: null },
      { id: 'c', institutionType: 'OTHER' as const },
    ]
    expect(filterByInstitutionType(items, 'ALL').map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('«Universidades» y «Colegios» filtran conservando el orden del ranking', () => {
    const schools = filterByInstitutionType(SAMPLE_STUDENTS, 'SCHOOL')
    expect(schools.length).toBeGreaterThan(0)
    expect(schools.every((s) => s.institutionType === 'SCHOOL')).toBe(true)
    const points = schools.map((s) => s.points)
    expect([...points].sort((a, b) => b - a)).toEqual(points)

    const universities = filterByInstitutionType(SAMPLE_UNIVERSITIES, 'UNIVERSITY')
    expect(universities.every((u) => u.institutionType === 'UNIVERSITY')).toBe(true)
  })

  it('sin coincidencias devuelve una lista vacía (la vista muestra el mensaje amable)', () => {
    expect(filterByInstitutionType([{ institutionType: 'OTHER' as const }], 'SCHOOL')).toEqual([])
    expect(emptyFilterMessage('students', 'SCHOOL')).toContain('colegios')
    expect(emptyFilterMessage('institutions', 'UNIVERSITY')).toContain('universidades')
  })
})

describe('cuenta regresiva hasta el próximo corte (medianoche de Colombia, UTC-5)', () => {
  it('a las 07:00 de Colombia el próximo corte es la medianoche siguiente (05:00 UTC)', () => {
    expect(nextColombiaCutoff(new Date('2026-11-03T12:00:00Z')).toISOString()).toBe('2026-11-04T05:00:00.000Z')
    expect(msUntilNextCutoff(new Date('2026-11-03T12:00:00Z'))).toBe(17 * 60 * 60 * 1000)
  })

  it('a las 23:30 de Colombia (04:30 UTC del día siguiente) faltan 30 minutos', () => {
    expect(nextColombiaCutoff(new Date('2026-11-04T04:30:00Z')).toISOString()).toBe('2026-11-04T05:00:00.000Z')
    expect(msUntilNextCutoff(new Date('2026-11-04T04:30:00Z'))).toBe(30 * 60 * 1000)
  })

  it('justo en el corte, el siguiente es dentro de 24 h (nunca 0)', () => {
    expect(msUntilNextCutoff(new Date('2026-11-04T05:00:00Z'))).toBe(24 * 60 * 60 * 1000)
  })

  it('formatea horas y minutos, redondeando hacia abajo', () => {
    expect(formatCountdown(5 * 3600_000 + 12 * 60_000 + 59_000)).toBe('5 h 12 min')
    expect(formatCountdown(12 * 60_000)).toBe('12 min')
    expect(formatCountdown(3600_000)).toBe('1 h 0 min')
    expect(formatCountdown(30_000)).toBe('menos de 1 min')
    expect(formatCountdown(-5)).toBe('menos de 1 min')
  })
})

describe('textos del ranking', () => {
  it('detalle del estudiante: programa · institución, con lo que haya', () => {
    expect(studentDetail({ program: 'Medicina', university: 'U. Horizonte' })).toBe('Medicina · U. Horizonte')
    expect(studentDetail({ program: null, university: 'Colegio Andino' })).toBe('Colegio Andino')
    expect(studentDetail({ program: '11°', university: null })).toBe('11°')
    expect(studentDetail({ program: '  ', university: null })).toBeNull()
  })

  it('anuncio discreto del cambio de vista', () => {
    expect(describeView('students', 'ALL', 8)).toBe('Mostrando 8 estudiantes.')
    expect(describeView('institutions', 'SCHOOL', 1)).toBe('Mostrando 1 institución de colegios.')
    expect(describeView('students', 'UNIVERSITY', 0)).toBe('No hay estudiantes de universidades en el ranking por ahora.')
  })
})
