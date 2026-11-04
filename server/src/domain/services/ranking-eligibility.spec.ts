import { describe, expect, it } from 'vitest';
import { isEligibleForPublicRanking, minAgeBornOnOrBefore } from './ranking-eligibility.js';

// 15:00 UTC = 10:00 en Colombia del 1 de noviembre de 2026.
const NOW = new Date('2026-11-01T15:00:00Z');

describe('minAgeBornOnOrBefore', () => {
  it('devuelve la fecha de hace 14 años', () => {
    expect(minAgeBornOnOrBefore(NOW).toISOString()).toBe('2012-11-01T00:00:00.000Z');
  });

  it('usa el día de Colombia, no el de UTC (01:00 UTC aún es el día anterior allá)', () => {
    expect(minAgeBornOnOrBefore(new Date('2026-11-02T01:00:00Z')).toISOString()).toBe('2012-11-01T00:00:00.000Z');
  });
});

describe('isEligibleForPublicRanking', () => {
  it('no es elegible sin fecha de nacimiento', () => {
    expect(isEligibleForPublicRanking(null, NOW)).toBe(false);
  });

  it('cumple 14 hoy: elegible; mañana: todavía no', () => {
    expect(isEligibleForPublicRanking(new Date('2012-11-01T00:00:00Z'), NOW)).toBe(true);
    expect(isEligibleForPublicRanking(new Date('2012-11-02T00:00:00Z'), NOW)).toBe(false);
  });

  it('13 años y 364 días no es elegible', () => {
    expect(isEligibleForPublicRanking(new Date('2012-11-02T00:00:00Z'), NOW)).toBe(false);
    expect(isEligibleForPublicRanking(new Date('2013-01-01T00:00:00Z'), NOW)).toBe(false);
  });

  it('adultos y mayores son elegibles', () => {
    expect(isEligibleForPublicRanking(new Date('2000-05-10T00:00:00Z'), NOW)).toBe(true);
  });

  it('nacido un 29 de febrero cumple el 1 de marzo en año no bisiesto', () => {
    const born = new Date('2012-02-29T00:00:00Z');
    expect(isEligibleForPublicRanking(born, new Date('2026-02-28T15:00:00Z'))).toBe(false);
    expect(isEligibleForPublicRanking(born, new Date('2026-03-01T15:00:00Z'))).toBe(true);
  });
});
