import { Inject, Injectable } from '@nestjs/common';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { SECRET_CIPHER, type SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { AI_ASSISTANT_FACTORY, type AiAssistantFactory } from '../../domain/ports/ai-assistant.factory.port.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { AiProviderConfigNotFoundError } from '../errors/application.errors.js';
import { toAiProviderConfigDto, type AiProviderConfigDto } from '../dtos/ai-provider-config-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { sanitizeProviderMessage } from '../services/ai-error-sanitizer.js';
import { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';

export interface TestAiProviderConfigInput {
  requestingUserId: string;
  id: string;
}

export interface TestAiProviderConfigOutput {
  ok: boolean;
  message: string;
  latencyMs: number;
  config: AiProviderConfigDto;
}

/**
 * "Probar conexión": hace una llamada mínima real con la key guardada y
 * deja el resultado en la configuración para que el panel lo muestre. Un
 * fallo del proveedor NO es un error HTTP — es el resultado esperado de la
 * prueba (`ok: false` + motivo), con la key redactada del mensaje.
 */
@Injectable()
export class TestAiProviderConfigUseCase implements UseCase<TestAiProviderConfigInput, TestAiProviderConfigOutput> {
  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(AI_ASSISTANT_FACTORY) private readonly factory: AiAssistantFactory,
    private readonly requesterAdminResolver: RequesterAdminResolver,
  ) {}

  async execute({ requestingUserId, id }: TestAiProviderConfigInput): Promise<TestAiProviderConfigOutput> {
    if (!(await this.requesterAdminResolver.resolve(requestingUserId))) {
      throw new ForbiddenActionError('probar proveedores de IA');
    }
    const config = await this.repository.findById(id);
    if (!config) throw new AiProviderConfigNotFoundError();

    const startedAt = Date.now();
    let ok = true;
    let message = 'Conexión exitosa.';
    let apiKey = '';

    try {
      apiKey = this.cipher.decrypt(config.encryptedApiKey);
      const assistant = this.factory.create(config, apiKey);
      if (!assistant.ping) throw new Error('Este proveedor no soporta la prueba de conexión.');
      await assistant.ping();
    } catch (error) {
      ok = false;
      const raw = error instanceof Error ? error.message : String(error);
      // Sin la key, y sin URLs ni IPs: este texto se guarda y se muestra en el panel.
      message = sanitizeProviderMessage(apiKey ? raw.split(apiKey).join('••••') : raw, 400);
    }

    const latencyMs = Date.now() - startedAt;
    const at = new Date();
    // Solo el resultado de la prueba: la llamada tardó, y el admin pudo editar mientras tanto.
    await this.repository.recordTestResult(id, config.updatedAt, { at, ok, message });
    const current = (await this.repository.findById(id)) ?? config;

    return { ok, message, latencyMs, config: toAiProviderConfigDto(current) };
  }
}
