import { Injectable } from '@nestjs/common';
import type { AiModelCatalog, ListAiModelsInput } from '../../domain/ports/ai-model-catalog.port.js';
import { InvalidAiProviderConfigError } from '../../application/errors/application.errors.js';
import { normalizeBaseUrl } from '../../application/services/ai-provider-config-validation.js';

const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200';
const TIMEOUT_MS = 15_000;

/** Lista modelos con el endpoint estándar de cada tipo: `GET {baseUrl}/models` o el de Google. */
@Injectable()
export class HttpAiModelCatalog implements AiModelCatalog {
  async list({ kind, baseUrl, apiKey }: ListAiModelsInput): Promise<string[]> {
    const request: { url: string; headers: Record<string, string> } =
      kind === 'gemini'
        ? { url: GEMINI_MODELS_URL, headers: { 'x-goog-api-key': apiKey } }
        : {
            url: `${normalizeBaseUrl(baseUrl ?? '').replace(/\/chat\/completions$/, '')}/models`,
            headers: { Authorization: `Bearer ${apiKey}` },
          };

    let response: Response;
    try {
      response = await fetch(request.url, { headers: request.headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new InvalidAiProviderConfigError('no se pudo conectar con el proveedor; revisa la URL base.');
    }

    if (response.status === 401 || response.status === 403) {
      throw new InvalidAiProviderConfigError('el proveedor rechazó la API key (no es válida o no tiene permiso).');
    }
    if (!response.ok) {
      throw new InvalidAiProviderConfigError(
        response.status === 404
          ? 'esta URL no ofrece una lista de modelos; escribe el nombre del modelo a mano.'
          : `el proveedor respondió con un error (${response.status}).`,
      );
    }

    const payload = (await response.json().catch(() => null)) as {
      data?: Array<{ id?: unknown }>;
      models?: Array<{ name?: unknown; supportedGenerationMethods?: unknown }>;
    } | null;

    const ids =
      kind === 'gemini'
        ? (payload?.models ?? [])
            .filter(
              (model) =>
                Array.isArray(model.supportedGenerationMethods) &&
                model.supportedGenerationMethods.includes('generateContent'),
            )
            .map((model) => String(model.name ?? '').replace(/^models\//, ''))
        : (payload?.data ?? []).map((model) => String(model.id ?? ''));

    const unique = [...new Set(ids.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    if (unique.length === 0) {
      throw new InvalidAiProviderConfigError('el proveedor no devolvió ningún modelo; escribe el nombre a mano.');
    }
    return unique;
  }
}
