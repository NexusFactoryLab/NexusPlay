import { describe, expect, it } from 'vitest';
import { InvalidInstitutionTypeError } from '../errors/organization.errors.js';
import { Organization } from '../entities/organization.entity.js';
import { isInstitutionType, parseInstitutionType } from './institution-type.vo.js';

describe('tipo de institución', () => {
  it('reconoce los tres tipos y trata null/undefined como sin clasificar', () => {
    expect(parseInstitutionType('UNIVERSITY')).toBe('UNIVERSITY');
    expect(parseInstitutionType('SCHOOL')).toBe('SCHOOL');
    expect(parseInstitutionType('OTHER')).toBe('OTHER');
    expect(parseInstitutionType(null)).toBeNull();
    expect(parseInstitutionType(undefined)).toBeNull();
  });

  it('rechaza valores fuera del enum (incluido el mismo valor en minúsculas)', () => {
    expect(() => parseInstitutionType('KINDER')).toThrow(InvalidInstitutionTypeError);
    expect(() => parseInstitutionType('school')).toThrow(InvalidInstitutionTypeError);
    expect(isInstitutionType('school')).toBe(false);
    expect(isInstitutionType(42)).toBe(false);
  });

  it('una organización nueva sin tipo queda sin clasificar y se puede clasificar después', () => {
    const organization = Organization.create({ id: 'o1', name: 'Colegio San José', createdByUserId: 'u1', inviteCode: 'ABC' });
    expect(organization.institutionType).toBeNull();

    organization.classify('SCHOOL');
    expect(organization.institutionType).toBe('SCHOOL');

    organization.classify(null);
    expect(organization.institutionType).toBeNull();
  });

  it('una organización restaurada sin el campo (datos previos) queda sin clasificar', () => {
    const organization = Organization.fromPersistence({
      id: 'o1',
      name: 'Universidad Andina',
      domain: null,
      createdByUserId: 'u1',
      createdAt: new Date(),
      isActive: true,
      inviteCode: 'ABC',
    });
    expect(organization.institutionType).toBeNull();
  });

  it('crearla con un tipo válido lo guarda', () => {
    const organization = Organization.create({
      id: 'o1',
      name: 'Universidad Andina',
      createdByUserId: 'u1',
      inviteCode: 'ABC',
      institutionType: 'UNIVERSITY',
    });
    expect(organization.institutionType).toBe('UNIVERSITY');
  });
});
