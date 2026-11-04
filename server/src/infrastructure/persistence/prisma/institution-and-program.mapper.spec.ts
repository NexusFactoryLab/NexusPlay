import { describe, expect, it } from 'vitest';
import { OrganizationMapper } from './organization.mapper.js';
import { UserMapper, type UserModelWithRole } from './user.mapper.js';

const NOW = new Date('2026-11-03T15:00:00Z');

function organizationRecord(institutionType: 'UNIVERSITY' | 'SCHOOL' | 'OTHER' | null) {
  return {
    id: 'org-1',
    name: 'Universidad Andina',
    institutionType,
    domain: null,
    createdByUserId: 'u1',
    createdAt: NOW,
    isActive: true,
    inviteCode: 'ABC123',
  };
}

function userRecord(academicProgram: string | null): UserModelWithRole {
  return {
    id: 'user-1',
    email: 'ana@colegio.edu.co',
    passwordHash: null,
    firstName: 'Ana',
    middleName: null,
    lastName: 'Pérez',
    displayName: 'Ana',
    roleId: 'role-1',
    role: { id: 'role-1', name: 'STUDENT', createdAt: NOW },
    hasChosenRole: true,
    avatarUrl: null,
    avatarConfig: null,
    birthDate: null,
    academicProgram,
    locale: 'es-CO',
    isActive: true,
    isEmailVerified: true,
    lastLoginAt: null,
    createdAt: NOW,
    lastUpdate: NOW,
  };
}

describe('OrganizationMapper: tipo de institución', () => {
  it('ida y vuelta conserva el tipo y el "sin clasificar"', () => {
    for (const institutionType of ['UNIVERSITY', 'SCHOOL', 'OTHER', null] as const) {
      const organization = OrganizationMapper.toDomain(organizationRecord(institutionType));
      expect(organization.institutionType).toBe(institutionType);
      expect(OrganizationMapper.toPersistence(organization).institutionType).toBe(institutionType);
    }
  });
});

describe('UserMapper: facultad o carrera', () => {
  it('ida y vuelta conserva el programa o su ausencia', () => {
    for (const academicProgram of ['Medicina', null]) {
      const user = UserMapper.toDomain(userRecord(academicProgram));
      expect(user.academicProgram).toBe(academicProgram);
      expect(UserMapper.toPersistence(user).academicProgram).toBe(academicProgram);
    }
  });
});
