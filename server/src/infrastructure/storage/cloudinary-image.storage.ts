import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import type { ImageStorage, UploadedImage } from '../../domain/ports/image-storage.port.js';
import type { DraftAssetStorage, DraftAssetUpload } from '../../domain/ports/draft-asset-storage.port.js';

const RESOURCE_TYPES = ['image', 'video', 'raw'] as const;
const PAGE_SIZE = 500;

/**
 * Las imágenes viven en Cloudinary (CDN + object storage), no en Mongo ni en
 * disco local: guardar binarios en la base de datos infla los documentos,
 * ralentiza cada query del catálogo, y no escala en un entorno serverless
 * donde el disco no persiste entre despliegues.
 */
@Injectable()
export class CloudinaryImageStorage implements ImageStorage, DraftAssetStorage {
  private readonly logger = new Logger(CloudinaryImageStorage.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async upload(buffer: Buffer, folder: string, tags?: string[]): Promise<UploadedImage> {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      throw new ServiceUnavailableException(
        'El almacenamiento de imágenes no está configurado todavía.',
      );
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `nexusplay/${folder}`,
          resource_type: 'image',
          ...(tags?.length ? { tags } : {}),
          // Redimensiona en el borde: nadie sube una carta de juego para
          // mostrarla a 4000px, y esto acota el costo de banda por imagen.
          transformation: [{ width: 1200, height: 1200, crop: 'limit' }],
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary no devolvió resultado.'));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      uploadStream.end(buffer);
    });
  }

  async uploadAudio(buffer: Buffer, folder: string, tags?: string[]): Promise<UploadedImage> {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      throw new ServiceUnavailableException(
        'El almacenamiento de imágenes no está configurado todavía.',
      );
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `nexusplay/${folder}`,
          // Cloudinary trata el audio bajo el tipo "video" (sin transformación de imagen).
          resource_type: 'video',
          ...(tags?.length ? { tags } : {}),
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary no devolvió resultado.'));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      uploadStream.end(buffer);
    });
  }

  async uploadDraftFile(buffer: Buffer, filename: string, tag: string): Promise<DraftAssetUpload> {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      throw new ServiceUnavailableException(
        'El almacenamiento de archivos no está configurado todavía.',
      );
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nexusplay/ai-draft-files',
          // "auto": Cloudinary decide entre imagen, video o archivo crudo (PDF, Word...).
          resource_type: 'auto',
          tags: [tag],
          use_filename: true,
          filename_override: filename,
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary no devolvió resultado.'));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      uploadStream.end(buffer);
    });
  }

  async removeTag(tag: string): Promise<void> {
    if (!process.env.CLOUDINARY_CLOUD_NAME) return;
    for (const resourceType of RESOURCE_TYPES) {
      let nextCursor: string | undefined;
      do {
        const page = (await cloudinary.api.resources_by_tag(tag, {
          resource_type: resourceType,
          max_results: PAGE_SIZE,
          next_cursor: nextCursor,
        })) as { resources: { public_id: string }[]; next_cursor?: string };
        const publicIds = page.resources.map((resource) => resource.public_id);
        if (publicIds.length > 0) {
          await cloudinary.uploader.remove_tag(tag, publicIds, { resource_type: resourceType });
        }
        nextCursor = page.next_cursor;
      } while (nextCursor);
    }
  }

  async deleteByTag(tag: string): Promise<void> {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      this.logger.warn(`Cloudinary sin configurar: no hay recursos que borrar para ${tag}.`);
      return;
    }
    for (const resourceType of RESOURCE_TYPES) {
      let partial = true;
      while (partial) {
        const result = (await cloudinary.api.delete_resources_by_tag(tag, {
          resource_type: resourceType,
        })) as { partial?: boolean };
        partial = result.partial === true;
      }
    }
  }
}
