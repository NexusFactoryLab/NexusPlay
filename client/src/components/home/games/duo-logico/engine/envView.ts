import { Container, Graphics, Sprite, TilingSprite, type Texture } from 'pixi.js'
import { TILE, currentRect, floaterRect, poolWaterRect, pressHeadRect, standPoint, type DuoFlowDef, type DuoLevel, type DuoPoolDef, type DuoPressDef } from '../shared/duoLevel'
import { flowDirection, isConditionMet, poolLevel, pressK } from '../shared/duoWorld'
import type { DuoWorldState } from '../shared/duoTypes'
import type { DuoAssets, DuoThemeAssets } from './duoAssets'
import type { Fx } from './fx'

/** Cada cuánto cambia de cuadro la ola del estanque (ms), como la del agua fija. */
const SURFACE_FRAME_MS = 180
/** Alto con el que se dibuja la cinta transportadora (px). */
const BELT_H = 40

function sized(texture: Texture, height: number): Sprite {
  const s = new Sprite(texture)
  s.scale.set(height / texture.frame.height)
  return s
}

interface PoolView {
  def: DuoPoolDef
  body: TilingSprite | null
  top: TilingSprite | null
  /** Agua dibujada a mano si no cargó la textura. */
  plain: Graphics
  valve: Sprite | null
  level: number | null
  bubbleAt: number
}

interface FlowView {
  def: DuoFlowDef
  streaks: Graphics
  gate: Sprite | null
  /** Corrimiento de las rayas (px), para que avancen con la corriente. */
  shift: number
  dir: -1 | 0 | 1 | null
}

interface PressView {
  def: DuoPressDef
  rod: Graphics
  head: Graphics
  light: Graphics
  lastK: number
}

/**
 * Lo propio de Río, Reciclaje y Ciudad (issue #132): estanques que suben y
 * bajan con su válvula, troncos y nenúfares que flotan, corrientes con su
 * compuerta, cintas transportadoras y prensas hidráulicas. `back` va detrás
 * de los personajes; `front` es el agua por delante (quien nada se ve sumergido).
 */
export class EnvView {
  readonly back = new Container()
  readonly front = new Container()
  private readonly pools: PoolView[] = []
  private readonly floaters: Array<{ sprite: Sprite; pool: DuoPoolDef; def: NonNullable<DuoLevel['def']['floaters']>[number]; lift: number }> = []
  private readonly flows: FlowView[] = []
  private readonly belts: Array<{ def: DuoFlowDef; chevrons: Graphics; shift: number; dir: -1 | 0 | 1 | null }> = []
  private readonly presses: PressView[] = []

  private readonly assets: DuoAssets
  private readonly fx: Fx
  private readonly onShake: (power: number, ms: number) => void
  private readonly so: Record<string, Texture>

  constructor(assets: DuoAssets, theme: DuoThemeAssets, level: DuoLevel, fx: Fx, onShake: (power: number, ms: number) => void) {
    this.assets = assets
    this.fx = fx
    this.onShake = onShake
    this.so = theme.objects?.textures ?? {}
    const def = level.def

    // --- Estanques: fondo de tierra (se ve excavado aunque esté vacío), agua por delante, válvula al costado ---
    const earth = theme.thinPrefix === 'branch' ? 0x2a1a0e : 0x1e293b
    for (const pool of def.pools ?? []) {
      const basin = poolWaterRect(pool, pool.depth * TILE)
      this.back.addChild(
        new Graphics()
          .rect(basin.x, basin.y, basin.w, basin.h)
          .fill({ color: earth, alpha: 0.85 })
          .rect(basin.x, basin.y + basin.h / 2, basin.w, basin.h / 2)
          .fill({ color: 0x000000, alpha: 0.18 }),
      )
    }
    for (const pool of def.pools ?? []) {
      const r = poolWaterRect(pool, pool.high * TILE)
      let body: TilingSprite | null = null
      let top: TilingSprite | null = null
      if (assets.water && assets.waterTop.length > 0) {
        body = new TilingSprite({ texture: assets.water, width: r.w, height: TILE })
        body.alpha = 0.92
        top = new TilingSprite({ texture: assets.waterTop[0], width: r.w, height: 52 })
        top.tileScale.set(52 / assets.waterTop[0].frame.height)
        this.front.addChild(body, top)
      }
      const plain = new Graphics()
      this.front.addChild(plain)
      let valve: Sprite | null = null
      if (pool.valve && (this.so['valve-up'] || this.so['valve-down'])) {
        valve = sized(this.so['valve-down'] ?? this.so['valve-up'], 46)
        valve.anchor.set(0.5, 1)
        const p = standPoint(pool.valve)
        valve.position.set(p.x, p.y + 2)
        this.back.addChild(valve)
      }
      this.pools.push({ def: pool, body, top, plain, valve, level: null, bubbleAt: 0 })
    }

    // --- Troncos y nenúfares (detrás del agua: se ven a medio hundir) ---
    for (const f of def.floaters ?? []) {
      const pool = (def.pools ?? []).find((p) => p.id === f.pool)
      if (!pool) continue
      const texture = f.kind === 'lily' ? this.so['lily'] : f.width >= 2 ? this.so['log-long'] : this.so['log-small']
      let sprite: Sprite
      let lift: number
      if (texture) {
        sprite = new Sprite(texture)
        sprite.anchor.set(0.5, 0.5)
        const w = f.width * TILE + (f.kind === 'lily' ? 18 : 10)
        sprite.scale.set(w / texture.frame.width)
        // Cuánto queda el centro del dibujo por debajo de la superficie que se pisa.
        lift = sprite.height * (f.kind === 'lily' ? 0.12 : 0.22)
      } else {
        const g = new Graphics().roundRect(-f.width * TILE / 2, -10, f.width * TILE, 22, 10).fill({ color: 0x8b5a2b }).stroke({ color: 0x3f2a14, width: 3 })
        sprite = new Sprite()
        sprite.addChild(g)
        lift = 6
      }
      this.back.addChild(sprite)
      this.floaters.push({ sprite, pool, def: f, lift })
    }

    // --- Corrientes: rayas que avanzan sobre el agua y la compuerta de donde salen ---
    for (const flow of def.flows ?? []) {
      if (flow.kind === 'belt') {
        this.back.addChild(this.beltSprite(flow))
        const chevrons = new Graphics()
        this.back.addChild(chevrons)
        this.belts.push({ def: flow, chevrons, shift: 0, dir: null })
        continue
      }
      const streaks = new Graphics()
      streaks.blendMode = 'add'
      this.front.addChild(streaks)
      let gate: Sprite | null = null
      if (flow.gate && this.so['sluice-open']) {
        gate = sized(this.so['sluice-open'], 2 * TILE)
        gate.anchor.set(0.5, 1)
        const p = standPoint(flow.gate)
        gate.position.set(p.x, p.y + 2)
        if (flow.dir < 0) gate.scale.x *= -1
        this.back.addChild(gate)
      }
      this.flows.push({ def: flow, streaks, gate, shift: 0, dir: null })
    }

    // --- Prensas: varilla desde el techo, cabezal con franjas y una luz de aviso ---
    for (const press of def.presses ?? []) {
      const w = press.width * TILE - 8
      const rod = new Graphics()
      const head = new Graphics()
        .roundRect(0, 0, w, TILE, 8)
        .fill({ color: 0x94a3b8 })
        .stroke({ color: 0x1e293b, width: 4 })
        .rect(6, 8, w - 12, 6)
        .fill({ color: 0xe2e8f0, alpha: 0.7 })
      // Franjas de peligro abajo.
      const stripes = new Graphics()
      for (let x = -16; x < w; x += 16) stripes.poly([x, TILE - 16, x + 8, TILE - 16, x + 16, TILE - 4, x + 8, TILE - 4]).fill({ color: 0x111827 })
      const band = new Graphics().rect(4, TILE - 16, w - 8, 12).fill({ color: 0xfacc15 })
      const mask = new Graphics().rect(4, TILE - 16, w - 8, 12).fill({ color: 0xffffff })
      stripes.mask = mask
      head.addChild(band, stripes, mask)
      const light = new Graphics()
      this.back.addChild(rod, head, light)
      this.presses.push({ def: press, rod, head, light, lastK: 0 })
    }
  }

  /** Cinta en 3 piezas (punta, tramo repetido, punta) sobre las celdas de su fila. */
  private beltSprite(flow: DuoFlowDef): Container {
    const c = new Container()
    const x = flow.col * TILE
    const y = flow.row * TILE - 6
    const w = flow.width * TILE
    const left = this.so['belt-left']
    const mid = this.so['belt-mid']
    const right = this.so['belt-right']
    if (!left || !mid || !right) {
      c.addChild(new Graphics().roundRect(x, y, w, BELT_H - 8, 14).fill({ color: 0x475569 }).stroke({ color: 0x1e293b, width: 3 }))
      return c
    }
    const k = BELT_H / mid.frame.height
    const l = new Sprite(left)
    l.scale.set(k)
    l.position.set(x, y)
    const r = new Sprite(right)
    r.scale.set(k)
    r.position.set(x + w - r.width, y)
    const span = w - l.width - r.width
    const piece = mid.frame.width * k
    const copies = Math.max(1, Math.round(span / piece))
    for (let i = 0; i < copies; i++) {
      const m = new Sprite(mid)
      m.scale.set(k)
      m.width = span / copies + 1
      m.position.set(x + l.width - 0.5 + (i * span) / copies, y)
      c.addChild(m)
    }
    c.addChild(l, r)
    return c
  }

  /** `time`: segundos del reloj del servidor (las prensas); `now`: hora local (ms). */
  update(world: DuoWorldState, now: number, time: number, dtMs: number): void {
    this.updatePools(world, now)
    this.updateFlows(world, now, dtMs)
    this.updatePresses(world, now, time)
  }

  private updatePools(world: DuoWorldState, now: number): void {
    const frame = Math.floor(now / SURFACE_FRAME_MS)
    for (const view of this.pools) {
      const level = poolLevel(world, view.def)
      const r = poolWaterRect(view.def, level)
      const changing = view.level !== null && Math.abs(level - view.level) > 0.05
      view.level = level
      const visible = level > 2
      if (view.body && view.top && this.assets.water) {
        view.body.visible = visible && level > 22
        view.top.visible = visible
        view.body.position.set(r.x, r.y + 22)
        view.body.height = Math.max(0, level - 22)
        // El dibujo del agua queda quieto en el mundo mientras la superficie sube.
        view.body.tilePosition.set(-r.x, -(r.y + 22))
        view.top.position.set(r.x, r.y - 16)
        view.top.texture = this.assets.waterTop[frame % this.assets.waterTop.length]
      } else {
        const g = view.plain.clear()
        if (visible) {
          g.rect(r.x, r.y + 6, r.w, Math.max(0, level - 6)).fill({ color: 0x0ea5e9, alpha: 0.45 })
          g.moveTo(r.x, r.y + 6)
          for (let x = r.x; x <= r.x + r.w; x += 8) g.lineTo(x, r.y + 6 + Math.sin(x / 26 + now / 260) * 3)
          g.stroke({ color: 0xe0f2fe, width: 3, alpha: 0.9 })
        }
      }
      if (view.valve) {
        const open = isConditionMet(view.def.when, world.switches)
        view.valve.texture = (open ? this.so['valve-up'] : this.so['valve-down']) ?? view.valve.texture
        // Mientras el agua cambia, la válvula vibra y gotea.
        view.valve.rotation = changing ? Math.sin(now / 45) * 0.05 : 0
        if (changing && now >= view.bubbleAt) {
          view.bubbleAt = now + 140
          this.fx.burst({ x: view.valve.x, y: view.valve.y - 30, count: 2, texture: 'dot', tint: [0xe0f2fe, 0x7dd3fc], speed: [60, 150], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [400, 650], scale: [0.6, 0.2], gravity: 500 })
          this.fx.burst({ x: r.x + Math.random() * r.w, y: r.y + 4, count: 1, texture: 'ring', tint: [0xe0f2fe, 0xbae6fd], speed: [10, 30], angle: -Math.PI / 2, life: [500, 800], scale: [0.4, 1.1], alpha: [0.8, 0] })
        }
      }
    }
    for (const f of this.floaters) {
      const rect = floaterRect(f.def, f.pool, poolLevel(world, f.pool))
      // Se mece un poco sobre el agua (solo el dibujo).
      f.sprite.position.set(rect.x + rect.w / 2, rect.y + f.lift + Math.sin(now / 520 + f.def.col) * 1.5)
      f.sprite.rotation = Math.sin(now / 900 + f.def.col) * 0.025
    }
  }

  private updateFlows(world: DuoWorldState, now: number, dtMs: number): void {
    for (const view of this.flows) {
      const dir = flowDirection(view.def, world.switches)
      const r = currentRect(view.def)
      if (view.dir !== null && view.dir !== dir && view.gate) {
        // La compuerta se cierra (o se abre): salpica.
        this.fx.burst({ x: view.gate.x, y: view.gate.y - 40, count: 14, texture: 'dot', tint: [0xe0f2fe, 0x7dd3fc, 0xffffff], speed: [80, 220], angle: [-Math.PI, 0], life: [400, 700], scale: [0.7, 0.2], gravity: 500 })
      }
      view.dir = dir
      if (view.gate) view.gate.texture = (dir === 0 ? this.so['sluice-closed'] : this.so['sluice-open']) ?? view.gate.texture
      view.shift += (dir * 120 * dtMs) / 1000
      const g = view.streaks.clear()
      if (dir === 0) continue
      // Rayas de espuma que avanzan con la corriente, en varias alturas.
      const rows = Math.max(1, Math.round(r.h / 22))
      for (let i = 0; i < rows; i++) {
        const y = r.y + 14 + (i * (r.h - 20)) / rows
        const offset = ((view.shift * (1 + (i % 3) * 0.25) + i * 37) % 96 + 96) % 96
        for (let x = r.x - 96 + offset; x < r.x + r.w; x += 96) {
          const x0 = Math.max(r.x, x)
          const x1 = Math.min(r.x + r.w, x + 34)
          if (x1 <= x0) continue
          g.moveTo(x0, y + Math.sin(x / 30 + now / 300) * 2).lineTo(x1, y + Math.sin(x1 / 30 + now / 300) * 2)
        }
      }
      g.stroke({ color: 0xffffff, width: 3, alpha: 0.35, cap: 'round' })
    }
    for (const belt of this.belts) {
      const dir = flowDirection(belt.def, world.switches)
      const x0 = belt.def.col * TILE + 18
      const x1 = (belt.def.col + belt.def.width) * TILE - 18
      const y = belt.def.row * TILE - 1
      if (belt.dir !== null && belt.dir !== dir) {
        // Cambió de sentido (o se detuvo): chispas en las puntas.
        for (const x of [x0, x1]) this.fx.burst({ x, y, count: 6, texture: 'star', tint: [0xfef08a, 0xffffff], speed: [60, 160], angle: [-Math.PI, 0], life: [260, 420], scale: [0.6, 0.1], glow: true })
      }
      belt.dir = dir
      belt.shift += (dir * 140 * dtMs) / 1000
      // Flechas que avanzan sobre la cinta, en el sentido en que arrastra.
      const g = belt.chevrons.clear()
      if (dir === 0) continue
      const gap = 56
      const offset = ((belt.shift % gap) + gap) % gap
      for (let x = x0 + offset; x < x1; x += gap) {
        const tip = x + dir * 7
        g.moveTo(x - dir * 7, y - 9).lineTo(tip, y - 4).lineTo(x - dir * 7, y + 1)
      }
      g.stroke({ color: 0xfde047, width: 3.5, alpha: 0.9, cap: 'round', join: 'round' })
    }
  }

  private updatePresses(world: DuoWorldState, now: number, time: number): void {
    for (const view of this.presses) {
      const press = view.def
      const k = pressK(press, world, time)
      const head = pressHeadRect(press, k)
      view.head.position.set(head.x, head.y)
      // Varilla desde el techo hasta el cabezal, con su caja arriba.
      const cx = head.x + head.w / 2
      const top = press.row * TILE - 10
      view.rod.clear()
        .rect(cx - 9, top, 18, Math.max(0, head.y - top + 4))
        .fill({ color: 0x64748b })
        .stroke({ color: 0x1e293b, width: 3 })
        .rect(cx - 4, top, 4, Math.max(0, head.y - top))
        .fill({ color: 0xcbd5e1, alpha: 0.8 })
        .roundRect(cx - 30, top - 6, 60, 22, 6)
        .fill({ color: 0x334155 })
        .stroke({ color: 0x0f172a, width: 3 })
      // Luz de aviso: verde si está frenada, roja parpadeando justo antes de bajar y mientras está abajo.
      const stopped = !!press.stop && isConditionMet(press.stop, world.switches)
      const phase = ((((time + (press.offset ?? 0)) % press.period) + press.period) % press.period) / press.period
      const warning = !stopped && (phase > 0.36 || k > 0)
      const color = stopped ? 0x4ade80 : warning ? (Math.floor(now / 110) % 2 ? 0xef4444 : 0x7f1d1d) : 0xf59e0b
      view.light.clear().circle(cx, top + 5, 6).fill({ color }).stroke({ color: 0x0f172a, width: 2 })
      // Golpe al llegar abajo: polvo y un temblor.
      if (view.lastK < 0.98 && k >= 0.98) {
        const floor = head.y + head.h
        this.fx.burst({ x: cx, y: floor - 4, count: 16, texture: 'soft', tint: [0xd6d3d1, 0xa8a29e, 0xe7e5e4], speed: [80, 220], angle: [-Math.PI, 0], life: [400, 700], scale: [0.5, 1.3], alpha: [0.75, 0], drag: 2.5, spread: [head.w, 6] })
        this.fx.burst({ x: cx, y: floor - 6, count: 8, texture: 'dot', tint: [0xfef08a, 0xffffff], speed: [120, 260], angle: [-Math.PI, 0], life: [200, 360], scale: [0.5, 0.1], glow: true })
        this.onShake(3, 160)
      }
      view.lastK = k
    }
  }
}
