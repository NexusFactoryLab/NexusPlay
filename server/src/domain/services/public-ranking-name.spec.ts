import { describe, expect, it } from 'vitest';
import { maskPublicName } from './public-ranking-name.js';

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
