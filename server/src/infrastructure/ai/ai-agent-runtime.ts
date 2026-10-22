import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiAgentConfig, type AiAgentKey } from '../../domain/entities/ai-agent.entity.js';
import {
  AI_AGENT_CONFIG_REPOSITORY,
  type AiAgentConfigRepository,
} from '../../domain/ports/ai-agent-config.repository.port.js';
import {
  AI_PROVIDER_CONFIG_REPOSITORY,
  type AiProviderConfigRepository,
} from '../../domain/ports/ai-provider-config.repository.port.js';
import type { AiContentAssistant } from '../../domain/ports/ai-content-assistant.port.js';
import type { AiAgentProbe, AiAgentProbeResult } from '../../domain/ports/ai-agent-probe.port.js';
import { AiProviderAttemptTracker } from '../../application/services/ai-provider-attempt-tracker.service.js';
import { sanitizeProviderMessage } from '../../application/services/ai-error-sanitizer.js';
import { planAgentProviders } from '../../application/services/ai-agent-provider-plan.js';
import { AiProviderChainResolver } from './ai-provider-chain-resolver.js';
import { AiProviderOrchestrator, type AiProviderChainEntry } from './ai-provider-orchestrator.js';

export interface ResolvedAiAgent {
  config: AiAgentConfig;
  /** Enfoque del agente ya listo para inyectar (vacío si no tiene). */
  instructions: string;
  /** En el orden en que se intentan: primero el proveedor propio del agente (si tiene), luego la cadena general. */
  entries: AiProviderChainEntry[];
}

/**
 * Lo que hace agnóstico al sistema: cada agente (Jugador, Configurador…) le
 * pide aquí SU asistente y recibe uno ya cableado a su proveedor/modelo y con
 * su enfoque. Cambiar un agente de Groq a Gemini (o de modelo) es solo
 * actualizar su configuración en el panel — ningún caso de uso cambia.
 *
 * Reglas de resolución:
 *  1. Si el agente tiene proveedor asignado y este está habilitado y es
 *     utilizable → se usa primero, con el modelo propio del agente si lo tiene.
 *  2. Si el proveedor asignado no sirve (borrado, deshabilitado, key ilegible)
 *     o el agente permite respaldo (`fallbackToDefault`) → sigue la cadena
 *     general, así un agente nunca se queda mudo por un proveedor caído.
 *  3. Sin proveedor asignado → cadena general directamente.
 */
@Injectable()
export class AiAgentRuntime implements AiAgentProbe {
  constructor(
    @Inject(AI_AGENT_CONFIG_REPOSITORY) private readonly agents: AiAgentConfigRepository,
    @Inject(AI_PROVIDER_CONFIG_REPOSITORY) private readonly providers: AiProviderConfigRepository,
    private readonly chains: AiProviderChainResolver,
    private readonly tracker: AiProviderAttemptTracker,
  ) {}

  async configOf(key: AiAgentKey): Promise<AiAgentConfig> {
    return (await this.agents.findByKey(key)) ?? AiAgentConfig.defaults(key);
  }

  async resolve(key: AiAgentKey): Promise<ResolvedAiAgent> {
    const config = await this.configOf(key);
    const entries: AiProviderChainEntry[] = [];

    // La misma regla que usa el panel (`toAiAgentDto`): ver `planAgentProviders`.
    const plan = planAgentProviders(
      config,
      config.providerId ? await this.providers.findAll() : [],
      (provider) => this.chains.entryForConfig(provider) !== null,
    );
    if (plan.own) {
      const own = this.chains.entryForConfig(plan.own, plan.model);
      if (own) entries.push(own);
    }

    if (plan.useGeneralChain) {
      try {
        const general = await this.chains.defaultEntries();
        const ownName = entries[0]?.name;
        entries.push(...general.filter((entry) => entry.name !== ownName));
      } catch (error) {
        // Con un proveedor propio utilizable, que la cadena general no esté disponible no importa.
        if (entries.length === 0) throw error;
      }
    }

    if (entries.length === 0) {
      throw new ServiceUnavailableException(
        'No hay ningún proveedor de IA disponible para este agente. Un administrador debe configurarlo en el panel de IA.',
      );
    }

    return { config, instructions: config.instructions.trim(), entries };
  }

  async probe(key: AiAgentKey): Promise<AiAgentProbeResult> {
    const startedAt = Date.now();
    let providerName: string | null = null;
    try {
      const { entries } = await this.resolve(key);
      const first = entries[0];
      providerName = first.name;
      if (!first.assistant.ping) throw new Error('Este proveedor no soporta la prueba de conexión.');
      await first.assistant.ping();
      return { ok: true, providerName, message: 'El agente respondió correctamente.', latencyMs: Date.now() - startedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, providerName, message: sanitizeProviderMessage(message, 400), latencyMs: Date.now() - startedAt };
    }
  }

  /** Asistente (con respaldo entre proveedores) del agente, y el enfoque que debe aplicar. */
  async assistantFor(key: AiAgentKey): Promise<{ assistant: AiContentAssistant; instructions: string }> {
    const { entries, instructions } = await this.resolve(key);
    return { assistant: new AiProviderOrchestrator(entries, this.tracker, key), instructions };
  }
}
