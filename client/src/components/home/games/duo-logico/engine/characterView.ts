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

/** Un personaje en pantalla: sprite animado, nombre arriba y globo de emote. */
export class CharacterView {
  readonly root = new Container()
  private readonly sprite: AnimatedSprite
  private readonly animations: Record<string, Texture[]>
  private readonly label: Container
  private readonly bubble = new Container()
  private bubbleUntil = 0
  private current: DuoAnim | null = null
  private readonly baseScale: number
  private bob = 0
  private deadFor = 0

  constructor(assets: DuoAssets, role: DuoRole, displayName: string, isMe: boolean) {
    const sheet = assets.characters[role]
    this.animations = sheet.animations
    const first = this.animations.idle[0]
    this.sprite = new AnimatedSprite(this.animations.idle)
    this.baseScale = FRAME_DISPLAY / first.frame.height
    this.sprite.scale.set(this.baseScale)
    this.sprite.play()
    this.label = makeLabel(isMe ? `${ROLE_NAME[role]} · Tú` : `${ROLE_NAME[role]} · ${displayName}`, role, isMe)
    this.label.y = -FRAME_DISPLAY - 6
    this.bubble.visible = false
    this.root.addChild(this.sprite, this.label, this.bubble)
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
    this.sprite.scale.x = this.baseScale * state.facing
    // Al nadar se mece; al apagarse sube y se desvanece.
    this.bob += dtMs / 1000
    this.deadFor = state.dead ? this.deadFor + dtMs / 1000 : 0
    this.sprite.rotation = state.anim === 'swim' ? Math.sin(this.bob * 5) * 0.12 : 0
    this.sprite.alpha = state.dead ? Math.max(0.15, 1 - this.deadFor) : 1
    this.sprite.y = -Math.min(40, this.deadFor * 50)
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
