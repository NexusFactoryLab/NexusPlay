export const GAME_CREATION_DRAFT_REPOSITORY = Symbol('GAME_CREATION_DRAFT_REPOSITORY');

export interface DraftAiFile {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  publicId: string;
}

/** Borrador de creación de juego (no confundir con `GameDraft`, el resultado de la IA). */
export interface GameCreationDraftRecord {
  id: string;
  userId: string;
  gameType: string;
  mode: string;
  formState: unknown;
  aiResult: unknown;
  aiMessage: string | null;
  aiFiles: DraftAiFile[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GameCreationDraftRepository {
  findById(id: string): Promise<GameCreationDraftRecord | null>;
  /** Del más reciente al más antiguo. */
  findByUser(userId: string): Promise<GameCreationDraftRecord[]>;
  /** Crea el borrador si no existe, o actualiza el estado del formulario. */
  upsertFormState(input: {
    id: string;
    userId: string;
    gameType: string;
    mode: string;
    formState: unknown;
  }): Promise<void>;
  upsertAiResult(input: {
    id: string;
    userId: string;
    gameType: string;
    mode: string;
    aiResult: unknown;
    aiMessage: string | null;
    aiFiles: DraftAiFile[];
  }): Promise<void>;
  delete(id: string): Promise<void>;
  /** Ids de los borradores sin modificar desde `before`. */
  findIdsNotUpdatedSince(before: Date, limit: number): Promise<string[]>;
}
