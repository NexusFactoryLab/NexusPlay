import { Injectable } from '@nestjs/common';
import type { AiProviderConfig } from '../../domain/entities/ai-provider-config.entity.js';
import type { AiContentAssistant } from '../../domain/ports/ai-content-assistant.port.js';
import type { AiAssistantFactory } from '../../domain/ports/ai-assistant.factory.port.js';
import { toChatCompletionsUrl } from '../../application/services/ai-provider-config-validation.js';
import { GeminiContentAssistant } from './gemini-content-assistant.adapter.js';
import { GroqContentAssistant } from './groq-content-assistant.adapter.js';

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
      return new GeminiContentAssistant({ apiKey, textModel: config.textModel, maxRpm });
    }

    return new GroqContentAssistant({
      label: config.name,
      apiKey,
      apiUrl: toChatCompletionsUrl(config.baseUrl ?? ''),
      textModel: config.textModel,
      visionModel: config.visionModel ?? undefined,
      maxRpm,
    });
  }
}
