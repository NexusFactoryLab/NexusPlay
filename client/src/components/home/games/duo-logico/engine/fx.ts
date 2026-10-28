import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js'

/**
 * Partículas del escenario (chispas, polvo, gotas, burbujas, hojas, destellos).
 * Un solo contenedor en coordenadas del mundo y un grupo fijo de sprites que se
 * reutilizan: nada se crea ni se destruye mientras se juega (importante en
 * celular). Las texturas se dibujan una vez al montar el juego.
 */
export interface FxTextures {
  /** Círculo difuso: brillos, humo, polvo. */
  soft: Texture
  /** Punto nítido: chispas pequeñas, burbujas lejanas. */
  dot: Texture
  /** Estrella de 4 puntas: destellos de fichas, portal, reaparición. */
  star: Texture
  /** Gota: salpicaduras de agua y el rastro de Gota. */
  drop: Texture
  /** Hoja: el viento del bosque. */
  leaf: Texture
  /** Anillo: burbujas y ondas. */
  ring: Texture
}

export function makeFxTextures(renderer: Renderer): FxTextures {
  const bake = (draw: (g: Graphics) => void): Texture => {
    const g = new Graphics()
    draw(g)
    const texture = renderer.generateTexture({ target: g, resolution: 2, antialias: true })
    g.destroy()
    return texture
  }
  return {
    soft: bake((g) => {
      // Varios círculos con poca opacidad: un difuminado sin degradados.
      for (let i = 0; i < 10; i++) g.circle(16, 16, 16 - i * 1.5).fill({ color: 0xffffff, alpha: 0.1 })
    }),
    dot: bake((g) => g.circle(4, 4, 4).fill({ color: 0xffffff })),
    star: bake((g) =>
      g
        .poly([8, 0, 10, 6, 16, 8, 10, 10, 8, 16, 6, 10, 0, 8, 6, 6])
        .fill({ color: 0xffffff })
        .circle(8, 8, 2.5)
        .fill({ color: 0xffffff }),
    ),
    drop: bake((g) => g.moveTo(5, 0).bezierCurveTo(10, 7, 10, 13, 5, 14).bezierCurveTo(0, 13, 0, 7, 5, 0).fill({ color: 0xffffff })),
    leaf: bake((g) => g.ellipse(8, 4, 8, 4).fill({ color: 0xffffff }).moveTo(0, 4).lineTo(16, 4).stroke({ color: 0x000000, alpha: 0.18, width: 1 })),
    ring: bake((g) => g.circle(8, 8, 6.5).stroke({ color: 0xffffff, width: 2 })),
  }
}

type Range = number | [number, number]

export interface Burst {
  x: number
  y: number
  count: number
  texture: keyof FxTextures
  /** Un color o varios (se elige al azar). */
  tint: number | number[]
  /** Velocidad inicial (px/s). */
  speed: Range
  /** Dirección (radianes; 0 = derecha, −π/2 = arriba). */
  angle: Range
  /** Duración (ms). */
  life: Range
  /** Escala al nacer y al morir. */
  scale: [number, number]
  alpha?: [number, number]
  /** Aceleración vertical (px/s²; positiva = cae). */
  gravity?: number
  /** Freno por segundo (0 = ninguno, 1 = se detiene enseguida). */
  drag?: number
  /** Las partículas nacen repartidas en este radio (o rectángulo [ancho, alto]). */
  spread?: number | [number, number]
  /** Giro (radianes/s). */
  spin?: Range
  /** Brilla (se suma al color de fondo): chispas, brillos, destellos. */
  glow?: boolean
  /** Vaivén horizontal (px) mientras vive: hojas, burbujas. */
  sway?: number
}

interface Particle {
  sprite: Sprite
  vx: number
  vy: number
  gravity: number
  drag: number
  life: number
  age: number
  spin: number
  scale0: number
  scale1: number
  alpha0: number
  alpha1: number
  sway: number
  swayPhase: number
  baseX: number
}

const pick = (r: Range): number => (typeof r === 'number' ? r : r[0] + Math.random() * (r[1] - r[0]))

export class Fx {
  readonly layer = new Container()
  private readonly free: Particle[] = []
  private readonly live: Particle[] = []
  readonly textures: FxTextures

  constructor(textures: FxTextures, max = 420) {
    this.textures = textures
    for (let i = 0; i < max; i++) {
      const sprite = new Sprite(textures.soft)
      sprite.anchor.set(0.5)
      sprite.visible = false
      this.layer.addChild(sprite)
      this.free.push({ sprite, vx: 0, vy: 0, gravity: 0, drag: 0, life: 1, age: 0, spin: 0, scale0: 1, scale1: 1, alpha0: 1, alpha1: 0, sway: 0, swayPhase: 0, baseX: 0 })
    }
  }

  /** Cuántas hay vivas (para no pasarse del presupuesto con los efectos continuos). */
  get count(): number {
    return this.live.length
  }

  burst(b: Burst): void {
    const tints = Array.isArray(b.tint) ? b.tint : [b.tint]
    for (let i = 0; i < b.count; i++) {
      const p = this.free.pop()
      if (!p) return
      const speed = pick(b.speed)
      const angle = pick(b.angle)
      let x = b.x
      let y = b.y
      if (Array.isArray(b.spread)) {
        x += (Math.random() - 0.5) * b.spread[0]
        y += (Math.random() - 0.5) * b.spread[1]
      } else if (b.spread) {
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * b.spread
        x += Math.cos(a) * r
        y += Math.sin(a) * r
      }
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.gravity = b.gravity ?? 0
      p.drag = b.drag ?? 0
      p.life = Math.max(1, pick(b.life))
      p.age = 0
      p.spin = b.spin === undefined ? 0 : pick(b.spin)
      p.scale0 = b.scale[0]
      p.scale1 = b.scale[1]
      p.alpha0 = b.alpha?.[0] ?? 1
      p.alpha1 = b.alpha?.[1] ?? 0
      p.sway = b.sway ?? 0
      p.swayPhase = Math.random() * Math.PI * 2
      p.baseX = x
      const s = p.sprite
      s.texture = this.textures[b.texture]
      s.tint = tints[Math.floor(Math.random() * tints.length)]
      s.blendMode = b.glow ? 'add' : 'normal'
      s.position.set(x, y)
      s.rotation = Math.random() * Math.PI * 2 * (b.spin === undefined ? 0 : 1)
      s.scale.set(p.scale0)
      s.alpha = p.alpha0
      s.visible = true
      this.live.push(p)
    }
  }

  update(dtMs: number): void {
    const dt = Math.min(dtMs, 50) / 1000
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]
      p.age += dtMs
      if (p.age >= p.life) {
        p.sprite.visible = false
        this.live[i] = this.live[this.live.length - 1]
        this.live.pop()
        this.free.push(p)
        continue
      }
      const k = p.age / p.life
      const damp = p.drag > 0 ? Math.max(0, 1 - p.drag * dt) : 1
      p.vx *= damp
      p.vy = p.vy * damp + p.gravity * dt
      p.baseX += p.vx * dt
      const s = p.sprite
      s.x = p.baseX + (p.sway ? Math.sin(p.swayPhase + p.age / 260) * p.sway : 0)
      s.y += p.vy * dt
      s.rotation += p.spin * dt
      s.scale.set(p.scale0 + (p.scale1 - p.scale0) * k)
      // Aparece rápido y se apaga al final.
      const fadeIn = Math.min(1, p.age / 90)
      s.alpha = (p.alpha0 + (p.alpha1 - p.alpha0) * k) * fadeIn
    }
  }

  clear(): void {
    for (const p of this.live) {
      p.sprite.visible = false
      this.free.push(p)
    }
    this.live.length = 0
  }
}

/** Sacudón de la cámara: fuerte al empezar y se apaga. */
export class Shake {
  private power = 0
  private until = 0
  private length = 1

  start(power: number, ms: number, now: number): void {
    if (power < this.current(now)) return
    this.power = power
    this.length = ms
    this.until = now + ms
  }

  current(now: number): number {
    if (now >= this.until) return 0
    return this.power * ((this.until - now) / this.length)
  }

  offset(now: number): { x: number; y: number } {
    const p = this.current(now)
    if (p <= 0) return { x: 0, y: 0 }
    return { x: (Math.random() * 2 - 1) * p, y: (Math.random() * 2 - 1) * p }
  }
}
