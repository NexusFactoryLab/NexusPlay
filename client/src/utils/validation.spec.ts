import { describe, expect, it } from 'vitest'
import { normalizeAcademicProgramInput, validateAcademicProgram } from './validation'

describe('facultad o carrera del perfil', () => {
  it('es opcional: vacío o solo espacios no es error y equivale a null', () => {
    expect(validateAcademicProgram('')).toBeNull()
    expect(validateAcademicProgram('   ')).toBeNull()
    expect(normalizeAcademicProgramInput('   ')).toBeNull()
  })

  it('limpia espacios repetidos e invisibles como el servidor', () => {
    expect(normalizeAcademicProgramInput('  Ingeniería   de\nSistemas ')).toBe('Ingeniería de Sistemas')
    expect(normalizeAcademicProgramInput('Medi​cina')).toBe('Medicina')
  })

  it('acepta programas y grados reales', () => {
    for (const program of ['Medicina', '11°', 'Lic. en Música', 'Contaduría (nocturna)', 'Grado 9-B']) {
      expect(validateAcademicProgram(program)).toBeNull()
    }
  })

  it('avisa si es muy largo o trae marcado', () => {
    expect(validateAcademicProgram('a'.repeat(81))).toMatch(/80/)
    expect(validateAcademicProgram('<b>Medicina</b>')).not.toBeNull()
  })
})
