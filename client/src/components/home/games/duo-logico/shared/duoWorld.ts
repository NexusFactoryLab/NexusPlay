import {
  CRATE_SIZE,
  bridgeRect,
  buttonRect,
  coinRect,
  crateSpawn,
  gateWallRect,
  leverRect,
  overlaps,
  pedestalRect,
  type DuoCondition,
  type DuoGateDef,
  type DuoLevel,
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
  return {
    switches,
    crates: level.def.crates.map((c) => ({ id: c.id, ...crateSpawn(c), owner: null })),
    coins: {},
    gates: {},
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
  /** Solo se pisan desde arriba (puentes de luz). */
  oneWay: Rect[];
}

export function dynamicSolids(level: DuoLevel, world: DuoWorldState): DynamicSolids {
  const solid: Rect[] = [];
  for (const gate of level.def.gates) {
    solid.push(pedestalRect(gate.pedestals.FIRE), pedestalRect(gate.pedestals.WATER));
    if (gate.wall && !world.gates[gate.id]) solid.push(gateWallRect(gate.wall));
  }
  const oneWay = level.def.bridges.filter((b) => isConditionMet(b.when, world.switches)).map(bridgeRect);
  return { solid, oneWay };
}

/** Siguiente Puerta del Saber sin abrir (en orden), o null si ya se abrieron todas. */
export function nextGate(level: DuoLevel, world: DuoWorldState): DuoGateDef | null {
  return level.def.gates.find((g) => !world.gates[g.id]) ?? null;
}

/** Celda de reaparición de cada personaje según las puertas ya abiertas. */
export function checkpointFor(level: DuoLevel, world: DuoWorldState, role: DuoRole) {
  let cell = level.def.spawns[role];
  for (const gate of level.def.gates) {
    if (world.gates[gate.id]) cell = gate.respawn[role];
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
  for (const lever of level.def.levers) {
    if (world.switches[lever.id]) continue;
    const rect = leverRect(lever);
    if (bodies.some((b) => (!lever.role || lever.role === b.role) && overlaps(b.rect, rect))) {
      world.switches[lever.id] = true;
      changed = true;
    }
  }
  return changed;
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
