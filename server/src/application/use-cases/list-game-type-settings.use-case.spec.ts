import { describe, expect, it, vi } from 'vitest';
import { GameTypeSetting } from '../../domain/entities/game-type-setting.entity.js';
import type { GameTypeSettingRepository } from '../../domain/ports/game-type-setting.repository.port.js';
import { GameType } from '../../domain/value-objects/game-type.vo.js';
import type { RequesterAdminResolver } from '../services/requester-admin-resolver.service.js';
import { ListGameTypeSettingsUseCase } from './list-game-type-settings.use-case.js';

function emptyRepository(): GameTypeSettingRepository {
  return {
    findByGameType: vi.fn(),
    findAll: vi.fn().mockResolvedValue([]),
    findArchivedGameTypes: vi.fn(),
    save: vi.fn(),
  };
}

describe('ListGameTypeSettingsUseCase', () => {
  it('expone los nombres editoriales cuando todavía no existe configuración persistida', async () => {
    const useCase = new ListGameTypeSettingsUseCase(
      emptyRepository(),
      { resolve: vi.fn().mockResolvedValue(false) } as unknown as RequesterAdminResolver,
    );

    const result = await useCase.execute({ requestingUserId: 'user-1', pageSize: 100 });

    expect(result.items.map((item) => [item.gameType, item.displayName])).toEqual(
      expect.arrayContaining([
        ['MEMORY_MATCH', 'MatchMente'],
        ['GUESS_WHO', 'Identidad Oculta'],
        ['DOMINO', 'Dominexo'],
        ['DUAL_QUEST_PIXI', 'Dúo Lógico Pixi'],
      ]),
    );
    expect(result.items.some((item) => item.displayName === item.gameType)).toBe(false);
  });

  it('conserva el displayName configurado de forma explícita', async () => {
    const configured = GameTypeSetting.create({
      id: 'setting-1',
      gameType: GameType.domino(),
      displayName: 'Dominó de biodiversidad',
    });
    const repository = emptyRepository();
    vi.mocked(repository.findAll).mockResolvedValue([configured]);
    const useCase = new ListGameTypeSettingsUseCase(
      repository,
      { resolve: vi.fn().mockResolvedValue(false) } as unknown as RequesterAdminResolver,
    );

    const result = await useCase.execute({ requestingUserId: 'user-1', pageSize: 100 });

    expect(result.items.find((item) => item.gameType === 'DOMINO')?.displayName).toBe('Dominó de biodiversidad');
  });
});
