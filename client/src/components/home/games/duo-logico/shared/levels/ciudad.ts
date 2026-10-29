import type { DuoLevelDef } from '../duoLevel.js';

/**
 * Escenario 5: la Ciudad (issue #132). Tres tramos:
 *
 *   A. Tres semáforos peatonales: en rojo, su cortina de luz apaga a quien
 *      cruza. Se puede esperar el verde de cada uno o pisar un pulsador
 *      (uno en cada punta), que los pone todos en verde mientras se pisa.
 *      Después, el teleférico cruza el canal de aguas negras. → Puerta 1.
 *   B. La llave está en la azotea. Con la caja de carga y un personaje en un
 *      plato de la báscula, el otro plato sube; desde ahí, el balcón y la
 *      azotea. La llave abre la puerta de arco del pasaje. → Puerta 2.
 *   C. El segundo teleférico sube a la terraza. El semáforo del final solo
 *      se pone en verde si se pisan a la vez el pulsador de la calle y el de
 *      la terraza (uno abajo y otro arriba). → Portal final.
 */
export const CIUDAD: DuoLevelDef = {
  id: 'ciudad',
  title: 'La Ciudad',
  theme: 'ciudad',
  tagline: 'Teleféricos, semáforos con pulsador y una puerta con candado en la azotea.',
  map: [
    '.............................................................###..............................................',
    '.............................................................###..............................................',
    '.............................................................###..............................................',
    '.............................................................###..............................................',
    '....................................................#####....###..............................................',
    '....................................................#####....###..............................................',
    '..................................................#######....###....................##########################',
    '..................................................#######....###....................##########################',
    '..................................................#######...........................##########################',
    '..................................................#######...........................##########################',
    '########################..........###########..#..############################################################',
    '########################SSSSSSSSSS###########..#..############################################################',
    '########################SSSSSSSSSS###########..#..############################################################',
  ],
  spawns: { FIRE: { col: 1, row: 9 }, WATER: { col: 2, row: 9 } },
  buttons: [
    { id: 'pulsador-a', col: 5, row: 9 },
    { id: 'pulsador-b', col: 21, row: 9 },
    { id: 'pulsador-calle', col: 80, row: 9 },
    { id: 'pulsador-terraza', col: 90, row: 5 },
  ],
  levers: [],
  latches: [{ id: 'cerrojo', when: { all: ['pulsador-calle', 'pulsador-terraza'] } }],
  bridges: [],
  crates: [{ id: 'caja-carga', col: 44, row: 9 }],
  movers: [
    { id: 'teleferico-1', col: 24, row: 10, width: 2, path: { dx: 8, dy: 0 }, period: 9 },
    { id: 'teleferico-2', col: 76, row: 10, width: 2, path: { dx: 6, dy: -4 }, period: 10 },
  ],
  scales: [{ id: 'bascula', left: { col: 45, row: 10, width: 2 }, right: { col: 48, row: 10, width: 2 }, travel: 2 }],
  barriers: [
    { id: 'semaforo-1', col: 8, row: 5, height: 5, off: { any: ['pulsador-a', 'pulsador-b'] }, cycle: { period: 6, red: 4 } },
    { id: 'semaforo-2', col: 13, row: 5, height: 5, off: { any: ['pulsador-a', 'pulsador-b'] }, cycle: { period: 6, red: 4, offset: 2 } },
    { id: 'semaforo-3', col: 18, row: 5, height: 5, off: { any: ['pulsador-a', 'pulsador-b'] }, cycle: { period: 6, red: 4, offset: 4 } },
    // Siempre en rojo hasta que se pisan a la vez los dos pulsadores del último tramo.
    { id: 'semaforo-final', col: 96, row: 1, height: 5, off: { all: ['cerrojo'] }, cycle: { period: 1, red: 1 } },
  ],
  keys: [{ id: 'llave', col: 54, row: 3, lock: 'puerta-arco' }],
  locks: [{ id: 'puerta-arco', col: 62, row: 8, height: 2 }],
  flags: [
    { id: 'farol-1', col: 60, row: 9 },
    { id: 'farol-2', col: 86, row: 5 },
  ],
  coins: [
    { id: 'ficha-semaforo', col: 11, row: 7, gate: 'puerta-1' },
    { id: 'ficha-cabina', col: 32, row: 7, gate: 'puerta-1' },
    { id: 'ficha-azotea', col: 55, row: 3, gate: 'puerta-2' },
    { id: 'ficha-calle', col: 82, row: 8, gate: 'portal' },
    { id: 'ficha-terraza', col: 92, row: 4, gate: 'portal' },
  ],
  gems: [
    { id: 'gema-semaforo', col: 16, row: 7, color: 'FIRE' },
    { id: 'gema-cabina', col: 25, row: 7, color: 'WATER' },
    { id: 'gema-balcon', col: 50, row: 5, color: 'FIRE' },
    { id: 'gema-azotea', col: 53, row: 2, color: 'BOTH' },
    { id: 'gema-cable', col: 80, row: 6, color: 'BOTH' },
    { id: 'gema-terraza', col: 94, row: 4, color: 'WATER' },
  ],
  gates: [
    {
      id: 'puerta-1',
      pedestals: { FIRE: { col: 37, row: 9 }, WATER: { col: 39, row: 9 } },
      wall: { col: 41, row: 5, height: 5 },
      respawn: { FIRE: { col: 42, row: 9 }, WATER: { col: 43, row: 9 } },
    },
    {
      id: 'puerta-2',
      pedestals: { FIRE: { col: 66, row: 9 }, WATER: { col: 68, row: 9 } },
      wall: { col: 70, row: 5, height: 5 },
      respawn: { FIRE: { col: 71, row: 9 }, WATER: { col: 72, row: 9 } },
    },
    {
      id: 'portal',
      pedestals: { FIRE: { col: 100, row: 5 }, WATER: { col: 102, row: 5 } },
      wall: null,
      respawn: { FIRE: { col: 100, row: 5 }, WATER: { col: 102, row: 5 } },
      portal: { col: 104, row: 5 },
    },
  ],
  decor: [
    { kind: 'bench', col: 3, row: 9 },
    { kind: 'flower-pot', col: 10, row: 9 },
    { kind: 'smart-bin', col: 22, row: 9 },
    { kind: 'bikes', col: 35, row: 9 },
    { kind: 'tree', col: 58, row: 9 },
    { kind: 'solar-lamp', col: 74, row: 9 },
    { kind: 'flowers-big', col: 88, row: 5 },
    { kind: 'books', col: 93, row: 5 },
    { kind: 'bench', col: 98, row: 5 },
    { kind: 'smart-bin', col: 107, row: 5 },
  ],
};
