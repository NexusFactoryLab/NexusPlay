/**
 * Tipos de proveedor soportados. `openai-compatible` cubre cualquier API con
 * el formato `/chat/completions` (Groq, OpenAI, OpenRouter, Together, Mistral,
 * DeepSeek, Ollama, etc.) — solo cambia `baseUrl`. `gemini` usa el SDK de
 * Google. Sumar un tipo nuevo es escribir su adaptador y registrarlo en
 * `AiAssistantFactory`.
 */
export const AI_PROVIDER_KINDS = ['openai-compatible', 'gemini'] as const;
export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];

export interface AiProviderConfigProps {
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string | null;
  textModel: string;
  visionModel: string | null;
  maxRpm: number | null;
  /** AES-256-GCM (ver `SecretCipher`). Nunca sale del servidor. */
  encryptedApiKey: string;
  /** Últimos caracteres de la key, solo para que el admin reconozca cuál está guardada. */
  apiKeyHint: string;
  enabled: boolean;
  /** Menor número = se intenta primero en la cadena de fallback. */
  priority: number;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Configuración de un proveedor de IA administrable en caliente (sin tocar `.env`). */
export class AiProviderConfig {
  private constructor(private readonly props: AiProviderConfigProps) {}

  static create(
    props: Omit<
      AiProviderConfigProps,
      'createdAt' | 'updatedAt' | 'lastTestAt' | 'lastTestOk' | 'lastTestMessage'
    >,
  ): AiProviderConfig {
    const now = new Date();
    return new AiProviderConfig({
      ...props,
      lastTestAt: null,
      lastTestOk: null,
      lastTestMessage: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: AiProviderConfigProps): AiProviderConfig {
    return new AiProviderConfig(props);
  }

  /** Copia con cambios: la entidad es inmutable. */
  with(changes: Partial<Omit<AiProviderConfigProps, 'id' | 'createdAt'>>): AiProviderConfig {
    return new AiProviderConfig({ ...this.props, ...changes, updatedAt: new Date() });
  }

  toProps(): AiProviderConfigProps {
    return { ...this.props };
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get kind(): AiProviderKind { return this.props.kind; }
  get baseUrl(): string | null { return this.props.baseUrl; }
  get textModel(): string { return this.props.textModel; }
  get visionModel(): string | null { return this.props.visionModel; }
  get maxRpm(): number | null { return this.props.maxRpm; }
  get encryptedApiKey(): string { return this.props.encryptedApiKey; }
  get apiKeyHint(): string { return this.props.apiKeyHint; }
  get enabled(): boolean { return this.props.enabled; }
  get priority(): number { return this.props.priority; }
  get lastTestAt(): Date | null { return this.props.lastTestAt; }
  get lastTestOk(): boolean | null { return this.props.lastTestOk; }
  get lastTestMessage(): string | null { return this.props.lastTestMessage; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
