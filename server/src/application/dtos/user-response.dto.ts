import { User } from '../../domain/entities/user.entity.js';
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
  /** Decisión sobre aparecer en el ranking público: null = aún no se le ha preguntado. */
  rankingConsent: boolean | null;
  /** true si tiene 14 años cumplidos verificables: solo entonces se le pregunta y puede aceptar. */
  rankingConsentEligible: boolean;
  birthDate: Date | null;
  locale: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  lastUpdate: Date;
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
    rankingConsent: user.rankingConsent,
    rankingConsentEligible: user.canDecideRankingConsent(),
    birthDate: user.birthDate,
    locale: user.locale,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    lastUpdate: user.lastUpdate,
  };
}
