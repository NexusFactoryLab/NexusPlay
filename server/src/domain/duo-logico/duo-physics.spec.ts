import { describe, expect, it } from 'vitest';
import { BOSQUE } from './shared/levels/bosque.js';
import { TILE, parseLevel, standPoint, type DuoLevelDef } from './shared/duoLevel.js';
import { STEP, createPlayer, stepPlayer, type CrateSim, type PlayerSim, type StepEvent } from './shared/duoPhysics.js';
import { createWorldState, gateWithBothOnPedestals, updateSwitches } from './shared/duoWorld.js';
import { NO_INPUT, type DuoInput, type DuoRole, type DuoWorldState } from './shared/duoTypes.js';
import type { DuoLevel } from './shared/duoLevel.js';

const bosque = parseLevel(BOSQUE);

function setup(level: DuoLevel = bosque) {
  const world = createWorldState(level);
  const crates: CrateSim[] = world.crates.map((c) => ({ id: c.id, x: c.x, y: c.y, vy: 0 }));
  return { level, world, crates };
}

function place(role: DuoRole, col: number, row: number): PlayerSim {
  return createPlayer(role, standPoint({ col, row }));
}

/** Corre `seconds` de simulación con una entrada fija (o calculada por paso). */
function run(
  p: PlayerSim,
  env: { level: DuoLevel; world: DuoWorldState; crates: CrateSim[] },
  input: Partial<DuoInput> | ((p: PlayerSim, step: number) => Partial<DuoInput>),
  seconds: number,
): StepEvent[] {
  const events: StepEvent[] = [];
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    const raw = typeof input === 'function' ? input(p, i) : input;
    const ev = stepPlayer(p, { ...NO_INPUT, ...raw }, { ...env, canPush: () => true, respawnAt: standPoint(BOSQUE.spawns[p.role]) }, STEP);
    if (ev) events.push(ev);
  }
  return events;
}

describe('física de Dúo Lógico', () => {
  it('cae y queda parado sobre el suelo', () => {
    const env = setup();
    const p = createPlayer('FIRE', { x: 3 * TILE, y: 4 * TILE });
    run(p, env, {}, 1.5);
    expect(p.grounded).toBe(true);
    expect(p.y).toBe(10 * TILE);
  });

  it('el salto sube unas 2,5 celdas: alcanza un escalón de 2 pero no uno de 3', () => {
    const def: DuoLevelDef = {
      ...BOSQUE,
      map: ['..........', '..........', '..........', '......####', '...##.####', '...##.####', '##########'],
      bridges: [],
      buttons: [],
      levers: [],
      crates: [],
      coins: [],
      gates: [],
    };
    const env = setup(parseLevel(def));
    const low = createPlayer('FIRE', standPoint({ col: 1, row: 5 }));
    run(low, env, (p, i) => ({ right: p.x < 3.5 * TILE, jump: i < 20 }), 1.2);
    expect(low.y).toBe(4 * TILE); // sobre el escalón de 2 celdas

    const high = createPlayer('FIRE', standPoint({ col: 5, row: 5 }));
    run(high, env, (_p, i) => ({ right: true, jump: i < 20 }), 1.2);
    expect(high.y).toBe(6 * TILE); // el muro de 3 celdas no se sube
  });

  it('el lodo apaga a cualquiera y el puente lo evita', () => {
    const env = setup();
    const p = place('WATER', 11, 9);
    const died = run(p, env, { right: true }, 1.5);
    expect(died.some((e) => e?.kind === 'died' && e.cause === 'sludge')).toBe(true);

    env.world.switches['boton-orilla'] = true;
    const q = place('WATER', 11, 9);
    const events = run(q, env, (p) => ({ right: p.x < 18 * TILE }), 3);
    expect(events.filter((e) => e?.kind === 'died')).toHaveLength(0);
    expect(q.x).toBeGreaterThan(17 * TILE);
  });

  it('Lumen nada en la lava y sale del otro lado; Gota se apaga', () => {
    const env = setup();
    const fire = place('FIRE', 30, 9);
    const events = run(fire, env, (p, i) => ({ right: p.x < 36 * TILE, jump: p.swimming && i % 12 < 6 }), 6);
    expect(events.filter((e) => e?.kind === 'died')).toHaveLength(0);
    expect(fire.x).toBeGreaterThan(35 * TILE);
    expect(fire.y).toBe(10 * TILE);

    const water = place('WATER', 30, 9);
    const died = run(water, env, { right: true }, 1.5);
    expect(died[0]).toEqual({ kind: 'died', cause: 'lava' });
  });

  it('al apagarse reaparece en su punto de control', () => {
    const env = setup();
    const water = place('WATER', 30, 9);
    const events = run(water, env, { right: true }, 3);
    expect(events.map((e) => e?.kind)).toEqual(['died', 'respawned']);
    expect(water.dead).toBe(false);
  });

  it('empujar la caja hasta el muro permite trepar al nivel alto', () => {
    const env = setup();
    const p = place('WATER', 52, 9);
    const crate = env.crates[0];
    // Empuja la caja hasta el muro (col 57).
    run(p, env, { right: true }, 3);
    expect(crate.x + 58).toBeCloseTo(57 * TILE, 0);
    expect(p.y).toBe(10 * TILE);
    // Retrocede, sube a la caja y salta al nivel alto.
    run(p, env, { left: true }, 0.35);
    run(p, env, (q, i) => ({ right: true, jump: (i > 10 && i < 30) || (q.y < 10 * TILE - 30 && q.y > 7 * TILE + 1 && (q.grounded || q.vy < 0)) }), 2);
    expect(p.y).toBe(7 * TILE);
  });

  it('la palanca queda activa al tocarla y tiende el puente', () => {
    const env = setup();
    const fire = place('FIRE', 36, 9);
    expect(updateSwitches(env.level, env.world, { FIRE: { ...fire, anim: 'idle', dead: false } })).toBe(true);
    expect(env.world.switches['palanca-lumen']).toBe(true);
    // Se aleja: la palanca sigue activa.
    expect(updateSwitches(env.level, env.world, { FIRE: { ...fire, x: 0, anim: 'idle', dead: false } })).toBe(false);
    expect(env.world.switches['palanca-lumen']).toBe(true);
  });

  it('el botón solo está activo mientras alguien lo pisa', () => {
    const env = setup();
    const p = place('FIRE', 10, 9);
    run(p, env, {}, 0.5);
    updateSwitches(env.level, env.world, { FIRE: { ...p, anim: 'idle', dead: false } });
    expect(env.world.switches['boton-orilla']).toBe(true);
    run(p, env, { left: true }, 0.6);
    updateSwitches(env.level, env.world, { FIRE: { ...p, anim: 'idle', dead: false } });
    expect(env.world.switches['boton-orilla']).toBe(false);
  });

  it('detecta a los dos sobre sus pedestales (y no si se cambian de pedestal)', () => {
    const env = setup();
    const fire = place('FIRE', 21, 9);
    const water = place('WATER', 25, 9);
    // Cada uno salta sobre el suyo.
    run(fire, env, (p, i) => ({ right: p.x < 22 * TILE + TILE / 2 - 4, jump: i < 15 }), 1.5);
    run(water, env, (p, i) => ({ left: p.x > 24 * TILE + TILE / 2 + 4, jump: i < 15 }), 1.5);
    const net = (p: PlayerSim) => ({ x: p.x, y: p.y, vx: 0, vy: 0, facing: 1 as const, anim: 'idle' as const, dead: false });
    expect(gateWithBothOnPedestals(env.level, env.world, { FIRE: net(fire), WATER: net(water) })?.id).toBe('puerta-1');
    expect(gateWithBothOnPedestals(env.level, env.world, { FIRE: net(water), WATER: net(fire) })).toBeNull();
  });

  it('la Puerta del Saber cerrada no se atraviesa; abierta sí', () => {
    const env = setup();
    const p = place('FIRE', 25, 9);
    run(p, env, { right: true }, 1.5);
    expect(p.x).toBeLessThan(26 * TILE + TILE / 2);
    env.world.gates['puerta-1'] = true;
    run(p, env, { right: true }, 1.5);
    expect(p.x).toBeGreaterThan(28 * TILE);
  });
});
