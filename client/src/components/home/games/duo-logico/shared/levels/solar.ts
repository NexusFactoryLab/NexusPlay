import type { DuoLevelDef } from '../duoLevel.js';

/**
 * Escenario 2: la Planta solar. Tres tramos:
 *
 *   A. Foso electrificado: una plataforma móvil lo cruza de lado a lado; hay
 *      que subirse a tiempo (y saltar desde ella por la ficha).
 *      → Puerta 1 (pregunta espejo).
 *   B. Espejos (cada uno en su repisa): la luz sale del cielo, rebota en
 *      dos espejos y llega al receptor que enciende el puente sobre el segundo foso. Cada espejo
 *      gira al tocarlo; solo con los dos bien orientados se enciende. Luego
 *      un ascensor sube al mirador. → Puerta 2 (información dividida).
 *   C. Tanques: Gota bucea en el agua y sostiene el botón del fondo para
 *      que Lumen cruce; Lumen nada en las sales fundidas y baja la palanca
 *      que tiende el puente para Gota. → Portal (pregunta en dos partes).
 */
export const SOLAR: DuoLevelDef = {
  id: 'solar',
  title: 'La Planta solar',
  theme: 'solar',
  tagline: 'Espejos que guían la luz y plataformas que no se detienen.',
  map: [
    '..............................................................................',
    '..............................................................................',
    '..............................................................................',
    '..............................................................................',
    '..............................................................................',
    '.................................................#########....................',
    '.................................................#########....................',
    '.................................................#########....................',
    '...........................==...===..............#########....................',
    '.................................................#########....................',
    '##########.......###################........################WWWWW##LLLLL######',
    '##########.......###################........################WWWWW##LLLLL######',
    '##########^^^^^^^###################^^^^^^^^################WWWWW##LLLLL######',
  ],
  spawns: { FIRE: { col: 2, row: 9 }, WATER: { col: 4, row: 9 } },
  buttons: [{ id: 'boton-fondo', col: 62, row: 12 }],
  levers: [{ id: 'palanca-sales', col: 69, row: 12 }],
  bridges: [
    { id: 'puente-sol', col: 36, row: 10, width: 8, when: { all: ['receptor'] } },
    { id: 'puente-agua', col: 60, row: 10, width: 5, when: { any: ['boton-fondo'] } },
    { id: 'puente-sales', col: 67, row: 10, width: 5, when: { all: ['palanca-sales'] } },
  ],
  crates: [],
  coins: [
    { id: 'ficha-foso', col: 13, row: 8, gate: 'puerta-1' },
    { id: 'ficha-repisa', col: 34, row: 6, gate: 'puerta-2' },
    { id: 'ficha-mirador', col: 52, row: 2, gate: 'puerta-2' },
    { id: 'ficha-agua', col: 61, row: 12, gate: 'portal' },
    { id: 'ficha-sales', col: 70, row: 11, gate: 'portal' },
  ],
  gates: [
    {
      id: 'puerta-1',
      format: 'MIRROR',
      pedestals: { FIRE: { col: 20, row: 9 }, WATER: { col: 22, row: 9 } },
      wall: { col: 24, row: 5, height: 5 },
      respawn: { FIRE: { col: 25, row: 9 }, WATER: { col: 26, row: 9 } },
    },
    {
      id: 'puerta-2',
      format: 'SPLIT',
      pedestals: { FIRE: { col: 51, row: 4 }, WATER: { col: 53, row: 4 } },
      wall: { col: 55, row: 0, height: 5 },
      respawn: { FIRE: { col: 56, row: 4 }, WATER: { col: 57, row: 4 } },
    },
    {
      id: 'portal',
      format: 'TWO_PART',
      pedestals: { FIRE: { col: 73, row: 9 }, WATER: { col: 75, row: 9 } },
      wall: null,
      respawn: { FIRE: { col: 73, row: 9 }, WATER: { col: 75, row: 9 } },
      portal: { col: 77, row: 9 },
    },
  ],
  mirrors: [
    { id: 'espejo-1', col: 27, row: 7, start: 0, target: 2 },
    { id: 'espejo-2', col: 33, row: 7, start: 3, target: 1 },
  ],
  receivers: [{ id: 'receptor', col: 35, row: 9, mirrors: ['espejo-1', 'espejo-2'] }],
  lightSource: { col: 30, row: 1 },
  movers: [
    { id: 'plataforma-foso', col: 10, row: 10, width: 2, path: { dx: 5, dy: 0 }, period: 6 },
    { id: 'ascensor', col: 47, row: 10, width: 2, path: { dx: 0, dy: -5 }, period: 7 },
  ],
  decor: [
    { kind: 'panel', col: 1, row: 9 },
    { kind: 'beacon', col: 18, row: 9 },
    { kind: 'battery', col: 29, row: 9 },
    { kind: 'valve', col: 45, row: 9 },
    { kind: 'sign', col: 59, row: 9 },
    { kind: 'panel', col: 66, row: 9 },
  ],
};
