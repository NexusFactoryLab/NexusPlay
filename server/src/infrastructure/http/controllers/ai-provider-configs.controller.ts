import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ListAiProviderConfigsUseCase } from '../../../application/use-cases/list-ai-provider-configs.use-case.js';
import { CreateAiProviderConfigUseCase } from '../../../application/use-cases/create-ai-provider-config.use-case.js';
import { UpdateAiProviderConfigUseCase } from '../../../application/use-cases/update-ai-provider-config.use-case.js';
import { DeleteAiProviderConfigUseCase } from '../../../application/use-cases/delete-ai-provider-config.use-case.js';
import { ReorderAiProviderConfigsUseCase } from '../../../application/use-cases/reorder-ai-provider-configs.use-case.js';
import { TestAiProviderConfigUseCase } from '../../../application/use-cases/test-ai-provider-config.use-case.js';
import { ListAiProviderModelsUseCase } from '../../../application/use-cases/list-ai-provider-models.use-case.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { Roles } from '../decorators/roles.decorator.js';
import { CurrentUserId } from '../decorators/current-user-id.decorator.js';
import {
  CreateAiProviderConfigDto,
  ListAiProviderModelsDto,
  ReorderAiProviderConfigsDto,
  UpdateAiProviderConfigDto,
} from '../dtos/ai-provider-config.dto.js';

/**
 * Administración de los proveedores de IA de la plataforma (API keys,
 * modelos, orden de fallback). Solo ADMIN, y cada caso de uso lo revalida
 * contra la base de datos. Ninguna respuesta incluye la API key.
 */
@Controller('admin/ai-providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AiProviderConfigsController {
  constructor(
    private readonly listUseCase: ListAiProviderConfigsUseCase,
    private readonly createUseCase: CreateAiProviderConfigUseCase,
    private readonly updateUseCase: UpdateAiProviderConfigUseCase,
    private readonly deleteUseCase: DeleteAiProviderConfigUseCase,
    private readonly reorderUseCase: ReorderAiProviderConfigsUseCase,
    private readonly testUseCase: TestAiProviderConfigUseCase,
    private readonly listModelsUseCase: ListAiProviderModelsUseCase,
  ) {}

  @Get()
  list(@CurrentUserId() requestingUserId: string) {
    return this.listUseCase.execute({ requestingUserId });
  }

  @Post()
  create(@CurrentUserId() requestingUserId: string, @Body() dto: CreateAiProviderConfigDto) {
    return this.createUseCase.execute({ requestingUserId, ...dto });
  }

  @Post('models')
  @HttpCode(200)
  listModels(@CurrentUserId() requestingUserId: string, @Body() dto: ListAiProviderModelsDto) {
    return this.listModelsUseCase.execute({ requestingUserId, ...dto });
  }

  // Antes de `:id` para que "order" no se interprete como un id.
  @Put('order')
  reorder(@CurrentUserId() requestingUserId: string, @Body() dto: ReorderAiProviderConfigsDto) {
    return this.reorderUseCase.execute({ requestingUserId, orderedIds: dto.ids });
  }

  @Patch(':id')
  update(
    @CurrentUserId() requestingUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAiProviderConfigDto,
  ) {
    return this.updateUseCase.execute({ requestingUserId, id, ...dto });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUserId() requestingUserId: string, @Param('id') id: string): Promise<void> {
    await this.deleteUseCase.execute({ requestingUserId, id });
  }

  @Post(':id/test')
  @HttpCode(200)
  test(@CurrentUserId() requestingUserId: string, @Param('id') id: string) {
    return this.testUseCase.execute({ requestingUserId, id });
  }
}
