import type { DuoLevelDef } from '../duoLevel.js';

/**
 * Escenario 1: el Bosque. Tres tramos, cada uno termina en una Puerta del Saber:
 *
 *   A. Foso de lodo: uno pisa el botón para que aparezca el puente, el otro
 *      cruza y pisa el botón del otro lado para que el primero pase también.
 *      → Puerta 1 (pregunta espejo).
 *   B. Pozos de lava y de agua: Lumen nada en la lava y activa la palanca que
 *      tiende el puente para Gota; Gota nada en el agua y tiende el de Lumen.
 *      Una ficha al fondo de cada pozo. → Puerta 2 (información dividida).
 *   C. Muro alto: hay que empujar la caja hasta el muro para trepar. Arriba,
 *      espinas con ramas por encima. → Portal final (pregunta en dos partes).
 */
export const BOSQUE: DuoLevelDef = {
  id: 'bosque',
  title: 'El Bosque',
  theme: 'bosque',
  tagline: 'Puentes, palancas y una caja para trepar.',
  map: [
    '........................................................................',
    '........................................................................',
    '........................................................................',
    '........................................................................',
    '........................................................................',
    '............................................................-----.......',
    '.............................................................^^^........',
    '....===............---...................................###############',
    '.........................................................###############',
    '.........................................................###############',
    '############.....##############LLLL###WWWWW#############################',
    '############SSSSS##############LLLL###WWWWW#############################',
    '############SSSSS##############LLLL###WWWWW#############################',
  ],
  spawns: { FIRE: { col: 2, row: 9 }, WATER: { col: 4, row: 9 } },
  buttons: [
    { id: 'boton-orilla', col: 10, row: 9 },
    { id: 'boton-lejano', col: 18, row: 9 },
  ],
  levers: [
    { id: 'palanca-lumen', col: 36, row: 9 },
    { id: 'palanca-gota', col: 44, row: 9 },
  ],
  bridges: [
    { id: 'puente-lodo', col: 12, row: 10, width: 5, when: { any: ['boton-orilla', 'boton-lejano'] } },
    { id: 'puente-lava', col: 31, row: 10, width: 4, when: { all: ['palanca-lumen'] } },
    { id: 'puente-agua', col: 38, row: 10, width: 5, when: { all: ['palanca-gota'] } },
  ],
  crates: [{ id: 'caja', col: 54, row: 9 }],
  coins: [
    { id: 'ficha-puente', col: 14, row: 7, gate: 'puerta-1' },
    { id: 'ficha-lava', col: 33, row: 12, gate: 'puerta-2' },
    { id: 'ficha-agua', col: 40, row: 12, gate: 'puerta-2' },
    { id: 'ficha-ramas', col: 62, row: 4, gate: 'portal' },
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
      pedestals: { FIRE: { col: 46, row: 9 }, WATER: { col: 48, row: 9 } },
      wall: { col: 50, row: 5, height: 5 },
      respawn: { FIRE: { col: 51, row: 9 }, WATER: { col: 52, row: 9 } },
    },
    {
      id: 'portal',
      pedestals: { FIRE: { col: 66, row: 6 }, WATER: { col: 68, row: 6 } },
      wall: null,
      respawn: { FIRE: { col: 66, row: 6 }, WATER: { col: 68, row: 6 } },
      portal: { col: 70, row: 6 },
    },
  ],
  decor: [
    { kind: 'flowers', col: 1, row: 9 },
    { kind: 'bush', col: 7, row: 9 },
    { kind: 'fern', col: 20, row: 9 },
    { kind: 'mushroom', col: 27, row: 9 },
    { kind: 'rock', col: 45, row: 9 },
    { kind: 'fern', col: 55, row: 9 },
    { kind: 'flowers', col: 59, row: 6 },
    { kind: 'bush', col: 65, row: 6 },
    { kind: 'mushroom', col: 70, row: 6 },
  ],
};
