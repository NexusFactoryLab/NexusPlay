import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import { SECRET_CIPHER, type SecretCipher } from '../../domain/ports/secret-cipher.port.js';
import { AI_ASSISTANT_FACTORY, type AiAssistantFactory } from '../../domain/ports/ai-assistant.factory.port.js';
import type { AiContentAssistant } from '../../domain/ports/ai-content-assistant.port.js';
import type { AiAvailability } from '../../domain/ports/ai-availability.port.js';
import { AiProviderConfigChangeNotifier } from '../../application/services/ai-provider-config-change-notifier.service.js';
import type { AiProviderChainEntry } from './ai-provider-orchestrator.js';
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
 * Sabe armar la "cadena general" de proveedores y los asistentes de cada
 * proveedor guardado. Es la pieza común de todos los agentes
 * (`AiAgentRuntime`): un agente sin proveedor propio usa esta cadena, y uno
 * con proveedor propio pide su asistente por separado.
 *
 *  - Hay configuraciones guardadas → cadena con las habilitadas, por
 *    `priority`. Si todas están deshabilitadas, falla con un 503 claro.
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
export class AiProviderChainResolver implements AiAvailability {
  private readonly logger = new Logger(AiProviderChainResolver.name);
  private chain: ResolvedChain | null = null;
  private loading: Promise<ResolvedChain> | null = null;
  /** Sube con cada `invalidate()`; permite saber si una carga en curso quedó vieja. */
  private version = 0;
  private readonly adapters = new Map<string, { updatedAt: number; assistant: AiContentAssistant }>();

  constructor(
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly repository: AiProviderConfigRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(AI_ASSISTANT_FACTORY) private readonly factory: AiAssistantFactory,
    notifier: AiProviderConfigChangeNotifier,
  ) {
    notifier.subscribe(() => this.invalidate());
  }

  /**
   * ¿Hay con qué responder? Con configuraciones guardadas, que alguna esté
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
    return configs.some((config) => config.enabled && this.entryForConfig(config) !== null);
  }

  invalidate(): void {
    this.version += 1;
    this.chain = null;
    // Una carga que ya estaba en curso leyó la configuración anterior: ni se reutiliza ni se guarda.
    this.loading = null;
  }

  /** La cadena general, en orden de prioridad. Lanza un 503 claro si no hay con qué responder. */
  async defaultEntries(): Promise<AiProviderChainEntry[]> {
    if (this.chain && Date.now() - this.chain.loadedAt < CHAIN_TTL_MS) return this.chain.entries;

    // Una sola carga a la vez: varias llamadas simultáneas comparten la misma consulta.
    if (!this.loading) {
      const startedAtVersion = this.version;
      const loading: Promise<ResolvedChain> = this.loadChain()
        .then((resolved) => {
          // Si el panel cambió algo mientras se cargaba, esta cadena ya es vieja: no se cachea.
          if (startedAtVersion === this.version) this.chain = resolved;
          return resolved;
        })
        .finally(() => {
          if (this.loading === loading) this.loading = null;
        });
      this.loading = loading;
    }
    return (await this.loading).entries;
  }

  /**
   * Entrada de cadena para UN proveedor guardado (el que se le asigna a un
   * agente), opcionalmente con otro modelo de texto. `null` si el proveedor
   * está deshabilitado o su key ya no se puede descifrar.
   */
  entryForConfig(config: AiProviderConfig, modelOverride?: string | null): AiProviderChainEntry | null {
    if (!config.enabled) return null;
    const assistant = this.assistantFor(config, modelOverride?.trim() || null);
    return assistant ? { name: config.name, assistant } : null;
  }

  private async loadChain(): Promise<ResolvedChain> {
    const configs = await this.repository.findAll();

    if (configs.length === 0) {
      return { entries: this.envChain(), loadedAt: Date.now() };
    }

    const entries: AiProviderChainEntry[] = [];
    for (const config of configs) {
      const entry = this.entryForConfig(config);
      if (entry) entries.push(entry);
    }

    if (entries.length === 0) {
      throw new ServiceUnavailableException(
        'No hay ningún proveedor de IA habilitado y con credenciales válidas. Un administrador debe configurarlo en el panel de IA.',
      );
    }
    return { entries, loadedAt: Date.now() };
  }

  private assistantFor(config: AiProviderConfig, modelOverride: string | null): AiContentAssistant | null {
    const cacheKey = modelOverride ? `${config.id}:${modelOverride}` : config.id;
    const version = config.updatedAt.getTime();
    const cached = this.adapters.get(cacheKey);
    if (cached && cached.updatedAt === version) return cached.assistant;

    try {
      const effective = modelOverride ? config.with({ textModel: modelOverride }) : config;
      const assistant = this.factory.create(effective, this.cipher.decrypt(config.encryptedApiKey));
      this.adapters.set(cacheKey, { updatedAt: version, assistant });
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
