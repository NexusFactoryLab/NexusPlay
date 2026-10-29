import { Container, Graphics, Sprite, TilingSprite, type Texture } from 'pixi.js'
import { TILE, barrierRect, lockRect, scaleSideRect, standPoint, type DuoLevel } from '../shared/duoLevel'
import { isConditionMet } from '../shared/duoWorld'
import type { DuoRole, DuoWorldState } from '../shared/duoTypes'
import type { DuoAssets, DuoThemeAssets } from './duoAssets'
import type { Fx } from './fx'

const GEM_TEXTURE: Record<DuoRole | 'BOTH', string> = { FIRE: 'gem-fire', WATER: 'gem-water', BOTH: 'gem-both' }
const GEM_COLORS: Record<DuoRole | 'BOTH', number[]> = {
  FIRE: [0xfca5a5, 0xef4444, 0xffffff],
  WATER: [0x93c5fd, 0x3b82f6, 0xffffff],
  BOTH: [0x86efac, 0x22c55e, 0xffffff],
}
/** Lo que tarda una puerta con candado en abrirse (ms). */
const LOCK_OPEN_MS = 650
/** Lo que tardan las zarzas en hundirse o volver a salir (ms). */
const THORNS_MS = 260

function sized(texture: Texture, height: number): Sprite {
  const s = new Sprite(texture)
  s.scale.set(height / texture.frame.height)
  return s
}

interface BarrierView {
  gfx: Graphics
  thorns: TilingSprite | null
  /** 0 = retirada, 1 = encendida; se acerca con el tiempo. */
  level: number
  active: boolean | null
  rect: { x: number; y: number; w: number; h: number }
}

/**
 * Lo que hay que hacer entre los dos (issue #128): gemas de color, llaves y
 * puertas con candado, barreras (zarzas en el bosque, rayos en la planta
 * solar), hongos saltarines, banderas de control y básculas. Se anima con el
 * estado del mundo y suelta partículas cuando algo cambia.
 */
export class CoopView {
  /** Detrás de los personajes. */
  readonly back = new Container()
  /** Delante: la llave que lleva alguien sobre la cabeza. */
  readonly front = new Container()
  private readonly gems = new Map<string, { sprite: Sprite; baseY: number; baseScale: number; takenAt: number | null; glintAt: number; color: DuoRole | 'BOTH' }>()
  private readonly keys = new Map<string, { sprite: Sprite; glow: Sprite; home: { x: number; y: number }; baseScale: number; state: DuoRole | 'used' | null }>()
  private readonly locks = new Map<string, { door: Sprite; padlock: Graphics; baseY: number; height: number; opened: boolean | null; openedAt: number }>()
  private readonly barriers = new Map<string, BarrierView>()
  private readonly springs: Array<{ sprite: Sprite; x: number; y: number; baseScaleY: number; bouncedAt: number }> = []
  private readonly flags = new Map<string, { sprite: Sprite; baseScaleX: number; on: boolean | null }>()
  private readonly scales = new Map<string, { left: Container; right: Container; frame: Graphics }>()

  private readonly level: DuoLevel
  private readonly fx: Fx
  private readonly onShake: (power: number, ms: number) => void
  private readonly electric: boolean

  constructor(assets: DuoAssets, theme: DuoThemeAssets, level: DuoLevel, fx: Fx, onShake: (power: number, ms: number) => void) {
    this.level = level
    this.fx = fx
    this.onShake = onShake
    this.electric = theme.hazard === 'electric'
    const def = level.def
    const g = assets.general?.textures ?? {}
    const o = assets.objects.textures
    const so = theme.objects?.textures ?? {}

    // --- Básculas: viga con su rueda, cuerdas y los dos platos ---
    for (const scale of def.scales ?? []) {
      const frame = new Graphics()
      const plate = (width: number) => {
        const c = new Container()
        if (so['mover']) {
          const s = new Sprite(so['mover'])
          s.width = width * TILE
          s.height = 30
          s.y = -6
          c.addChild(s)
        } else {
          // Tablón de madera.
          const w = width * TILE
          const plank = new Graphics()
            .roundRect(0, -4, w, 20, 6)
            .fill({ color: 0x9a6a3a })
            .stroke({ color: 0x3f2a14, width: 3 })
            .rect(8, 3, w - 16, 2)
            .fill({ color: 0x7c4f27, alpha: 0.8 })
            .circle(10, 6, 2.5)
            .fill({ color: 0x3f2a14 })
            .circle(w - 10, 6, 2.5)
            .fill({ color: 0x3f2a14 })
          c.addChild(plank)
        }
        return c
      }
      const left = plate(scale.left.width)
      const right = plate(scale.right.width)
      this.back.addChild(frame, left, right)
      this.scales.set(scale.id, { left, right, frame })
    }

    // --- Barreras ---
    for (const b of def.barriers ?? []) {
      const rect = barrierRect(b)
      const gfx = new Graphics()
      let thorns: TilingSprite | null = null
      if (!this.electric) {
        // Zarzas: una mata de espinas en vertical que se hunde en la tierra.
        thorns = new TilingSprite({ texture: assets.thorns, width: rect.h, height: 52 })
        thorns.tileScale.set(52 / assets.thorns.frame.height)
        thorns.rotation = -Math.PI / 2
        thorns.position.set(rect.x + rect.w / 2 - 26, rect.y + rect.h)
        this.back.addChild(thorns)
      }
      this.back.addChild(gfx)
      this.barriers.set(b.id, { gfx, thorns, level: 1, active: null, rect })
    }

    // --- Puertas con candado ---
    for (const lock of def.locks ?? []) {
      const r = lockRect(lock)
      const door = sized(g['door-wood'] ?? o['door-closed'], lock.height * TILE + 8)
      door.anchor.set(0.5, 1)
      door.position.set(r.x + r.w / 2, r.y + r.h + 4)
      const padlock = new Graphics()
        .roundRect(-13, -4, 26, 22, 5)
        .fill({ color: 0xfacc15 })
        .stroke({ color: 0x713f12, width: 3 })
        .arc(0, -4, 8, Math.PI, 0)
        .stroke({ color: 0x713f12, width: 4 })
        .circle(0, 7, 3)
        .fill({ color: 0x713f12 })
      padlock.position.set(door.x, r.y + r.h / 2)
      this.back.addChild(door, padlock)
      this.locks.set(lock.id, { door, padlock, baseY: door.y, height: r.h, opened: null, openedAt: -Infinity })
    }

    // --- Hongos saltarines ---
    for (const s of def.springs ?? []) {
      const sprite = sized(g['spring'] ?? o['button-up'], 50)
      sprite.anchor.set(0.5, 1)
      const p = standPoint(s)
      sprite.position.set(p.x, p.y + 2)
      this.back.addChild(sprite)
      this.springs.push({ sprite, x: p.x, y: p.y, baseScaleY: sprite.scale.y, bouncedAt: -Infinity })
    }

    // --- Banderas de control ---
    for (const f of def.flags ?? []) {
      const sprite = sized(g['flag-red'] ?? o['lever-off'], 2 * TILE + 10)
      sprite.anchor.set(0.15, 1)
      const p = standPoint(f)
      sprite.position.set(p.x - 12, p.y + 2)
      this.back.addChild(sprite)
      this.flags.set(f.id, { sprite, baseScaleX: sprite.scale.x, on: null })
    }

    // --- Gemas ---
    for (const gem of def.gems ?? []) {
      const sprite = sized(g[GEM_TEXTURE[gem.color]] ?? o['coin-0'], 34)
      sprite.anchor.set(0.5)
      sprite.position.set(gem.col * TILE + TILE / 2, gem.row * TILE + TILE / 2)
      this.back.addChild(sprite)
      this.gems.set(gem.id, { sprite, baseY: sprite.y, baseScale: sprite.scale.x, takenAt: null, glintAt: Math.random() * 2000, color: gem.color })
    }

    // --- Llaves (con un brillo detrás) ---
    for (const key of def.keys ?? []) {
      const glow = new Sprite(fx.textures.soft)
      glow.anchor.set(0.5)
      glow.tint = 0xfde047
      glow.blendMode = 'add'
      glow.scale.set(2.4)
      const sprite = sized(g['key-gold'] ?? o['coin-0'], 42)
      sprite.anchor.set(0.5)
      const home = { x: key.col * TILE + TILE / 2, y: key.row * TILE + TILE / 2 }
      sprite.position.set(home.x, home.y)
      glow.position.set(home.x, home.y)
      this.front.addChild(glow, sprite)
      this.keys.set(key.id, { sprite, glow, home, baseScale: sprite.scale.x, state: null })
    }
  }

  /** Alguien rebotó en un hongo cerca de (x, y): se aplasta y suelta esporas. */
  springBounce(x: number, y: number, now: number): void {
    const spring = this.springs.find((s) => Math.abs(s.x - x) < 60 && Math.abs(s.y - 30 - y) < 70)
    if (!spring || now - spring.bouncedAt < 120) return
    spring.bouncedAt = now
    this.fx.burst({ x: spring.x, y: spring.y - 40, count: 12, texture: 'dot', tint: [0xfca5a5, 0xffffff, 0xfde68a], speed: [80, 220], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [380, 620], scale: [0.6, 0.15], gravity: 300 })
  }

  update(world: DuoWorldState, bodies: Partial<Record<DuoRole, { x: number; y: number }>>, now: number, dtMs: number): void {
    this.updateScales(world)
    this.updateBarriers(world, now, dtMs)

    for (const [id, lock] of this.locks) {
      const open = !!world.locks?.[id]
      if (lock.opened === false && open) {
        lock.openedAt = now
        this.fx.burst({ x: lock.door.x, y: lock.baseY - 8, count: 20, texture: 'soft', tint: [0xd6d3d1, 0xa8a29e, 0xe7e5e4], speed: [60, 190], angle: [-Math.PI, 0], life: [500, 900], scale: [0.5, 1.4], alpha: [0.75, 0], drag: 2.5, spread: [60, 10] })
        this.fx.burst({ x: lock.padlock.x, y: lock.padlock.y, count: 16, texture: 'star', tint: [0xfde047, 0xffffff], speed: [80, 220], angle: [0, Math.PI * 2], life: [400, 700], scale: [0.8, 0.1], glow: true, drag: 2 })
        this.onShake(5, 320)
      }
      if (lock.opened === null && open) lock.openedAt = -Infinity
      lock.opened = open
      // Abierta: la puerta sube y se desvanece; el candado salta.
      const k = open ? Math.min(1, (now - lock.openedAt) / LOCK_OPEN_MS) : 0
      lock.door.y = lock.baseY - lock.height * k * k
      lock.door.alpha = 1 - k
      lock.door.visible = k < 1
      lock.padlock.scale.set(1 + k * 0.8)
      lock.padlock.alpha = 1 - Math.min(1, k * 2)
      lock.padlock.visible = lock.padlock.alpha > 0
    }

    for (const spring of this.springs) {
      // Se aplasta al rebotar y vuelve con un temblor.
      const t = (now - spring.bouncedAt) / 420
      spring.sprite.scale.y = spring.baseScaleY * (t < 1 ? 1 - 0.35 * Math.cos(t * Math.PI * 3) * (1 - t) : 1)
    }

    for (const flag of this.level.def.flags ?? []) {
      const view = this.flags.get(flag.id)
      if (!view) continue
      const on = !!world.flags?.[flag.id]
      if (view.on === false && on) {
        const s = view.sprite
        this.fx.burst({ x: s.x + 30, y: s.y - 100, count: 18, texture: 'star', tint: [0xfca5a5, 0xfde047, 0xffffff], speed: [80, 220], angle: [0, Math.PI * 2], life: [420, 720], scale: [0.8, 0.1], glow: true, drag: 2 })
        this.fx.burst({ x: s.x + 30, y: s.y - 100, count: 1, texture: 'ring', tint: 0xfca5a5, speed: 0, angle: 0, life: 420, scale: [1, 5], alpha: [0.9, 0], glow: true })
      }
      view.on = on
      // Gris hasta que alguien la toca; después ondea.
      view.sprite.tint = on ? 0xffffff : 0x9ca3af
      view.sprite.skew.y = on ? Math.sin(now / 220 + flag.col) * 0.07 : 0
      view.sprite.scale.x = view.baseScaleX * (on ? 1 + Math.sin(now / 160 + flag.col) * 0.05 : 1)
    }

    for (const [id, gem] of this.gems) {
      const taken = !!world.gems?.[id]
      const s = gem.sprite
      if (taken && gem.takenAt === null) {
        gem.takenAt = now
        this.fx.burst({ x: s.x, y: s.y, count: 16, texture: 'star', tint: GEM_COLORS[gem.color], speed: [90, 240], angle: [0, Math.PI * 2], life: [380, 680], scale: [0.85, 0.1], glow: true, drag: 2.5 })
        this.fx.burst({ x: s.x, y: s.y, count: 1, texture: 'ring', tint: GEM_COLORS[gem.color][1], speed: 0, angle: 0, life: 380, scale: [1, 4.5], alpha: [0.9, 0], glow: true })
      }
      if (!taken) {
        gem.takenAt = null
        s.visible = true
        s.alpha = 1
        s.scale.set(gem.baseScale)
        s.y = gem.baseY + Math.sin(now / 350 + s.x) * 5
        s.rotation = Math.sin(now / 600 + s.x) * 0.12
        if (now >= gem.glintAt) {
          gem.glintAt = now + 1800 + Math.random() * 1600
          this.fx.burst({ x: s.x + 9, y: s.y - 9, count: 1, texture: 'star', tint: 0xffffff, speed: 0, angle: 0, life: 400, scale: [0.2, 0.9], alpha: [1, 0], glow: true, spin: 3 })
        }
      } else if (gem.takenAt !== null) {
        const k = Math.min(1, (now - gem.takenAt) / 450)
        s.y = gem.baseY - 40 * k
        s.scale.set(gem.baseScale * (1 + 0.5 * k))
        s.alpha = 1 - k
        s.visible = k < 1
      }
    }

    for (const [id, key] of this.keys) {
      const state = world.keys?.[id] ?? null
      if (state !== key.state) {
        if (state === 'FIRE' || state === 'WATER') this.fx.burst({ x: key.sprite.x, y: key.sprite.y, count: 14, texture: 'star', tint: [0xfde047, 0xffffff], speed: [70, 200], angle: [0, Math.PI * 2], life: [380, 620], scale: [0.8, 0.1], glow: true, drag: 2 })
        key.state = state
      }
      const holder = state === 'FIRE' || state === 'WATER' ? bodies[state] : undefined
      key.sprite.visible = state !== 'used'
      key.glow.visible = state !== 'used'
      if (state === 'used') continue
      // En su lugar flota; si alguien la lleva, va sobre su cabeza (por encima de su nombre).
      const x = holder ? holder.x + 4 : key.home.x
      const y = (holder ? holder.y - 136 : key.home.y) + Math.sin(now / 300) * 4
      key.sprite.position.set(x, y)
      key.sprite.rotation = Math.sin(now / 500) * 0.15
      key.glow.position.set(x, y)
      key.glow.alpha = 0.35 + Math.sin(now / 260) * 0.15
    }
  }

  private updateScales(world: DuoWorldState): void {
    for (const scale of this.level.def.scales ?? []) {
      const view = this.scales.get(scale.id)
      if (!view) continue
      const offset = world.scales?.[scale.id] ?? 0
      const l = scaleSideRect(scale.left, offset)
      const r = scaleSideRect(scale.right, -offset)
      view.left.position.set(l.x, l.y)
      view.right.position.set(r.x, r.y)
      // Viga arriba, con su rueda, y una cuerda hasta cada plato.
      const lx = l.x + l.w / 2
      const rx = r.x + r.w / 2
      const beamY = Math.min(scale.left.row, scale.right.row) * TILE - (scale.travel + 1.2) * TILE
      const cx = (lx + rx) / 2
      const g = view.frame.clear()
      const color = this.electric ? 0x64748b : 0x5b3a1e
      g.moveTo(lx, beamY).lineTo(lx, l.y).moveTo(rx, beamY).lineTo(rx, r.y).stroke({ color: 0x3f3f46, width: 3 })
      g.roundRect(lx - 10, beamY - 7, rx - lx + 20, 14, 6).fill({ color }).stroke({ color: 0x1f2937, width: 2 })
      g.moveTo(cx, beamY).lineTo(cx, Math.max(l.y, r.y) + 30).stroke({ color, width: 8 })
      g.circle(cx, beamY, 13).fill({ color: this.electric ? 0x94a3b8 : 0x8b5a2b }).stroke({ color: 0x1f2937, width: 3 }).circle(cx, beamY, 4).fill({ color: 0x1f2937 })
    }
  }

  private updateBarriers(world: DuoWorldState, now: number, dtMs: number): void {
    for (const b of this.level.def.barriers ?? []) {
      const view = this.barriers.get(b.id)
      if (!view) continue
      const active = !isConditionMet(b.off, world.switches)
      if (view.active !== null && view.active !== active) {
        // Al apagarse (o volver): chispas o tierra.
        const r = view.rect
        this.fx.burst(
          this.electric
            ? { x: r.x + r.w / 2, y: r.y + r.h / 2, count: 14, texture: 'dot', tint: [0xfef08a, 0x7dd3fc, 0xffffff], speed: [80, 240], angle: [0, Math.PI * 2], life: [200, 380], scale: [0.6, 0.1], glow: true, spread: [10, r.h] }
            : { x: r.x + r.w / 2, y: r.y + r.h - 4, count: 12, texture: 'soft', tint: [0xa16207, 0x78350f, 0xd6d3d1], speed: [40, 140], angle: [-Math.PI, 0], life: [400, 700], scale: [0.4, 1], alpha: [0.7, 0], drag: 3, spread: [40, 4] },
        )
      }
      if (view.active === null) view.level = active ? 1 : 0
      view.active = active
      view.level = Math.max(0, Math.min(1, view.level + (active ? 1 : -1) * (dtMs / THORNS_MS)))
      this.drawBarrier(view, active, now)
    }
  }

  private drawBarrier(view: BarrierView, active: boolean, now: number): void {
    const { x, y, w, h } = view.rect
    const g = view.gfx.clear()
    if (view.thorns) {
      // Zarzas: salen de la tierra; retiradas, solo asoma un montículo.
      view.thorns.scale.x = 0.08 + 0.92 * view.level
      view.thorns.alpha = 0.6 + 0.4 * view.level
      g.ellipse(x + w / 2, y + h - 2, 30, 9).fill({ color: 0x5b3a1e, alpha: 0.85 })
      return
    }
    // Rayos entre dos postes: encendidos, chisporrotean; apagados, la luz del poste es verde.
    const cx = x + w / 2
    const post = (py: number) => g.roundRect(cx - 14, py - 8, 28, 16, 4).fill({ color: 0x475569 }).stroke({ color: 0x1e293b, width: 2 }).circle(cx, py, 4).fill({ color: active ? 0xfde047 : 0x4ade80 })
    if (view.level > 0.02) {
      for (const [color, width, phase] of [[0x7dd3fc, 7, 0], [0xfef08a, 3, 1.3], [0xffffff, 1.5, 2.1]] as const) {
        g.moveTo(cx, y + 6)
        for (let py = y + 6; py <= y + h - 6; py += 12) g.lineTo(cx + Math.sin(py * 0.7 + now / 45 + phase) * 7 * view.level, py)
        g.lineTo(cx, y + h - 6)
        g.stroke({ color, width, alpha: 0.85 * view.level })
      }
      g.rect(cx - 12, y, 24, h).fill({ color: 0x7dd3fc, alpha: 0.12 * view.level })
      if (Math.random() < 0.08 * view.level) {
        this.fx.burst({ x: cx, y: y + Math.random() * h, count: 2, texture: 'dot', tint: [0xfef08a, 0xffffff], speed: [60, 160], angle: [0, Math.PI * 2], life: [140, 260], scale: [0.4, 0.1], glow: true })
      }
    }
    post(y + 4)
    post(y + h - 4)
  }
}
