import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type {
  AiContentAssistant,
  CompleteInput,
  DescribeImageInput,
  GenerateGameDraftInput,
  GenerateGameDraftOutput,
} from '../../domain/ports/ai-content-assistant.port.js';
import type { AiProviderOperation } from '../../domain/entities/ai-provider-attempt.entity.js';
import { sanitizeProviderMessage } from '../../application/services/ai-error-sanitizer.js';
import type { AiProviderAttemptTracker } from '../../application/services/ai-provider-attempt-tracker.service.js';

export interface AiProviderChainEntry {
  /** Nombre corto y estable — es lo que queda guardado en cada intento y lo que ve el admin. */
  name: string;
  assistant: AiContentAssistant;
}

/**
 * Implementa `AiContentAssistant` igual que cualquier proveedor concreto, así
 * que ni `GenerateGameDraftUseCase` ni el resto de la aplicación saben que
 * hay más de un proveedor detrás — reciben esta clase por el mismo token
 * `AI_CONTENT_ASSISTANT` (ver `game.module.ts`).
 *
 * Prueba cada proveedor de `chain`, en orden, hasta que uno responda. Si el
 * primero falla (cuota agotada, red, key inválida), cae al siguiente sin que
 * el usuario note nada más que una respuesta un poco más lenta — issue #204.
 * Agregar un proveedor nuevo el día de mañana es: escribir su adaptador
 * (implementa `AiContentAssistant`), registrarlo en `game.module.ts` y
 * agregarlo a `chain` (o a `AI_PROVIDER_ORDER` en el entorno) — nada acá
 * cambia.
 *
 * Cada intento (éxito o falla, de cualquier proveedor) se registra vía
 * `AiProviderAttemptTracker` para que el panel de administración de IA
 * pueda ver la salud de cada proveedor sin acceso a logs del servidor. Un
 * fallo al registrar nunca debe tumbar la generación real.
 */
@Injectable()
export class AiProviderOrchestrator implements AiContentAssistant {
  private readonly logger = new Logger(AiProviderOrchestrator.name);

  constructor(
    private readonly chain: AiProviderChainEntry[],
    private readonly tracker: AiProviderAttemptTracker,
    /** Agente que hace la llamada (para el historial); `null` si no se sabe. */
    private readonly agent: string | null = null,
  ) {
    if (chain.length === 0) {
      throw new Error('AiProviderOrchestrator necesita al menos un proveedor en la cadena.');
    }
  }

  async describeImage(input: DescribeImageInput): Promise<string> {
    return this.runWithFallback('describeImage', (assistant) => assistant.describeImage(input));
  }

  async complete(input: CompleteInput): Promise<string> {
    // El plazo es del total: cada proveedor de la cadena recibe lo que queda, no el plazo completo.
    const deadlineAt = input.deadlineMs ? Date.now() + input.deadlineMs : null;
    return this.runWithFallback('complete', (assistant) =>
      assistant.complete(deadlineAt === null ? input : { ...input, deadlineMs: Math.max(1, deadlineAt - Date.now()) }),
    );
  }

  async generateGameDraft(input: GenerateGameDraftInput): Promise<GenerateGameDraftOutput> {
    return this.runWithFallback('generateGameDraft', (assistant) => assistant.generateGameDraft(input));
  }

  private async runWithFallback<T>(
    operation: AiProviderOperation,
    call: (assistant: AiContentAssistant) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (let index = 0; index < this.chain.length; index += 1) {
      const { name, assistant } = this.chain[index];
      const usedFallback = index > 0;
      const startedAt = Date.now();

      try {
        const result = await call(assistant);
        await this.tracker.record({
          provider: name,
          operation,
          agent: this.agent,
          succeeded: true,
          usedFallback,
          latencyMs: Date.now() - startedAt,
        });
        if (usedFallback) {
          this.logger.warn(`"${operation}" se resolvió con el proveedor de respaldo "${name}".`);
        }
        return result;
      } catch (error) {
        lastError = error;
        const reason = error instanceof Error ? error.message : String(error);
        await this.tracker.record({
          provider: name,
          operation,
          agent: this.agent,
          succeeded: false,
          usedFallback,
          // Va al historial del panel: sin URLs ni IPs del proveedor.
          errorMessage: sanitizeProviderMessage(reason, 400),
          latencyMs: Date.now() - startedAt,
        });
        this.logger.warn(`Proveedor "${name}" falló en "${operation}": ${reason}`);
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new ServiceUnavailableException('Ningún proveedor de IA pudo responder.');
  }
}
