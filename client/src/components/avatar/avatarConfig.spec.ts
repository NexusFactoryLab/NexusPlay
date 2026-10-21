import { describe, expect, it } from 'vitest'
import voxelArt from '@dicebear/styles/voxel-art.json'
import {
  BEARDS,
  CHEEKS,
  DEFAULT_AVATAR,
  EYEBROWS,
  EYES,
  GLASSES,
  HATS,
  MOUTHS,
  NOSES,
  OUTFITS,
  PALETTES,
  TOPS,
  avatarDataUri,
  initialsOf,
  normalizeAvatar,
  randomAvatar,
  sameAvatar,
  toDiceBearOptions,
} from './avatarConfig'

const variants = (component: string) =>
  Object.keys((voxelArt as unknown as { components: Record<string, { variants: Record<string, unknown> }> }).components[component].variants)

describe('opciones del avatar (Voxel Art, issue #77)', () => {
  it('cada opción existe en el estilo de DiceBear', () => {
    const cases: [string, { id: string }[]][] = [
      ['top', [...TOPS, ...HATS]], ['outfit', OUTFITS], ['eyes', EYES], ['eyebrows', EYEBROWS], ['mouth', MOUTHS],
      ['nose', NOSES], ['cheeks', CHEEKS], ['glasses', GLASSES], ['beard', BEARDS],
    ]
    for (const [component, options] of cases) {
      const available = variants(component)
      for (const option of options) expect(available, `${component}:${option.id}`).toContain(option.id)
    }
  })

  it('los colores de las paletas son hexadecimales de 6 dígitos (lo que valida el servidor)', () => {
    for (const palette of Object.values(PALETTES)) for (const hex of palette) expect(hex).toMatch(/^[0-9a-f]{6}$/)
  })

  it('el avatar por defecto es válido y se dibuja', () => {
    expect(normalizeAvatar(DEFAULT_AVATAR)).toEqual(DEFAULT_AVATAR)
    expect(avatarDataUri(DEFAULT_AVATAR)).toMatch(/^data:image\/svg\+xml/)
  })
})

describe('normalizeAvatar', () => {
  it('lo desconocido toma el valor por defecto o queda vacío si es opcional', () => {
    const avatar = normalizeAvatar({ outfit: 'capa', top: 'corona', skinColor: '#fff', glasses: 'round', mouth: 'grin' })
    expect(avatar).toEqual({ ...DEFAULT_AVATAR, top: null, eyebrows: null, cheeks: null, glasses: 'round', mouth: 'grin' })
  })

  it('un avatar del formato anterior (piezas PNG) se dibuja con lo de por defecto', () => {
    expect(normalizeAvatar({ skin: 'light', hair: 'hair-01' })?.outfit).toBe(DEFAULT_AVATAR.outfit)
    expect(normalizeAvatar(null)).toBeNull()
  })
})

describe('dibujo con DiceBear', () => {
  it('fija todo explícitamente: lo vacío va con probabilidad 0 y sin variante', () => {
    const options = toDiceBearOptions({ ...DEFAULT_AVATAR, glasses: null, beard: 'goatee' })
    expect(options.glassesProbability).toBe(0)
    expect('glassesVariant' in options).toBe(false)
    expect(options).toMatchObject({ beardVariant: ['goatee'], beardProbability: 100, backgroundColor: [] })
  })

  it('avatares distintos dan imágenes distintas y el mismo, la misma', () => {
    const other = { ...DEFAULT_AVATAR, outfit: 'dress' }
    expect(avatarDataUri(other)).not.toBe(avatarDataUri(DEFAULT_AVATAR))
    expect(avatarDataUri({ ...DEFAULT_AVATAR })).toBe(avatarDataUri(DEFAULT_AVATAR))
  })

  it('randomAvatar arma combinaciones válidas que se pueden dibujar', () => {
    let seed = 7
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let round = 0; round < 40; round += 1) {
      const avatar = randomAvatar(random)
      expect(normalizeAvatar(avatar)).toEqual(avatar)
      expect(() => avatarDataUri(avatar)).not.toThrow()
    }
  })
})

describe('utilidades', () => {
  it('sameAvatar compara todos los campos', () => {
    expect(sameAvatar(DEFAULT_AVATAR, { ...DEFAULT_AVATAR })).toBe(true)
    expect(sameAvatar(DEFAULT_AVATAR, { ...DEFAULT_AVATAR, nose: 'tall' })).toBe(false)
    expect(sameAvatar(null, null)).toBe(true)
  })

  it('initialsOf toma hasta dos iniciales', () => {
    expect(initialsOf('Camilo Pardo Ruiz')).toBe('CP')
    expect(initialsOf('  ')).toBe('?')
  })
})
