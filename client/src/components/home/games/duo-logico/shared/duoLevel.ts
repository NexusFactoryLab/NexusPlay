import type { DuoRole, Rect } from './duoTypes.js';

/** Lado de una celda del mapa, en píxeles de mundo. */
export const TILE = 64;

/**
 * Leyenda del mapa (una letra por celda):
 *   .  vacío            #  suelo            =  plataforma flotante (sólida)
 *   -  rama (se atraviesa desde abajo y se baja con ↓)
 *   L  lava (Lumen nada en ella; a Gota la apaga)
 *   W  agua (Gota nada en ella; a Lumen lo apaga)
 *   S  lodo tóxico (los apaga a los dos)
 *   ^  espinas (los apagan a los dos)
 */
export type TileKind = 'empty' | 'ground' | 'float' | 'branch' | 'lava' | 'water' | 'sludge' | 'thorns';

const TILE_BY_CHAR: Record<string, TileKind> = {
  '.': 'empty',
  '#': 'ground',
  '=': 'float',
  '-': 'branch',
  L: 'lava',
  W: 'water',
  S: 'sludge',
  '^': 'thorns',
};

export interface Cell {
  col: number;
  row: number;
}

/** Interruptores que deben estar activos: `any` con uno basta, `all` exige todos. */
export interface DuoCondition {
  any?: string[];
  all?: string[];
}

export interface DuoGateDef {
  id: string;
  /** Pedestal de cada personaje: la celda sobre la que se para. */
  pedestals: Record<DuoRole, Cell>;
  /** Barrera que se abre al responder bien; null en el portal final. */
  wall: (Cell & { height: number }) | null;
  /** Dónde reaparece cada uno después de abrirla. */
  respawn: Record<DuoRole, Cell>;
  /** Solo en la última: el portal que termina el escenario al responder bien. */
  portal?: Cell;
}

/** Escenarios con su propio arte (tileset, fondo y objetos). */
export type DuoTheme = 'bosque' | 'solar';

/** Cuántas posiciones tiene un espejo: se gira una al tocarlo. */
export const MIRROR_ANGLES = 4;

/** Espejo que se gira al tocarlo; refleja la luz cuando queda en `target`. */
export interface DuoMirrorDef extends Cell {
  id: string;
  start: number;
  target: number;
}

/** Receptor de luz: se enciende (es un interruptor con su id) cuando todos sus espejos apuntan bien. */
export interface DuoReceiverDef extends Cell {
  id: string;
  /** En el orden en que la luz los recorre, desde la fuente. */
  mirrors: string[];
}

/**
 * Plataforma que va y vuelve suave entre su celda y `path` celdas más allá,
 * según el reloj del servidor: los dos jugadores la ven en el mismo lugar.
 */
export interface DuoMoverDef extends Cell {
  id: string;
  width: number;
  path: { dx: number; dy: number };
  period: number;
}

export interface DuoLevelDef {
  id: string;
  title: string;
  theme: DuoTheme;
  /** Una frase para la tarjeta del escenario en la sala de espera. */
  tagline: string;
  map: string[];
  spawns: Record<DuoRole, Cell>;
  buttons: Array<Cell & { id: string }>;
  levers: Array<Cell & { id: string; role?: DuoRole }>;
  bridges: Array<Cell & { id: string; width: number; when: DuoCondition }>;
  crates: Array<Cell & { id: string }>;
  coins: Array<Cell & { id: string; gate: string }>;
  gates: DuoGateDef[];
  mirrors?: DuoMirrorDef[];
  receivers?: DuoReceiverDef[];
  /** De dónde sale la luz que reflejan los espejos (solo se dibuja). */
  lightSource?: Cell;
  movers?: DuoMoverDef[];
  /** `kind` es el nombre de la pieza de decoración en el atlas del escenario. */
  decor: Array<Cell & { kind: string }>;
}

export interface DuoLevel {
  def: DuoLevelDef;
  cols: number;
  rows: number;
  widthPx: number;
  heightPx: number;
  tiles: TileKind[][];
}

export function parseLevel(def: DuoLevelDef): DuoLevel {
  const rows = def.map.length;
  const cols = Math.max(...def.map.map((line) => line.length));
  const tiles = def.map.map((line, row) =>
    Array.from({ length: cols }, (_, col) => {
      const kind = TILE_BY_CHAR[line[col] ?? '.'];
      if (!kind) throw new Error(`Celda desconocida "${line[col]}" en (${col}, ${row}) del nivel ${def.id}.`);
      return kind;
    }),
  );
  return { def, cols, rows, widthPx: cols * TILE, heightPx: rows * TILE, tiles };
}

export function tileAt(level: DuoLevel, col: number, row: number): TileKind {
  if (col < 0 || col >= level.cols) return 'ground'; // los bordes laterales son pared
  if (row < 0) return 'empty';
  if (row >= level.rows) return 'ground';
  return level.tiles[row][col];
}

export function isSolidTile(kind: TileKind): boolean {
  return kind === 'ground' || kind === 'float';
}

export function isLiquidTile(kind: TileKind): kind is 'lava' | 'water' | 'sludge' {
  return kind === 'lava' || kind === 'water' || kind === 'sludge';
}

/** Punto de apoyo (centro de los pies) de quien está parado en la celda. */
export function standPoint(cell: Cell): { x: number; y: number } {
  return { x: cell.col * TILE + TILE / 2, y: (cell.row + 1) * TILE };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---- Geometría de los objetos (la misma para el servidor y el dibujo) ----

export const BUTTON_W = 44;
export const BUTTON_H = 10;
export const PEDESTAL_W = 44;
export const PEDESTAL_H = 50;
export const CRATE_SIZE = 58;
export const COIN_SIZE = 36;
export const BRIDGE_H = 16;
export const GATE_W = 40;

export function buttonRect(cell: Cell): Rect {
  return { x: cell.col * TILE + (TILE - BUTTON_W) / 2, y: (cell.row + 1) * TILE - BUTTON_H, w: BUTTON_W, h: BUTTON_H };
}

export function leverRect(cell: Cell): Rect {
  return { x: cell.col * TILE + 12, y: cell.row * TILE + 16, w: TILE - 24, h: TILE - 16 };
}

export function pedestalRect(cell: Cell): Rect {
  return { x: cell.col * TILE + (TILE - PEDESTAL_W) / 2, y: (cell.row + 1) * TILE - PEDESTAL_H, w: PEDESTAL_W, h: PEDESTAL_H };
}

export function coinRect(cell: Cell): Rect {
  return { x: cell.col * TILE + (TILE - COIN_SIZE) / 2, y: cell.row * TILE + (TILE - COIN_SIZE) / 2, w: COIN_SIZE, h: COIN_SIZE };
}

export function bridgeRect(bridge: Cell & { width: number }): Rect {
  return { x: bridge.col * TILE, y: bridge.row * TILE, w: bridge.width * TILE, h: BRIDGE_H };
}

export function gateWallRect(wall: Cell & { height: number }): Rect {
  return { x: wall.col * TILE + (TILE - GATE_W) / 2, y: wall.row * TILE, w: GATE_W, h: wall.height * TILE };
}

export const MIRROR_W = 40;
export const RECEIVER_W = 56;

export function mirrorRect(cell: Cell): Rect {
  return { x: cell.col * TILE + (TILE - MIRROR_W) / 2, y: cell.row * TILE + 8, w: MIRROR_W, h: TILE - 8 };
}

/** Desplazamiento de una plataforma móvil a la hora `t` (segundos del servidor). */
export function moverOffset(mover: DuoMoverDef, t: number): { dx: number; dy: number } {
  const phase = (((t % mover.period) + mover.period) % mover.period) / mover.period;
  const k = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  return { dx: k * mover.path.dx * TILE, dy: k * mover.path.dy * TILE };
}

export function moverRect(mover: DuoMoverDef, t: number): Rect {
  const { dx, dy } = moverOffset(mover, t);
  return { x: mover.col * TILE + dx, y: mover.row * TILE + dy, w: mover.width * TILE, h: BRIDGE_H };
}

export function crateSpawn(cell: Cell): { x: number; y: number } {
  return { x: cell.col * TILE + (TILE - CRATE_SIZE) / 2, y: (cell.row + 1) * TILE - CRATE_SIZE };
}
