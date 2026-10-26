import { TILE, isLiquidTile, isSolidTile, tileAt, type DuoLevel, type TileKind } from './duoLevel.js';
import { PLAYER_H, PLAYER_W, crateRect, dynamicSolids, playerRect, type DynamicSolids } from './duoWorld.js';
import type { DuoAnim, DuoInput, DuoPlayerNet, DuoRole, DuoWorldState, Rect } from './duoTypes.js';

/** Paso fijo de la simulación (s). El cliente corre varios por cuadro si hace falta. */
export const STEP = 1 / 60;

/**
 * Ajuste del movimiento. Con estos valores un salto sube ~2,5 celdas y cruza
 * ~3 celdas de vacío: un muro de 3 celdas exige la caja y un foso de 5, el puente.
 */
export const PHYS = {
  gravity: 2300,
  moveSpeed: 290,
  pushSpeed: 150,
  groundAccel: 3200,
  airAccel: 2100,
  jumpSpeed: 860,
  /** Soltar el salto antes corta la subida: saltos cortos y largos. */
  jumpCut: 340,
  maxFall: 950,
  /** Un instante para saltar aunque ya se haya salido del borde. */
  coyote: 0.09,
  /** Un salto pedido un poco antes de tocar el piso igual cuenta. */
  jumpBuffer: 0.12,
  swimGravity: 650,
  swimMaxSink: 170,
  swimSpeed: 190,
  swimStroke: 560,
  respawnDelay: 1.1,
  dropThrough: 0.25,
} as const;

export type DeathCause = 'lava' | 'water' | 'sludge' | 'thorns' | 'fall';

export interface PlayerSim {
  role: DuoRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  coyote: number;
  jumpBuffer: number;
  jumpHeld: boolean;
  swimming: boolean;
  pushing: boolean;
  dropTimer: number;
  dead: boolean;
  deadTimer: number;
  cheering: boolean;
}

export interface CrateSim {
  id: string;
  x: number;
  y: number;
  vy: number;
}

export interface StepContext {
  level: DuoLevel;
  world: DuoWorldState;
  /** Posiciones actuales de las cajas (las propias se mueven aquí mismo). */
  crates: CrateSim[];
  /** Si este personaje puede empujar la caja (nadie más la está moviendo). */
  canPush: (crateId: string) => boolean;
  /** Avisa que se empujó una caja: el cliente la toma como propia. */
  onPush?: (crateId: string) => void;
  /** Dónde reaparece el personaje si se apaga. */
  respawnAt: { x: number; y: number };
}

export type StepEvent = { kind: 'died'; cause: DeathCause } | { kind: 'respawned' } | null;

export function createPlayer(role: DuoRole, at: { x: number; y: number }): PlayerSim {
  return {
    role,
    x: at.x,
    y: at.y,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    jumpHeld: false,
    swimming: false,
    pushing: false,
    dropTimer: 0,
    dead: false,
    deadTimer: 0,
    cheering: false,
  };
}

function approach(value: number, target: number, delta: number): number {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}

const EPS = 0.001;

interface Blocker {
  rect: Rect;
  crate?: CrateSim;
}

/** Todo lo sólido que toca `rect`: celdas del mapa, pedestales, muros, cajas. */
function blockersFor(level: DuoLevel, dyn: DynamicSolids, crates: CrateSim[], rect: Rect, skipCrate?: CrateSim): Blocker[] {
  const out: Blocker[] = [];
  const c0 = Math.floor(rect.x / TILE);
  const c1 = Math.floor((rect.x + rect.w - EPS) / TILE);
  const r0 = Math.floor(rect.y / TILE);
  const r1 = Math.floor((rect.y + rect.h - EPS) / TILE);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (isSolidTile(tileAt(level, col, row))) out.push({ rect: { x: col * TILE, y: row * TILE, w: TILE, h: TILE } });
    }
  }
  for (const s of dyn.solid) if (overlapsStrict(s, rect)) out.push({ rect: s });
  for (const crate of crates) {
    if (crate === skipCrate) continue;
    const cr = crateRect(crate);
    if (overlapsStrict(cr, rect)) out.push({ rect: cr, crate });
  }
  return out;
}

function overlapsStrict(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;
}

/** Superficies que solo frenan desde arriba (ramas y puentes) bajo un tramo horizontal. */
function oneWayTops(level: DuoLevel, dyn: DynamicSolids, x: number, w: number, fromY: number, toY: number): number | null {
  let best: number | null = null;
  const c0 = Math.floor(x / TILE);
  const c1 = Math.floor((x + w - EPS) / TILE);
  const r0 = Math.floor(fromY / TILE);
  const r1 = Math.floor(toY / TILE);
  for (let row = Math.max(0, r0); row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (tileAt(level, col, row) !== 'branch') continue;
      const top = row * TILE;
      if (fromY <= top + EPS && toY > top && (best === null || top < best)) best = top;
    }
  }
  for (const r of dyn.oneWay) {
    if (x < r.x + r.w && x + w > r.x && fromY <= r.y + EPS && toY > r.y && (best === null || r.y < best)) best = r.y;
  }
  return best;
}

/** Mueve una caja en x lo que pueda (sin atravesar nada). Devuelve lo que se movió. */
function pushCrateX(level: DuoLevel, dyn: DynamicSolids, crates: CrateSim[], crate: CrateSim, dx: number): number {
  const next = { ...crateRect(crate), x: crate.x + dx };
  let moved = dx;
  for (const b of blockersFor(level, dyn, crates, next, crate)) {
    if (dx > 0) moved = Math.min(moved, b.rect.x - (crate.x + next.w));
    else moved = Math.max(moved, b.rect.x + b.rect.w - crate.x);
  }
  if (dx > 0) moved = Math.max(0, moved);
  else moved = Math.min(0, moved);
  crate.x += moved;
  return moved;
}

/** ¿La caja está apoyada? Solo se empuja una caja que no está cayendo. */
function crateResting(level: DuoLevel, dyn: DynamicSolids, crates: CrateSim[], crate: CrateSim): boolean {
  const probe = { ...crateRect(crate), y: crate.y + 1 };
  if (blockersFor(level, dyn, crates, probe, crate).length > 0) return true;
  return oneWayTops(level, dyn, crate.x, probe.w, crate.y + probe.h - 0.5, crate.y + probe.h + 1) !== null;
}

/** Gravedad de una caja que mueve este cliente. Devuelve false si cayó a un líquido (hay que reponerla). */
export function stepCrate(level: DuoLevel, world: DuoWorldState, crates: CrateSim[], crate: CrateSim, dt: number): boolean {
  const dyn = dynamicSolids(level, world);
  crate.vy = Math.min(crate.vy + PHYS.gravity * dt, PHYS.maxFall);
  const dy = crate.vy * dt;
  const rect = crateRect(crate);
  const next = { ...rect, y: crate.y + dy };
  let landY: number | null = null;
  for (const b of blockersFor(level, dyn, crates, next, crate)) {
    if (dy > 0) landY = landY === null ? b.rect.y : Math.min(landY, b.rect.y);
  }
  const top = dy > 0 ? oneWayTops(level, dyn, crate.x, rect.w, crate.y + rect.h, crate.y + rect.h + dy) : null;
  if (top !== null && (landY === null || top < landY)) landY = top;
  if (landY !== null && dy > 0) {
    crate.y = landY - rect.h;
    crate.vy = 0;
  } else {
    crate.y += dy;
  }
  const center = tileAt(level, Math.floor((crate.x + rect.w / 2) / TILE), Math.floor((crate.y + rect.h / 2) / TILE));
  return !isLiquidTile(center) && crate.y < level.heightPx;
}

/** Qué celda de peligro toca el personaje, si alguna. */
function hazardUnder(level: DuoLevel, p: PlayerSim): TileKind | null {
  // Los líquidos se miran a la altura de los pies (un poco adentro del cuerpo).
  const feet = tileAt(level, Math.floor(p.x / TILE), Math.floor((p.y - 10) / TILE));
  if (isLiquidTile(feet)) return feet;
  // Las espinas ocupan la mitad baja de su celda.
  const rect = playerRect(p);
  const c0 = Math.floor(rect.x / TILE);
  const c1 = Math.floor((rect.x + rect.w - EPS) / TILE);
  const r0 = Math.floor(rect.y / TILE);
  const r1 = Math.floor((rect.y + rect.h - EPS) / TILE);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (tileAt(level, col, row) === 'thorns' && rect.y + rect.h > row * TILE + TILE * 0.55) return 'thorns';
    }
  }
  return null;
}

function kill(p: PlayerSim, cause: DeathCause): StepEvent {
  p.dead = true;
  p.deadTimer = PHYS.respawnDelay;
  p.vx = 0;
  p.vy = 0;
  p.swimming = false;
  p.pushing = false;
  return { kind: 'died', cause };
}

/** Un paso de simulación del personaje propio. */
export function stepPlayer(p: PlayerSim, input: DuoInput, ctx: StepContext, dt: number): StepEvent {
  const { level } = ctx;
  if (p.dead) {
    p.deadTimer -= dt;
    if (p.deadTimer > 0) return null;
    p.dead = false;
    p.x = ctx.respawnAt.x;
    p.y = ctx.respawnAt.y;
    p.vx = 0;
    p.vy = 0;
    p.grounded = false;
    return { kind: 'respawned' };
  }
  const dyn = dynamicSolids(level, ctx.world);

  // --- Horizontal ---
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) p.facing = dir as 1 | -1;
  const speed = p.swimming ? PHYS.swimSpeed : p.pushing ? PHYS.pushSpeed : PHYS.moveSpeed;
  const accel = p.grounded || p.swimming ? PHYS.groundAccel : PHYS.airAccel;
  p.vx = approach(p.vx, dir * speed, accel * dt);

  // --- Salto ---
  const pressed = input.jump && !p.jumpHeld;
  p.jumpHeld = input.jump;
  p.jumpBuffer = pressed ? PHYS.jumpBuffer : Math.max(0, p.jumpBuffer - dt);
  p.coyote = p.grounded ? PHYS.coyote : Math.max(0, p.coyote - dt);
  if (p.swimming) {
    if (pressed) p.vy = -PHYS.swimStroke;
  } else if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = -PHYS.jumpSpeed;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.grounded = false;
  }
  if (!p.swimming && !input.jump && p.vy < -PHYS.jumpCut) p.vy = -PHYS.jumpCut;

  // --- Gravedad ---
  if (p.swimming) p.vy = Math.min(p.vy + PHYS.swimGravity * dt, PHYS.swimMaxSink);
  else p.vy = Math.min(p.vy + PHYS.gravity * dt, PHYS.maxFall);

  if (input.down && p.grounded) p.dropTimer = PHYS.dropThrough;
  else p.dropTimer = Math.max(0, p.dropTimer - dt);

  // --- Mover en x (empujando cajas) ---
  p.pushing = false;
  const dx = p.vx * dt;
  if (dx !== 0) {
    let target = p.x + dx;
    const half = PLAYER_W / 2;
    const next = { ...playerRect(p), x: target - half };
    let blockers = blockersFor(level, dyn, ctx.crates, next);
    for (const b of blockers) {
      if (!b.crate || !p.grounded || !ctx.canPush(b.crate.id)) continue;
      if (!crateResting(level, dyn, ctx.crates, b.crate)) continue;
      const overlap = dx > 0 ? next.x + next.w - b.rect.x : next.x - (b.rect.x + b.rect.w);
      const moved = pushCrateX(level, dyn, ctx.crates, b.crate, overlap);
      if (moved !== 0) {
        p.pushing = true;
        ctx.onPush?.(b.crate.id);
      }
    }
    blockers = blockersFor(level, dyn, ctx.crates, next);
    for (const b of blockers) {
      if (dx > 0) target = Math.min(target, b.rect.x - half);
      else target = Math.max(target, b.rect.x + b.rect.w + half);
      if (b.crate && p.grounded) p.pushing = true;
    }
    if ((dx > 0 && target < p.x) || (dx < 0 && target > p.x)) target = p.x;
    if (target !== p.x + dx) p.vx = 0;
    p.x = target;
  }

  // --- Mover en y ---
  const dy = p.vy * dt;
  const wasGrounded = p.grounded;
  p.grounded = false;
  if (dy !== 0) {
    const rect = playerRect(p);
    const next = { ...rect, y: rect.y + dy };
    const blockers = blockersFor(level, dyn, ctx.crates, next);
    if (dy > 0) {
      let land: number | null = null;
      for (const b of blockers) land = land === null ? b.rect.y : Math.min(land, b.rect.y);
      if (p.dropTimer <= 0) {
        const top = oneWayTops(level, dyn, rect.x, rect.w, p.y, p.y + dy);
        if (top !== null && (land === null || top < land)) land = top;
      }
      if (land !== null) {
        p.y = land;
        p.vy = 0;
        p.grounded = true;
      } else {
        p.y += dy;
      }
    } else {
      let ceiling: number | null = null;
      for (const b of blockers) ceiling = ceiling === null ? b.rect.y + b.rect.h : Math.max(ceiling, b.rect.y + b.rect.h);
      if (ceiling !== null) {
        p.y = ceiling + PLAYER_H;
        p.vy = 0;
      } else {
        p.y += dy;
      }
    }
  }
  if (!p.grounded && wasGrounded && p.vy >= 0) p.coyote = PHYS.coyote;

  // --- Bordes del mundo ---
  p.x = Math.max(PLAYER_W / 2, Math.min(level.widthPx - PLAYER_W / 2, p.x));
  if (p.y - PLAYER_H > level.heightPx) return kill(p, 'fall');

  // --- Líquidos y peligros ---
  const hazard = hazardUnder(level, p);
  const ownLiquid = (p.role === 'FIRE' && hazard === 'lava') || (p.role === 'WATER' && hazard === 'water');
  p.swimming = ownLiquid;
  if (hazard && !ownLiquid) return kill(p, hazard as DeathCause);
  return null;
}

/** Animación que corresponde al estado físico. */
export function animFor(p: PlayerSim): DuoAnim {
  if (p.dead) return 'hurt';
  if (p.cheering) return 'cheer';
  if (p.swimming) return 'swim';
  if (p.grounded) {
    if (p.pushing) return 'push';
    return Math.abs(p.vx) > 20 ? 'walk' : 'idle';
  }
  if (p.vy < -220) return 'rise';
  if (p.vy < 220) return 'peak';
  return 'fall';
}

export function toNet(p: PlayerSim): DuoPlayerNet {
  return {
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
    vx: Math.round(p.vx),
    vy: Math.round(p.vy),
    facing: p.facing,
    anim: animFor(p),
    dead: p.dead,
  };
}
