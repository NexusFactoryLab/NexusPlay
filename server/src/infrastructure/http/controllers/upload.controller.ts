import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { UploadImageUseCase } from '../../../application/use-cases/upload-image.use-case.js';
import { UploadAudioUseCase } from '../../../application/use-cases/upload-audio.use-case.js';
import { draftTag } from '../../../domain/ports/draft-asset-storage.port.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';

const ALLOWED_FOLDERS = new Set(['game-covers', 'memory-cards', 'guess-who-cards']);
const ALLOWED_AUDIO_FOLDERS = new Set(['guess-who-audio']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Issue #69: durante la creación de un juego el cliente manda el id del
 * borrador y el recurso queda con la etiqueta `draft-<id>`, para poder borrarlo
 * si el borrador se descarta o vence (y quitársela cuando el juego se crea).
 */
function tagsFor(draftId: string | undefined): string[] | undefined {
  if (draftId === undefined) return undefined;
  if (!UUID.test(draftId)) throw new BadRequestException('Borrador no válido.');
  return [draftTag(draftId)];
}

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly uploadImageUseCase: UploadImageUseCase,
    private readonly uploadAudioUseCase: UploadAudioUseCase,
  ) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('folder') folder = 'game-covers',
    @Query('draftId') draftId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }
    if (!ALLOWED_FOLDERS.has(folder)) {
      throw new BadRequestException('Carpeta de destino no válida.');
    }

    return this.uploadImageUseCase.execute({
      buffer: file.buffer,
      mimeType: file.mimetype,
      size: file.size,
      folder,
      tags: tagsFor(draftId),
    });
  }

  @Post('audio')
  @UseInterceptors(FileInterceptor('file'))
  uploadAudio(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('folder') folder = 'guess-who-audio',
    @Query('draftId') draftId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }
    if (!ALLOWED_AUDIO_FOLDERS.has(folder)) {
      throw new BadRequestException('Carpeta de destino no válida.');
    }

    return this.uploadAudioUseCase.execute({
      buffer: file.buffer,
      mimeType: file.mimetype,
      size: file.size,
      folder,
      tags: tagsFor(draftId),
    });
  }
}
