import { Inject, Injectable, Optional } from '@nestjs/common';
import { AI_AVAILABILITY, type AiAvailability } from '../../domain/ports/ai-availability.port.js';

/**
 * Único punto que decide si un usuario puede gastar IA (issue #50). Hoy
 * todos pueden; cuando la IA pase a ser de pago (planes o créditos), basta
 * con implementar aquí la regla — y llevar el conteo de uso — sin tocar los
 * casos de uso que la consumen. Se consulta SIEMPRE en el servidor antes de
 * llamar al modelo, nunca solo en la interfaz.
 */
@Injectable()
export class AiUsagePolicy {
  constructor(@Optional() @Inject(AI_AVAILABILITY) private readonly availability?: AiAvailability) {}

  /** Si la plataforma tiene algún proveedor de IA utilizable (distinto de "puede gastarla este usuario"). */
  async isConfigured(): Promise<boolean> {
    return this.availability ? this.availability.isConfigured() : true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async canUseAi(_userId: string): Promise<boolean> {
    return true;
  }
}
