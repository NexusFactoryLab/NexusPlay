import type { AiProviderConfig } from '../entities/ai-provider-config.entity.js';

export const AI_PROVIDER_CONFIG_REPOSITORY = Symbol('AI_PROVIDER_CONFIG_REPOSITORY');

export interface AiProviderConfigRepository {
  /** Todas, ordenadas por `priority` ascendente (luego por antigüedad). */
  findAll(): Promise<AiProviderConfig[]>;
  findById(id: string): Promise<AiProviderConfig | null>;
  findByName(name: string): Promise<AiProviderConfig | null>;
  /** Lanza `AiProviderConfigNameTakenError` si otro proveedor ya usa ese nombre (también ante una carrera). */
  save(config: AiProviderConfig): Promise<void>;
  /**
   * Guardado condicional (bloqueo optimista): actualiza SOLO si la fila sigue
   * con el `updatedAt` que se leyó (`expectedVersion`), en una sola
   * sentencia de la base de datos —no un if previo— para que dos admins
   * simultáneos no se pisen. Devuelve `false` si otro cambió/borró la fila.
   * Lanza `AiProviderConfigNameTakenError` ante un nombre repetido.
   */
  saveIfUnchanged(config: AiProviderConfig, expectedVersion: Date): Promise<boolean>;
  /**
   * Fija la prioridad (0, 1, 2…) según la posición en `orderedIds`, todo en
   * una sola transacción: o queda el orden completo o no cambia nada.
   */
  savePriorities(orderedIds: string[]): Promise<void>;
  /**
   * Guarda SOLO el resultado de la última prueba de conexión. La prueba tarda
   * segundos; reescribir la entidad entera al terminar pisaría lo que otro
   * admin hubiera editado mientras tanto. Si la configuración cambió desde que
   * empezó la prueba (`testedVersion` ya no coincide con su `updatedAt`), el
   * resultado se descarta: describiría algo distinto de lo que quedó guardado.
   */
  recordTestResult(
    id: string,
    testedVersion: Date,
    result: { at: Date; ok: boolean; message: string },
  ): Promise<void>;
  delete(id: string): Promise<void>;
}
