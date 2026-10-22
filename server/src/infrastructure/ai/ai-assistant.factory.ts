import { Injectable } from '@nestjs/common';
import type { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import type { AiContentAssistant } from '../../domain/ports/ai-content-assistant.port.js';
import type { AiAssistantFactory } from '../../domain/ports/ai-assistant.factory.port.js';
import { toChatCompletionsUrl } from '../../application/services/ai-provider-config-validation.js';
import { GeminiContentAssistant } from './gemini-content-assistant.adapter.js';
import { GroqContentAssistant } from './groq-content-assistant.adapter.js';
import { assertPublicHost } from './assert-public-host.js';
import { sharedRateLimiter } from './rate-limiter.js';

/** Mismos valores por defecto que los adaptadores cuando el admin no fija "llamadas por minuto". */
const DEFAULT_OPENAI_COMPATIBLE_RPM = 25;
const DEFAULT_GEMINI_RPM = 5;

/**
 * Único lugar que traduce el `kind` de una configuración en un adaptador
 * concreto. Hoy: `openai-compatible` (Groq, OpenAI, OpenRouter, Ollama...) y
 * `gemini`. Un proveedor nuevo = una rama más acá y su adaptador.
 */
@Injectable()
export class DefaultAiAssistantFactory implements AiAssistantFactory {
  create(config: AiProviderConfig, apiKey: string): AiContentAssistant {
    const maxRpm = config.maxRpm ?? undefined;

    if (config.kind === 'gemini') {
      return new GeminiContentAssistant({
        apiKey,
        textModel: config.textModel,
        maxRpm,
        rateLimiter: sharedRateLimiter('gemini', apiKey, maxRpm ?? DEFAULT_GEMINI_RPM),
      });
    }

    const apiUrl = toChatCompletionsUrl(config.baseUrl ?? '');
    return new GroqContentAssistant({
      label: config.name,
      apiKey,
      apiUrl,
      textModel: config.textModel,
      visionModel: config.visionModel ?? undefined,
      maxRpm,
      hostGuard: (url) => assertPublicHost(url),
      // Un solo contador por API key: dos agentes con la misma cuenta (aunque con
      // distinto modelo) no pueden sumar más llamadas por minuto de las permitidas.
      rateLimiter: sharedRateLimiter(apiUrl, apiKey, maxRpm ?? DEFAULT_OPENAI_COMPATIBLE_RPM),
    });
  }
}
