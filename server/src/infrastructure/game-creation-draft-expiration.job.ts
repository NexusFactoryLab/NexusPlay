import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { GameCreationDraftService } from '../application/services/game-creation-draft.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Primera corrida poco después de arrancar, para no depender de que el servidor
// permanezca 24 h arriba entre despliegues.
const FIRST_RUN_DELAY_MS = 2 * 60 * 1000;

/**
 * Job diario (issue #69): elimina los borradores de creación de juego de más de
 * 7 días con sus archivos e imágenes de Cloudinary. Es un `setInterval` simple
 * (el servidor es un proceso de larga vida y @nestjs/schedule no está en el
 * proyecto); es idempotente, así que reinicios o varias instancias no dañan.
 */
@Injectable()
export class GameCreationDraftExpirationJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameCreationDraftExpirationJob.name);
  private firstRun?: NodeJS.Timeout;
  private daily?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly drafts: GameCreationDraftService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.firstRun = setTimeout(() => void this.run(), FIRST_RUN_DELAY_MS);
    this.daily = setInterval(() => void this.run(), DAY_MS);
    this.firstRun.unref();
    this.daily.unref();
  }

  onModuleDestroy() {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.daily) clearInterval(this.daily);
  }

  /** Una corrida; nunca lanza (un fallo se registra y se reintenta al día siguiente). */
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const report = await this.drafts.deleteExpired();
      if (report.deleted > 0 || report.failed > 0) {
        this.logger.log(
          `Borradores vencidos: ${report.deleted} eliminados, ${report.failed} con error.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Falló la limpieza de borradores vencidos: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
