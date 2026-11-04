import type { DuoLevelDef } from '../duoLevel.js';

/**
 * Escenario 4: la planta de Reciclaje (issue #132). Tres tramos:
 *
 *   A. La cinta lleva hacia el foso de lixiviados y pasa bajo dos prensas.
 *      Mientras alguien pisa un botón de la cinta (hay uno en cada punta),
 *      corre al revés y ayuda a cruzar rápido. Después, la báscula: con el
 *      cubo de cartón y un personaje en un plato, el otro plato sube y no
 *      baja; desde ahí se alcanza el piso alto. Arriba, un botón tiende el
 *      escalón para que suba el compañero. → Puerta 1.
 *   B. Un pasillo con tres prensas; mientras alguien pisa un freno (uno en
 *      cada punta), se quedan arriba. La llave está en un estante alto:
 *      mientras el compañero pisa su botón aparece la pasarela para subir.
 *      La llave abre la puerta del final del tramo. → Puerta 2.
 *   C. El cubo de plástico solo se mueve si lo empujan los dos; junto al
 *      muro sirve de escalón. Arriba, cada botón está en la punta de una
 *      cinta que aleja de él: pisados a la vez, tienden el puente sobre el
 *      foso. → Portal final.
 */
export const RECICLAJE: DuoLevelDef = {
  id: 'reciclaje',
  title: 'La Planta de Reciclaje',
  theme: 'reciclaje',
  tagline: 'Cintas transportadoras, prensas hidráulicas y una báscula con cubos compactados.',
  map: [
    '...........#....#................................#..#..#.............................................................',
    '...........#....#................................#..#..#.............................................................',
    '...........#....#................................#..#..#.............................................................',
    '...........#....#................................#..#..#.............................................................',
    '...........#....#................................#..#..#.............................................................',
    '...........#....#................................#..#..#.............................................................',
    '..............................###############..................===...................................................',
    '..............................###############.........................................##################.....########',
    '..............................###############.........................................##################SSSSS########',
    '..............................###############.........................................##################SSSSS########',
    '#####..#################..##..##########################################################################SSSSS########',
    '#####SS#################..##..##########################################################################SSSSS########',
    '#####SS#################..##..##########################################################################SSSSS########',
  ],
  spawns: { FIRE: { col: 1, row: 9 }, WATER: { col: 2, row: 9 } },
  buttons: [
    { id: 'boton-cinta-a', col: 4, row: 9 },
    { id: 'boton-cinta-b', col: 21, row: 9 },
    { id: 'boton-escalon', col: 31, row: 5 },
    { id: 'freno-a', col: 46, row: 9 },
    { id: 'freno-b', col: 58, row: 9 },
    { id: 'boton-repisa', col: 60, row: 9 },
    { id: 'boton-izq', col: 93, row: 6 },
    { id: 'boton-der', col: 98, row: 6 },
  ],
  levers: [],
  latches: [{ id: 'cerrojo', when: { all: ['boton-izq', 'boton-der'] } }],
  bridges: [
    { id: 'escalon', col: 26, row: 8, width: 3, when: { any: ['boton-escalon'] } },
    { id: 'pasarela', col: 61, row: 8, width: 2, when: { any: ['boton-repisa'] } },
    { id: 'puente-final', col: 104, row: 7, width: 5, when: { all: ['cerrojo'] } },
  ],
  crates: [
    { id: 'cubo-carton', col: 22, row: 9 },
    { id: 'cubo-plastico', col: 81, row: 9, heavy: true },
  ],
  flows: [
    { id: 'cinta-1', kind: 'belt', col: 7, row: 10, width: 14, dir: -1, reverse: { any: ['boton-cinta-a', 'boton-cinta-b'] } },
    { id: 'cinta-izq', kind: 'belt', col: 88, row: 7, width: 6, dir: -1 },
    { id: 'cinta-der', kind: 'belt', col: 98, row: 7, width: 6, dir: 1 },
  ],
  presses: [
    { id: 'prensa-1', col: 11, row: 6, width: 1, drop: 3, period: 2.4 },
    { id: 'prensa-2', col: 16, row: 6, width: 1, drop: 3, period: 2.4, offset: 1.2 },
    { id: 'prensa-3', col: 49, row: 6, width: 1, drop: 3, period: 1.8, stop: { any: ['freno-a', 'freno-b'] } },
    { id: 'prensa-4', col: 52, row: 6, width: 1, drop: 3, period: 1.8, offset: 0.6, stop: { any: ['freno-a', 'freno-b'] } },
    { id: 'prensa-5', col: 55, row: 6, width: 1, drop: 3, period: 1.8, offset: 1.2, stop: { any: ['freno-a', 'freno-b'] } },
  ],
  scales: [{ id: 'bascula', left: { col: 24, row: 10, width: 2 }, right: { col: 28, row: 10, width: 2 }, travel: 2 }],
  keys: [{ id: 'llave', col: 64, row: 5, lock: 'puerta-llave' }],
  locks: [{ id: 'puerta-llave', col: 70, row: 5, height: 5 }],
  flags: [
    { id: 'bandera-prensas', col: 45, row: 9 },
    { id: 'bandera-cubo', col: 87, row: 6 },
  ],
  coins: [
    { id: 'ficha-cinta', col: 13, row: 7, gate: 'puerta-1' },
    { id: 'ficha-prensas', col: 53, row: 7, gate: 'puerta-2' },
    { id: 'ficha-repisa', col: 65, row: 4, gate: 'puerta-2' },
    { id: 'ficha-cubo', col: 83, row: 7, gate: 'portal' },
    { id: 'ficha-puente', col: 106, row: 5, gate: 'portal' },
  ],
  gems: [
    { id: 'gema-cinta', col: 18, row: 7, color: 'WATER' },
    { id: 'gema-piso-alto', col: 32, row: 3, color: 'FIRE' },
    { id: 'gema-prensa', col: 50, row: 7, color: 'FIRE' },
    { id: 'gema-estante', col: 63, row: 4, color: 'BOTH' },
    { id: 'gema-cinta-izq', col: 90, row: 5, color: 'WATER' },
    { id: 'gema-cinta-der', col: 101, row: 5, color: 'BOTH' },
  ],
  gates: [
    {
      id: 'puerta-1',
      pedestals: { FIRE: { col: 34, row: 5 }, WATER: { col: 36, row: 5 } },
      wall: { col: 38, row: 1, height: 5 },
      respawn: { FIRE: { col: 40, row: 5 }, WATER: { col: 41, row: 5 } },
    },
    {
      id: 'puerta-2',
      pedestals: { FIRE: { col: 72, row: 9 }, WATER: { col: 74, row: 9 } },
      wall: { col: 76, row: 5, height: 5 },
      respawn: { FIRE: { col: 77, row: 9 }, WATER: { col: 78, row: 9 } },
    },
    {
      id: 'portal',
      pedestals: { FIRE: { col: 110, row: 6 }, WATER: { col: 112, row: 6 } },
      wall: null,
      respawn: { FIRE: { col: 110, row: 6 }, WATER: { col: 112, row: 6 } },
      portal: { col: 114, row: 6 },
    },
  ],
  decor: [
    { kind: 'sign-recycle', col: 0, row: 9 },
    { kind: 'bin', col: 3, row: 9 },
    { kind: 'box-bottles', col: 33, row: 5 },
    { kind: 'toolbox', col: 42, row: 5 },
    { kind: 'trash', col: 57, row: 9 },
    { kind: 'bucket', col: 67, row: 9 },
    { kind: 'cardboard', col: 84, row: 9 },
    { kind: 'bin', col: 95, row: 6 },
    { kind: 'boxes', col: 96, row: 6 },
    { kind: 'box-bottles', col: 115, row: 6 },
    { kind: 'scale-full', col: 116, row: 6 },
  ],
};
