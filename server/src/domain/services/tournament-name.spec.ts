import { describe, expect, it } from 'vitest';
import { MAX_TOURNAMENT_NAME_LENGTH, sanitizeTournamentName } from './tournament-name.js';

describe('sanitizeTournamentName (#147)', () => {
  it('deja el nombre tal cual cuando ya está limpio', () => {
    expect(sanitizeTournamentName('Torneo de 8° A')).toBe('Torneo de 8° A');
  });

  it('recorta espacios y junta los repetidos o los saltos de línea', () => {
    expect(sanitizeTournamentName('  Torneo   de\n\tciencias  ')).toBe('Torneo de ciencias');
  });

  it('sin nombre devuelve undefined: vacío, solo espacios o algo que no es texto', () => {
    expect(sanitizeTournamentName('')).toBeUndefined();
    expect(sanitizeTournamentName('   \n ')).toBeUndefined();
    expect(sanitizeTournamentName(undefined)).toBeUndefined();
    expect(sanitizeTournamentName(null)).toBeUndefined();
    expect(sanitizeTournamentName(42)).toBeUndefined();
    expect(sanitizeTournamentName({ name: 'x' })).toBeUndefined();
  });

  it('corta los nombres demasiado largos sin dejar un espacio al final', () => {
    const long = `${'a'.repeat(MAX_TOURNAMENT_NAME_LENGTH - 1)} ${'b'.repeat(20)}`;
    const result = sanitizeTournamentName(long)!;
    expect(result.length).toBeLessThanOrEqual(MAX_TOURNAMENT_NAME_LENGTH);
    expect(result.endsWith(' ')).toBe(false);
  });
});
