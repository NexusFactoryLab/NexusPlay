import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ListAiAgentsUseCase } from '../../../application/use-cases/list-ai-agents.use-case.js';
import { UpdateAiAgentUseCase } from '../../../application/use-cases/update-ai-agent.use-case.js';
import { ResetAiAgentUseCase } from '../../../application/use-cases/reset-ai-agent.use-case.js';
import { TestAiAgentUseCase } from '../../../application/use-cases/test-ai-agent.use-case.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { Roles } from '../decorators/roles.decorator.js';
import { CurrentUserId } from '../decorators/current-user-id.decorator.js';
import { UpdateAiAgentDto } from '../dtos/ai-provider-config.dto.js';

/**
 * Agentes de IA de la plataforma (Jugador, Configurador): su enfoque y con
 * qué proveedor/modelo trabaja cada uno. Solo ADMIN, revalidado en cada caso
 * de uso. Los agentes son un catálogo fijo: no se crean ni se borran, solo
 * se configuran o se restauran a fábrica.
 */
@Controller('admin/ai-agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AiAgentsController {
  constructor(
    private readonly listUseCase: ListAiAgentsUseCase,
    private readonly updateUseCase: UpdateAiAgentUseCase,
    private readonly resetUseCase: ResetAiAgentUseCase,
    private readonly testUseCase: TestAiAgentUseCase,
  ) {}

  @Get()
  list(@CurrentUserId() requestingUserId: string) {
    return this.listUseCase.execute({ requestingUserId });
  }

  @Patch(':key')
  update(@CurrentUserId() requestingUserId: string, @Param('key') key: string, @Body() dto: UpdateAiAgentDto) {
    return this.updateUseCase.execute({ requestingUserId, key, ...dto });
  }

  /** Restaura el agente a su configuración de fábrica. */
  @Delete(':key')
  reset(@CurrentUserId() requestingUserId: string, @Param('key') key: string) {
    return this.resetUseCase.execute({ requestingUserId, key });
  }

  @Post(':key/test')
  @HttpCode(200)
  test(@CurrentUserId() requestingUserId: string, @Param('key') key: string) {
    return this.testUseCase.execute({ requestingUserId, key });
  }
}
