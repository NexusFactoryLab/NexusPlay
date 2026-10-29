import {
  CRATE_SIZE,
  TILE,
  barrierRect,
  bridgeRect,
  buttonRect,
  coinRect,
  crateSpawn,
  flagRect,
  gateWallRect,
  gemRect,
  keyRect,
  leverRect,
  lockRect,
  MIRROR_ANGLES,
  moverRect,
  overlaps,
  pedestalRect,
  scaleSideId,
  scaleSideRect,
  springRect,
  type Cell,
  type DuoCondition,
  type DuoGateDef,
  type DuoLevel,
  type DuoScaleDef,
} from './duoLevel.js';
import type { DuoCrateState, DuoPlayerNet, DuoRole, DuoWorldState, Rect } from './duoTypes.js';

export const PLAYER_W = 40;
export const PLAYER_H = 56;

/** Hitbox de un personaje a partir del centro de sus pies. */
export function playerRect(p: { x: number; y: number }): Rect {
  return { x: p.x - PLAYER_W / 2, y: p.y - PLAYER_H, w: PLAYER_W, h: PLAYER_H };
}

export function crateRect(c: { x: number; y: number }): Rect {
  return { x: c.x, y: c.y, w: CRATE_SIZE, h: CRATE_SIZE };
}

export function createWorldState(level: DuoLevel): DuoWorldState {
  const switches: Record<string, boolean> = {};
  for (const b of level.def.buttons) switches[b.id] = false;
  for (const l of level.def.levers) switches[l.id] = false;
  for (const l of level.def.latches ?? []) switches[l.id] = false;
  return {
    switches,
    crates: level.def.crates.map((c) => ({ id: c.id, ...crateSpawn(c), owner: null })),
    coins: {},
    gates: {},
    mirrors: Object.fromEntries((level.def.mirrors ?? []).map((m) => [m.id, m.start % MIRROR_ANGLES])),
    gems: {},
    keys: {},
    locks: {},
    flags: {},
    scales: Object.fromEntries((level.def.scales ?? []).map((s) => [s.id, 0])),
  };
}

export function isConditionMet(condition: DuoCondition, switches: Record<string, boolean>): boolean {
  const all = condition.all ?? [];
  const any = condition.any ?? [];
  return all.every((id) => switches[id]) && (any.length === 0 || any.some((id) => switches[id]));
}

export function isBridgeOn(level: DuoLevel, world: DuoWorldState, bridgeId: string): boolean {
  const bridge = level.def.bridges.find((b) => b.id === bridgeId);
  return !!bridge && isConditionMet(bridge.when, world.switches);
}

/** Lo que bloquea a un personaje además de las celdas sólidas del mapa. */
export interface DynamicSolids {
  /** Bloquean por todos lados. */
  solid: Rect[];
  /** Solo se pisan desde arriba (puentes de luz, plataformas móviles y básculas). */
  oneWay: Rect[];
  /** Hongos saltarines (también bloquean): quien cae encima rebota. */
  springs: Rect[];
}

/** `time`: segundos del reloj del servidor, para ubicar las plataformas móviles. */
export function dynamicSolids(level: DuoLevel, world: DuoWorldState, time = 0): DynamicSolids {
  const solid: Rect[] = [];
  for (const gate of level.def.gates) {
    solid.push(pedestalRect(gate.pedestals.FIRE), pedestalRect(gate.pedestals.WATER));
    if (gate.wall && !world.gates[gate.id]) solid.push(gateWallRect(gate.wall));
  }
  for (const lock of level.def.locks ?? []) {
    if (!world.locks?.[lock.id]) solid.push(lockRect(lock));
  }
  const springs = (level.def.springs ?? []).map(springRect);
  solid.push(...springs);
  const oneWay = level.def.bridges.filter((b) => isConditionMet(b.when, world.switches)).map(bridgeRect);
  for (const mover of level.def.movers ?? []) oneWay.push(moverRect(mover, time));
  for (const scale of level.def.scales ?? []) {
    const offset = world.scales?.[scale.id] ?? 0;
    oneWay.push(scaleSideRect(scale.left, offset), scaleSideRect(scale.right, -offset));
  }
  return { solid, oneWay, springs };
}

/** La barrera apaga a quien la toca (está encendida) salvo mientras se cumple su condición. */
export function isBarrierActive(level: DuoLevel, world: DuoWorldState, barrierId: string): boolean {
  const barrier = (level.def.barriers ?? []).find((b) => b.id === barrierId);
  return !!barrier && !isConditionMet(barrier.off, world.switches);
}

/** Las barreras encendidas que toca un rectángulo. */
export function touchesActiveBarrier(level: DuoLevel, world: DuoWorldState, rect: Rect): boolean {
  return (level.def.barriers ?? []).some((b) => !isConditionMet(b.off, world.switches) && overlaps(barrierRect(b), rect));
}

/** Rectángulo de cada lado de una báscula con el desplazamiento actual del mundo. */
export function scaleSides(scale: DuoScaleDef, world: DuoWorldState): { left: Rect; right: Rect } {
  const offset = world.scales?.[scale.id] ?? 0;
  return { left: scaleSideRect(scale.left, offset), right: scaleSideRect(scale.right, -offset) };
}

/** El lado de báscula al que corresponde un id de `DuoPlayerNet.mover` ("scale:<id>:left"), si lo es. */
export function scaleSideOf(level: DuoLevel, moverId: string | undefined): { scale: DuoScaleDef; side: 'left' | 'right' } | null {
  if (!moverId?.startsWith('scale:')) return null;
  for (const scale of level.def.scales ?? []) {
    for (const side of ['left', 'right'] as const) if (scaleSideId(scale.id, side) === moverId) return { scale, side };
  }
  return null;
}

/** Siguiente Puerta del Saber sin abrir (en orden), o null si ya se abrieron todas. */
export function nextGate(level: DuoLevel, world: DuoWorldState): DuoGateDef | null {
  return level.def.gates.find((g) => !world.gates[g.id]) ?? null;
}

/**
 * Celda de reaparición de cada personaje: la más avanzada entre el inicio,
 * las puertas ya abiertas y las banderas de control ya tocadas.
 */
export function checkpointFor(level: DuoLevel, world: DuoWorldState, role: DuoRole): Cell {
  let cell = level.def.spawns[role];
  for (const gate of level.def.gates) {
    if (world.gates[gate.id] && gate.respawn[role].col >= cell.col) cell = gate.respawn[role];
  }
  for (const flag of level.def.flags ?? []) {
    if (world.flags?.[flag.id] && flag.col >= cell.col) cell = { col: role === 'FIRE' ? flag.col : flag.col + 1, row: flag.row };
  }
  return cell;
}

type Bodies = Partial<Record<DuoRole, DuoPlayerNet>>;

function livingRects(players: Bodies): Array<{ role: DuoRole; rect: Rect }> {
  const out: Array<{ role: DuoRole; rect: Rect }> = [];
  for (const role of ['FIRE', 'WATER'] as const) {
    const p = players[role];
    if (p && !p.dead) out.push({ role, rect: playerRect(p) });
  }
  return out;
}

/**
 * Recalcula los interruptores con las posiciones actuales: un botón está activo
 * mientras alguien (o una caja) lo pisa; una palanca queda activa al tocarla.
 * Devuelve true si algo cambió.
 */
export function updateSwitches(level: DuoLevel, world: DuoWorldState, players: Bodies): boolean {
  let changed = false;
  const bodies = livingRects(players);
  const crates = world.crates.map(crateRect);
  for (const button of level.def.buttons) {
    const plate = buttonRect(button);
    // Se mira un poco por encima de la placa: quien está parado encima la toca con los pies.
    const zone = { x: plate.x, y: plate.y - 6, w: plate.w, h: plate.h + 6 };
    const pressed = bodies.some((b) => overlaps(b.rect, zone)) || crates.some((c) => overlaps(c, zone));
    if (world.switches[button.id] !== pressed) {
      world.switches[button.id] = pressed;
      changed = true;
    }
  }
  // Receptores de luz: encendidos mientras todos sus espejos apuntan bien.
  for (const receiver of level.def.receivers ?? []) {
    const lit = isReceiverLit(level, world, receiver.id);
    if (world.switches[receiver.id] !== lit) {
      world.switches[receiver.id] = lit;
      changed = true;
    }
  }
  for (const lever of level.def.levers) {
    if (world.switches[lever.id]) continue;
    const rect = leverRect(lever);
    if (bodies.some((b) => (!lever.role || lever.role === b.role) && overlaps(b.rect, rect))) {
      world.switches[lever.id] = true;
      changed = true;
    }
  }
  // Cerrojos: se activan cuando su condición se cumple (aunque sea un instante) y quedan así.
  for (const latch of level.def.latches ?? []) {
    if (world.switches[latch.id] || !isConditionMet(latch.when, world.switches)) continue;
    world.switches[latch.id] = true;
    changed = true;
  }
  return changed;
}

/** Cuántos espejos seguidos (desde la fuente) ya dejan pasar la luz hacia este receptor. */
export function litMirrorCount(level: DuoLevel, world: DuoWorldState, receiverId: string): number {
  const receiver = (level.def.receivers ?? []).find((r) => r.id === receiverId);
  if (!receiver) return 0;
  let count = 0;
  for (const id of receiver.mirrors) {
    const mirror = (level.def.mirrors ?? []).find((m) => m.id === id);
    if (!mirror || world.mirrors[id] !== mirror.target) break;
    count += 1;
  }
  return count;
}

export function isReceiverLit(level: DuoLevel, world: DuoWorldState, receiverId: string): boolean {
  const receiver = (level.def.receivers ?? []).find((r) => r.id === receiverId);
  return !!receiver && litMirrorCount(level, world, receiverId) === receiver.mirrors.length;
}

/** Recoge las fichas que toca cada personaje. Devuelve las recién tomadas. */
export function collectCoins(level: DuoLevel, world: DuoWorldState, players: Bodies): Array<{ id: string; by: DuoRole }> {
  const taken: Array<{ id: string; by: DuoRole }> = [];
  for (const body of livingRects(players)) {
    for (const coin of level.def.coins) {
      if (world.coins[coin.id]) continue;
      if (overlaps(body.rect, coinRect(coin))) {
        world.coins[coin.id] = body.role;
        taken.push({ id: coin.id, by: body.role });
      }
    }
  }
  return taken;
}

/** Recoge las gemas que toca cada personaje (la roja solo Lumen, la azul solo Gota). Devuelve las recién tomadas. */
export function collectGems(level: DuoLevel, world: DuoWorldState, players: Bodies): Array<{ id: string; by: DuoRole }> {
  const taken: Array<{ id: string; by: DuoRole }> = [];
  for (const body of livingRects(players)) {
    for (const gem of level.def.gems ?? []) {
      if (world.gems[gem.id] || (gem.color !== 'BOTH' && gem.color !== body.role)) continue;
      if (overlaps(body.rect, gemRect(gem))) {
        world.gems[gem.id] = body.role;
        taken.push({ id: gem.id, by: body.role });
      }
    }
  }
  return taken;
}

export type DuoKeyEvent = { kind: 'key-taken'; id: string; by: DuoRole } | { kind: 'key-dropped'; id: string } | { kind: 'lock-opened'; id: string; by: DuoRole };

/**
 * Llaves y candados: quien toca una llave la lleva; si se apaga (o sale), la
 * llave vuelve a su lugar; al tocar con ella su puerta, la puerta se abre.
 */
export function updateKeys(level: DuoLevel, world: DuoWorldState, players: Bodies): DuoKeyEvent[] {
  const events: DuoKeyEvent[] = [];
  const living = livingRects(players);
  for (const key of level.def.keys ?? []) {
    const holder = world.keys[key.id];
    if (holder === 'used') continue;
    if (holder) {
      const body = living.find((b) => b.role === holder);
      if (!body) {
        delete world.keys[key.id];
        events.push({ kind: 'key-dropped', id: key.id });
        continue;
      }
      const lock = (level.def.locks ?? []).find((l) => l.id === key.lock);
      if (!lock) continue;
      const door = lockRect(lock);
      const reach = { x: door.x - 12, y: door.y, w: door.w + 24, h: door.h };
      if (overlaps(body.rect, reach)) {
        world.locks[lock.id] = true;
        world.keys[key.id] = 'used';
        events.push({ kind: 'lock-opened', id: lock.id, by: holder });
      }
      continue;
    }
    const finder = living.find((b) => overlaps(b.rect, keyRect(key)));
    if (finder) {
      world.keys[key.id] = finder.role;
      events.push({ kind: 'key-taken', id: key.id, by: finder.role });
    }
  }
  return events;
}

/** Marca las banderas de control que toca algún personaje. Devuelve las recién tocadas. */
export function updateFlags(level: DuoLevel, world: DuoWorldState, players: Bodies): string[] {
  const touched: string[] = [];
  const living = livingRects(players);
  for (const flag of level.def.flags ?? []) {
    if (world.flags[flag.id]) continue;
    if (living.some((b) => overlaps(b.rect, flagRect(flag)))) {
      world.flags[flag.id] = true;
      touched.push(flag.id);
    }
  }
  return touched;
}

/** Velocidad con la que se mueve una báscula (px/s). */
export const SCALE_SPEED = 150;

/**
 * Básculas: cuenta el peso de cada lado —los personajes que cuentan que van
 * parados ahí (`mover`) y las cajas apoyadas— y acerca la báscula a su
 * posición: el lado más pesado baja hasta `travel` celdas.
 */
export function updateScales(level: DuoLevel, world: DuoWorldState, players: Bodies, dt: number): void {
  for (const scale of level.def.scales ?? []) {
    const sides = scaleSides(scale, world);
    const weight = (side: 'left' | 'right') => {
      const rect = sides[side];
      let w = 0;
      for (const role of ['FIRE', 'WATER'] as const) {
        const p = players[role];
        if (p && !p.dead && p.mover?.id === scaleSideId(scale.id, side)) w += 1;
      }
      for (const c of world.crates) {
        const bottom = c.y + CRATE_SIZE;
        if (Math.abs(bottom - rect.y) < 8 && c.x + CRATE_SIZE > rect.x && c.x < rect.x + rect.w) w += 1;
      }
      return w;
    };
    const diff = weight('left') - weight('right');
    const target = Math.sign(diff) * scale.travel * TILE;
    const current = world.scales[scale.id] ?? 0;
    const step = SCALE_SPEED * dt;
    world.scales[scale.id] = Math.abs(target - current) <= step ? target : current + Math.sign(target - current) * step;
  }
}

/** ¿Está este personaje parado sobre su pedestal de esta puerta? */
export function isOnPedestal(gate: DuoGateDef, role: DuoRole, player: DuoPlayerNet | undefined): boolean {
  if (!player || player.dead) return false;
  const top = pedestalRect(gate.pedestals[role]);
  const onTop = Math.abs(player.y - top.y) <= 6;
  const centered = player.x >= top.x - 4 && player.x <= top.x + top.w + 4;
  return onTop && centered;
}

/** La puerta cuyos dos pedestales están ocupados por su dueño, si hay una. */
export function gateWithBothOnPedestals(level: DuoLevel, world: DuoWorldState, players: Bodies): DuoGateDef | null {
  const gate = nextGate(level, world);
  if (!gate) return null;
  return isOnPedestal(gate, 'FIRE', players.FIRE) && isOnPedestal(gate, 'WATER', players.WATER) ? gate : null;
}

/** Cuántas fichas de pista de esta puerta ya se recogieron. */
export function coinsForGate(level: DuoLevel, world: DuoWorldState, gateId: string): number {
  return level.def.coins.filter((c) => c.gate === gateId && world.coins[c.id]).length;
}

export function resetCrate(level: DuoLevel, crate: DuoCrateState): void {
  const def = level.def.crates.find((c) => c.id === crate.id);
  if (!def) return;
  const spawn = crateSpawn(def);
  crate.x = spawn.x;
  crate.y = spawn.y;
  crate.owner = null;
}
