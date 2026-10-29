import type { DuoLevelDef } from '../duoLevel.js';

/**
 * Escenario 1: el Bosque. Tres tramos, cada uno termina en una Puerta del Saber:
 *
 *   A. Foso de lodo: uno pisa el botón para que aparezca el puente, el otro
 *      cruza y pisa el botón del otro lado para que el primero pase también.
 *      Un hongo saltarín (al inicio) lleva a la isla de la gema de Lumen.
 *      → Puerta 1.
 *   B. Pozos de lava y de agua: Lumen nada en la lava y baja la palanca que
 *      tiende el puente para Gota; Gota nada en el agua y tiende el de Lumen.
 *      Zarzas que solo se retiran mientras alguien pisa uno de sus botones:
 *      uno sostiene, el otro cruza y sostiene del otro lado. Una báscula: uno
 *      se para en un plato y el otro plato sube; desde ahí el compañero alcanza
 *      la repisa de la llave, que abre la puerta con candado. → Puerta 2.
 *   C. Caja de metal: solo se mueve si la empujan los dos; junto al muro alto
 *      sirve de escalón. Arriba, ramas sobre espinas y un hongo hasta la rama
 *      alta. Dos botones lejanos (uno en la rama alta) hay que pisarlos a la
 *      vez para que las zarzas del final se retiren. → Portal final.
 */
export const BOSQUE: DuoLevelDef = {
  id: 'bosque',
  title: 'El Bosque',
  theme: 'bosque',
  tagline: 'Zarzas, una báscula, una caja de metal y botones que hay que pisar a la vez.',
  map: [
    '................................................................................................................',
    '................................................................................................................',
    '...............................................................................................---..............',
    '................................................................................................................',
    '................................................................................................................',
    '........................................................................................------..................',
    '.................................................................==......................^^^^...................',
    '....===............---...............................................................###########################',
    '.....................................................................................###########################',
    '.....................................................................................###########################',
    '############.....##############LLLL###WWWWW###############..##..################################################',
    '############SSSSS##############LLLL###WWWWW###############..##..################################################',
    '############SSSSS##############LLLL###WWWWW###############..##..################################################',
  ],
  spawns: { FIRE: { col: 2, row: 9 }, WATER: { col: 4, row: 9 } },
  buttons: [
    { id: 'boton-orilla', col: 10, row: 9 },
    { id: 'boton-lejano', col: 18, row: 9 },
    { id: 'boton-zarzas-a', col: 48, row: 9 },
    { id: 'boton-zarzas-b', col: 54, row: 9 },
    { id: 'boton-par-alto', col: 97, row: 1 },
    { id: 'boton-par-bajo', col: 100, row: 6 },
  ],
  levers: [
    { id: 'palanca-lumen', col: 36, row: 9 },
    { id: 'palanca-gota', col: 44, row: 9 },
  ],
  latches: [{ id: 'cerrojo', when: { all: ['boton-par-alto', 'boton-par-bajo'] } }],
  bridges: [
    { id: 'puente-lodo', col: 12, row: 10, width: 5, when: { any: ['boton-orilla', 'boton-lejano'] } },
    { id: 'puente-lava', col: 31, row: 10, width: 4, when: { all: ['palanca-lumen'] } },
    { id: 'puente-agua', col: 38, row: 10, width: 5, when: { all: ['palanca-gota'] } },
  ],
  crates: [{ id: 'caja-metal', col: 81, row: 9, heavy: true }],
  coins: [
    { id: 'ficha-puente', col: 14, row: 7, gate: 'puerta-1' },
    { id: 'ficha-lava', col: 33, row: 12, gate: 'puerta-2' },
    { id: 'ficha-agua', col: 40, row: 12, gate: 'puerta-2' },
    { id: 'ficha-ramas', col: 90, row: 4, gate: 'portal' },
    { id: 'ficha-hongo', col: 95, row: 1, gate: 'portal' },
  ],
  gems: [
    { id: 'gema-isla', col: 5, row: 6, color: 'FIRE' },
    { id: 'gema-puente', col: 15, row: 8, color: 'WATER' },
    { id: 'gema-lava', col: 32, row: 11, color: 'FIRE' },
    { id: 'gema-agua', col: 41, row: 11, color: 'WATER' },
    { id: 'gema-repisa', col: 65, row: 5, color: 'BOTH' },
    { id: 'gema-ramas', col: 91, row: 3, color: 'BOTH' },
  ],
  springs: [
    { id: 'hongo-inicio', col: 0, row: 9 },
    { id: 'hongo-ramas', col: 95, row: 6 },
  ],
  barriers: [
    { id: 'zarzas', col: 51, row: 7, height: 3, off: { any: ['boton-zarzas-a', 'boton-zarzas-b'] } },
    { id: 'zarzas-final', col: 102, row: 4, height: 3, off: { all: ['cerrojo'] } },
  ],
  scales: [{ id: 'bascula', left: { col: 58, row: 10, width: 2 }, right: { col: 62, row: 10, width: 2 }, travel: 2 }],
  keys: [{ id: 'llave', col: 66, row: 5, lock: 'candado' }],
  locks: [{ id: 'candado', col: 69, row: 7, height: 3 }],
  flags: [
    { id: 'bandera-pozos', col: 46, row: 9 },
    { id: 'bandera-muro', col: 87, row: 6 },
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
      pedestals: { FIRE: { col: 72, row: 9 }, WATER: { col: 74, row: 9 } },
      wall: { col: 76, row: 5, height: 5 },
      respawn: { FIRE: { col: 77, row: 9 }, WATER: { col: 78, row: 9 } },
    },
    {
      id: 'portal',
      pedestals: { FIRE: { col: 104, row: 6 }, WATER: { col: 106, row: 6 } },
      wall: null,
      respawn: { FIRE: { col: 104, row: 6 }, WATER: { col: 106, row: 6 } },
      portal: { col: 108, row: 6 },
    },
  ],
  decor: [
    { kind: 'flowers', col: 1, row: 9 },
    { kind: 'bush', col: 7, row: 9 },
    { kind: 'fern', col: 20, row: 9 },
    { kind: 'mushroom', col: 27, row: 9 },
    { kind: 'rock', col: 45, row: 9 },
    { kind: 'fern', col: 56, row: 9 },
    { kind: 'rock', col: 60, row: 9 },
    { kind: 'bush', col: 66, row: 9 },
    { kind: 'flowers', col: 71, row: 9 },
    { kind: 'fern', col: 79, row: 9 },
    { kind: 'flowers', col: 86, row: 6 },
    { kind: 'bush', col: 98, row: 6 },
    { kind: 'mushroom', col: 109, row: 6 },
  ],
};
