import type { DuoInput } from '../shared/duoTypes'

const KEYS: Record<string, keyof DuoInput> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  ArrowDown: 'down',
  KeyS: 'down',
}

/**
 * Entrada del jugador: teclado (flechas, WASD, espacio) y los botones táctiles
 * se suman — cualquiera de los dos mueve al personaje.
 */
export class DuoInputState {
  private keys: DuoInput = { left: false, right: false, jump: false, down: false }
  private touch: DuoInput = { left: false, right: false, jump: false, down: false }

  private readonly onKeyDown = (event: KeyboardEvent) => this.setKey(event, true)
  private readonly onKeyUp = (event: KeyboardEvent) => this.setKey(event, false)
  private readonly onBlur = () => {
    this.keys = { left: false, right: false, jump: false, down: false }
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }

  setTouch(key: keyof DuoInput, down: boolean): void {
    this.touch[key] = down
  }

  read(): DuoInput {
    return {
      left: this.keys.left || this.touch.left,
      right: this.keys.right || this.touch.right,
      jump: this.keys.jump || this.touch.jump,
      down: this.keys.down || this.touch.down,
    }
  }

  private setKey(event: KeyboardEvent, down: boolean): void {
    const key = KEYS[event.code]
    if (!key) return
    // No robar las teclas mientras se escribe en el chat o en un campo.
    const target = event.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
    event.preventDefault()
    this.keys[key] = down
  }
}
