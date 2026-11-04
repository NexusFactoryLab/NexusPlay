import { describe, expect, it, vi } from 'vitest';
import type { OrganizationRepository } from '../../domain/ports/organization.repository.port.js';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import type { OrganizationMembership } from '../../domain/entities/organization-membership.entity.js';
import { Organization } from '../../domain/entities/organization.entity.js';
import { OrganizationRole } from '../../domain/value-objects/organization-role.vo.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { InvalidInstitutionTypeError } from '../../domain/errors/organization.errors.js';
import { InMemoryPublicRankingCache } from '../../infrastructure/persistence/in-memory-public-ranking-cache.js';
import { OrganizationNotFoundError } from '../errors/application.errors.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { UpdateOrganizationUseCase } from './update-organization.use-case.js';

function org(institutionType: 'UNIVERSITY' | 'SCHOOL' | 'OTHER' | null = null) {
  return Organization.fromPersistence({
    id: 'org-1',
    name: 'Colegio San José',
    domain: null,
    createdByUserId: 'creator-1',
    createdAt: new Date(),
    isActive: true,
    inviteCode: 'ORGABC',
    institutionType,
  });
}

function membership(orgRoleName: 'STUDENT' | 'TEACHER' | 'ADMIN') {
  return {
    organizationId: 'org-1',
    userId: 'requester-1',
    orgRole: OrganizationRole.create(orgRoleName),
    joinedAt: new Date(),
    isAdmin: () => orgRoleName === 'ADMIN',
  } as OrganizationMembership;
}

function setup(options: {
  organization: Organization | null;
  requestingMembership?: OrganizationMembership | null;
  requestingUserIsPlatformAdmin?: boolean;
}) {
  const organizationRepository: OrganizationRepository = {
    createWithOwner: vi.fn(),
    save: vi.fn(),
    findById: vi.fn(async () => options.organization),
    findByDomain: vi.fn(),
    findByInviteCode: vi.fn(),
    findAll: vi.fn(),
    findAllByUserId: vi.fn(),
    saveMembership: vi.fn(),
    createMembership: vi.fn(),
    findMembership: vi.fn(async () => options.requestingMembership ?? null),
    findMembershipsByOrganizationId: vi.fn(),
    findMembershipsByUserId: vi.fn(),
    removeMembership: vi.fn(),
  };
  const userRepository: UserRepository = {
    save: vi.fn(),
    findById: vi.fn(async () => ({ isAdmin: () => options.requestingUserIsPlatformAdmin ?? false }) as never),
    findByIds: vi.fn(),
    findByEmail: vi.fn(),
    existsByEmail: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };
  const cache = new InMemoryPublicRankingCache<string>();
  cache.set(1, 'ranking del día');
  const useCase = new UpdateOrganizationUseCase(
    organizationRepository,
    new RequesterAdminResolver(userRepository),
    cache,
  );
  return { useCase, organizationRepository, cache };
}

describe('UpdateOrganizationUseCase', () => {
  it('el ADMIN de la organización la clasifica, se guarda e invalida la caché del ranking', async () => {
    const { useCase, organizationRepository, cache } = setup({
      organization: org(),
      requestingMembership: membership('ADMIN'),
    });

    const result = await useCase.execute({
      organizationId: 'org-1',
      requestingUserId: 'requester-1',
      institutionType: 'SCHOOL',
    });

    expect(result.institutionType).toBe('SCHOOL');
    expect(organizationRepository.save).toHaveBeenCalledTimes(1);
    expect(cache.get(1)).toBeNull();
  });

  it('un ADMIN global puede clasificarla sin ser miembro', async () => {
    const { useCase, organizationRepository } = setup({
      organization: org(),
      requestingMembership: null,
      requestingUserIsPlatformAdmin: true,
    });

    await useCase.execute({ organizationId: 'org-1', requestingUserId: 'admin', institutionType: 'UNIVERSITY' });

    expect(organizationRepository.save).toHaveBeenCalledTimes(1);
  });

  it('null la deja sin clasificar', async () => {
    const { useCase } = setup({ organization: org('UNIVERSITY'), requestingMembership: membership('ADMIN') });

    const result = await useCase.execute({ organizationId: 'org-1', requestingUserId: 'requester-1', institutionType: null });

    expect(result.institutionType).toBeNull();
  });

  it('sin cambios no escribe ni invalida la caché', async () => {
    const { useCase, organizationRepository, cache } = setup({
      organization: org('SCHOOL'),
      requestingMembership: membership('ADMIN'),
    });

    await useCase.execute({ organizationId: 'org-1', requestingUserId: 'requester-1', institutionType: 'SCHOOL' });
    await useCase.execute({ organizationId: 'org-1', requestingUserId: 'requester-1' });

    expect(organizationRepository.save).not.toHaveBeenCalled();
    expect(cache.get(1)).toBe('ranking del día');
  });

  it('un TEACHER o STUDENT de la organización recibe 403', async () => {
    const { useCase, organizationRepository } = setup({
      organization: org(),
      requestingMembership: membership('TEACHER'),
    });

    await expect(
      useCase.execute({ organizationId: 'org-1', requestingUserId: 'requester-1', institutionType: 'SCHOOL' }),
    ).rejects.toThrow(ForbiddenActionError);
    expect(organizationRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza un tipo fuera del enum', async () => {
    const { useCase } = setup({ organization: org(), requestingMembership: membership('ADMIN') });

    await expect(
      useCase.execute({ organizationId: 'org-1', requestingUserId: 'requester-1', institutionType: 'KINDER' }),
    ).rejects.toThrow(InvalidInstitutionTypeError);
  });

  it('lanza OrganizationNotFoundError si no existe', async () => {
    const { useCase } = setup({ organization: null });

    await expect(
      useCase.execute({ organizationId: 'missing', requestingUserId: 'requester-1', institutionType: 'SCHOOL' }),
    ).rejects.toThrow(OrganizationNotFoundError);
  });
});
