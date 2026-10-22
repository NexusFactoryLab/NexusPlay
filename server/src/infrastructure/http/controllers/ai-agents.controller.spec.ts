import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AiAgentsController } from './ai-agents.controller.js';
import { UpdateAiAgentDto } from '../dtos/ai-provider-config.dto.js';
import { RolesGuard } from '../guards/roles.guard.js';
import {
  JwtAuthGuard,
  controllerPath,
  guardsOf,
  rolesOf,
  routeOf,
  runRolesGuard,
  validateBody,
} from './testing/controller-meta.helper-spec.js';

function makeController() {
  const useCases = {
    list: { execute: vi.fn().mockResolvedValue({ items: [] }) },
    update: { execute: vi.fn().mockResolvedValue({ key: 'GAME_PLAYER' }) },
    reset: { execute: vi.fn().mockResolvedValue({ key: 'GAME_PLAYER' }) },
    test: { execute: vi.fn().mockResolvedValue({ ok: true }) },
  };
  const controller = new AiAgentsController(
    useCases.list as never,
    useCases.update as never,
    useCases.reset as never,
    useCases.test as never,
  );
  return { controller, useCases };
}

describe('AiAgentsController', () => {
  it('exige JWT y rol ADMIN bajo /admin/ai-agents', async () => {
    expect(controllerPath(AiAgentsController)).toBe('admin/ai-agents');
    expect(guardsOf(AiAgentsController)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(rolesOf(AiAgentsController)).toEqual(['ADMIN']);

    await expect(runRolesGuard(AiAgentsController, 'update', 'ADMIN')).resolves.toBe(true);
    for (const role of ['TEACHER', 'STUDENT', null]) {
      await expect(runRolesGuard(AiAgentsController, 'update', role)).rejects.toThrow(ForbiddenException);
    }
  });

  it.each([
    ['list', 'GET', '/', undefined],
    ['update', 'PATCH', ':key', undefined],
    ['reset', 'DELETE', ':key', undefined],
    ['test', 'POST', ':key/test', 200],
  ])('%s -> %s %s (éxito %s)', (handler, method, path, status) => {
    expect(routeOf(AiAgentsController, handler)).toEqual({ method, path, status });
  });

  it('delega en los casos de uso con el usuario autenticado y la clave del agente', async () => {
    const { controller, useCases } = makeController();

    await controller.list('admin-1');
    expect(useCases.list.execute).toHaveBeenCalledWith({ requestingUserId: 'admin-1' });

    await controller.update('admin-1', 'GAME_PLAYER', {
      instructions: null,
      providerId: 'p1',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(useCases.update.execute).toHaveBeenCalledWith({
      requestingUserId: 'admin-1',
      key: 'GAME_PLAYER',
      instructions: null,
      providerId: 'p1',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });

    await controller.reset('admin-1', 'GAME_PLAYER');
    expect(useCases.reset.execute).toHaveBeenCalledWith({ requestingUserId: 'admin-1', key: 'GAME_PLAYER' });

    await controller.test('admin-1', 'GAME_CONFIGURATOR');
    expect(useCases.test.execute).toHaveBeenCalledWith({ requestingUserId: 'admin-1', key: 'GAME_CONFIGURATOR' });
  });

  describe('validación del cuerpo de PATCH :key', () => {
    it('acepta texto, texto vacío ("sin instrucciones") y null ("texto de fábrica")', async () => {
      for (const instructions of ['Sé breve.', '', null]) {
        await expect(validateBody(UpdateAiAgentDto, { instructions })).resolves.toMatchObject({ instructions });
      }
    });

    it('rechaza instrucciones de más de 4000 caracteres, ausentes o que no son texto', async () => {
      await expect(validateBody(UpdateAiAgentDto, { instructions: 'x'.repeat(4_001) })).rejects.toThrow(BadRequestException);
      await expect(validateBody(UpdateAiAgentDto, {})).rejects.toThrow(BadRequestException);
      await expect(validateBody(UpdateAiAgentDto, { instructions: 42 })).rejects.toThrow(BadRequestException);
    });

    it('valida los demás campos y rechaza propiedades desconocidas', async () => {
      await expect(validateBody(UpdateAiAgentDto, { instructions: 'x', fallbackToDefault: 'si' })).rejects.toThrow(BadRequestException);
      await expect(validateBody(UpdateAiAgentDto, { instructions: 'x', modelOverride: 'm'.repeat(121) })).rejects.toThrow(BadRequestException);
      await expect(validateBody(UpdateAiAgentDto, { instructions: 'x', expectedUpdatedAt: 'ayer' })).rejects.toThrow(BadRequestException);
      await expect(validateBody(UpdateAiAgentDto, { instructions: 'x', extra: 1 })).rejects.toThrow(BadRequestException);
      await expect(
        validateBody(UpdateAiAgentDto, { instructions: 'x', expectedUpdatedAt: null, providerId: null, modelOverride: null }),
      ).resolves.toBeDefined();
    });
  });
});
