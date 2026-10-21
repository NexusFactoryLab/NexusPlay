import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { SECRET_CIPHER, type SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { AI_ASSISTANT_FACTORY, type AiAssistantFactory } from '../../domain/ports/ai-assistant.factory.port.js';
import type {
  AiContentAssistant,
  DescribeImageInput,
  GenerateGameDraftInput,
  GenerateGameDraftOutput,
} from '../../domain/ports/ai-content-assistant.port.js';
import type { AiAvailability } from '../../domain/ports/ai-availability.port.js';
import { AiProviderAttemptTracker } from '../../application/services/ai-provider-attempt-tracker.service.js';
import { AiProviderConfigChangeNotifier } from '../../application/services/ai-provider-config-change-notifier.service.js';
import { AiProviderOrchestrator, type AiProviderChainEntry } from './ai-provider-orchestrator.js';
import { GeminiContentAssistant } from './gemini-content-assistant.adapter.js';
import { GroqContentAssistant } from './groq-content-assistant.adapter.js';

/** Por si otra instancia del servidor cambió la configuración: nunca se sirve una cadena más vieja que esto. */
const CHAIN_TTL_MS = 30_000;
const DEFAULT_ENV_PROVIDER_ORDER = ['groq'];

interface ResolvedChain {
  entries: AiProviderChainEntry[];
  loadedAt: number;
}

/**
 * Implementa `AiContentAssistant` (el token `AI_CONTENT_ASSISTANT`) leyendo
 * los proveedores que el administrador configuró en la base de datos, en
 * vez de depender de un proveedor fijo en `.env`:
 *  - Hay configuraciones guardadas → cadena de fallback con las habilitadas,
 *    por `priority`. Si todas están deshabilitadas, falla con un 503 claro.
 *  - No hay ninguna guardada → respaldo a las variables de entorno de
 *    siempre (`GROQ_API_KEY`, `AI_PROVIDER_ORDER`), para que un despliegue
 *    existente siga funcionando hasta que el admin configure el panel.
 *
 * La cadena se cachea y se recarga al instante cuando el panel cambia algo
 * (`AiProviderConfigChangeNotifier`). Los adaptadores se reutilizan mientras
 * su configuración no cambie, para no perder su límite por minuto ni su
 * enfriamiento tras un 429.
 */
@Injectable()
export class ConfiguredAiContentAssistant implements AiContentAssistant, AiAvailability {
  private readonly logger = new Logger(ConfiguredAiContentAssistant.name);
  private chain: ResolvedChain | null = null;
  private loading: Promise<ResolvedChain> | null = null;
  private readonly adapters = new Map<string, { updatedAt: number; assistant: AiContentAssistant }>();

  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(AI_ASSISTANT_FACTORY) private readonly factory: AiAssistantFactory,
    private readonly tracker: AiProviderAttemptTracker,
    notifier: AiProviderConfigChangeNotifier,
  ) {
    notifier.subscribe(() => this.invalidate());
  }

  /**
   * ¿Hay con qué responder? Misma regla que `loadChain`, pero sin construir
   * la cadena ni lanzar: con configuraciones guardadas, que alguna esté
   * habilitada y se pueda descifrar; sin ninguna, que el entorno tenga la
   * key de algún proveedor de `AI_PROVIDER_ORDER`.
   */
  async isConfigured(): Promise<boolean> {
    const configs = await this.repository.findAll();
    if (configs.length === 0) {
      const keyByProvider: Record<string, string | undefined> = {
        groq: process.env.GROQ_API_KEY,
        gemini: process.env.GOOGLE_IA_STUDIO_API_KEY,
      };
      const configured = (process.env.AI_PROVIDER_ORDER ?? '').split(',').map((name) => name.trim());
      const order = configured.some((name) => name in keyByProvider) ? configured : DEFAULT_ENV_PROVIDER_ORDER;
      return order.some((name) => Boolean(keyByProvider[name]?.trim()));
    }
    return configs.some((config) => config.enabled && this.assistantFor(config) !== null);
  }

  invalidate(): void {
    this.chain = null;
  }

  describeImage(input: DescribeImageInput): Promise<string> {
    return this.orchestrator().then((orchestrator) => orchestrator.describeImage(input));
  }

  generateGameDraft(input: GenerateGameDraftInput): Promise<GenerateGameDraftOutput> {
    return this.orchestrator().then((orchestrator) => orchestrator.generateGameDraft(input));
  }

  private async orchestrator(): Promise<AiProviderOrchestrator> {
    const { entries } = await this.resolveChain();
    return new AiProviderOrchestrator(entries, this.tracker);
  }

  private async resolveChain(): Promise<ResolvedChain> {
    if (this.chain && Date.now() - this.chain.loadedAt < CHAIN_TTL_MS) return this.chain;
    // Una sola carga a la vez: varias llamadas simultáneas comparten la misma consulta.
    this.loading ??= this.loadChain().finally(() => {
      this.loading = null;
    });
    this.chain = await this.loading;
    return this.chain;
  }

  private async loadChain(): Promise<ResolvedChain> {
    const configs = await this.repository.findAll();

    if (configs.length === 0) {
      return { entries: this.envChain(), loadedAt: Date.now() };
    }

    const entries: AiProviderChainEntry[] = [];
    for (const config of configs.filter((candidate) => candidate.enabled)) {
      const assistant = this.assistantFor(config);
      if (assistant) entries.push({ name: config.name, assistant });
    }

    if (entries.length === 0) {
      throw new ServiceUnavailableException(
        'No hay ningún proveedor de IA habilitado y con credenciales válidas. Un administrador debe configurarlo en el panel de IA.',
      );
    }
    return { entries, loadedAt: Date.now() };
  }

  private assistantFor(config: AiProviderConfig): AiContentAssistant | null {
    const version = config.updatedAt.getTime();
    const cached = this.adapters.get(config.id);
    if (cached && cached.updatedAt === version) return cached.assistant;

    try {
      const assistant = this.factory.create(config, this.cipher.decrypt(config.encryptedApiKey));
      this.adapters.set(config.id, { updatedAt: version, assistant });
      return assistant;
    } catch (error) {
      // Típico: se rotó AI_CONFIG_ENCRYPTION_KEY y la key guardada ya no se puede descifrar.
      this.logger.error(
        `No se pudo usar el proveedor de IA "${config.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** Comportamiento histórico basado en variables de entorno (ver `AI_PROVIDER_ORDER`). */
  private envChain(): AiProviderChainEntry[] {
    const registry: Record<string, AiContentAssistant> = {
      gemini: this.adapters.get('env:gemini')?.assistant ?? new GeminiContentAssistant(),
      groq: this.adapters.get('env:groq')?.assistant ?? new GroqContentAssistant(),
    };
    this.adapters.set('env:gemini', { updatedAt: 0, assistant: registry.gemini });
    this.adapters.set('env:groq', { updatedAt: 0, assistant: registry.groq });

    const configured = (process.env.AI_PROVIDER_ORDER ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name in registry);
    const order = configured.length > 0 ? configured : DEFAULT_ENV_PROVIDER_ORDER;
    return order.map((name) => ({ name, assistant: registry[name] }));
  }
}
