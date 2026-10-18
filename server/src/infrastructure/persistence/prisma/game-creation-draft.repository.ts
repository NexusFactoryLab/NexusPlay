import { Injectable } from '@nestjs/common';
import type {
  DraftAiFile,
  GameCreationDraftRecord,
  GameCreationDraftRepository,
} from '../../../domain/ports/game-creation-draft.repository.port.js';
import { PrismaService } from './prisma.service.js';

type DraftRow = {
  id: string;
  userId: string;
  gameType: string;
  mode: string;
  formState: unknown;
  aiResult: unknown;
  aiMessage: string | null;
  aiFiles: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function toRecord(row: DraftRow): GameCreationDraftRecord {
  return {
    id: row.id,
    userId: row.userId,
    gameType: row.gameType,
    mode: row.mode,
    formState: row.formState,
    aiResult: row.aiResult,
    aiMessage: row.aiMessage,
    aiFiles: Array.isArray(row.aiFiles) ? (row.aiFiles as DraftAiFile[]) : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Persistencia de los borradores de creación de juego (issue #69). */
@Injectable()
export class PrismaGameCreationDraftRepository implements GameCreationDraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const row = await this.prisma.gameCreationDraftModel.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findByUser(userId: string) {
    const rows = await this.prisma.gameCreationDraftModel.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  async upsertFormState(input: {
    id: string;
    userId: string;
    gameType: string;
    mode: string;
    formState: unknown;
  }) {
    const formState = input.formState as object;
    await this.prisma.gameCreationDraftModel.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        userId: input.userId,
        gameType: input.gameType,
        mode: input.mode,
        formState,
      },
      update: { formState },
    });
  }

  async upsertAiResult(input: {
    id: string;
    userId: string;
    gameType: string;
    mode: string;
    aiResult: unknown;
    aiMessage: string | null;
    aiFiles: DraftAiFile[];
  }) {
    const data = {
      aiResult: input.aiResult as object,
      aiMessage: input.aiMessage,
      aiFiles: input.aiFiles as object[],
    };
    await this.prisma.gameCreationDraftModel.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        userId: input.userId,
        gameType: input.gameType,
        mode: input.mode,
        ...data,
      },
      update: data,
    });
  }

  async delete(id: string) {
    await this.prisma.gameCreationDraftModel.deleteMany({ where: { id } });
  }

  async findIdsNotUpdatedSince(before: Date, limit: number) {
    const rows = await this.prisma.gameCreationDraftModel.findMany({
      where: { updatedAt: { lt: before } },
      select: { id: true },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => row.id);
  }
}
