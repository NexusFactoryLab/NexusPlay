import { InvalidAvatarError } from '../errors/user.errors.js';

/**
 * Avatar (issue #77) con el estilo Voxel Art de DiceBear: el cliente lo
 * dibuja a partir de estas opciones. Aquí solo se aceptan las variantes que
 * existen en ese estilo y colores en hexadecimal de 6 dígitos (sin "#"); las
 * mismas listas están en `client/src/components/avatar/avatarConfig.ts`.
 */
const TOPS = [
  'short', 'spiky', 'bowl', 'sideSwept', 'curly', 'mohawk', 'halfShaved', 'afro', 'buns', 'ponytail', 'bob',
  'shoulderLength', 'longStraight', 'longWavy', 'partedLong', 'braids', 'twinTails', 'cap', 'beanie', 'animalEars',
  'bunnyEars',
] as const;
const OUTFITS = ['plain', 'stripes', 'checker', 'hoodie', 'jacket', 'coat', 'dress', 'overalls', 'suit', 'tie'] as const;
const EYES = ['open', 'soft', 'happy', 'wide', 'side', 'sleepy', 'closed', 'star'] as const;
const EYEBROWS = ['flat', 'soft', 'raised', 'angry'] as const;
const MOUTHS = ['smile', 'bigSmile', 'wideSmile', 'grin', 'laugh', 'smirk', 'tongue', 'ooh', 'flat', 'frown'] as const;
const NOSES = ['small', 'block', 'wide', 'tall'] as const;
const CHEEKS = ['blush', 'freckles', 'pixel'] as const;
const GLASSES = ['round', 'square', 'cat', 'shades', 'visor'] as const;
const BEARDS = ['stubble', 'mustache', 'goatee', 'full'] as const;

const REQUIRED_VARIANTS = { outfit: OUTFITS, eyes: EYES, mouth: MOUTHS, nose: NOSES } as const;
const OPTIONAL_VARIANTS = { top: TOPS, eyebrows: EYEBROWS, cheeks: CHEEKS, glasses: GLASSES, beard: BEARDS } as const;
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

  static create(input: AvatarConfigInput): AvatarConfig {
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

  get(field: keyof AvatarConfigProps): string | null {
    return this.props[field];
  }

  toJSON(): AvatarConfigProps {
    return { ...this.props };
  }
}
