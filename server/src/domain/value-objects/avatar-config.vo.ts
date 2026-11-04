import { InvalidAvatarError } from '../errors/user.errors.js';

/**
 * Avatar (issues #77 y #136) con un estilo propio sobre Voxel Art de DiceBear:
 * el cliente lo dibuja a partir de estas opciones, cada parte por su cuenta
 * (pelo, gorro encima del pelo, torso, pantalón, calzado). Aquí solo se aceptan
 * las variantes que existen en ese estilo y colores en hexadecimal de 6 dígitos
 * (sin "#"); las mismas listas están en `client/src/components/avatar/avatarConfig.ts`.
 */
const TOPS = [
  'short', 'spiky', 'bowl', 'sideSwept', 'mohawk', 'halfShaved', 'afro', 'buns', 'ponytail', 'bob', 'longStraight',
  'longWavy', 'braids', 'twinTails',
] as const;
const HATS = [
  'cap', 'backwardsCap', 'beanie', 'beret', 'sunHat', 'helmet', 'headband', 'crown', 'animalEars', 'bunnyEars',
] as const;
const OUTFITS = [
  'plain', 'tank', 'jersey', 'stripes', 'checker', 'hoodie', 'jacket', 'vest', 'coat', 'dress', 'overalls', 'suit', 'tie',
] as const;
const PANTS = ['long', 'jeans', 'joggers', 'cargo', 'shorts', 'skirt'] as const;
const SHOES = ['classic', 'sneakers', 'boots', 'sandals'] as const;
const EYES = ['open', 'soft', 'happy', 'wide', 'side', 'sleepy', 'closed', 'star'] as const;
const EYEBROWS = ['flat', 'soft', 'raised', 'angry'] as const;
const MOUTHS = ['smile', 'bigSmile', 'wideSmile', 'grin', 'laugh', 'smirk', 'tongue', 'ooh', 'flat', 'frown'] as const;
const NOSES = ['small', 'block', 'wide', 'tall'] as const;
const CHEEKS = ['blush', 'freckles', 'pixel'] as const;
const GLASSES = ['round', 'cat', 'shades', 'visor'] as const;
const BEARDS = ['stubble', 'mustache', 'goatee', 'full'] as const;

const REQUIRED_VARIANTS = {
  outfit: OUTFITS, pants: PANTS, shoes: SHOES, eyes: EYES, mouth: MOUTHS, nose: NOSES,
} as const;
const OPTIONAL_VARIANTS = {
  top: TOPS, hat: HATS, eyebrows: EYEBROWS, cheeks: CHEEKS, glasses: GLASSES, beard: BEARDS,
} as const;

/** Lo que falta en un avatar de antes de #136 (sin pantalón ni calzado propios). */
const LEGACY_DEFAULTS = { pants: 'long', shoes: 'classic' } as const;
/** Opciones que se quitaron por parecerse a otras (#136) y la más parecida que queda. */
const RETIRED: Partial<Record<OptionalField, Record<string, string>>> = {
  top: { curly: 'spiky', shoulderLength: 'bob', partedLong: 'longStraight' },
  glasses: { square: 'round' },
};
const LEGACY_HAIR = 'short';
export const AVATAR_COLOR_FIELDS = [
  'hairColor', 'hatColor', 'skinColor', 'shirtColor', 'jacketColor', 'pantsColor', 'shoesColor',
] as const;

const HEX = /^[0-9a-f]{6}$/;

type RequiredField = keyof typeof REQUIRED_VARIANTS;
type OptionalField = keyof typeof OPTIONAL_VARIANTS;
type ColorField = (typeof AVATAR_COLOR_FIELDS)[number];

export type AvatarConfigProps = Record<RequiredField | ColorField, string> & Record<OptionalField, string | null>;

export type AvatarConfigInput = Partial<Record<keyof AvatarConfigProps, unknown>>;

export class AvatarConfig {
  private constructor(private readonly props: AvatarConfigProps) {}

  static create(raw: AvatarConfigInput): AvatarConfig {
    const input = AvatarConfig.upgrade(raw);
    const props = {} as AvatarConfigProps;
    for (const [field, allowed] of Object.entries(REQUIRED_VARIANTS) as [RequiredField, readonly string[]][]) {
      const value = input[field];
      if (typeof value !== 'string' || !allowed.includes(value)) {
        throw new InvalidAvatarError(`"${String(value)}" no es una opción válida para "${field}".`);
      }
      props[field] = value;
    }
    for (const [field, allowed] of Object.entries(OPTIONAL_VARIANTS) as [OptionalField, readonly string[]][]) {
      const value = input[field];
      if (value === undefined || value === null || value === '') {
        props[field] = null;
      } else if (typeof value === 'string' && allowed.includes(value)) {
        props[field] = value;
      } else {
        throw new InvalidAvatarError(`"${String(value)}" no es una opción válida para "${field}".`);
      }
    }
    for (const field of AVATAR_COLOR_FIELDS) {
      const value = input[field];
      if (typeof value !== 'string' || !HEX.test(value)) {
        throw new InvalidAvatarError(`"${String(value)}" no es un color válido para "${field}".`);
      }
      props[field] = value;
    }
    return new AvatarConfig(props);
  }

  /**
   * Reconstruye lo guardado en la base de datos. Si ya no es válido (por
   * ejemplo, un avatar del formato anterior), la cuenta queda sin avatar en
   * vez de romper la carga de su perfil.
   */
  static restore(value: unknown): AvatarConfig | null {
    if (!value || typeof value !== 'object') return null;
    try {
      return AvatarConfig.create(value as AvatarConfigInput);
    } catch (error) {
      if (error instanceof InvalidAvatarError) return null;
      throw error;
    }
  }

  /**
   * Pasa un avatar de antes de #136 al formato actual: el gorro iba en lugar
   * del pelo (en `top`) y ahora va encima de un peinado; el pantalón y el
   * calzado no existían; algunos peinados se quitaron.
   */
  private static upgrade(raw: AvatarConfigInput): AvatarConfigInput {
    const input: AvatarConfigInput = { ...LEGACY_DEFAULTS, ...raw };
    if (typeof input.top === 'string' && (HATS as readonly string[]).includes(input.top)) {
      if (input.hat === undefined) input.hat = input.top;
      input.top = LEGACY_HAIR;
    }
    for (const [field, map] of Object.entries(RETIRED) as [OptionalField, Record<string, string>][]) {
      const value = input[field];
      if (typeof value === 'string' && value in map) input[field] = map[value];
    }
    return input;
  }

  get(field: keyof AvatarConfigProps): string | null {
    return this.props[field];
  }

  toJSON(): AvatarConfigProps {
    return { ...this.props };
  }
}
