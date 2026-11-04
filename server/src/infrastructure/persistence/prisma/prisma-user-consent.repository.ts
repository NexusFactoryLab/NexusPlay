import { Injectable } from '@nestjs/common';
import type { UserConsentRepository } from '../../../domain/ports/user-consent.repository.port.js';
import { UserConsent, type ConsentType } from '../../../domain/entities/user-consent.entity.js';
import { PrismaService } from './prisma.service.js';

/** Historial de consentimientos en `user_consents`: solo lee la última fila y anexa. */
@Injectable()
export class PrismaUserConsentRepository implements UserConsentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLatest(userId: string, type: ConsentType): Promise<UserConsent | null> {
    // Recorre el índice (user_id, type, created_at DESC) y se detiene en la primera fila.
    const record = await this.prisma.userConsentModel.findFirst({
      where: { userId, type },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, type: true, granted: true, createdAt: true },
    });
    return record ? UserConsent.fromPersistence(record) : null;
  }

  async append(consent: UserConsent): Promise<void> {
    await this.prisma.userConsentModel.create({
      data: {
        userId: consent.userId,
        type: consent.type,
        granted: consent.granted,
        createdAt: consent.createdAt,
      },
    });
  }
}
