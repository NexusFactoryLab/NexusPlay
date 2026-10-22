import { Injectable } from '@nestjs/common';
import type { AiModelCatalog, ListAiModelsInput } from '../../domain/ports/ai-model-catalog.port.js';
import { InvalidAiProviderConfigError } from '../../application/errors/application.errors.js';
import { normalizeBaseUrl } from '../../application/services/ai-provider-config-validation.js';
import { assertPublicHost, PrivateProviderHostError } from './assert-public-host.js';

const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200';
const TIMEOUT_MS = 15_000;
/** Ids que por su nombre no son modelos de chat/texto. */
export const NON_CHAT_MODEL =
  /embed|whisper|tts|transcribe|moderation|guard|dall-e|gpt-image|image-gen|rerank|speech|audio|realtime/i;

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

    if (kind !== 'gemini') {
      try {
        // Anti DNS-rebinding: el nombre pudo ser público al guardarlo y apuntar a la red interna ahora.
        await assertPublicHost(request.url);
      } catch (error) {
        if (error instanceof PrivateProviderHostError) {
          throw new InvalidAiProviderConfigError('la URL base apunta a una dirección interna o privada.');
        }
        throw error;
      }
    }

    let response: Response;
    try {
      response = await fetch(request.url, { headers: request.headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      // Sin el texto del error de red: puede traer la IP/puerto consultados.
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

    // Los listados mezclan modelos que no sirven para generar texto (embeddings, voz, moderación,
    // imágenes): elegir uno por error daría un fallo poco claro. Gemini ya viene filtrado por método.
    const unique = [...new Set(ids.filter(Boolean))]
      .filter((id) => kind === 'gemini' || !NON_CHAT_MODEL.test(id))
      .sort((a, b) => a.localeCompare(b));
    if (unique.length === 0) {
      throw new InvalidAiProviderConfigError('el proveedor no devolvió ningún modelo; escribe el nombre a mano.');
    }
    return unique;
  }
}
