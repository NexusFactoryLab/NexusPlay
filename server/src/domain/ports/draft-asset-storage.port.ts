export const DRAFT_ASSET_STORAGE = Symbol('DRAFT_ASSET_STORAGE');

export interface DraftAssetUpload {
  url: string;
  publicId: string;
}

/**
 * Archivos y recursos de un borrador de creación de juego (issue #69) en el
 * almacenamiento externo. Todo lo que se sube durante la creación lleva la
 * etiqueta `draft-<id>` para poder quitarla (el juego se publicó) o borrar
 * todo lo que la conserve (el borrador se descartó o venció).
 */
export interface DraftAssetStorage {
  /** Sube un archivo que va a la IA (PDF, Word, imagen...) con la etiqueta del borrador. */
  uploadDraftFile(buffer: Buffer, filename: string, tag: string): Promise<DraftAssetUpload>;
  /** Quita la etiqueta de todos los recursos que la tengan: pasan a ser definitivos. */
  removeTag(tag: string): Promise<void>;
  /** Borra todos los recursos que aún tengan la etiqueta. Idempotente. */
  deleteByTag(tag: string): Promise<void>;
}

/** Etiqueta de Cloudinary de un borrador. */
export function draftTag(draftId: string): string {
  return `draft-${draftId}`;
}
