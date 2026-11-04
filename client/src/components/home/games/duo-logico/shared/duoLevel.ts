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
export type DuoTheme = 'bosque' | 'solar' | 'rio' | 'reciclaje' | 'ciudad';

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

/** Gema de color: la roja solo la toma Lumen, la azul solo Gota, la verde cualquiera. */
export interface DuoGemDef extends Cell {
  id: string;
  color: DuoRole | 'BOTH';
}

/** Llave: quien la toca la lleva; al llegar con ella a su puerta con candado, la abre. */
export interface DuoKeyDef extends Cell {
  id: string;
  lock: string;
}

/** Puerta con candado: un muro de `height` celdas (de su celda hacia abajo) hasta que llega su llave. */
export interface DuoLockDef extends Cell {
  id: string;
  height: number;
}

/**
 * Barrera: un muro de `height` celdas (de su celda hacia abajo) que apaga a
 * quien la toca, salvo mientras se cumple `off` (por ejemplo, mientras el
 * compañero pisa un botón). Eléctrica en la planta solar, de espinas en el bosque.
 */
export interface DuoBarrierDef extends Cell {
  id: string;
  height: number;
  off: DuoCondition;
  /**
   * Semáforo (Ciudad): además se apaga sola parte del tiempo. Cada `period`
   * segundos del reloj del servidor está en rojo (encendida) los primeros `red`.
   */
  cycle?: { period: number; red: number; offset?: number };
}

/**
 * Estanque de nivel variable (Río): el agua ocupa de abajo hacia arriba las
 * `depth` filas que empiezan en `row`. Sube hasta `high` filas mientras se
 * cumple `when` (alguien abre la válvula) y baja hasta `low` cuando no. Gota
 * nada en ella; a Lumen lo apaga.
 */
export interface DuoPoolDef extends Cell {
  id: string;
  width: number;
  depth: number;
  low: number;
  high: number;
  when: DuoCondition;
  /** Dónde se dibuja la rueda de la válvula (gira mientras el agua cambia). */
  valve?: Cell;
}

/** Tronco o nenúfar: flota en su estanque y sube y baja con el agua. */
export interface DuoFloaterDef {
  id: string;
  pool: string;
  col: number;
  width: number;
  kind: 'log' | 'lily';
}

/**
 * Corriente (en el agua) o cinta transportadora (sobre el suelo): arrastra
 * hacia `dir` a quien nada en su zona o va parado encima. Mientras se cumple
 * `reverse` va al revés; mientras se cumple `stop`, se detiene.
 */
export interface DuoFlowDef extends Cell {
  id: string;
  kind: 'current' | 'belt';
  width: number;
  /** Solo corrientes: filas de agua que cubre desde `row`. La cinta es la superficie de las celdas de `row`. */
  height?: number;
  dir: 1 | -1;
  reverse?: DuoCondition;
  stop?: DuoCondition;
  /** Solo se dibuja: la compuerta de donde sale la corriente (abierta mientras corre). */
  gate?: Cell;
}

/**
 * Prensa hidráulica (Reciclaje): su cabezal (una fila de alto) descansa en
 * `row`, baja `drop` filas y vuelve a subir cada `period` segundos del reloj
 * del servidor. Mientras baja o está abajo apaga a quien toca (arriba, no);
 * mientras se cumple `stop`, se queda arriba.
 */
export interface DuoPressDef extends Cell {
  id: string;
  width: number;
  drop: number;
  period: number;
  /** Desfase (s), para que dos prensas no bajen a la vez. */
  offset?: number;
  stop?: DuoCondition;
}

/**
 * Báscula: dos plataformas unidas. El lado con más peso (personajes o cajas)
 * baja y el otro sube, hasta `travel` celdas; con el mismo peso quedan parejas.
 */
export interface DuoScaleDef {
  id: string;
  left: Cell & { width: number };
  right: Cell & { width: number };
  travel: number;
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
  /**
   * Cerrojos: interruptores que quedan activos para siempre cuando se cumple
   * su condición; por ejemplo, dos botones lejanos pisados a la vez.
   */
  latches?: Array<{ id: string; when: DuoCondition }>;
  bridges: Array<Cell & { id: string; width: number; when: DuoCondition }>;
  /** `heavy`: caja de metal, solo se mueve si la empujan los dos a la vez. */
  crates: Array<Cell & { id: string; heavy?: boolean }>;
  gems?: DuoGemDef[];
  keys?: DuoKeyDef[];
  locks?: DuoLockDef[];
  barriers?: DuoBarrierDef[];
  /** Hongos saltarines: quien cae encima sale disparado hacia arriba. */
  springs?: Array<Cell & { id: string }>;
  /** Banderas de control: al tocarlas, los dos reaparecen ahí si se apagan. */
  flags?: Array<Cell & { id: string }>;
  scales?: DuoScaleDef[];
  pools?: DuoPoolDef[];
  floaters?: DuoFloaterDef[];
  flows?: DuoFlowDef[];
  presses?: DuoPressDef[];
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

export const GEM_SIZE = 32;
export const KEY_SIZE = 36;
export const LOCK_W = 44;
export const BARRIER_W = 20;
export const SPRING_W = 46;
export const SPRING_H = 30;

export function gemRect(cell: Cell): Rect {
  return { x: cell.col * TILE + (TILE - GEM_SIZE) / 2, y: cell.row * TILE + (TILE - GEM_SIZE) / 2, w: GEM_SIZE, h: GEM_SIZE };
}

export function keyRect(cell: Cell): Rect {
  return { x: cell.col * TILE + (TILE - KEY_SIZE) / 2, y: cell.row * TILE + (TILE - KEY_SIZE) / 2, w: KEY_SIZE, h: KEY_SIZE };
}

export function lockRect(lock: Cell & { height: number }): Rect {
  return { x: lock.col * TILE + (TILE - LOCK_W) / 2, y: lock.row * TILE, w: LOCK_W, h: lock.height * TILE };
}

export function barrierRect(barrier: Cell & { height: number }): Rect {
  return { x: barrier.col * TILE + (TILE - BARRIER_W) / 2, y: barrier.row * TILE, w: BARRIER_W, h: barrier.height * TILE };
}

/** El hongo saltarín: su sombrero es lo que se pisa. */
export function springRect(cell: Cell): Rect {
  return { x: cell.col * TILE + (TILE - SPRING_W) / 2, y: (cell.row + 1) * TILE - SPRING_H, w: SPRING_W, h: SPRING_H };
}

/** La bandera se toca en cualquier punto del asta (dos celdas de alto). */
export function flagRect(cell: Cell): Rect {
  return { x: cell.col * TILE + 12, y: (cell.row - 1) * TILE, w: TILE - 24, h: 2 * TILE };
}

/** Un lado de la báscula, desplazado `offset` px hacia abajo (negativo: hacia arriba). */
export function scaleSideRect(side: Cell & { width: number }, offset: number): Rect {
  return { x: side.col * TILE, y: side.row * TILE + offset, w: side.width * TILE, h: BRIDGE_H };
}

/** Id con el que un personaje cuenta que va parado en un lado de una báscula (en `DuoPlayerNet.mover`). */
export function scaleSideId(scaleId: string, side: 'left' | 'right'): string {
  return `scale:${scaleId}:${side}`;
}

/** Velocidad con la que sube o baja el agua de un estanque (px/s). */
export const POOL_SPEED = 80;
/**
 * Lo que asoma la superficie de un tronco o nenúfar sobre el agua (px). En 0,
 * con el estanque lleno hasta la orilla, el tronco queda al ras y se pasa
 * caminando de la orilla al tronco.
 */
export const FLOAT_RISE = 0;

/** El agua de un estanque con `level` px de alto (desde su fondo). */
export function poolWaterRect(pool: DuoPoolDef, level: number): Rect {
  const bottom = (pool.row + pool.depth) * TILE;
  return { x: pool.col * TILE, y: bottom - level, w: pool.width * TILE, h: level };
}

/** La superficie que se pisa de un tronco o nenúfar con el agua de su estanque a `level` px. */
export function floaterRect(floater: DuoFloaterDef, pool: DuoPoolDef, level: number): Rect {
  const surface = (pool.row + pool.depth) * TILE - level;
  return { x: floater.col * TILE + 4, y: surface - FLOAT_RISE, w: floater.width * TILE - 8, h: BRIDGE_H };
}

/** Id con el que un personaje cuenta que va parado en un tronco (en `DuoPlayerNet.mover`). */
export function floaterMoverId(floaterId: string): string {
  return `float:${floaterId}`;
}

/** Arrastre de una corriente (px/s): Gota nada a 190, así que contra ella no avanza. */
export const CURRENT_SPEED = 200;
/** Arrastre de una cinta transportadora (px/s); se camina a 290. */
export const BELT_SPEED = 140;

/** La zona de agua de una corriente. */
export function currentRect(flow: DuoFlowDef): Rect {
  return { x: flow.col * TILE, y: flow.row * TILE, w: flow.width * TILE, h: (flow.height ?? 1) * TILE };
}

/** El cabezal de una prensa bajado `k` (0 = arriba, 1 = abajo del todo). */
export function pressHeadRect(press: DuoPressDef, k: number): Rect {
  return { x: press.col * TILE + 4, y: (press.row + press.drop * k) * TILE, w: press.width * TILE - 8, h: TILE };
}

/**
 * Cuánto bajó el cabezal de una prensa a la hora `t` (segundos del servidor):
 * arriba quieta, baja de golpe, se queda abajo un instante y sube despacio.
 */
export function pressDrop(press: DuoPressDef, t: number): number {
  const phase = ((((t + (press.offset ?? 0)) % press.period) + press.period) % press.period) / press.period;
  if (phase < 0.5) return 0;
  if (phase < 0.6) return ((phase - 0.5) / 0.1) ** 2;
  if (phase < 0.72) return 1;
  return 1 - (phase - 0.72) / 0.28;
}

/** ¿El semáforo de esta barrera está en rojo a la hora `t`? (sin ciclo: siempre) */
export function cycleRed(cycle: DuoBarrierDef['cycle'], t: number): boolean {
  if (!cycle) return true;
  const phase = (((t + (cycle.offset ?? 0)) % cycle.period) + cycle.period) % cycle.period;
  return phase < cycle.red;
}

export function crateSpawn(cell: Cell): { x: number; y: number } {
  return { x: cell.col * TILE + (TILE - CRATE_SIZE) / 2, y: (cell.row + 1) * TILE - CRATE_SIZE };
}
