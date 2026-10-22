import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ListAiAuditLogsUseCase } from '../../../application/use-cases/list-ai-audit-logs.use-case.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { Roles } from '../decorators/roles.decorator.js';
import { CurrentUserId } from '../decorators/current-user-id.decorator.js';
import { ListAiProviderAttemptsQueryDto } from '../dtos/list-ai-provider-attempts-query.dto.js';

/** Registro de cambios del panel de IA (quién cambió qué). Solo ADMIN. */
@Controller('admin/ai-audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AiAuditController {
  constructor(private readonly listUseCase: ListAiAuditLogsUseCase) {}

  @Get()
  list(@CurrentUserId() requestingUserId: string, @Query() query: ListAiProviderAttemptsQueryDto) {
    return this.listUseCase.execute({ requestingUserId, page: query.page, pageSize: query.pageSize });
  }
}
