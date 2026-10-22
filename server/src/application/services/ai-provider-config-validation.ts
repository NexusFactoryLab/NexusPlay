import { AI_PROVIDER_KINDS, type AiProviderKind } from '../../domain/entities/ai-provider-config.entity.js';
import { InvalidAiProviderConfigError } from '../errors/application.errors.js';
import { allowPrivateProviderUrls, isPrivateHostname } from './ai-url-safety.js';

export interface AiProviderConfigFields {
  name: string;
  kind: string;
  baseUrl?: string | null;
  textModel: string;
  visionModel?: string | null;
  maxRpm?: number | null;
}

export interface ValidAiProviderConfigFields {
  name: string;
  kind: AiProviderKind;
  baseUrl: string | null;
  textModel: string;
  visionModel: string | null;
  maxRpm: number | null;
}

const MAX_RPM = 10_000;

/**
 * Debe ser http(s) hacia un servidor PÚBLICO: se rechazan `localhost`, redes
 * internas, IPs privadas/de metadatos (ver `ai-url-safety`) y, en producción,
 * `http`. `AI_ALLOW_PRIVATE_PROVIDER_URLS=true` levanta estas restricciones
 * (Ollama / LM Studio locales).
 */
export function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new InvalidAiProviderConfigError('la URL base no es válida.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new InvalidAiProviderConfigError('la URL base debe empezar por https://.');
  }
  if (url.username || url.password) {
    throw new InvalidAiProviderConfigError('la URL base no debe incluir usuario ni contraseña; usa el campo API key.');
  }
  if (!allowPrivateProviderUrls()) {
    if (isPrivateHostname(url.hostname)) {
      throw new InvalidAiProviderConfigError(
        'la URL base apunta a una dirección interna o privada; solo se permiten proveedores públicos.',
      );
    }
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      throw new InvalidAiProviderConfigError('en producción la URL base debe empezar por https://.');
    }
  }
  return url.toString().replace(/\/+$/, '');
}

/** Acepta la URL base (`.../v1`) o la completa (`.../v1/chat/completions`). */
export function toChatCompletionsUrl(baseUrl: string): string {
  return /\/chat\/completions$/.test(baseUrl) ? baseUrl : `${baseUrl}/chat/completions`;
}

export function validateAiProviderConfigFields(input: AiProviderConfigFields): ValidAiProviderConfigFields {
  const name = input.name?.trim() ?? '';
  if (name.length < 1 || name.length > 60) {
    throw new InvalidAiProviderConfigError('el nombre debe tener entre 1 y 60 caracteres.');
  }
  if (!(AI_PROVIDER_KINDS as readonly string[]).includes(input.kind)) {
    throw new InvalidAiProviderConfigError(`el tipo de proveedor "${input.kind}" no está soportado.`);
  }
  const kind = input.kind as AiProviderKind;

  const textModel = input.textModel?.trim() ?? '';
  if (textModel.length < 1 || textModel.length > 120) {
    throw new InvalidAiProviderConfigError('el modelo de texto es obligatorio (máximo 120 caracteres).');
  }
  const visionModel = input.visionModel?.trim() || null;
  if (visionModel && visionModel.length > 120) {
    throw new InvalidAiProviderConfigError('el modelo de visión no puede superar los 120 caracteres.');
  }

  let baseUrl: string | null = null;
  if (kind === 'openai-compatible') {
    if (!input.baseUrl?.trim()) {
      throw new InvalidAiProviderConfigError('este tipo de proveedor requiere la URL base de la API.');
    }
    baseUrl = normalizeBaseUrl(input.baseUrl);
  }

  const maxRpm = input.maxRpm ?? null;
  if (maxRpm !== null && (!Number.isInteger(maxRpm) || maxRpm < 1 || maxRpm > MAX_RPM)) {
    throw new InvalidAiProviderConfigError(`el máximo de llamadas por minuto debe estar entre 1 y ${MAX_RPM}.`);
  }

  return { name, kind, baseUrl, textModel, visionModel, maxRpm };
}

export function validateApiKey(raw: string): string {
  const apiKey = raw?.trim() ?? '';
  if (apiKey.length < 8 || apiKey.length > 500 || /\s/.test(apiKey)) {
    throw new InvalidAiProviderConfigError('la API key no parece válida (8 a 500 caracteres, sin espacios).');
  }
  return apiKey;
}

export function apiKeyHint(apiKey: string): string {
  return `••••${apiKey.slice(-4)}`;
}
