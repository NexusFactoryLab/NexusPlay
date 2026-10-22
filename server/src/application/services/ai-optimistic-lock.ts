import { InvalidAiProviderConfigError } from '../errors/application.errors.js';

/**
 * Bloqueo optimista del panel de IA: el cliente manda la versión (`updatedAt`
 * ISO) que vio al abrir el formulario. `undefined` = el cliente no la envió
 * (no se compara de antemano; el guardado condicional de la base de datos
 * protege igual contra carreras). `null` = "esto no existía/no estaba
 * personalizado cuando lo viste" (agentes sin fila).
 */
export function parseExpectedVersion(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidAiProviderConfigError('la versión esperada (expectedUpdatedAt) no es una fecha válida.');
  }
  return parsed;
}

/** ¿La versión que vio el cliente ya no es la guardada? Compara por milisegundos, no por referencia. */
export function isStaleVersion(current: Date | null, expected: Date | null | undefined): boolean {
  if (expected === undefined) return false;
  return (current?.getTime() ?? null) !== (expected?.getTime() ?? null);
}
