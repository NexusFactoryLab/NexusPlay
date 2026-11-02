import { describe, expect, it } from 'vitest';
import { adultBornOnOrBefore, maskPublicName } from './public-ranking-name.js';

describe('maskPublicName', () => {
  it('deja el primer nombre y la inicial del apellido', () => {
    expect(maskPublicName('Valentina', 'Castaño Ruiz')).toBe('Valentina C.');
  });

  it('usa solo el primer nombre si el nombre viene compuesto', () => {
    expect(maskPublicName('Juan Pablo', 'Pérez')).toBe('Juan P.');
  });

  it('tolera espacios sobrantes y minúsculas', () => {
    expect(maskPublicName('  laura ', ' rojas')).toBe('laura R.');
  });

  it('no inventa nada cuando falta el apellido o el nombre', () => {
    expect(maskPublicName('Sofía', '')).toBe('Sofía');
    expect(maskPublicName('', 'Gómez')).toBe('G.');
    expect(maskPublicName('', '')).toBe('Jugador');
  });
});

describe('adultBornOnOrBefore', () => {
  it('devuelve la fecha de hace 18 años', () => {
    expect(adultBornOnOrBefore(new Date('2026-11-01T15:00:00Z')).toISOString()).toBe('2008-11-01T00:00:00.000Z');
  });
});
