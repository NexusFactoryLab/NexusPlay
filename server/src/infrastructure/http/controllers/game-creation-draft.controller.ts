import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express, Response } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { CurrentUserId } from '../decorators/current-user-id.decorator.js';
import {
  GameCreationDraftKeyDto,
  SaveGameCreationDraftAiDto,
  SaveGameCreationDraftFormDto,
} from '../dtos/game-creation-draft.dto.js';
import { PrismaGameCreationDraftRepository } from '../../persistence/prisma/game-creation-draft.repository.js';

// Mismos límites que POST /games/ai-draft: lo guardado es lo que se subió a la IA.
const MAX_FILES = 65;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

/**
 * Borradores automáticos de creación de juego (issue #69): uno por usuario,
 * tipo de juego y modo. Guarda el formulario, el resultado de la IA y los
 * archivos que se le subieron, para no volver a gastar tokens.
 */
@Controller('games/creation-drafts')
@UseGuards(JwtAuthGuard)
export class GameCreationDraftController {
  constructor(private readonly drafts: PrismaGameCreationDraftRepository) {}

  @Get()
  async get(@CurrentUserId() userId: string, @Query() key: GameCreationDraftKeyDto) {
    return (await this.drafts.find(userId, key.gameType, key.mode ?? '')) ?? null;
  }

  @Put()
  async saveForm(@CurrentUserId() userId: string, @Body() dto: SaveGameCreationDraftFormDto) {
    await this.drafts.saveFormState(userId, dto.gameType, dto.mode ?? '', dto.formState);
    return { ok: true };
  }

  @Put('ai')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES },
    }),
  )
  async saveAi(
    @CurrentUserId() userId: string,
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

  @Get('files/:fileId')
  async file(
    @CurrentUserId() userId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const file = await this.drafts.findFile(userId, fileId);
    if (!file) throw new NotFoundException('Archivo no encontrado.');
    res.setHeader('Content-Type', file.mimeType);
    res.send(file.data);
  }

  @Delete()
  async remove(@CurrentUserId() userId: string, @Query() key: GameCreationDraftKeyDto) {
    await this.drafts.delete(userId, key.gameType, key.mode);
    return { ok: true };
  }
}
