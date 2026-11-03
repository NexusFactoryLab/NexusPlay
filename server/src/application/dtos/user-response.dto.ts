import { User } from '../../domain/entities/user.entity.js';
import type { UserConsent } from '../../domain/entities/user-consent.entity.js';
import type { AvatarConfigProps } from '../../domain/value-objects/avatar-config.vo.js';

export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  displayName: string;
  role: string;
  hasChosenRole: boolean;
  avatarUrl: string | null;
  /** Avatar armado por piezas (issue #77); null si la cuenta aún no lo configuró. */
  avatarConfig: AvatarConfigProps | null;
  birthDate: Date | null;
  locale: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  lastUpdate: Date;
}

/**
 * Perfil de la propia persona (login, `/users/me` y lo que edita de sí misma):
 * el perfil general más su decisión vigente sobre el ranking público. Los
 * listados y vistas de administración usan `UserResponseDto` y no la incluyen.
 */
export interface CurrentUserResponseDto extends UserResponseDto {
  /** Decisión vigente sobre aparecer en el ranking público: null = aún no se le ha preguntado. */
  rankingConsent: boolean | null;
  /** Cuándo tomó esa decisión; null si aún no se le ha preguntado. */
  rankingConsentAt: Date | null;
  /** true si tiene 14 años cumplidos verificables: solo entonces se le pregunta y puede aceptar. */
  rankingConsentEligible: boolean;
}

export function toUserResponseDto(user: User): UserResponseDto {
  return {
    id: user.id,
    email: user.email.getValue(),
    firstName: user.name.firstName,
    middleName: user.name.middleName,
    lastName: user.name.lastName,
    displayName: user.displayName,
    role: user.role.getName(),
    hasChosenRole: user.hasChosenRole,
    avatarUrl: user.avatarUrl,
    avatarConfig: user.avatarConfig?.toJSON() ?? null,
    birthDate: user.birthDate,
    locale: user.locale,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    lastUpdate: user.lastUpdate,
  };
}

/** `rankingConsent` es la última decisión `PUBLIC_RANKING` del historial (null si no hay). */
export function toCurrentUserResponseDto(
  user: User,
  rankingConsent: UserConsent | null,
  now: Date = new Date(),
): CurrentUserResponseDto {
  return {
    ...toUserResponseDto(user),
    rankingConsent: rankingConsent?.granted ?? null,
    rankingConsentAt: rankingConsent?.createdAt ?? null,
    rankingConsentEligible: user.canDecideRankingConsent(now),
  };
}
