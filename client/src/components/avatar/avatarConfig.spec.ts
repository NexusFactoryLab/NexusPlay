import { describe, expect, it } from 'vitest'
import nexusVoxel from './nexus-voxel.json'
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
  PANTS,
  SHOES,
  TOPS,
  avatarDataUri,
  initialsOf,
  normalizeAvatar,
  randomAvatar,
  sameAvatar,
  toDiceBearOptions,
} from './avatarConfig'

const variants = (component: string) =>
  Object.keys((nexusVoxel as unknown as { components: Record<string, { variants: Record<string, unknown> }> }).components[component].variants)

describe('opciones del avatar (Voxel Art, issues #77 y #136)', () => {
  it('cada opción existe en el estilo', () => {
    const cases: [string, { id: string }[]][] = [
      ['top', TOPS], ['hat', HATS], ['outfit', OUTFITS], ['pants', PANTS], ['shoes', SHOES], ['shoesOver', SHOES], ['eyes', EYES], ['eyebrows', EYEBROWS], ['mouth', MOUTHS],
      ['nose', NOSES], ['cheeks', CHEEKS], ['glasses', GLASSES], ['beard', BEARDS],
    ]
    for (const [component, options] of cases) {
      const available = variants(component)
      for (const option of options) expect(available, `${component}:${option.id}`).toContain(option.id)
    }
  })

  it('cada peinado tiene su versión bajo gorro', () => {
    for (const option of TOPS) expect(variants('top')).toContain(`${option.id}UnderHat`)
  })

  it('no hay opciones repetidas', () => {
    for (const list of [TOPS, HATS, OUTFITS, PANTS, SHOES, GLASSES]) {
      expect(new Set(list.map((option) => option.id)).size).toBe(list.length)
      expect(new Set(list.map((option) => option.label)).size).toBe(list.length)
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

  it('un gorro guardado antes de #136 (en lugar del pelo) pasa a ir encima del peinado por defecto', () => {
    const avatar = normalizeAvatar({ ...DEFAULT_AVATAR, top: 'beanie', hat: undefined, pants: undefined, shoes: undefined })
    expect(avatar).toMatchObject({ top: DEFAULT_AVATAR.top, hat: 'beanie', pants: DEFAULT_AVATAR.pants, shoes: DEFAULT_AVATAR.shoes })
  })

  it('los peinados que se quitaron pasan al más parecido', () => {
    expect(normalizeAvatar({ ...DEFAULT_AVATAR, top: 'partedLong' })?.top).toBe('longStraight')
    expect(normalizeAvatar({ ...DEFAULT_AVATAR, top: 'shoulderLength' })?.top).toBe('bob')
    expect(normalizeAvatar({ ...DEFAULT_AVATAR, top: 'curly' })?.top).toBe('spiky')
    expect(normalizeAvatar({ ...DEFAULT_AVATAR, glasses: 'square' })?.glasses).toBe('round')
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

  it('con un gorro que tapa la coronilla el pelo se recorta; con cintillo o corona se ve entero', () => {
    expect(toDiceBearOptions({ ...DEFAULT_AVATAR, top: 'afro', hat: 'cap' })).toMatchObject({ topVariant: ['afroUnderHat'], hatVariant: ['cap'] })
    expect(toDiceBearOptions({ ...DEFAULT_AVATAR, top: 'afro', hat: 'crown' })).toMatchObject({ topVariant: ['afro'], hatVariant: ['crown'] })
    expect(toDiceBearOptions({ ...DEFAULT_AVATAR, top: null, hat: 'cap' }).topProbability).toBe(0)
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
