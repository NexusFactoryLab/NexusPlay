import { describe, expect, it } from 'vitest'
import type { AvatarConfig } from '../../services/avatar.service'
import { AVATAR_FACE_IDS, AVATAR_PIECES, AVATAR_SKINS } from './avatarCatalog.generated'
import {
  DEFAULT_AVATAR,
  avatarLayers,
  normalizeAvatar,
  piecesFor,
  randomAvatar,
  sameAvatar,
  wearPiece,
} from './avatarConfig'

// Las mismas imágenes que resuelve avatarAssets.ts (sin descargarlas).
const ASSETS = import.meta.glob('./assets/**/*.webp')
const hasAsset = (path: string) => `./assets/${path}.webp` in ASSETS

// Prefijos que exige el servidor (AvatarConfig en server/src/domain/value-objects).
const PREFIX: Record<string, string> = { hair: 'hair', hat: 'hat', top: 'top', outer: 'outer', bottom: 'bottom', dress: 'dress', shoes: 'shoes' }

describe('catálogo del avatar (issue #77)', () => {
  it('cada pieza tiene un id único con el prefijo de su ranura (el que valida el servidor)', () => {
    const ids = AVATAR_PIECES.map((piece) => piece.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const piece of AVATAR_PIECES) {
      expect(piece.id).toMatch(new RegExp(`^${PREFIX[piece.slot]}-[0-9]{2}$`))
    }
    for (const face of AVATAR_FACE_IDS) expect(face).toMatch(/^face-[0-9]{2}$/)
  })

  it('trae todas las piezas de las hojas de diseño', () => {
    expect(piecesFor('hair')).toHaveLength(11)
    expect(piecesFor('hat')).toHaveLength(30)
    expect(piecesFor('top')).toHaveLength(18)
    expect(piecesFor('outer')).toHaveLength(15)
    expect(piecesFor('bottom')).toHaveLength(21)
    expect(piecesFor('dress')).toHaveLength(6)
    expect(piecesFor('shoes')).toHaveLength(24)
    expect(AVATAR_FACE_IDS).toHaveLength(18)
    expect(AVATAR_SKINS.map((skin) => skin.id)).toEqual(['light', 'medium', 'dark'])
  })

  it('cada pieza, cara y tono tiene sus imágenes', () => {
    for (const piece of AVATAR_PIECES) {
      expect(hasAsset(`pieces/${piece.id}`), piece.id).toBe(true)
      expect(hasAsset(`thumbs/${piece.id}`), piece.id).toBe(true)
    }
    for (const face of AVATAR_FACE_IDS) expect(hasAsset(`faces/${face}`), face).toBe(true)
    for (const skin of AVATAR_SKINS) {
      expect(hasAsset(`body/${skin.id}`)).toBe(true)
      expect(hasAsset(`body/${skin.id}-head`)).toBe(true)
    }
  })

  it('los sombreros dicen si tapan el pelo y los zapatos dónde se corta el pie', () => {
    for (const hat of piecesFor('hat')) {
      expect(typeof hat.clipHair).toBe('boolean')
      expect(hat.hairClipY).toBeGreaterThan(hat.box.y)
    }
    for (const shoes of piecesFor('shoes')) expect(shoes.feetCutY).toBeGreaterThan(1300)
  })
})

describe('reglas del avatar', () => {
  it('el avatar por defecto es válido', () => {
    expect(normalizeAvatar(DEFAULT_AVATAR)).toEqual(DEFAULT_AVATAR)
  })

  it('un vestido quita la parte de arriba y la de abajo, y al revés', () => {
    const withDress = wearPiece({ ...DEFAULT_AVATAR, top: 'top-01' }, 'dress', 'dress-02')
    expect(withDress).toMatchObject({ dress: 'dress-02', top: null, bottom: null, outer: 'outer-13' })

    const withTop = wearPiece(withDress, 'top', 'top-03')
    expect(withTop).toMatchObject({ dress: null, top: 'top-03' })
  })

  it('tocar la pieza que ya tiene puesta se la quita', () => {
    expect(wearPiece(DEFAULT_AVATAR, 'shoes', 'shoes-02').shoes).toBeNull()
    expect(wearPiece(DEFAULT_AVATAR, 'portrait', 'face-04').portrait).toBe('face-04')
  })

  it('normalizeAvatar descarta piezas que no existen o están en otra ranura', () => {
    const avatar = normalizeAvatar({ skin: 'verde', hair: 'hat-01', top: 'top-99', shoes: 'shoes-05', portrait: 'face-77' })
    expect(avatar).toEqual({ ...emptyLight(), shoes: 'shoes-05' })
    expect(normalizeAvatar(null)).toBeNull()
    expect(normalizeAvatar('avatar')).toBeNull()
  })

  it('randomAvatar arma combinaciones válidas y conserva la foto rápida', () => {
    let seed = 7
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let round = 0; round < 50; round += 1) {
      const avatar = randomAvatar({ ...DEFAULT_AVATAR, portrait: 'face-03' }, random)
      expect(normalizeAvatar(avatar)).toEqual(avatar)
      expect(avatar.portrait).toBe('face-03')
      expect(avatar.shoes).not.toBeNull()
    }
  })

  it('sameAvatar compara todas las ranuras', () => {
    expect(sameAvatar(DEFAULT_AVATAR, { ...DEFAULT_AVATAR })).toBe(true)
    expect(sameAvatar(DEFAULT_AVATAR, { ...DEFAULT_AVATAR, hat: 'hat-01' })).toBe(false)
    expect(sameAvatar(null, null)).toBe(true)
  })
})

describe('capas del avatar', () => {
  it('apila de atrás hacia adelante: cuerpo, zapatos, ropa, cabeza, pelo y sombrero', () => {
    const layers = avatarLayers({ ...DEFAULT_AVATAR, top: 'top-01', hat: 'hat-02' })
    expect(layers.map((layer) => layer.key)).toEqual(['body', 'shoes-02', 'bottom-07', 'top-01', 'outer-13', 'head', 'hair-01', 'hat-02'])
  })

  it('con zapatos recorta los pies del cuerpo; descalzo no', () => {
    expect(avatarLayers(DEFAULT_AVATAR)[0].clipPath).toMatch(/^inset\(0 0 [0-9.]+% 0\)$/)
    expect(avatarLayers({ ...DEFAULT_AVATAR, shoes: null })[0].clipPath).toBeUndefined()
  })

  it('un gorro oculta el pelo de arriba; una diadema no', () => {
    const hair = (config: AvatarConfig) => avatarLayers(config).find((layer) => layer.key === 'hair-01')
    expect(hair({ ...DEFAULT_AVATAR, hat: 'hat-02' })?.clipPath).toMatch(/^polygon\(/)
    expect(hair({ ...DEFAULT_AVATAR, hat: 'hat-05' })?.clipPath).toBeUndefined()
    expect(hair(DEFAULT_AVATAR)?.clipPath).toBeUndefined()
  })
})

function emptyLight(): AvatarConfig {
  return { skin: 'light', hair: null, hat: null, top: null, outer: null, bottom: null, dress: null, shoes: null, portrait: null }
}
