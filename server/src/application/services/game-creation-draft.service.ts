import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  GAME_CREATION_DRAFT_REPOSITORY,
  type DraftAiFile,
  type GameCreationDraftRecord,
  type GameCreationDraftRepository,
} from '../../domain/ports/game-creation-draft.repository.port.js';
import {
  DRAFT_ASSET_STORAGE,
  draftTag,
  type DraftAssetStorage,
} from '../../domain/ports/draft-asset-storage.port.js';
import {
  GameCreationDraftLimitError,
  GameCreationDraftNotFoundError,
} from '../errors/application.errors.js';

/** Máximo de borradores guardados por persona. */
export const MAX_DRAFTS_PER_USER = 5;

/** Días sin modificarse tras los cuales un borrador (y sus archivos) se elimina. */
export const DRAFT_RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRATION_BATCH_SIZE = 200;

export interface DraftSummary {
  id: string;
  gameType: string;
  mode: string;
  gameName: string;
  updatedAt: Date;
}

export interface DraftUploadedFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ExpirationReport {
  deleted: number;
  failed: number;
}

/**
 * Borradores automáticos de creación de juego (issue #69). Cada borrador guarda
 * el estado completo del formulario, el resultado de la IA (para no volver a
 * gastar tokens) y las URLs de los archivos subidos a la IA; los binarios
 * viven en Cloudinary con la etiqueta `draft-<id>`.
 */
@Injectable()
export class GameCreationDraftService {
  private readonly logger = new Logger(GameCreationDraftService.name);

  constructor(
    @Inject(GAME_CREATION_DRAFT_REPOSITORY) private readonly drafts: GameCreationDraftRepository,
    @Inject(DRAFT_ASSET_STORAGE) private readonly assets: DraftAssetStorage,
  ) {}

  /** Resumen de los borradores de la persona (solo los que tienen algo guardado). */
  async list(userId: string): Promise<DraftSummary[]> {
    const drafts = await this.drafts.findByUser(userId);
    return drafts
      .filter((draft) => draft.formState != null || draft.aiResult != null)
      .map((draft) => ({
        id: draft.id,
        gameType: draft.gameType,
        mode: draft.mode,
        gameName: extractGameName(draft),
        updatedAt: draft.updatedAt,
      }));
  }

  async get(userId: string, id: string): Promise<GameCreationDraftRecord> {
    const draft = await this.drafts.findById(id);
    if (!draft || draft.userId !== userId) throw new GameCreationDraftNotFoundError();
    return draft;
  }

  async saveFormState(
    userId: string,
    id: string,
    gameType: string,
    mode: string,
    formState: unknown,
  ): Promise<void> {
    await this.assertNotOwnedByOther(userId, id);
    await this.drafts.upsertFormState({ id, userId, gameType, mode, formState });
  }

  /** Guarda el resultado de la IA y sube a Cloudinary los archivos que se le enviaron. */
  async saveAiResult(
    userId: string,
    id: string,
    gameType: string,
    mode: string,
    aiResult: unknown,
    aiMessage: string | null,
    files: DraftUploadedFile[],
  ): Promise<void> {
    await this.assertNotOwnedByOther(userId, id);
    const tag = draftTag(id);
    const aiFiles: DraftAiFile[] = [];
    for (const file of files) {
      const uploaded = await this.assets.uploadDraftFile(file.buffer, file.filename, tag);
      aiFiles.push({
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.buffer.length,
        url: uploaded.url,
        publicId: uploaded.publicId,
      });
    }
    await this.drafts.upsertAiResult({ id, userId, gameType, mode, aiResult, aiMessage, aiFiles });
  }

  /** Descartar: borra la fila y todo lo que siga con la etiqueta en Cloudinary. */
  async discard(userId: string, id: string): Promise<void> {
    const draft = await this.drafts.findById(id);
    if (!draft) {
      // Idempotente: puede haber recursos subidos antes de que se guardara la fila.
      await this.assets.deleteByTag(draftTag(id));
      return;
    }
    if (draft.userId !== userId) throw new GameCreationDraftNotFoundError();
    await this.assets.deleteByTag(draftTag(id));
    await this.drafts.delete(id);
  }

  /**
   * El juego se creó con éxito: las imágenes y archivos dejan de ser del
   * borrador (se les quita la etiqueta para que no se borren con él) y la fila
   * sobra. Nunca borra recursos de Cloudinary.
   */
  async complete(userId: string, id: string): Promise<void> {
    const draft = await this.drafts.findById(id);
    if (draft && draft.userId !== userId) return;
    await this.assets.removeTag(draftTag(id));
    if (draft) await this.drafts.delete(id);
  }

  /**
   * Borra los borradores sin modificar en más de `DRAFT_RETENTION_DAYS` días:
   * primero los recursos de Cloudinary con su etiqueta y solo si eso salió bien
   * la fila, así un fallo se reintenta en la siguiente corrida (idempotente).
   */
  async deleteExpired(now: Date = new Date()): Promise<ExpirationReport> {
    const before = new Date(now.getTime() - DRAFT_RETENTION_DAYS * DAY_MS);
    const report: ExpirationReport = { deleted: 0, failed: 0 };
    const failedIds = new Set<string>();
    for (;;) {
      const ids = (await this.drafts.findIdsNotUpdatedSince(before, EXPIRATION_BATCH_SIZE)).filter(
        (id) => !failedIds.has(id),
      );
      if (ids.length === 0) break;
      for (const id of ids) {
        try {
          await this.assets.deleteByTag(draftTag(id));
          await this.drafts.delete(id);
          report.deleted += 1;
        } catch (error) {
          failedIds.add(id);
          report.failed += 1;
          this.logger.error(
            `No se pudo eliminar el borrador vencido ${id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    return report;
  }

  /** Guardar uno existente siempre se permite; uno nuevo solo si no se llegó al tope. */
  private async assertNotOwnedByOther(userId: string, id: string): Promise<void> {
    const existing = await this.drafts.findById(id);
    if (existing) {
      if (existing.userId !== userId) throw new GameCreationDraftNotFoundError();
      return;
    }
    const owned = await this.drafts.findByUser(userId);
    if (owned.length >= MAX_DRAFTS_PER_USER) throw new GameCreationDraftLimitError(MAX_DRAFTS_PER_USER);
  }
}

function extractGameName(draft: GameCreationDraftRecord): string {
  const fromForm = readString(draft.formState, 'title');
  if (fromForm) return fromForm;
  const config = (draft.aiResult as { config?: unknown } | null)?.config;
  return readString(config, 'title') ?? '';
}

function readString(source: unknown, key: string): string | null {
  if (!source || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
