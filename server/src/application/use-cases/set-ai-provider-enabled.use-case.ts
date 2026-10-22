import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { AiConfigConflictError, AiProviderConfigNotFoundError } from '../errors/application.errors.js';
import { toAiProviderConfigDto, type AiProviderConfigDto } from '../dtos/ai-provider-config-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { AiAuditLogger } from '../services/ai-audit-logger.service.js';
import { AiProviderConfigChangeNotifier } from '../services/ai-provider-config-change-notifier.service.js';
import { isStaleVersion, parseExpectedVersion } from '../services/ai-optimistic-lock.js';

export interface SetAiProviderEnabledInput {
  requestingUserId: string;
  id: string;
  enabled: boolean;
  expectedUpdatedAt?: string;
}

/**
 * Habilita o deshabilita un proveedor cambiando SOLO ese campo. El interruptor
 * del panel no debe reenviar el formulario entero: con valores viejos en
 * pantalla pisaría lo que otro administrador acaba de editar.
 */
@Injectable()
export class SetAiProviderEnabledUseCase implements UseCase<SetAiProviderEnabledInput, AiProviderConfigDto> {
  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    private readonly requesterAdminResolver: RequesterAdminResolver,
    private readonly notifier: AiProviderConfigChangeNotifier,
    private readonly audit: AiAuditLogger,
  ) {}

  async execute(input: SetAiProviderEnabledInput): Promise<AiProviderConfigDto> {
    if (!(await this.requesterAdminResolver.resolve(input.requestingUserId))) {
      throw new ForbiddenActionError('habilitar o deshabilitar proveedores de IA');
    }

    const current = await this.repository.findById(input.id);
    if (!current) throw new AiProviderConfigNotFoundError();

    const conflict = () => new AiConfigConflictError(`el proveedor "${current.name}"`);
    if (isStaleVersion(current.updatedAt, parseExpectedVersion(input.expectedUpdatedAt))) throw conflict();

    // Conserva el resultado de la última prueba: habilitar o no no cambia la conexión.
    const updated = current.with({ enabled: input.enabled });
    if (!(await this.repository.saveIfUnchanged(updated, current.updatedAt))) throw conflict();

    this.notifier.notify();
    await this.audit.record({
      actorUserId: input.requestingUserId,
      action: input.enabled ? 'provider.enable' : 'provider.disable',
      targetType: 'provider',
      targetId: updated.id,
      targetLabel: updated.name,
    });
    return toAiProviderConfigDto(updated);
  }
}
