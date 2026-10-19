import { InvalidAvatarError } from '../errors/user.errors.js';

/** Tonos de piel del cuerpo base del avatar (issue #77). */
export const AVATAR_SKINS = ['light', 'medium', 'dark'] as const;
export type AvatarSkin = (typeof AVATAR_SKINS)[number];

/**
 * Ranuras del avatar y el prefijo de sus piezas. `portrait` es la "foto
 * rápida": una cara lista que reemplaza al avatar en las fotos redondas.
 *
 * El catálogo (qué piezas existen y dónde se dibujan) vive en el cliente
 * (`client/src/components/avatar/avatarCatalog.ts`); aquí solo se exige el
 * formato `<prefijo>-NN`, para que una pieza no termine en la ranura de otra.
 */
const PIECE_PREFIXES = {
  hair: 'hair',
  hat: 'hat',
  top: 'top',
  outer: 'outer',
  bottom: 'bottom',
  dress: 'dress',
  shoes: 'shoes',
  portrait: 'face',
} as const;

export type AvatarPieceSlot = keyof typeof PIECE_PREFIXES;
export const AVATAR_PIECE_SLOTS = Object.keys(PIECE_PREFIXES) as AvatarPieceSlot[];

export type AvatarConfigProps = { skin: AvatarSkin } & Record<AvatarPieceSlot, string | null>;

export type AvatarConfigInput = { skin: unknown } & Partial<Record<AvatarPieceSlot, unknown>>;

export class AvatarConfig {
  private constructor(private readonly props: AvatarConfigProps) {}

  static create(input: AvatarConfigInput): AvatarConfig {
    if (!AVATAR_SKINS.includes(input.skin as AvatarSkin)) {
      throw new InvalidAvatarError(`el tono de piel "${String(input.skin)}" no existe.`);
    }
    const pieces = {} as Record<AvatarPieceSlot, string | null>;
    for (const slot of AVATAR_PIECE_SLOTS) {
      pieces[slot] = AvatarConfig.validatePiece(slot, input[slot]);
    }
    // Un vestido ocupa el lugar de la parte de arriba y la de abajo a la vez.
    if (pieces.dress && (pieces.top || pieces.bottom)) {
      throw new InvalidAvatarError('un vestido reemplaza la parte de arriba y la de abajo.');
    }
    return new AvatarConfig({ skin: input.skin as AvatarSkin, ...pieces });
  }

  /**
   * Reconstruye lo guardado en la base de datos. Si alguien lo dejó con un
   * formato que ya no es válido, el usuario simplemente queda sin avatar en
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

  private static validatePiece(slot: AvatarPieceSlot, value: unknown): string | null {
    if (value === undefined || value === null || value === '') return null;
    const pattern = new RegExp(`^${PIECE_PREFIXES[slot]}-[0-9]{2}$`);
    if (typeof value !== 'string' || !pattern.test(value)) {
      throw new InvalidAvatarError(`la pieza "${String(value)}" no corresponde a "${slot}".`);
    }
    return value;
  }

  get skin(): AvatarSkin {
    return this.props.skin;
  }

  piece(slot: AvatarPieceSlot): string | null {
    return this.props[slot];
  }

  toJSON(): AvatarConfigProps {
    return { ...this.props };
  }
}
