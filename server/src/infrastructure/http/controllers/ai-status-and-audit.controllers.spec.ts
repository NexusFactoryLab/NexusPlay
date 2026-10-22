import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AiStatusController } from './ai-status.controller.js';
import { AiAuditController } from './ai-audit.controller.js';
import { ListAiProviderAttemptsQueryDto } from '../dtos/list-ai-provider-attempts-query.dto.js';
import { RolesGuard } from '../guards/roles.guard.js';
import {
  JwtAuthGuard,
  controllerPath,
  guardsOf,
  rolesOf,
  routeOf,
  runRolesGuard,
  validateQuery,
} from './testing/controller-meta.helper-spec.js';

describe('AiStatusController', () => {
  it('es para cualquier usuario autenticado (solo JWT, sin rol) bajo GET /ai/status', () => {
    expect(controllerPath(AiStatusController)).toBe('ai');
    expect(guardsOf(AiStatusController)).toEqual([JwtAuthGuard]);
    expect(rolesOf(AiStatusController)).toBeUndefined();
    expect(routeOf(AiStatusController, 'status')).toEqual({ method: 'GET', path: 'status', status: undefined });
  });

  it('responde solo { configured } y no expone nada del proveedor', async () => {
    const policy = { isConfigured: vi.fn().mockResolvedValue(true) };
    const controller = new AiStatusController(policy as never);

    const response = await controller.status();

    expect(response).toEqual({ configured: true });
    expect(Object.keys(response)).toEqual(['configured']);

    policy.isConfigured.mockResolvedValue(false);
    expect(await controller.status()).toEqual({ configured: false });
  });
});

describe('AiAuditController', () => {
  it('exige JWT y rol ADMIN bajo GET /admin/ai-audit', async () => {
    expect(controllerPath(AiAuditController)).toBe('admin/ai-audit');
    expect(guardsOf(AiAuditController)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(rolesOf(AiAuditController)).toEqual(['ADMIN']);
    expect(routeOf(AiAuditController, 'list')).toEqual({ method: 'GET', path: '/', status: undefined });

    await expect(runRolesGuard(AiAuditController, 'list', 'ADMIN')).resolves.toBe(true);
    await expect(runRolesGuard(AiAuditController, 'list', 'STUDENT')).rejects.toThrow(ForbiddenException);
  });

  it('pasa página y tamaño (convertidos a número) al caso de uso', async () => {
    const useCase = { execute: vi.fn().mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 5 }) };
    const controller = new AiAuditController(useCase as never);

    const query = await validateQuery(ListAiProviderAttemptsQueryDto, { page: '2', pageSize: '5' });
    await controller.list('admin-1', query);

    expect(useCase.execute).toHaveBeenCalledWith({ requestingUserId: 'admin-1', page: 2, pageSize: 5 });
  });

  it('rechaza una paginación inválida con 400', async () => {
    for (const query of [{ page: '0' }, { pageSize: '-1' }, { page: 'abc' }, { desconocido: '1' }]) {
      await expect(validateQuery(ListAiProviderAttemptsQueryDto, query)).rejects.toThrow(BadRequestException);
    }
  });
});
