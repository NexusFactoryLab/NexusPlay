import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateOrganizationDto } from './create-organization.dto.js';
import { UpdateOrganizationDto } from './update-organization.dto.js';
import { UpdateUserProfileDto } from './update-user-profile.dto.js';

async function errorsOf<T extends object>(cls: new () => T, body: object) {
  const errors = await validate(plainToInstance(cls, body));
  return errors.map((error) => error.property);
}

describe('DTO: tipo de institución', () => {
  it('crear: acepta los tres tipos, null o ausente', async () => {
    for (const institutionType of ['UNIVERSITY', 'SCHOOL', 'OTHER', null, undefined]) {
      expect(await errorsOf(CreateOrganizationDto, { name: 'Colegio San José', institutionType })).toEqual([]);
    }
  });

  it('crear: rechaza un tipo desconocido', async () => {
    expect(await errorsOf(CreateOrganizationDto, { name: 'Colegio San José', institutionType: 'KINDER' })).toEqual([
      'institutionType',
    ]);
  });

  it('editar: acepta un tipo o null y rechaza valores fuera del enum', async () => {
    expect(await errorsOf(UpdateOrganizationDto, { institutionType: 'SCHOOL' })).toEqual([]);
    expect(await errorsOf(UpdateOrganizationDto, { institutionType: null })).toEqual([]);
    expect(await errorsOf(UpdateOrganizationDto, { institutionType: 'school' })).toEqual(['institutionType']);
  });
});

describe('DTO: facultad o carrera del perfil', () => {
  it('es opcional y admite null para quitarlo', async () => {
    expect(await errorsOf(UpdateUserProfileDto, {})).toEqual([]);
    expect(await errorsOf(UpdateUserProfileDto, { academicProgram: null })).toEqual([]);
    expect(await errorsOf(UpdateUserProfileDto, { academicProgram: 'Medicina' })).toEqual([]);
  });

  it('rechaza más de 80 caracteres y valores que no son texto', async () => {
    expect(await errorsOf(UpdateUserProfileDto, { academicProgram: 'a'.repeat(80) })).toEqual([]);
    expect(await errorsOf(UpdateUserProfileDto, { academicProgram: 'a'.repeat(81) })).toEqual(['academicProgram']);
    expect(await errorsOf(UpdateUserProfileDto, { academicProgram: 42 })).toEqual(['academicProgram']);
  });
});
