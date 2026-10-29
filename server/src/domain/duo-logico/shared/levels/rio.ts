import type { DuoLevelDef } from '../duoLevel.js';

/**
 * Escenario 3: el Río (issue #132). Usa el suelo del bosque. Tres tramos:
 *
 *   A. El canal: mientras alguien abre la válvula (un botón en cada orilla),
 *      el agua sube y los troncos quedan al ras para cruzar. Al soltarla, el
 *      agua baja. → Puerta 1.
 *   B. El túnel: unas zarzas cierran el camino. Gota baja por el túnel
 *      inundado, pero la corriente la arrastra de vuelta; mientras Lumen
 *      cierra la compuerta, la corriente se detiene. Al otro lado, Gota baja
 *      la palanca que retira las zarzas. Después, la llave está en el fondo
 *      de un pozo seco: Gota baja por ella y Lumen llena el pozo para que
 *      salga nadando y abra la compuerta con candado. → Puerta 2.
 *   C. Vasos comunicantes: al abrir la válvula, un vaso se vacía y el otro
 *      se llena, así que solo uno tiene los troncos arriba a la vez. Al
 *      final, dos botones a la vez retiran las zarzas: uno en el mirador (se
 *      sube con el hongo) y otro en el fondo de una charca (solo Gota).
 *      → Portal final.
 */
export const RIO: DuoLevelDef = {
  id: 'rio',
  title: 'El Río',
  theme: 'rio',
  tagline: 'Válvulas que suben el agua, troncos que flotan y una corriente que arrastra.',
  map: [
    '..............................................................................................................',
    '..............................................................................................................',
    '..............................................................................................................',
    '..............................................................................................................',
    '..............................................................................................................',
    '..............................................................................................................',
    '.........................................................................................====.................',
    '..............................................................................................................',
    '..............................................................................................................',
    '..............................................................................................................',
    '##########.......###############W###############W######..#############......###......##########WW#############',
    '##########.......###############WWWWWWWWWWWWWWWWW######..#############......###......##########WW#############',
    '##########.......###############WWWWWWWWWWWWWWWWW######..#############......###......##########WW#############',
  ],
  spawns: { FIRE: { col: 2, row: 9 }, WATER: { col: 4, row: 9 } },
  buttons: [
    { id: 'valvula-a', col: 7, row: 9 },
    { id: 'valvula-b', col: 19, row: 9 },
    { id: 'compuerta', col: 30, row: 9 },
    { id: 'valvula-pozo', col: 54, row: 9 },
    { id: 'valvula-media', col: 77, row: 9 },
    { id: 'valvula-final', col: 86, row: 9 },
    { id: 'boton-mirador', col: 90, row: 5 },
    { id: 'boton-fondo', col: 95, row: 12 },
  ],
  levers: [{ id: 'palanca-zarzas', col: 51, row: 9 }],
  latches: [{ id: 'cerrojo', when: { all: ['boton-mirador', 'boton-fondo'] } }],
  bridges: [],
  crates: [],
  pools: [
    { id: 'canal', col: 10, row: 10, width: 7, depth: 3, low: 1, high: 3, when: { any: ['valvula-a', 'valvula-b'] }, valve: { col: 8, row: 9 } },
    { id: 'pozo', col: 55, row: 10, width: 2, depth: 3, low: 0, high: 3, when: { any: ['valvula-pozo'] }, valve: { col: 53, row: 9 } },
    // Vasos comunicantes: con la válvula abierta el primero se vacía y el segundo se llena.
    { id: 'vaso-1', col: 70, row: 10, width: 6, depth: 3, low: 3, high: 0, when: { any: ['valvula-media', 'valvula-final'] }, valve: { col: 69, row: 9 } },
    { id: 'vaso-2', col: 79, row: 10, width: 6, depth: 3, low: 0, high: 3, when: { any: ['valvula-media', 'valvula-final'] }, valve: { col: 85, row: 9 } },
  ],
  floaters: [
    { id: 'tronco-a', pool: 'canal', col: 10, width: 2, kind: 'log' },
    { id: 'tronco-b', pool: 'canal', col: 14, width: 2, kind: 'log' },
    { id: 'tronco-c', pool: 'vaso-1', col: 70, width: 2, kind: 'log' },
    { id: 'nenufar-c', pool: 'vaso-1', col: 73, width: 2, kind: 'lily' },
    { id: 'tronco-d', pool: 'vaso-2', col: 79, width: 2, kind: 'log' },
    { id: 'nenufar-d', pool: 'vaso-2', col: 82, width: 2, kind: 'lily' },
  ],
  flows: [{ id: 'corriente', kind: 'current', col: 33, row: 11, width: 15, height: 2, dir: -1, stop: { any: ['compuerta'] }, gate: { col: 49, row: 9 } }],
  barriers: [
    { id: 'zarzas-rio', col: 40, row: 6, height: 4, off: { all: ['palanca-zarzas'] } },
    { id: 'zarzas-final', col: 99, row: 5, height: 5, off: { all: ['cerrojo'] } },
  ],
  keys: [{ id: 'llave', col: 55, row: 12, lock: 'compuerta-llave' }],
  locks: [{ id: 'compuerta-llave', col: 59, row: 6, height: 4 }],
  springs: [{ id: 'hongo-mirador', col: 87, row: 9 }],
  flags: [
    { id: 'bandera-tunel', col: 50, row: 9 },
    { id: 'bandera-vasos', col: 88, row: 9 },
  ],
  coins: [
    { id: 'ficha-canal', col: 12, row: 7, gate: 'puerta-1' },
    { id: 'ficha-tunel', col: 44, row: 12, gate: 'puerta-2' },
    { id: 'ficha-pozo', col: 56, row: 12, gate: 'puerta-2' },
    { id: 'ficha-vasos', col: 81, row: 8, gate: 'portal' },
    { id: 'ficha-mirador', col: 89, row: 4, gate: 'portal' },
  ],
  gems: [
    { id: 'gema-canal', col: 13, row: 12, color: 'WATER' },
    { id: 'gema-tronco', col: 15, row: 8, color: 'FIRE' },
    { id: 'gema-tunel', col: 38, row: 12, color: 'WATER' },
    { id: 'gema-orilla', col: 45, row: 7, color: 'FIRE' },
    { id: 'gema-isla', col: 77, row: 7, color: 'BOTH' },
    { id: 'gema-mirador', col: 92, row: 4, color: 'BOTH' },
  ],
  gates: [
    {
      id: 'puerta-1',
      pedestals: { FIRE: { col: 22, row: 9 }, WATER: { col: 24, row: 9 } },
      wall: { col: 26, row: 5, height: 5 },
      respawn: { FIRE: { col: 28, row: 9 }, WATER: { col: 29, row: 9 } },
    },
    {
      id: 'puerta-2',
      pedestals: { FIRE: { col: 62, row: 9 }, WATER: { col: 64, row: 9 } },
      wall: { col: 66, row: 5, height: 5 },
      respawn: { FIRE: { col: 67, row: 9 }, WATER: { col: 68, row: 9 } },
    },
    {
      id: 'portal',
      pedestals: { FIRE: { col: 102, row: 9 }, WATER: { col: 104, row: 9 } },
      wall: null,
      respawn: { FIRE: { col: 102, row: 9 }, WATER: { col: 104, row: 9 } },
      portal: { col: 106, row: 9 },
    },
  ],
  decor: [
    { kind: 'purifier-dirty', col: 0, row: 9 },
    { kind: 'flowers', col: 5, row: 9 },
    { kind: 'fern', col: 18, row: 9 },
    { kind: 'bush', col: 20, row: 9 },
    { kind: 'rock', col: 34, row: 9 },
    { kind: 'mushroom', col: 46, row: 9 },
    { kind: 'flowers', col: 58, row: 9 },
    { kind: 'fern', col: 61, row: 9 },
    { kind: 'bush', col: 93, row: 9 },
    { kind: 'flowers', col: 97, row: 9 },
    { kind: 'purifier-clean', col: 108, row: 9 },
  ],
};
