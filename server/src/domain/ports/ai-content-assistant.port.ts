export const AI_CONTENT_ASSISTANT = Symbol('AI_CONTENT_ASSISTANT');

export interface DescribeImageInput {
  buffer: Buffer;
  mimeType: string;
}

export interface GenerateGameDraftInput {
  gameType: string;
  /** Texto ya extraído (y concatenado) de todos los archivos que subió el usuario. */
  sourceText: string;
  /** Instrucciones + forma de JSON esperada para este gameType (ver game-prompt-catalog). */
  instructions: string;
  /**
   * Descripciones (por visión del modelo) de las imágenes que el usuario
   * subió como CONTENIDO del juego (no como material de referencia) — solo
   * presente en tipos de juego con imagen obligatoria por elemento (Quién
   * Es, Parejas). El índice de este arreglo es el "imageIndex" que la IA
   * debe usar para referenciar cada imagen en el JSON generado, en vez de
   * inventar una URL.
   */
  imageDescriptions?: string[];
}

export interface GenerateGameDraftOutput {
  config: unknown;
  content: unknown;
  /**
   * `true` cuando el proveedor tuvo que recortar `sourceText` para que
   * cupiera en el límite de tokens del modelo — el caso de uso se lo avisa
   * al usuario ("la IA usó solo la primera parte de tu texto"). Opcional:
   * un proveedor sin ese límite nunca lo manda.
   */
  sourceTruncated?: boolean;
}

/**
 * Puerto hacia el proveedor de IA que arma el borrador de un juego a partir
 * de los archivos que sube el usuario. Ningún caso de uso ni controller
 * conoce el proveedor real: se configura desde el panel de administración
 * (ver `AiAssistantFactory`) — agregar uno nuevo es escribir un adaptador y
 * registrarlo en la fábrica, nada más.
 */
export interface AiContentAssistant {
  /** Describe/extrae en texto legible el contenido de una imagen (usa visión del modelo). */
  describeImage(input: DescribeImageInput): Promise<string>;
  /** Genera `config`/`content` para un `gameType` a partir del texto fuente ya extraído. */
  generateGameDraft(input: GenerateGameDraftInput): Promise<GenerateGameDraftOutput>;
  /**
   * Llamada mínima para verificar credenciales y modelo ("Probar conexión"
   * del panel de administración). Lanza si el proveedor no responde bien.
   * Opcional: la cadena de fallback (`AiProviderOrchestrator`) no la expone.
   */
  ping?(): Promise<void>;
}
