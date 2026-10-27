import { parseLevel, type DuoLevel, type DuoLevelDef } from '../duoLevel.js';
import { BOSQUE } from './bosque.js';
import { SOLAR } from './solar.js';

/** Los escenarios de la campaña, en el orden en que se juegan. */
export const DUO_LEVEL_DEFS: readonly DuoLevelDef[] = [BOSQUE, SOLAR];

const PARSED = new Map<string, DuoLevel>(DUO_LEVEL_DEFS.map((def) => [def.id, parseLevel(def)]));

export function duoLevel(id: string): DuoLevel {
  const level = PARSED.get(id);
  if (!level) throw new Error(`No existe el escenario ${id}.`);
  return level;
}

export function isDuoLevelId(id: unknown): id is string {
  return typeof id === 'string' && PARSED.has(id);
}

/** El escenario que sigue en la campaña, o null si es el último. */
export function nextDuoLevelId(id: string): string | null {
  const index = DUO_LEVEL_DEFS.findIndex((def) => def.id === id);
  return DUO_LEVEL_DEFS[index + 1]?.id ?? null;
}
