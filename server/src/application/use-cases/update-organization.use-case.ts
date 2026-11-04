import { Inject, Injectable } from '@nestjs/common';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../domain/ports/organization.repository.port.js';
import {
  PUBLIC_RANKING_CACHE,
  type PublicRankingCache,
} from '../../domain/ports/public-ranking-cache.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { OrganizationNotFoundError } from '../errors/application.errors.js';
import {
  toOrganizationResponseDto,
  type OrganizationResponseDto,
} from '../dtos/organization-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';

export interface UpdateOrganizationInput {
  organizationId: string;
  requestingUserId: string;
  /** Universidad, colegio u otra; null la deja sin clasificar; ausente no la toca. */
  institutionType?: string | null;
}

/**
 * Edita los datos de una organización que decide quien la administra (por
 * ahora, su tipo de institución). Autorización: ADMIN de ESTA organización
 * **o** ADMIN global de plataforma, el mismo OR de ejes que
 * `RemoveOrganizationMemberUseCase`, resuelto aquí porque `RolesGuard` no lo
 * expresa. Si el tipo cambia se invalida la caché del ranking público, que
 * lo muestra junto a cada institución y estudiante.
 */
@Injectable()
export class UpdateOrganizationUseCase
  implements UseCase<UpdateOrganizationInput, OrganizationResponseDto>
{
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
    @Inject(PUBLIC_RANKING_CACHE) private readonly rankingCache: PublicRankingCache<unknown>,
  ) {}

  async execute(input: UpdateOrganizationInput): Promise<OrganizationResponseDto> {
    const organization = await this.organizationRepository.findById(input.organizationId);
    if (!organization) {
      throw new OrganizationNotFoundError(input.organizationId);
    }

    const isPlatformAdmin = await this.requesterAdminResolver.resolve(input.requestingUserId);
    if (!isPlatformAdmin) {
      const membership = await this.organizationRepository.findMembership(
        organization.id,
        input.requestingUserId,
      );
      if (!membership?.isAdmin()) {
        throw new ForbiddenActionError('editar esta organización');
      }
    }

    if (input.institutionType !== undefined) {
      const before = organization.institutionType;
      organization.classify(input.institutionType);

      if (organization.institutionType !== before) {
        await this.organizationRepository.save(organization);
        this.rankingCache.invalidate();
      }
    }

    return toOrganizationResponseDto(organization);
  }
}
