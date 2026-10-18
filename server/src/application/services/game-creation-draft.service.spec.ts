import { describe, expect, it, beforeEach } from 'vitest';
import {
  DRAFT_RETENTION_DAYS,
  MAX_DRAFTS_PER_USER,
  GameCreationDraftService,
} from './game-creation-draft.service.js';
import type {
  DraftAiFile,
  GameCreationDraftRecord,
  GameCreationDraftRepository,
} from '../../domain/ports/game-creation-draft.repository.port.js';
import type { DraftAssetStorage } from '../../domain/ports/draft-asset-storage.port.js';
import {
  GameCreationDraftLimitError,
  GameCreationDraftNotFoundError,
} from '../errors/application.errors.js';

const DAY_MS = 24 * 60 * 60 * 1000;

class InMemoryDrafts implements GameCreationDraftRepository {
  rows = new Map<string, GameCreationDraftRecord>();

  seed(id: string, userId: string, updatedAt: Date, extra: Partial<GameCreationDraftRecord> = {}) {
    this.rows.set(id, {
      id,
      userId,
      gameType: 'DOMINO',
      mode: '',
      formState: null,
      aiResult: null,
      aiMessage: null,
      aiFiles: [],
      createdAt: updatedAt,
      updatedAt,
      ...extra,
    });
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByUser(userId: string) {
    return [...this.rows.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  async upsertFormState(input: {
    id: string;
    userId: string;
    gameType: string;
    mode: string;
    formState: unknown;
  }) {
    const current = this.rows.get(input.id);
    if (current) this.rows.set(input.id, { ...current, formState: input.formState, updatedAt: new Date() });
    else this.seed(input.id, input.userId, new Date(), { ...input });
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
    const current = this.rows.get(input.id);
    if (current) this.rows.set(input.id, { ...current, ...input, updatedAt: new Date() });
    else this.seed(input.id, input.userId, new Date(), { ...input });
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
  async findIdsNotUpdatedSince(before: Date, limit: number) {
    return [...this.rows.values()]
      .filter((row) => row.updatedAt < before)
      .slice(0, limit)
      .map((row) => row.id);
  }
}

class FakeAssets implements DraftAssetStorage {
  uploaded: { filename: string; tag: string }[] = [];
  untagged: string[] = [];
  deleted: string[] = [];
  failDeleteFor = new Set<string>();

  async uploadDraftFile(_buffer: Buffer, filename: string, tag: string) {
    this.uploaded.push({ filename, tag });
    return { url: `https://cdn/${tag}/${filename}`, publicId: `pid-${filename}` };
  }
  async removeTag(tag: string) {
    this.untagged.push(tag);
  }
  async deleteByTag(tag: string) {
    if (this.failDeleteFor.has(tag)) throw new Error('cloudinary caído');
    this.deleted.push(tag);
  }
}

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_C = '33333333-3333-4333-8333-333333333333';

describe('GameCreationDraftService', () => {
  let drafts: InMemoryDrafts;
  let assets: FakeAssets;
  let service: GameCreationDraftService;

  beforeEach(() => {
    drafts = new InMemoryDrafts();
    assets = new FakeAssets();
    service = new GameCreationDraftService(drafts, assets);
  });

  describe('list', () => {
    it('resume tipo, nombre y última modificación, y omite borradores vacíos', async () => {
      await service.saveFormState('u1', ID_A, 'DOMINO', '', { title: ' Mi dominó ' });
      drafts.seed(ID_B, 'u1', new Date(), { aiResult: { config: { title: 'Título de la IA' } } });
      drafts.seed(ID_C, 'u1', new Date()); // sin nada guardado
      drafts.seed('otro', 'u2', new Date(), { formState: { title: 'Ajeno' } });

      const list = await service.list('u1');

      expect(list.map((d) => d.id).sort()).toEqual([ID_A, ID_B].sort());
      expect(list.find((d) => d.id === ID_A)).toMatchObject({
        gameType: 'DOMINO',
        gameName: 'Mi dominó',
      });
      expect(list.find((d) => d.id === ID_B)?.gameName).toBe('Título de la IA');
    });
  });

  describe('tope de borradores por persona', () => {
    const idFor = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

    it('rechaza un borrador nuevo cuando ya hay 5, en formulario y en IA', async () => {
      for (let n = 1; n <= MAX_DRAFTS_PER_USER; n++) {
        await service.saveFormState('u1', idFor(n), 'DOMINO', '', { title: `j${n}` });
      }

      await expect(service.saveFormState('u1', idFor(6), 'DOMINO', '', {})).rejects.toBeInstanceOf(
        GameCreationDraftLimitError,
      );
      await expect(
        service.saveAiResult('u1', idFor(7), 'DOMINO', '', { config: {}, content: [] }, null, []),
      ).rejects.toThrow(/máximo de 5 borradores/);
      expect(assets.uploaded).toEqual([]);
    });

    it('sigue permitiendo guardar un borrador que ya existe', async () => {
      for (let n = 1; n <= MAX_DRAFTS_PER_USER; n++) {
        await service.saveFormState('u1', idFor(n), 'DOMINO', '', { title: `j${n}` });
      }

      await service.saveFormState('u1', idFor(3), 'DOMINO', '', { title: 'editado' });

      expect((await service.get('u1', idFor(3))).formState).toEqual({ title: 'editado' });
    });

    it('el tope es por persona y se libera al descartar o completar', async () => {
      for (let n = 1; n <= MAX_DRAFTS_PER_USER; n++) {
        await service.saveFormState('u1', idFor(n), 'DOMINO', '', {});
      }
      await expect(service.saveFormState('u2', idFor(8), 'DOMINO', '', {})).resolves.toBeUndefined();

      await service.discard('u1', idFor(1));
      await expect(service.saveFormState('u1', idFor(6), 'DOMINO', '', {})).resolves.toBeUndefined();
    });
  });

  describe('saveAiResult', () => {
    it('sube los archivos a Cloudinary con la etiqueta del borrador y guarda solo las URLs', async () => {
      await service.saveAiResult('u1', ID_A, 'DOMINO', '', { config: {}, content: [] }, 'hola', [
        { filename: 'tema.pdf', mimeType: 'application/pdf', buffer: Buffer.from('abc') },
      ]);

      expect(assets.uploaded).toEqual([{ filename: 'tema.pdf', tag: `draft-${ID_A}` }]);
      const saved = await service.get('u1', ID_A);
      expect(saved.aiMessage).toBe('hola');
      expect(saved.aiFiles).toEqual([
        {
          filename: 'tema.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 3,
          url: `https://cdn/draft-${ID_A}/tema.pdf`,
          publicId: 'pid-tema.pdf',
        },
      ]);
    });

    it('no deja pisar el borrador de otra persona', async () => {
      drafts.seed(ID_A, 'u2', new Date());
      await expect(service.saveFormState('u1', ID_A, 'DOMINO', '', {})).rejects.toBeInstanceOf(
        GameCreationDraftNotFoundError,
      );
    });
  });

  describe('complete (juego creado con éxito)', () => {
    it('quita la etiqueta sin borrar recursos y elimina la fila', async () => {
      await service.saveFormState('u1', ID_A, 'DOMINO', '', { title: 'x' });

      await service.complete('u1', ID_A);

      expect(assets.untagged).toEqual([`draft-${ID_A}`]);
      expect(assets.deleted).toEqual([]);
      expect(drafts.rows.has(ID_A)).toBe(false);
    });

    it('ignora un borrador ajeno', async () => {
      drafts.seed(ID_A, 'u2', new Date());
      await service.complete('u1', ID_A);
      expect(assets.untagged).toEqual([]);
      expect(drafts.rows.has(ID_A)).toBe(true);
    });
  });

  describe('discard', () => {
    it('borra la fila y los recursos con la etiqueta', async () => {
      await service.saveFormState('u1', ID_A, 'DOMINO', '', {});
      await service.discard('u1', ID_A);
      expect(assets.deleted).toEqual([`draft-${ID_A}`]);
      expect(drafts.rows.has(ID_A)).toBe(false);
    });

    it('es idempotente si la fila ya no existe', async () => {
      await expect(service.discard('u1', ID_A)).resolves.toBeUndefined();
    });
  });

  describe('deleteExpired', () => {
    it('borra solo los de más de 7 días, con sus recursos de Cloudinary', async () => {
      const now = new Date('2026-10-18T12:00:00Z');
      drafts.seed(ID_A, 'u1', new Date(now.getTime() - (DRAFT_RETENTION_DAYS + 1) * DAY_MS));
      drafts.seed(ID_B, 'u1', new Date(now.getTime() - (DRAFT_RETENTION_DAYS - 1) * DAY_MS));

      const report = await service.deleteExpired(now);

      expect(report).toEqual({ deleted: 1, failed: 0 });
      expect(assets.deleted).toEqual([`draft-${ID_A}`]);
      expect([...drafts.rows.keys()]).toEqual([ID_B]);
    });

    it('si Cloudinary falla conserva la fila para reintentar y sigue con los demás', async () => {
      const now = new Date('2026-10-18T12:00:00Z');
      const old = new Date(now.getTime() - 10 * DAY_MS);
      drafts.seed(ID_A, 'u1', old);
      drafts.seed(ID_B, 'u1', old);
      assets.failDeleteFor.add(`draft-${ID_A}`);

      const report = await service.deleteExpired(now);

      expect(report).toEqual({ deleted: 1, failed: 1 });
      expect([...drafts.rows.keys()]).toEqual([ID_A]);

      assets.failDeleteFor.clear();
      expect(await service.deleteExpired(now)).toEqual({ deleted: 1, failed: 0 });
      expect(drafts.rows.size).toBe(0);
    });

    it('sin vencidos no hace nada (idempotente)', async () => {
      expect(await service.deleteExpired()).toEqual({ deleted: 0, failed: 0 });
      expect(assets.deleted).toEqual([]);
    });
  });
});
