import { describe, expect, it } from 'vitest';
import { InvalidAcademicProgramError } from '../errors/user.errors.js';
import { normalizeAcademicProgram } from './academic-program.vo.js';

describe('normalizeAcademicProgram', () => {
  it('acepta nombres reales de programas y grados', () => {
    for (const program of ['Ingeniería de Sistemas', 'Medicina', '11°', 'Lic. en Música', 'Contaduría (nocturna)', 'Grado 9-B', 'Diseño & Artes']) {
      expect(normalizeAcademicProgram(program)).toBe(program);
    }
  });

  it('recorta extremos y colapsa espacios repetidos', () => {
    expect(normalizeAcademicProgram('   Ingeniería    de   Sistemas  ')).toBe('Ingeniería de Sistemas');
  });

  it('vacío, solo espacios, null o undefined equivalen a no indicarlo', () => {
    expect(normalizeAcademicProgram('')).toBeNull();
    expect(normalizeAcademicProgram('    ')).toBeNull();
    expect(normalizeAcademicProgram(null)).toBeNull();
    expect(normalizeAcademicProgram(undefined)).toBeNull();
  });

  it('quita saltos de línea y caracteres invisibles (incluido el que invierte el texto)', () => {
    expect(normalizeAcademicProgram('Medicina\n\tnocturna')).toBe('Medicina nocturna');
    expect(normalizeAcademicProgram('Medi​cina')).toBe('Medicina');
    expect(normalizeAcademicProgram('‮Medicina')).toBe('Medicina');
  });

  it('rechaza marcado y símbolos que no aparecen en nombres de programas', () => {
    expect(() => normalizeAcademicProgram('<script>alert(1)</script>')).toThrow(InvalidAcademicProgramError);
    expect(() => normalizeAcademicProgram('Medicina "top"')).toThrow(InvalidAcademicProgramError);
    expect(() => normalizeAcademicProgram('Medicina {x}')).toThrow(InvalidAcademicProgramError);
  });

  it('rechaza más de 80 caracteres después de limpiar', () => {
    expect(normalizeAcademicProgram(`  ${'a'.repeat(80)}  `)).toBe('a'.repeat(80));
    expect(() => normalizeAcademicProgram('a'.repeat(81))).toThrow(InvalidAcademicProgramError);
  });
});
