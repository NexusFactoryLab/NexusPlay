import { describe, expect, it } from 'vitest';
import { mazeCollectorPoints } from './rooms.gateway.js';

describe('mazeCollectorPoints (issue #166): puntos de una ronda de torneo de Salvando el mundo', () => {
  it('sin acertar ninguna no da puntos', () => {
    expect(mazeCollectorPoints(0, 0, 0, 'MEDIUM')).toBe(0);
  });

  it('perder vidas solo da el crédito parcial de lo acertado, sin bonos', () => {
    expect(mazeCollectorPoints(3, 2, 50_000, 'MEDIUM')).toBe(3);
  });

  it('terminar sin perder vidas suma el bono fijo además del crédito parcial', () => {
    const slow = mazeCollectorPoints(5, 0, 180_000, 'MEDIUM');
    expect(slow).toBe(5 + 2);
  });

  it('entre menos se demoró (sin perder vidas) más puntos de velocidad', () => {
    const fast = mazeCollectorPoints(5, 0, 1_000, 'MEDIUM');
    const slow = mazeCollectorPoints(5, 0, 170_000, 'MEDIUM');
    expect(fast).toBeGreaterThan(slow);
  });

  it('el bono de velocidad nunca pasa el tope ni queda negativo', () => {
    expect(mazeCollectorPoints(2, 0, 0, 'HARD')).toBe(2 + 2 + 3);
    expect(mazeCollectorPoints(2, 0, 10_000_000, 'HARD')).toBe(2 + 2);
  });
});
