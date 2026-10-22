/**
 * Catálogo FIJO de agentes de IA de la plataforma. Qué hace cada uno está en
 * el código (cada uno se engancha a una parte distinta del sistema); lo que
 * el administrador configura es su enfoque (instrucciones) y con qué
 * proveedor/modelo trabaja. Sumar un agente nuevo = una entrada aquí y
 * pedirle su asistente a `AiAgentRuntime`.
 */
export const AI_AGENT_KEYS = ['GAME_PLAYER', 'GAME_CONFIGURATOR'] as const;
export type AiAgentKey = (typeof AI_AGENT_KEYS)[number];

export interface AiAgentDefinition {
  key: AiAgentKey;
  name: string;
  /** Qué hace, dicho para el administrador. */
  description: string;
  /** Dónde de la plataforma se usa realmente (para que el panel no prometa más de lo que hace). */
  usedIn: string[];
  /** Lo que NO hace, si hay un malentendido probable. */
  limits: string | null;
  /** Instrucciones de fábrica; "Restaurar" en el panel vuelve a estas. */
  defaultInstructions: string;
}

export const AI_AGENT_CATALOG: Record<AiAgentKey, AiAgentDefinition> = {
  GAME_PLAYER: {
    key: 'GAME_PLAYER',
    name: 'Agente Jugador',
    description:
      'Responde por el bot cuando un jugador le escribe una pregunta propia de Sí/No en Identidad Oculta (partida contra el bot).',
    usedIn: [
      'Identidad Oculta contra el bot: cuando el jugador escribe su propia pregunta y pulsa «Hacer esta pregunta».',
    ],
    limits:
      'No elige las jugadas del bot (qué preguntar, qué descartar, cuándo acusar), no responde las preguntas sugeridas y no conversa por el chat.',
    defaultInstructions:
      'Eres un jugador virtual de un juego de adivinar personajes. Responde con honestidad y precisión, sin inventar datos. Si no estás seguro de algo, reconócelo en vez de adivinar.',
  },
  GAME_CONFIGURATOR: {
    key: 'GAME_CONFIGURATOR',
    name: 'Agente Configurador',
    description:
      'Parametriza los juegos: arma el borrador de un juego (configuración y contenido) a partir de un tema o de archivos, y adapta juegos a otro tipo.',
    usedIn: [
      'Crear un juego con el asistente de IA.',
      'Adaptar un juego a otro tipo con la opción «Con IA».',
      'Leer las imágenes que se suben al asistente.',
    ],
    limits: null,
    defaultInstructions: '',
  },
};

export function isAiAgentKey(value: string): value is AiAgentKey {
  return (AI_AGENT_KEYS as readonly string[]).includes(value);
}

export interface AiAgentConfigProps {
  key: AiAgentKey;
  instructions: string;
  /** `null` = usa la cadena general de proveedores. */
  providerId: string | null;
  /** Solo con `providerId`: modelo de texto que reemplaza al configurado en el proveedor. */
  modelOverride: string | null;
  /** Si el proveedor asignado falla, seguir con la cadena general en vez de fallar. */
  fallbackToDefault: boolean;
  /** `null` = nunca personalizado (valores de fábrica). */
  updatedAt: Date | null;
}

/** Configuración efectiva de un agente: lo guardado, o los valores de fábrica si no hay nada. */
export class AiAgentConfig {
  private constructor(private readonly props: AiAgentConfigProps) {}

  static defaults(key: AiAgentKey): AiAgentConfig {
    return new AiAgentConfig({
      key,
      instructions: AI_AGENT_CATALOG[key].defaultInstructions,
      providerId: null,
      modelOverride: null,
      fallbackToDefault: true,
      updatedAt: null,
    });
  }

  static fromPersistence(props: AiAgentConfigProps): AiAgentConfig {
    return new AiAgentConfig(props);
  }

  with(changes: Partial<Omit<AiAgentConfigProps, 'key' | 'updatedAt'>>): AiAgentConfig {
    return new AiAgentConfig({ ...this.props, ...changes, updatedAt: new Date() });
  }

  toProps(): AiAgentConfigProps {
    return { ...this.props };
  }

  get key(): AiAgentKey { return this.props.key; }
  get instructions(): string { return this.props.instructions; }
  get providerId(): string | null { return this.props.providerId; }
  get modelOverride(): string | null { return this.props.modelOverride; }
  get fallbackToDefault(): boolean { return this.props.fallbackToDefault; }
  get updatedAt(): Date | null { return this.props.updatedAt; }
  get customized(): boolean { return this.props.updatedAt !== null; }
}
