import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AiConfigConflictError } from '../../../application/errors/application.errors.js';
import { AiProviderConfigsController } from './ai-provider-configs.controller.js';
import {
  CreateAiProviderConfigDto,
  ListAiProviderModelsDto,
  ReorderAiProviderConfigsDto,
  SetAiProviderEnabledDto,
  UpdateAiProviderConfigDto,
} from '../dtos/ai-provider-config.dto.js';
import {
  JwtAuthGuard,
  controllerPath,
  filterResponse,
  guardsOf,
  rolesOf,
  routeOf,
  runRolesGuard,
  validateBody,
} from './testing/controller-meta.helper-spec.js';
import { RolesGuard } from '../guards/roles.guard.js';

function makeController() {
  const useCases = {
    list: { execute: vi.fn().mockResolvedValue({ items: [] }) },
    create: { execute: vi.fn().mockResolvedValue({ id: 'p1' }) },
    update: { execute: vi.fn().mockResolvedValue({ id: 'p1' }) },
    setEnabled: { execute: vi.fn().mockResolvedValue({ id: 'p1' }) },
    reencrypt: { execute: vi.fn().mockResolvedValue({ migrated: 1 }) },
    remove: { execute: vi.fn().mockResolvedValue(undefined) },
    reorder: { execute: vi.fn().mockResolvedValue([]) },
    test: { execute: vi.fn().mockResolvedValue({ ok: true }) },
    models: { execute: vi.fn().mockResolvedValue({ models: ['m'] }) },
  };
  const controller = new AiProviderConfigsController(
    useCases.list as never,
    useCases.create as never,
    useCases.update as never,
    useCases.setEnabled as never,
    useCases.reencrypt as never,
    useCases.remove as never,
    useCases.reorder as never,
    useCases.test as never,
    useCases.models as never,
  );
  return { controller, useCases };
}

const VALID_BODY = {
  name: 'Groq',
  kind: 'openai-compatible',
  baseUrl: 'https://api.groq.com/openai/v1',
  textModel: 'modelo',
};

describe('AiProviderConfigsController', () => {
  describe('acceso', () => {
    it('exige JWT y rol ADMIN en todo el controlador, bajo /admin/ai-providers', () => {
      expect(controllerPath(AiProviderConfigsController)).toBe('admin/ai-providers');
      expect(guardsOf(AiProviderConfigsController)).toEqual([JwtAuthGuard, RolesGuard]);
      expect(rolesOf(AiProviderConfigsController)).toEqual(['ADMIN']);
    });

    it('el RolesGuard real deja pasar a un ADMIN y rechaza a docentes, estudiantes y desconocidos', async () => {
      await expect(runRolesGuard(AiProviderConfigsController, 'list', 'ADMIN')).resolves.toBe(true);
      for (const role of ['TEACHER', 'STUDENT', null]) {
        await expect(runRolesGuard(AiProviderConfigsController, 'list', role)).rejects.toThrow(ForbiddenException);
      }
    });
  });

  describe('rutas y códigos HTTP', () => {
    it.each([
      ['list', 'GET', '/', undefined],
      ['create', 'POST', '/', undefined],
      ['listModels', 'POST', 'models', 200],
      ['reencrypt', 'POST', 'reencrypt', 200],
      ['reorder', 'PUT', 'order', undefined],
      ['update', 'PATCH', ':id', undefined],
      ['setEnabled', 'PATCH', ':id/enabled', undefined],
      ['remove', 'DELETE', ':id', 204],
      ['test', 'POST', ':id/test', 200],
    ])('%s -> %s %s (éxito %s)', (handler, method, path, status) => {
      expect(routeOf(AiProviderConfigsController, handler)).toEqual({ method, path, status });
    });
  });

  describe('delegación al caso de uso con el usuario autenticado', () => {
    it('list, create, update, setEnabled, reorder, test, models, reencrypt y remove', async () => {
      const { controller, useCases } = makeController();

      await controller.list('admin-1');
      expect(useCases.list.execute).toHaveBeenCalledWith({ requestingUserId: 'admin-1' });

      await controller.create('admin-1', { ...VALID_BODY, apiKey: 'k-12345678' } as CreateAiProviderConfigDto);
      expect(useCases.create.execute).toHaveBeenCalledWith(expect.objectContaining({ requestingUserId: 'admin-1', apiKey: 'k-12345678' }));

      await controller.update('admin-1', 'p1', { ...VALID_BODY, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' } as UpdateAiProviderConfigDto);
      expect(useCases.update.execute).toHaveBeenCalledWith(
        expect.objectContaining({ requestingUserId: 'admin-1', id: 'p1', expectedUpdatedAt: '2026-01-01T00:00:00.000Z' }),
      );

      await controller.setEnabled('admin-1', 'p1', { enabled: false, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' });
      expect(useCases.setEnabled.execute).toHaveBeenCalledWith({
        requestingUserId: 'admin-1',
        id: 'p1',
        enabled: false,
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      });

      await controller.reorder('admin-1', { ids: ['b', 'a'] });
      expect(useCases.reorder.execute).toHaveBeenCalledWith({ requestingUserId: 'admin-1', orderedIds: ['b', 'a'] });

      await controller.test('admin-1', 'p1');
      expect(useCases.test.execute).toHaveBeenCalledWith({ requestingUserId: 'admin-1', id: 'p1' });

      await controller.listModels('admin-1', { kind: 'gemini', apiKey: 'k-12345678' });
      expect(useCases.models.execute).toHaveBeenCalledWith({ requestingUserId: 'admin-1', kind: 'gemini', apiKey: 'k-12345678' });

      await controller.reencrypt('admin-1');
      expect(useCases.reencrypt.execute).toHaveBeenCalledWith({ requestingUserId: 'admin-1' });

      await expect(controller.remove('admin-1', 'p1')).resolves.toBeUndefined();
      expect(useCases.remove.execute).toHaveBeenCalledWith({ requestingUserId: 'admin-1', id: 'p1' });
    });

    it('un error del caso de uso se propaga al filtro: el conflicto de edición es 409', async () => {
      const { controller, useCases } = makeController();
      useCases.setEnabled.execute.mockRejectedValue(new AiConfigConflictError('el proveedor "Groq"'));

      const error = await controller.setEnabled('admin-1', 'p1', { enabled: true }).catch((caught: Error) => caught);
      const { status, body } = filterResponse(error as Error);

      expect(status).toBe(409);
      expect(body.message).toMatch(/Otro administrador modificó/);
    });
  });

  describe('validación del cuerpo', () => {
    it('crear: acepta un cuerpo completo', async () => {
      await expect(validateBody(CreateAiProviderConfigDto, { ...VALID_BODY, apiKey: 'k-12345678' })).resolves.toMatchObject({
        name: 'Groq',
      });
    });

    it.each([
      ['sin nombre', { kind: 'gemini', textModel: 'm', apiKey: 'k' }],
      ['sin apiKey', VALID_BODY],
      ['nombre de más de 60 caracteres', { ...VALID_BODY, apiKey: 'k', name: 'x'.repeat(61) }],
      ['maxRpm fuera de rango', { ...VALID_BODY, apiKey: 'k', maxRpm: 0 }],
      ['maxRpm no entero', { ...VALID_BODY, apiKey: 'k', maxRpm: 2.5 }],
      ['enabled que no es booleano', { ...VALID_BODY, apiKey: 'k', enabled: 'si' }],
      ['propiedad desconocida', { ...VALID_BODY, apiKey: 'k', admin: true }],
    ])('crear: rechaza %s con 400', async (_label, body) => {
      await expect(validateBody(CreateAiProviderConfigDto, body)).rejects.toThrow(BadRequestException);
    });

    it('editar: expectedUpdatedAt debe ser una fecha ISO', async () => {
      await expect(
        validateBody(UpdateAiProviderConfigDto, { ...VALID_BODY, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' }),
      ).resolves.toBeDefined();
      await expect(validateBody(UpdateAiProviderConfigDto, { ...VALID_BODY, expectedUpdatedAt: 'ayer' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('interruptor: enabled es obligatorio y booleano', async () => {
      await expect(validateBody(SetAiProviderEnabledDto, { enabled: true })).resolves.toBeDefined();
      await expect(validateBody(SetAiProviderEnabledDto, {})).rejects.toThrow(BadRequestException);
      await expect(validateBody(SetAiProviderEnabledDto, { enabled: 'true' })).rejects.toThrow(BadRequestException);
      // El interruptor NO acepta otros campos: solo cambia ese.
      await expect(validateBody(SetAiProviderEnabledDto, { enabled: true, textModel: 'x' })).rejects.toThrow(BadRequestException);
    });

    it('reordenar: ids es una lista no vacía de textos', async () => {
      await expect(validateBody(ReorderAiProviderConfigsDto, { ids: ['a'] })).resolves.toBeDefined();
      await expect(validateBody(ReorderAiProviderConfigsDto, { ids: [] })).rejects.toThrow(BadRequestException);
      await expect(validateBody(ReorderAiProviderConfigsDto, { ids: [1] })).rejects.toThrow(BadRequestException);
      await expect(validateBody(ReorderAiProviderConfigsDto, {})).rejects.toThrow(BadRequestException);
    });

    it('consulta de modelos: kind obligatorio', async () => {
      await expect(validateBody(ListAiProviderModelsDto, { kind: 'gemini' })).resolves.toBeDefined();
      await expect(validateBody(ListAiProviderModelsDto, {})).rejects.toThrow(BadRequestException);
    });
  });
});
