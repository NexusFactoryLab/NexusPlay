import type { DuoLevelDef } from '../duoLevel.js';

/**
 * Escenario 2: la Planta solar. Tres tramos:
 *
 *   A. Foso electrificado: una plataforma móvil lo cruza de lado a lado; hay
 *      que subirse a tiempo (y saltar desde ella por la ficha).
 *      → Puerta 1.
 *   B. Espejos (cada uno en su repisa): la luz sale del cielo, rebota en dos
 *      espejos y llega al receptor que enciende el puente sobre el segundo foso.
 *      Luego una barrera eléctrica que solo se apaga mientras alguien pisa uno
 *      de sus botones (uno sostiene, el otro cruza y sostiene del otro lado), y
 *      un ascensor al mirador. → Puerta 2.
 *   C. Una caja de metal que solo se mueve si la empujan los dos: sobre la
 *      placa enciende el puente del foso. Tanques: Gota bucea y sostiene el
 *      botón del fondo para que Lumen cruce; Lumen nada en las sales, baja la
 *      palanca del puente de Gota y se trae la llave de la puerta con candado.
 *      Una báscula sube a uno hasta el botón alto, que hay que pisar a la vez
 *      con el de abajo para apagar la última barrera. → Portal.
 */
export const SOLAR: DuoLevelDef = {
  id: 'solar',
  title: 'La Planta solar',
  theme: 'solar',
  tagline: 'Espejos, barreras eléctricas, una báscula y una caja de metal para dos.',
  map: [
    '....................................................................................................................',
    '....................................................................................................................',
    '....................................................................................................................',
    '....................................................................................................................',
    '....................................................................................................................',
    '.......................................................#########....................................................',
    '.......................................................#########.........................................--.........',
    '.......................................................#########....................................................',
    '...........................==...===....................#########....................................................',
    '.......................................................#########........#...........................................',
    '##########.......###################........#############################.....##WWWWW##LLLLL#######..##..###########',
    '##########.......###################........#############################.....##WWWWW##LLLLL#######..##..###########',
    '##########^^^^^^^###################^^^^^^^^#############################^^^^^##WWWWW##LLLLL#######..##..###########',
  ],
  spawns: { FIRE: { col: 2, row: 9 }, WATER: { col: 4, row: 9 } },
  buttons: [
    { id: 'boton-rayo-a', col: 44, row: 9 },
    { id: 'boton-rayo-b', col: 49, row: 9 },
    { id: 'placa', col: 71, row: 9 },
    { id: 'boton-fondo', col: 82, row: 12 },
    { id: 'boton-bajo', col: 102, row: 9 },
    { id: 'boton-alto', col: 106, row: 5 },
  ],
  levers: [{ id: 'palanca-sales', col: 89, row: 12 }],
  latches: [{ id: 'cerrojo', when: { all: ['boton-alto', 'boton-bajo'] } }],
  bridges: [
    { id: 'puente-sol', col: 36, row: 10, width: 8, when: { all: ['receptor'] } },
    { id: 'puente-placa', col: 73, row: 10, width: 5, when: { any: ['placa'] } },
    { id: 'puente-agua', col: 80, row: 10, width: 5, when: { any: ['boton-fondo'] } },
    { id: 'puente-sales', col: 87, row: 10, width: 5, when: { all: ['palanca-sales'] } },
  ],
  crates: [{ id: 'caja-metal', col: 66, row: 9, heavy: true }],
  coins: [
    { id: 'ficha-foso', col: 13, row: 8, gate: 'puerta-1' },
    { id: 'ficha-repisa', col: 34, row: 6, gate: 'puerta-2' },
    { id: 'ficha-mirador', col: 58, row: 2, gate: 'puerta-2' },
    { id: 'ficha-agua', col: 81, row: 12, gate: 'portal' },
    { id: 'ficha-sales', col: 88, row: 11, gate: 'portal' },
  ],
  gems: [
    { id: 'gema-inicio', col: 5, row: 8, color: 'FIRE' },
    { id: 'gema-puente', col: 40, row: 8, color: 'WATER' },
    { id: 'gema-mirador', col: 60, row: 2, color: 'BOTH' },
    { id: 'gema-tanque', col: 83, row: 11, color: 'WATER' },
    { id: 'gema-sales', col: 91, row: 11, color: 'FIRE' },
    { id: 'gema-alta', col: 105, row: 4, color: 'BOTH' },
  ],
  barriers: [
    { id: 'rayo', col: 46, row: 7, height: 3, off: { any: ['boton-rayo-a', 'boton-rayo-b'] } },
    { id: 'rayo-final', col: 108, row: 7, height: 3, off: { all: ['cerrojo'] } },
  ],
  scales: [{ id: 'bascula', left: { col: 99, row: 10, width: 2 }, right: { col: 103, row: 10, width: 2 }, travel: 2 }],
  keys: [{ id: 'llave', col: 90, row: 11, lock: 'candado' }],
  locks: [{ id: 'candado', col: 96, row: 7, height: 3 }],
  flags: [
    { id: 'bandera-placa', col: 79, row: 9 },
    { id: 'bandera-candado', col: 93, row: 9 },
  ],
  gates: [
    {
      id: 'puerta-1',
      pedestals: { FIRE: { col: 20, row: 9 }, WATER: { col: 22, row: 9 } },
      wall: { col: 24, row: 5, height: 5 },
      respawn: { FIRE: { col: 25, row: 9 }, WATER: { col: 26, row: 9 } },
    },
    {
      id: 'puerta-2',
      pedestals: { FIRE: { col: 57, row: 4 }, WATER: { col: 59, row: 4 } },
      wall: { col: 61, row: 0, height: 5 },
      respawn: { FIRE: { col: 62, row: 4 }, WATER: { col: 63, row: 4 } },
    },
    {
      id: 'portal',
      pedestals: { FIRE: { col: 110, row: 9 }, WATER: { col: 112, row: 9 } },
      wall: null,
      respawn: { FIRE: { col: 110, row: 9 }, WATER: { col: 112, row: 9 } },
      portal: { col: 114, row: 9 },
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
    { id: 'ascensor', col: 53, row: 10, width: 2, path: { dx: 0, dy: -5 }, period: 7 },
  ],
  decor: [
    { kind: 'panel', col: 1, row: 9 },
    { kind: 'beacon', col: 18, row: 9 },
    { kind: 'battery', col: 29, row: 9 },
    { kind: 'valve', col: 51, row: 9 },
    { kind: 'sign', col: 65, row: 9 },
    { kind: 'panel', col: 69, row: 9 },
    { kind: 'beacon', col: 85, row: 9 },
    { kind: 'battery', col: 97, row: 9 },
    { kind: 'panel', col: 109, row: 9 },
  ],
};
