import { AnimatedSprite, Container, Graphics, Text, type Texture } from 'pixi.js'
import type { DuoAnim, DuoEmote, DuoPlayerNet, DuoRole } from '../shared/duoTypes'
import { ROLE_NAME, type DuoAssets } from './duoAssets'

/** Alto en pantalla del cuadro del sprite (el cuerpo ocupa ~85 %): un poco más que el hitbox. */
const FRAME_DISPLAY = 84

const SHEET_ANIM: Record<DuoAnim, { name: string; speed: number }> = {
  idle: { name: 'idle', speed: 0.08 },
  walk: { name: 'walk', speed: 0.22 },
  rise: { name: 'rise', speed: 0 },
  peak: { name: 'peak', speed: 0 },
  fall: { name: 'fall', speed: 0 },
  push: { name: 'push', speed: 0.14 },
  swim: { name: 'walk', speed: 0.12 },
  cheer: { name: 'cheer', speed: 0.12 },
  hurt: { name: 'faint', speed: 0 },
}

export const EMOTE_TEXT: Record<DuoEmote, string> = {
  here: '📍 ¡Aquí!',
  wait: '✋ Espera',
  button: '🔘 Pisa el botón',
  go: '🏃 ¡Vamos!',
  thanks: '💛 ¡Gracias!',
  idea: '💡 Tengo una idea',
}

/** En el aire (sin sombra en el piso). */
export function isAirborne(anim: DuoAnim): boolean {
  return anim === 'rise' || anim === 'peak' || anim === 'fall'
}

/** 0→1 con un pequeño rebote al final. */
function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/**
 * Un personaje en pantalla: sprite animado, sombra, nombre arriba y globo de
 * emote. Además del cuadro de la hoja, se estira al saltar, se aplasta al
 * caer (y rebota), respira quieto y reaparece creciendo.
 */
export class CharacterView {
  readonly root = new Container()
  private readonly sprite: AnimatedSprite
  private readonly shadow = new Graphics()
  private readonly animations: Record<string, Texture[]>
  private readonly label: Container
  private readonly bubble = new Container()
  private bubbleUntil = 0
  private current: DuoAnim | null = null
  private readonly baseScale: number
  private bob = 0
  private deadFor = 0
  private squashX = 1
  private squashY = 1
  /** 0→1 al reaparecer (crece con rebote). */
  private appear = 1
  private readonly breathPhase = Math.random() * 10

  constructor(assets: DuoAssets, role: DuoRole, displayName: string, isMe: boolean) {
    const sheet = assets.characters[role]
    this.animations = sheet.animations
    const first = this.animations.idle[0]
    this.sprite = new AnimatedSprite(this.animations.idle)
    this.baseScale = FRAME_DISPLAY / first.frame.height
    this.sprite.scale.set(this.baseScale)
    this.sprite.play()
    this.shadow.ellipse(0, 0, 20, 5).fill({ color: 0x000000, alpha: 0.22 })
    this.label = makeLabel(isMe ? `${ROLE_NAME[role]} · Tú` : `${ROLE_NAME[role]} · ${displayName}`, role, isMe)
    this.label.y = -FRAME_DISPLAY - 6
    this.bubble.visible = false
    this.root.addChild(this.shadow, this.sprite, this.label, this.bubble)
  }

  /** Al saltar: se estira hacia arriba. */
  stretch(): void {
    this.squashX = 0.84
    this.squashY = 1.2
  }

  /** Al aterrizar: se aplasta según la fuerza de la caída (0..1) y rebota. */
  land(strength: number): void {
    const s = 0.08 + 0.2 * Math.max(0, Math.min(1, strength))
    this.squashX = 1 + s
    this.squashY = 1 - s
  }

  /** Reaparece: crece desde chico con un rebote. */
  respawn(): void {
    this.appear = 0
  }

  update(state: DuoPlayerNet, now: number, dtMs: number): void {
    this.root.position.set(state.x, state.y)
    if (state.anim !== this.current) {
      this.current = state.anim
      const spec = SHEET_ANIM[state.anim]
      this.sprite.textures = this.animations[spec.name]
      this.sprite.animationSpeed = spec.speed
      if (spec.speed > 0) this.sprite.gotoAndPlay(0)
      else this.sprite.gotoAndStop(0)
    }
    // Al nadar se mece; al apagarse sube y se desvanece.
    this.bob += dtMs / 1000
    this.deadFor = state.dead ? this.deadFor + dtMs / 1000 : 0
    this.sprite.rotation = state.anim === 'swim' ? Math.sin(this.bob * 5) * 0.12 : 0
    this.sprite.alpha = state.dead ? Math.max(0.15, 1 - this.deadFor) : 1
    this.sprite.y = -Math.min(40, this.deadFor * 50)

    // El estirón y el aplastón vuelven a la forma normal como un resorte.
    const k = 1 - Math.exp(-dtMs / 70)
    this.squashX += (1 - this.squashX) * k
    this.squashY += (1 - this.squashY) * k
    this.appear = Math.min(1, this.appear + dtMs / 420)
    const pop = this.appear < 1 ? Math.max(0.05, easeOutBack(this.appear)) : 1
    const breathe = state.anim === 'idle' ? 1 + Math.sin(now / 420 + this.breathPhase) * 0.018 : 1
    this.sprite.scale.set(this.baseScale * state.facing * this.squashX * pop, this.baseScale * this.squashY * breathe * pop)

    // Sombra en el piso: se esconde en el aire, al nadar y al apagarse.
    this.shadow.visible = !state.dead && !isAirborne(state.anim) && state.anim !== 'swim'
    this.shadow.scale.set(this.squashX)
    if (this.bubble.visible && now > this.bubbleUntil) this.bubble.visible = false
  }

  showEmote(emote: DuoEmote, now: number): void {
    this.bubble.removeChildren().forEach((c) => c.destroy())
    const text = new Text({ text: EMOTE_TEXT[emote], style: { fontFamily: 'system-ui, sans-serif', fontSize: 15, fontWeight: '800', fill: 0x1f2937 } })
    const padX = 10
    const box = new Graphics()
      .roundRect(-text.width / 2 - padX, -text.height - 12, text.width + padX * 2, text.height + 8, 10)
      .fill({ color: 0xffffff, alpha: 0.96 })
      .stroke({ color: 0x1f2937, width: 2, alpha: 0.25 })
      .moveTo(-6, -4)
      .lineTo(0, 4)
      .lineTo(6, -4)
      .fill({ color: 0xffffff, alpha: 0.96 })
    text.anchor.set(0.5, 1)
    text.y = -8
    this.bubble.addChild(box, text)
    this.bubble.y = -FRAME_DISPLAY - 26
    this.bubble.visible = true
    this.bubbleUntil = now + 2600
  }

  destroy(): void {
    this.root.destroy({ children: true })
  }
}

function makeLabel(text: string, role: DuoRole, isMe: boolean): Container {
  const c = new Container()
  const t = new Text({
    text,
    style: { fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: '800', fill: 0xffffff },
  })
  t.anchor.set(0.5, 1)
  const color = role === 'FIRE' ? 0xea580c : 0x0284c7
  const bg = new Graphics()
    .roundRect(-t.width / 2 - 7, -t.height - 3, t.width + 14, t.height + 5, 8)
    .fill({ color, alpha: isMe ? 0.95 : 0.75 })
  if (isMe) bg.stroke({ color: 0xffffff, width: 2 })
  c.addChild(bg, t)
  return c
}
