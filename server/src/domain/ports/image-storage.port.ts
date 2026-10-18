export const IMAGE_STORAGE = Symbol('IMAGE_STORAGE');

export interface UploadedImage {
  url: string;
  publicId: string;
}

export interface ImageStorage {
  /** Sube un buffer de imagen y devuelve su URL pública (CDN) y su id para poder borrarla luego. */
  upload(buffer: Buffer, folder: string, tags?: string[]): Promise<UploadedImage>;
  /**
   * Sube un buffer de audio (ej. pronunciación de una tarjeta de "¿Quién Es?").
   * Con `tags` el recurso queda etiquetado (ej. `draft-<id>` durante la creación, issue #69).
   */
  uploadAudio(buffer: Buffer, folder: string, tags?: string[]): Promise<UploadedImage>;
}
