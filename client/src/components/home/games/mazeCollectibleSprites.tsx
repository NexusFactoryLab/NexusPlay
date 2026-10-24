import { SpriteStrip } from './mazeSpriteStrip'

/**
 * Coleccionables del laberinto, con los sprites del Camión Reciclador (issue
 * #82): botella PET, Caneca de Energía, bolsa negra y celular e-waste, cada
 * uno con su animación de 4 frames.
 */

export function PetSprite({ size }: { size: number }) {
  return <SpriteStrip name="item-pet" frames={4} size={size} durationMs={1200} />
}

export function PowerPelletSprite({ size }: { size: number }) {
  return <SpriteStrip name="item-power" frames={4} size={size} durationMs={800} />
}

export function TrashBagSprite({ size }: { size: number }) {
  return <SpriteStrip name="item-bag" frames={4} size={size} durationMs={500} />
}

export function BonusSprite({ size }: { size: number }) {
  return <SpriteStrip name="item-bonus" frames={4} size={size} durationMs={600} />
}
