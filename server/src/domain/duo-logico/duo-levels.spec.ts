import { describe, expect, it } from 'vitest';
import { CRATE_SIZE, TILE, lockRect, scaleSideId, standPoint, type DuoCondition, type DuoLevel } from './shared/duoLevel.js';
import { STEP, createPlayer, stepHeavyCrates, stepPlayer, toNet, type CrateSim, type PlayerSim, type StepEvent } from './shared/duoPhysics.js';
import {
  collectGems,
  createWorldState,
  floaterSurfaces,
  isBarrierActive,
  isBridgeOn,
  scaleSides,
  updateKeys,
  updatePools,
  updateScales,
  updateSwitches,
} from './shared/duoWorld.js';
import { DUO_LEVEL_DEFS, duoLevel } from './shared/levels/index.js';
import { NO_INPUT, type DuoInput, type DuoPlayerNet, type DuoWorldState } from './shared/duoTypes.js';

/**
 * Los retos de los escenarios se pueden resolver con la física real (y solo
 * como se pensaron: con ayuda del compañero). Cada prueba juega un tramo
 * como lo haría una persona, por fases: saltar, soltar, caer donde quiere.
 */
const bosque = duoLevel('bosque');
const solar = duoLevel('solar');

/** Una fase devuelve la entrada de este paso, o null cuando ya cumplió y sigue la próxima. */
type Phase = (p: PlayerSim) => Partial<DuoInput> | null;

/** `t0`: segundos del reloj del servidor al empezar (prensas, semáforos y teleféricos); `crates`: cajas que estorban o sostienen. */
function play(
  level: DuoLevel,
  world: DuoWorldState,
  p: PlayerSim,
  phases: Phase[],
  seconds: number,
  each?: (p: PlayerSim) => void,
  { t0 = 0, crates = [] }: { t0?: number; crates?: CrateSim[] } = {},
): StepEvent[] {
  const events: StepEvent[] = [];
  let current = 0;
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    let input: Partial<DuoInput> | null = null;
    while (current < phases.length && (input = phases[current](p)) === null) current += 1;
    const ev = stepPlayer(p, { ...NO_INPUT, ...input }, { level, world, crates, canPush: () => true, respawnAt: standPoint(level.def.spawns[p.role]), time: t0 + i * STEP }, STEP);
    if (ev) events.push(ev);
    each?.(p);
  }
  return events;
}

/**
 * Salta (manteniendo el salto) hacia la derecha y suelta la flecha pasada
 * `stopX`; termina al aterrizar. Antes espera a estar parado en el piso.
 */
function jumpRightTo(stopX: number): Phase {
  let ready = false;
  let leftGround = false;
  return (p) => {
    if (!ready) {
      ready = p.grounded;
      return {};
    }
    if (!p.grounded) leftGround = true;
    if (leftGround && p.grounded) return null;
    return { right: p.x < stopX, jump: true };
  };
}

/** Camina hacia la derecha hasta `x`. */
const walkRightTo = (x: number): Phase => (p) => (p.x >= x ? null : { right: true });

const net = (p: { x: number; y: number }, extra: Partial<DuoPlayerNet> = {}): DuoPlayerNet => ({ x: p.x, y: p.y, vx: 0, vy: 0, facing: 1, anim: 'idle', dead: false, ...extra });

describe('Bosque', () => {
  it('el hongo del inicio lleva a la isla de la gema de Lumen', () => {
    const world = createWorldState(bosque);
    const p = createPlayer('FIRE', { x: 32, y: 7 * TILE });
    let bounced = false;
    const events = play(bosque, world, p, [(q) => {
      if (q.vy < -1000) bounced = true;
      return { right: bounced && q.x < 5 * TILE + 32 };
    }], 2, (q) => collectGems(bosque, world, { FIRE: toNet(q) }));
    expect(events[0]).toEqual({ kind: 'bounced' });
    expect(p.y).toBe(7 * TILE);
    expect(world.gems['gema-isla']).toBe('FIRE');
  });

  it('las zarzas del tramo 2 se retiran mientras alguien pisa uno de sus botones', () => {
    const world = createWorldState(bosque);
    expect(isBarrierActive(bosque, world, 'zarzas')).toBe(true);
    updateSwitches(bosque, world, { FIRE: net(standPoint({ col: 54, row: 9 })) });
    expect(isBarrierActive(bosque, world, 'zarzas')).toBe(false);
  });

  it('la llave de la repisa solo se alcanza con la báscula inclinada por el compañero', () => {
    for (const tilted of [false, true]) {
      const world = createWorldState(bosque);
      // El compañero parado en el plato izquierdo lo hace bajar: el derecho sube dos celdas.
      if (tilted) world.scales.bascula = 2 * TILE;
      const p = createPlayer('WATER', standPoint({ col: 61, row: 9 }));
      // Al plato derecho (cols 62-63), luego a la repisa (cols 65-66) y hasta la llave.
      play(bosque, world, p, [jumpRightTo(62 * TILE + 40), walkRightTo(63 * TILE + 40), jumpRightTo(66 * TILE + 20), walkRightTo(66 * TILE + 30)], 4, (q) =>
        updateKeys(bosque, world, { WATER: toNet(q) }),
      );
      expect(world.keys.llave === 'WATER').toBe(tilted);
    }
  });

  it('con la llave, al tocar la puerta con candado se abre', () => {
    const world = createWorldState(bosque);
    world.keys.llave = 'FIRE';
    const door = lockRect(bosque.def.locks![0]);
    const p = createPlayer('FIRE', standPoint({ col: 67, row: 9 }));
    play(bosque, world, p, [() => ({ right: true })], 1, (q) => updateKeys(bosque, world, { FIRE: toNet(q) }));
    expect(world.locks.candado).toBe(true);
    expect(p.x).toBeGreaterThan(door.x - 30);
  });

  it('el hongo de las ramas lleva a la rama alta y a su botón', () => {
    const world = createWorldState(bosque);
    const p = createPlayer('WATER', { x: 95 * TILE + 32, y: 5 * TILE });
    const landed: Phase = (q) => (q.grounded && q.y === 2 * TILE ? null : { right: q.vy > 0 && q.y < 3 * TILE });
    play(bosque, world, p, [landed, walkRightTo(97 * TILE + 32)], 2.5, (q) => updateSwitches(bosque, world, { WATER: toNet(q) }));
    expect(p.y).toBe(2 * TILE);
    expect(world.switches['boton-par-alto']).toBe(true);
  });

  it('los dos botones pisados a la vez retiran para siempre las zarzas del final', () => {
    const world = createWorldState(bosque);
    updateSwitches(bosque, world, { FIRE: net(standPoint({ col: 100, row: 6 })) });
    expect(isBarrierActive(bosque, world, 'zarzas-final')).toBe(true);
    updateSwitches(bosque, world, { FIRE: net(standPoint({ col: 100, row: 6 })), WATER: net(standPoint({ col: 97, row: 1 })) });
    updateSwitches(bosque, world, {});
    expect(isBarrierActive(bosque, world, 'zarzas-final')).toBe(false);
  });
});

describe('Planta solar', () => {
  it('la caja de metal, empujada por los dos, queda sobre la placa y enciende el puente', () => {
    const world = createWorldState(solar);
    const crate = world.crates[0];
    const fall: Record<string, number> = {};
    for (let i = 0; i < 150; i++) {
      const pusher = { x: crate.x - 18, y: 10 * TILE, vx: 110, vy: 0, facing: 1 as const, anim: 'push' as const, dead: false };
      stepHeavyCrates(solar, world, { FIRE: pusher, WATER: pusher }, 1 / 30, i / 30, fall);
    }
    // El tope la deja justo sobre la placa.
    expect(crate.x + CRATE_SIZE).toBeCloseTo(72 * TILE, 0);
    updateSwitches(solar, world, {});
    expect(world.switches.placa).toBe(true);
    expect(isBridgeOn(solar, world, 'puente-placa')).toBe(true);
  });

  it('el botón alto solo se alcanza con la báscula inclinada por el compañero', () => {
    for (const tilted of [false, true]) {
      const world = createWorldState(solar);
      if (tilted) world.scales.bascula = 2 * TILE;
      const p = createPlayer('FIRE', standPoint({ col: 102, row: 9 }));
      // Al plato derecho (cols 103-104), a la plataforma alta (cols 105-106) y al botón.
      play(solar, world, p, [jumpRightTo(103 * TILE + 40), walkRightTo(104 * TILE + 30), jumpRightTo(106 * TILE + 20), walkRightTo(106 * TILE + 30)], 4, (q) =>
        updateSwitches(solar, world, { FIRE: toNet(q) }),
      );
      expect(world.switches['boton-alto']).toBe(tilted);
    }
  });

  it('Lumen se trae la llave de las sales y abre la puerta con candado', () => {
    const world = createWorldState(solar);
    updateKeys(solar, world, { FIRE: net(standPoint({ col: 90, row: 11 })) });
    expect(world.keys.llave).toBe('FIRE');
    const p = createPlayer('FIRE', standPoint({ col: 94, row: 9 }));
    play(solar, world, p, [() => ({ right: true })], 1, (q) => updateKeys(solar, world, { FIRE: toNet(q) }));
    expect(world.locks.candado).toBe(true);
  });
});

// ---- Escenarios nuevos (issue #132) ----

const rio = duoLevel('rio');
const reciclaje = duoLevel('reciclaje');
const ciudad = duoLevel('ciudad');

const died = (events: StepEvent[]) => events.find((e) => e?.kind === 'died');

/** Se queda quieto `seconds` segundos (por ejemplo, mientras viaja en el teleférico). */
function wait(seconds: number): Phase {
  let steps = Math.round(seconds / STEP);
  return () => (steps-- > 0 ? {} : null);
}

/** Espera hasta que se cumpla `done` (sin moverse). */
const until = (done: (p: PlayerSim) => boolean): Phase => (p) => (done(p) ? null : {});

/** Nada hacia un lado dando brazadas (salta y suelta) hasta que se cumpla `done`. */
function swim(dir: 1 | -1, done: (p: PlayerSim) => boolean): Phase {
  let n = 0;
  return (p) => (done(p) ? null : { right: dir > 0, left: dir < 0, jump: Math.floor(n++ / 8) % 2 === 0 });
}

/** Llena (o vacía) los estanques hasta su nivel con los interruptores de ahora. */
function settlePools(level: DuoLevel, world: DuoWorldState): void {
  for (let i = 0; i < 120; i++) updatePools(level, world, 1 / 30);
}

describe('todos los escenarios', () => {
  it('cada referencia apunta a algo que existe, y hay dos gemas de cada color', () => {
    for (const def of DUO_LEVEL_DEFS) {
      const level = duoLevel(def.id);
      const switches = new Set([
        ...def.buttons.map((b) => b.id),
        ...def.levers.map((l) => l.id),
        ...(def.latches ?? []).map((l) => l.id),
        ...(def.receivers ?? []).map((r) => r.id),
      ]);
      const conditions: DuoCondition[] = [
        ...def.bridges.map((b) => b.when),
        ...(def.latches ?? []).map((l) => l.when),
        ...(def.barriers ?? []).map((b) => b.off),
        ...(def.pools ?? []).map((p) => p.when),
        ...(def.flows ?? []).flatMap((f) => [f.stop, f.reverse].filter((c): c is DuoCondition => !!c)),
        ...(def.presses ?? []).flatMap((p) => (p.stop ? [p.stop] : [])),
      ];
      for (const c of conditions) for (const id of [...(c.all ?? []), ...(c.any ?? [])]) expect(switches.has(id), `${def.id}: ${id}`).toBe(true);
      const gates = new Set(def.gates.map((g) => g.id));
      for (const coin of def.coins) expect(gates.has(coin.gate), `${def.id}: ${coin.id}`).toBe(true);
      for (const key of def.keys ?? []) expect((def.locks ?? []).some((l) => l.id === key.lock), `${def.id}: ${key.id}`).toBe(true);
      for (const f of def.floaters ?? []) expect((def.pools ?? []).some((p) => p.id === f.pool), `${def.id}: ${f.id}`).toBe(true);
      const colors = (def.gems ?? []).map((g) => g.color);
      if (colors.length > 0) for (const color of ['FIRE', 'WATER', 'BOTH'] as const) expect(colors.filter((c) => c === color).length, `${def.id}: ${color}`).toBe(2);
      expect(def.gates.at(-1)?.portal, def.id).toBeTruthy();
      expect(level.tiles.every((row) => row.length === level.cols)).toBe(true);
    }
  });
});

describe('El Río', () => {
  it('con la válvula abierta, los troncos quedan al ras de la orilla y Lumen cruza el canal', () => {
    const world = createWorldState(rio);
    world.switches['valvula-a'] = true;
    settlePools(rio, world);
    expect(world.pools.canal).toBe(3 * TILE);
    const p = createPlayer('FIRE', standPoint({ col: 8, row: 9 }));
    const events = play(rio, world, p, [walkRightTo(10 * TILE + 40), jumpRightTo(14 * TILE + 40), jumpRightTo(17 * TILE + 40), walkRightTo(18 * TILE)], 5);
    expect(died(events)).toBeUndefined();
    expect(p.x).toBeGreaterThanOrEqual(18 * TILE);
    expect(p.y).toBe(10 * TILE);
  });

  it('con la válvula cerrada, el agua está abajo y Lumen se apaga si entra al canal', () => {
    const world = createWorldState(rio);
    const p = createPlayer('FIRE', standPoint({ col: 8, row: 9 }));
    expect(died(play(rio, world, p, [walkRightTo(13 * TILE)], 3))).toEqual({ kind: 'died', cause: 'water' });
  });

  it('la corriente del túnel devuelve a Gota; con la compuerta cerrada lo cruza y sale al otro lado', () => {
    for (const closed of [false, true]) {
      const world = createWorldState(rio);
      if (closed) world.switches.compuerta = true;
      const p = createPlayer('WATER', { x: 32 * TILE + 32, y: 10 * TILE });
      const out = (q: PlayerSim) => q.grounded && q.x > 49 * TILE + 20 && q.y === 10 * TILE;
      const events = play(rio, world, p, [(q) => (q.x >= 48 * TILE + 24 ? null : { right: true }), swim(1, out)], 10);
      expect(died(events)).toBeUndefined();
      expect(out(p)).toBe(closed);
      if (!closed) expect(p.x).toBeLessThan(36 * TILE);
    }
  });

  it('las zarzas del túnel no se pasan hasta que Gota baja la palanca del otro lado', () => {
    const world = createWorldState(rio);
    const p = createPlayer('FIRE', standPoint({ col: 37, row: 9 }));
    expect(died(play(rio, world, p, [walkRightTo(44 * TILE)], 2))).toEqual({ kind: 'died', cause: 'electric' });
    updateSwitches(rio, world, { WATER: net(standPoint({ col: 51, row: 9 })) });
    expect(isBarrierActive(rio, world, 'zarzas-rio')).toBe(false);
  });

  it('Gota sale del pozo con la llave solo cuando Lumen lo llena', () => {
    for (const filled of [false, true]) {
      const world = createWorldState(rio);
      if (filled) world.switches['valvula-pozo'] = true;
      const p = createPlayer('WATER', { x: 55 * TILE + 40, y: 13 * TILE });
      const out = (q: PlayerSim) => q.grounded && q.x > 57 * TILE + 20 && q.y === 10 * TILE;
      play(rio, world, p, [swim(1, out)], 7, (q) => {
        updatePools(rio, world, STEP);
        updateKeys(rio, world, { WATER: toNet(q) });
      });
      expect(world.keys.llave).toBe('WATER');
      expect(out(p)).toBe(filled);
    }
  });

  it('vasos comunicantes: con la válvula abierta, el primero se vacía y el segundo se llena', () => {
    const world = createWorldState(rio);
    expect(world.pools['vaso-1']).toBe(3 * TILE);
    expect(world.pools['vaso-2']).toBe(0);
    world.switches['valvula-media'] = true;
    settlePools(rio, world);
    expect(world.pools['vaso-1']).toBe(0);
    expect(world.pools['vaso-2']).toBe(3 * TILE);
    expect(floaterSurfaces(rio, world).find((f) => f.floater.id === 'tronco-d')?.rect.y).toBe(10 * TILE);
    // Con el segundo lleno se cruza de la isla a la otra orilla.
    const p = createPlayer('FIRE', standPoint({ col: 78, row: 9 }));
    const events = play(rio, world, p, [walkRightTo(79 * TILE + 40), jumpRightTo(82 * TILE + 40), jumpRightTo(85 * TILE + 40)], 4);
    expect(died(events)).toBeUndefined();
    expect(p.x).toBeGreaterThan(85 * TILE);
    expect(p.y).toBe(10 * TILE);
  });

  it('el hongo lleva al mirador y a su botón; Gota pisa el del fondo y juntos retiran las zarzas', () => {
    const world = createWorldState(rio);
    const lumen = createPlayer('FIRE', { x: 87 * TILE + 32, y: 7 * TILE });
    const landed: Phase = (q) => (q.grounded && q.y === 6 * TILE ? null : { right: q.vy > -400 && q.y < 6 * TILE });
    play(rio, world, lumen, [landed, walkRightTo(90 * TILE + 32)], 3);
    expect(lumen.y).toBe(6 * TILE);
    const gota = createPlayer('WATER', standPoint({ col: 94, row: 9 }));
    play(rio, world, gota, [walkRightTo(95 * TILE + 32)], 3);
    expect(gota.y).toBe(13 * TILE);
    updateSwitches(rio, world, { FIRE: toNet(lumen), WATER: toNet(gota) });
    updateSwitches(rio, world, {});
    expect(world.switches.cerrojo).toBe(true);
    expect(isBarrierActive(rio, world, 'zarzas-final')).toBe(false);
  });

  it('las zarzas del final no se saltan desde el mirador', () => {
    const world = createWorldState(rio);
    const p = createPlayer('FIRE', { x: 92 * TILE + 44, y: 6 * TILE });
    let maxX = 0;
    play(rio, world, p, [() => ({ right: true, jump: true })], 2.5, (q) => (maxX = Math.max(maxX, q.x)));
    expect(maxX).toBeLessThan(99 * TILE + 32);
  });
});

describe('La Planta de Reciclaje', () => {
  it('quieto sobre la cinta, lo lleva al foso de lixiviados', () => {
    const world = createWorldState(reciclaje);
    const p = createPlayer('WATER', standPoint({ col: 9, row: 9 }));
    expect(died(play(reciclaje, world, p, [], 4))).toEqual({ kind: 'died', cause: 'sludge' });
  });

  it('con su botón pisado, la cinta corre al revés y lleva rápido bajo las prensas', () => {
    const world = createWorldState(reciclaje);
    world.switches['boton-cinta-a'] = true;
    const p = createPlayer('FIRE', standPoint({ col: 7, row: 9 }));
    expect(died(play(reciclaje, world, p, [walkRightTo(21 * TILE + 32)], 3))).toBeUndefined();
    expect(p.x).toBeGreaterThanOrEqual(21 * TILE + 32);
  });

  it('con el cubo y un personaje en un plato, el otro plato sube y no baja: desde ahí, el piso alto', () => {
    for (const withCube of [false, true]) {
      const world = createWorldState(reciclaje);
      const scale = reciclaje.def.scales![0];
      const cube = world.crates.find((c) => c.id === 'cubo-carton')!;
      const fire = net(standPoint({ col: 24, row: 9 }), { mover: { id: scaleSideId('bascula', 'left'), dx: 20 } });
      const p = createPlayer('WATER', standPoint({ col: 28, row: 9 }));
      play(reciclaje, world, p, [until((q) => q.grounded && q.y <= 8 * TILE + 0.5), jumpRightTo(30 * TILE + 40)], 5, (q) => {
        const left = scaleSides(scale, world).left;
        fire.y = left.y;
        if (withCube) Object.assign(cube, { x: left.x + TILE - CRATE_SIZE / 2, y: left.y - CRATE_SIZE });
        updateScales(reciclaje, world, { FIRE: fire, WATER: toNet(q) }, STEP);
      });
      expect(p.y === 6 * TILE).toBe(withCube);
    }
  });

  it('arriba, su botón tiende el escalón para que suba el compañero', () => {
    for (const held of [false, true]) {
      const world = createWorldState(reciclaje);
      if (held) world.switches['boton-escalon'] = true;
      const p = createPlayer('FIRE', standPoint({ col: 26, row: 9 }));
      play(reciclaje, world, p, [jumpRightTo(26 * TILE + 34), walkRightTo(28 * TILE + 30), jumpRightTo(31 * TILE)], 4);
      expect(p.y === 6 * TILE).toBe(held);
    }
  });

  it('con un freno pisado, las prensas del pasillo se quedan arriba; sin él, aplastan', () => {
    const braked = createWorldState(reciclaje);
    braked.switches['freno-a'] = true;
    const p = createPlayer('FIRE', standPoint({ col: 47, row: 9 }));
    expect(died(play(reciclaje, braked, p, [walkRightTo(57 * TILE)], 4))).toBeUndefined();
    const world = createWorldState(reciclaje);
    const q = createPlayer('FIRE', standPoint({ col: 52, row: 9 }));
    expect(died(play(reciclaje, world, q, [], 2))).toEqual({ kind: 'died', cause: 'press' });
  });

  it('la llave del estante solo se alcanza con la pasarela, y la puerta no se salta desde el estante', () => {
    for (const held of [false, true]) {
      const world = createWorldState(reciclaje);
      if (held) world.switches['boton-repisa'] = true;
      const p = createPlayer('WATER', standPoint({ col: 61, row: 9 }));
      play(reciclaje, world, p, [jumpRightTo(61 * TILE + 40), jumpRightTo(64 * TILE + 20), walkRightTo(64 * TILE + 32)], 4, (q) =>
        updateKeys(reciclaje, world, { WATER: toNet(q) }),
      );
      expect(world.keys.llave === 'WATER').toBe(held);
    }
    const world = createWorldState(reciclaje);
    const p = createPlayer('FIRE', { x: 65 * TILE + 50, y: 6 * TILE });
    let maxX = 0;
    play(reciclaje, world, p, [() => ({ right: true, jump: true })], 2, (q) => (maxX = Math.max(maxX, q.x)));
    expect(maxX).toBeLessThan(lockRect(reciclaje.def.locks![0]).x);
  });

  it('el cubo de plástico, empujado por los dos hasta el muro, sirve de escalón', () => {
    const world = createWorldState(reciclaje);
    const cube = world.crates.find((c) => c.id === 'cubo-plastico')!;
    const fall: Record<string, number> = {};
    for (let i = 0; i < 150; i++) {
      const pusher = net({ x: cube.x - 20, y: 10 * TILE }, { anim: 'push', facing: 1 });
      stepHeavyCrates(reciclaje, world, { FIRE: pusher, WATER: pusher }, 1 / 30, i / 30, fall);
    }
    expect(cube.x).toBeCloseTo(86 * TILE - CRATE_SIZE, 0);
    const p = createPlayer('FIRE', { x: cube.x + CRATE_SIZE / 2, y: cube.y });
    play(reciclaje, world, p, [jumpRightTo(87 * TILE)], 2, undefined, { crates: [{ id: cube.id, x: cube.x, y: cube.y, vy: 0 }] });
    expect(p.y).toBe(7 * TILE);
  });

  it('cada botón del final está en la punta de una cinta que aleja de él; pisados a la vez, tienden el puente', () => {
    const world = createWorldState(reciclaje);
    const p = createPlayer('FIRE', standPoint({ col: 93, row: 6 }));
    play(reciclaje, world, p, [], 1.5);
    expect(p.x).toBeLessThan(92 * TILE);
    const q = createPlayer('WATER', standPoint({ col: 98, row: 6 }));
    expect(died(play(reciclaje, world, q, [], 5))).toEqual({ kind: 'died', cause: 'sludge' });
    updateSwitches(reciclaje, world, { FIRE: net(standPoint({ col: 93, row: 6 })), WATER: net(standPoint({ col: 98, row: 6 })) });
    updateSwitches(reciclaje, world, {});
    expect(isBridgeOn(reciclaje, world, 'puente-final')).toBe(true);
  });
});

describe('La Ciudad', () => {
  it('en rojo, la cortina del semáforo apaga; con un pulsador pisado se cruzan los tres', () => {
    const world = createWorldState(ciudad);
    const p = createPlayer('FIRE', standPoint({ col: 6, row: 9 }));
    expect(died(play(ciudad, world, p, [walkRightTo(10 * TILE)], 1))).toEqual({ kind: 'died', cause: 'electric' });
    const held = createWorldState(ciudad);
    held.switches['pulsador-a'] = true;
    const q = createPlayer('FIRE', standPoint({ col: 6, row: 9 }));
    expect(died(play(ciudad, held, q, [walkRightTo(22 * TILE)], 4))).toBeUndefined();
    expect(q.x).toBeGreaterThanOrEqual(22 * TILE);
  });

  it('esperando el verde de cada semáforo también se pasa', () => {
    const world = createWorldState(ciudad);
    const p = createPlayer('WATER', standPoint({ col: 6, row: 9 }));
    // Verdes: el 1.º entre 4 y 6 s, el 2.º entre 8 y 10 s y el 3.º entre 12 y 14 s (se espera entre uno y otro).
    const events = play(ciudad, world, p, [wait(4.1), walkRightTo(11 * TILE), wait(3.3), walkRightTo(16 * TILE), wait(2.7), walkRightTo(22 * TILE)], 16);
    expect(died(events)).toBeUndefined();
    expect(p.x).toBeGreaterThanOrEqual(22 * TILE);
  });

  it('el teleférico cruza el canal con quien va adentro', () => {
    const world = createWorldState(ciudad);
    const p = createPlayer('WATER', { x: 25 * TILE, y: 10 * TILE });
    const events = play(ciudad, world, p, [wait(4.6), walkRightTo(35 * TILE)], 7);
    expect(died(events)).toBeUndefined();
    expect(p.x).toBeGreaterThanOrEqual(35 * TILE);
    expect(p.y).toBe(10 * TILE);
  });

  it('con la caja y un personaje en un plato de la báscula, el otro sube al balcón y a la azotea por la llave', () => {
    const world = createWorldState(ciudad);
    const scale = ciudad.def.scales![0];
    const box = world.crates.find((c) => c.id === 'caja-carga')!;
    const fire = net(standPoint({ col: 45, row: 9 }), { mover: { id: scaleSideId('bascula', 'left'), dx: 20 } });
    const p = createPlayer('WATER', standPoint({ col: 48, row: 9 }));
    play(
      ciudad,
      world,
      p,
      [until((q) => q.grounded && q.y <= 8 * TILE + 0.5), walkRightTo(49 * TILE + 30), jumpRightTo(50 * TILE + 40), jumpRightTo(53 * TILE + 40), walkRightTo(54 * TILE + 32)],
      6,
      (q) => {
        const left = scaleSides(scale, world).left;
        fire.y = left.y;
        Object.assign(box, { x: left.x + TILE - CRATE_SIZE / 2, y: left.y - CRATE_SIZE });
        updateScales(ciudad, world, { FIRE: fire, WATER: toNet(q) }, STEP);
        updateKeys(ciudad, world, { WATER: toNet(q) });
      },
    );
    expect(world.keys.llave).toBe('WATER');
  });

  it('la puerta de arco del pasaje no se salta (la tapa la fachada) y se abre con la llave', () => {
    const world = createWorldState(ciudad);
    const p = createPlayer('FIRE', standPoint({ col: 59, row: 9 }));
    let maxX = 0;
    play(ciudad, world, p, [() => ({ right: true, jump: true })], 2, (q) => (maxX = Math.max(maxX, q.x)));
    expect(maxX).toBeLessThan(lockRect(ciudad.def.locks![0]).x);
    world.keys.llave = 'FIRE';
    play(ciudad, world, p, [() => ({ right: true })], 1, (q) => updateKeys(ciudad, world, { FIRE: toNet(q) }));
    expect(world.locks['puerta-arco']).toBe(true);
  });

  it('el segundo teleférico sube a la terraza', () => {
    const world = createWorldState(ciudad);
    const p = createPlayer('WATER', { x: 77 * TILE, y: 10 * TILE });
    const events = play(ciudad, world, p, [wait(5.1), walkRightTo(85 * TILE)], 7);
    expect(died(events)).toBeUndefined();
    expect(p.x).toBeGreaterThanOrEqual(85 * TILE);
    expect(p.y).toBe(6 * TILE);
  });

  it('el semáforo del final sigue en rojo (y no se salta) hasta que se pisan a la vez los pulsadores de la calle y la terraza', () => {
    const world = createWorldState(ciudad);
    const p = createPlayer('FIRE', standPoint({ col: 93, row: 5 }));
    let maxX = 0;
    play(ciudad, world, p, [() => ({ right: true, jump: true })], 2, (q) => (maxX = Math.max(maxX, q.x)));
    expect(maxX).toBeLessThan(96 * TILE + 22);
    updateSwitches(ciudad, world, { FIRE: net(standPoint({ col: 80, row: 9 })) });
    expect(isBarrierActive(ciudad, world, 'semaforo-final', 3.3)).toBe(true);
    updateSwitches(ciudad, world, { FIRE: net(standPoint({ col: 80, row: 9 })), WATER: net(standPoint({ col: 90, row: 5 })) });
    updateSwitches(ciudad, world, {});
    expect(isBarrierActive(ciudad, world, 'semaforo-final', 7.7)).toBe(false);
  });
});
