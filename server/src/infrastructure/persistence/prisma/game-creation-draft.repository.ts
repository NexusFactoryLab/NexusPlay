import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

export type DraftFileInput = { filename: string; mimeType: string; buffer: Buffer };

/** Persistencia de los borradores de creación de juego (issue #69). */
@Injectable()
export class PrismaGameCreationDraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(userId: string, gameType: string, mode: string) {
    const draft = await this.prisma.gameCreationDraftModel.findUnique({
      where: { userId_gameType_mode: { userId, gameType, mode } },
      include: {
        files: {
          orderBy: { position: 'asc' },
          select: { id: true, filename: true, mimeType: true, sizeBytes: true },
        },
      },
    });
    if (!draft) return null;
    return {
      gameType: draft.gameType,
      mode: draft.mode,
      formState: draft.formState,
      aiResult: draft.aiResult,
      aiMessage: draft.aiMessage,
      updatedAt: draft.updatedAt,
      files: draft.files,
    };
  }

  async saveFormState(userId: string, gameType: string, mode: string, formState: unknown) {
    const json = formState as object;
    await this.prisma.gameCreationDraftModel.upsert({
      where: { userId_gameType_mode: { userId, gameType, mode } },
      create: { userId, gameType, mode, formState: json },
      update: { formState: json },
    });
  }

  /** Guarda el resultado de la IA con sus archivos; reemplaza los anteriores. */
  async saveAiResult(
    userId: string,
    gameType: string,
    mode: string,
    aiResult: unknown,
    aiMessage: string | null,
    files: DraftFileInput[],
  ) {
    const json = aiResult as object;
    await this.prisma.$transaction(async (tx) => {
      const draft = await tx.gameCreationDraftModel.upsert({
        where: { userId_gameType_mode: { userId, gameType, mode } },
        create: { userId, gameType, mode, aiResult: json, aiMessage },
        update: { aiResult: json, aiMessage },
      });
      await tx.gameCreationDraftFileModel.deleteMany({ where: { draftId: draft.id } });
      if (files.length > 0) {
        await tx.gameCreationDraftFileModel.createMany({
          data: files.map((file, position) => ({
            draftId: draft.id,
            filename: file.filename,
            mimeType: file.mimeType,
            sizeBytes: file.buffer.length,
            data: new Uint8Array(file.buffer),
            position,
          })),
        });
      }
    });
  }

  async findFile(userId: string, fileId: string) {
    const file = await this.prisma.gameCreationDraftFileModel.findFirst({
      where: { id: fileId, draft: { userId } },
    });
    return file
      ? { filename: file.filename, mimeType: file.mimeType, data: Buffer.from(file.data) }
      : null;
  }

  /** Sin `mode` borra los borradores de todos los modos de ese tipo de juego. */
  async delete(userId: string, gameType: string, mode?: string) {
    await this.prisma.gameCreationDraftModel.deleteMany({
      where: { userId, gameType, ...(mode === undefined ? {} : { mode }) },
    });
  }
}
