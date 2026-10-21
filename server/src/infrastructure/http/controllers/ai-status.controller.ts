import { Controller, Get, UseGuards } from '@nestjs/common';
import { AiUsagePolicy } from '../../../application/services/ai-usage-policy.service.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';

/**
 * Estado público (para cualquier usuario autenticado) de la IA: lo único que
 * necesita la interfaz para avisar ANTES de ofrecer una función de IA si la
 * plataforma todavía no tiene un proveedor configurado. No expone nada del
 * proveedor (ni nombre, ni modelo, ni key).
 */
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiStatusController {
  constructor(private readonly aiUsagePolicy: AiUsagePolicy) {}

  @Get('status')
  async status() {
    return { configured: await this.aiUsagePolicy.isConfigured() };
  }
}
