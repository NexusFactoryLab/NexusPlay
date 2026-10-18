import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { CurrentUserId } from '../decorators/current-user-id.decorator.js';
import {
  DraftIdParamDto,
  SaveGameCreationDraftAiDto,
  SaveGameCreationDraftFormDto,
} from '../dtos/game-creation-draft.dto.js';
import { GameCreationDraftService } from '../../../application/services/game-creation-draft.service.js';

// Mismos límites que POST /games/ai-draft: lo guardado es lo que se subió a la IA.
const MAX_FILES = 65;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

/**
 * Borradores automáticos de creación de juego (issue #69). Ruta de primer
 * nivel (no `games/...`) para no chocar con `GET /games/:id`.
 */
@Controller('creation-drafts')
@UseGuards(JwtAuthGuard)
export class GameCreationDraftController {
  constructor(private readonly drafts: GameCreationDraftService) {}

  /** Resumen de los borradores de la persona: tipo, nombre y última modificación. */
  @Get()
  list(@CurrentUserId() userId: string) {
    return this.drafts.list(userId);
  }

  @Get(':id')
  async get(@CurrentUserId() userId: string, @Param() { id }: DraftIdParamDto) {
    const draft = await this.drafts.get(userId, id);
    return {
      id: draft.id,
      gameType: draft.gameType,
      mode: draft.mode,
      formState: draft.formState,
      aiResult: draft.aiResult,
      aiMessage: draft.aiMessage,
      aiFiles: draft.aiFiles.map(({ filename, mimeType, sizeBytes, url }) => ({
        filename,
        mimeType,
        sizeBytes,
        url,
      })),
      updatedAt: draft.updatedAt,
    };
  }

  @Put(':id')
  async saveForm(
    @CurrentUserId() userId: string,
    @Param() { id }: DraftIdParamDto,
    @Body() dto: SaveGameCreationDraftFormDto,
  ) {
    await this.drafts.saveFormState(userId, id, dto.gameType, dto.mode ?? '', dto.formState);
    return { ok: true };
  }

  @Put(':id/ai')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES },
    }),
  )
  async saveAi(
    @CurrentUserId() userId: string,
    @Param() { id }: DraftIdParamDto,
    @Body() dto: SaveGameCreationDraftAiDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    let result: unknown;
    try {
      result = JSON.parse(dto.result);
    } catch {
      throw new BadRequestException('El resultado de la IA no es un JSON válido.');
    }
    await this.drafts.saveAiResult(
      userId,
      id,
      dto.gameType,
      dto.mode ?? '',
      result,
      dto.message?.trim() || null,
      (files ?? []).map((file) => ({
        filename: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      })),
    );
    return { ok: true };
  }

  /** Descartar: borra el borrador y sus archivos e imágenes. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async discard(@CurrentUserId() userId: string, @Param() { id }: DraftIdParamDto) {
    await this.drafts.discard(userId, id);
  }
}
