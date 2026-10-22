export const AI_AVAILABILITY = Symbol('AI_AVAILABILITY');

/** Responde, sin gastar cuota, si hay al menos un proveedor de IA con el que se pueda trabajar. */
export interface AiAvailability {
  isConfigured(): Promise<boolean>;
}
