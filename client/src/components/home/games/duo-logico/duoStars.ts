import type { DuoRoomView } from './shared/duoProtocol'

/**
 * Estrellas de un escenario ganado (1 a 3): una por llegar al portal, otra si
 * juntaron todas las gemas y otra si no perdieron ningún corazón.
 */
export function duoStars(room: Pick<DuoRoomView, 'gemsCollected' | 'gemsTotal' | 'hearts' | 'maxHearts'>): number {
  return 1 + (room.gemsTotal > 0 && room.gemsCollected >= room.gemsTotal ? 1 : 0) + (room.hearts >= room.maxHearts ? 1 : 0)
}
