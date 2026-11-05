import { Body, Controller, Get, Header, Inject, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  TOURNAMENT_AGREEMENT_HASH,
  TOURNAMENT_AGREEMENT_SECTIONS,
  TOURNAMENT_AGREEMENT_TEXT,
  TOURNAMENT_AGREEMENT_VERSION,
} from '../../../domain/legal/tournament-confidentiality-agreement.js';
import {
  TOURNAMENT_CONFIDENTIALITY_SIGNATURE_REPOSITORY,
  type TournamentConfidentialitySignatureRepository,
} from '../../../domain/ports/tournament-confidentiality-signature.repository.port.js';
import { SignTournamentConfidentialityUseCase } from '../../../application/use-cases/sign-tournament-confidentiality.use-case.js';
import {
  ListTournamentSignaturesUseCase,
  signaturesToCsv,
} from '../../../application/use-cases/list-tournament-signatures.use-case.js';
import { CurrentUserId } from '../decorators/current-user-id.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { SignTournamentConfidentialityDto } from '../dtos/sign-tournament-confidentiality.dto.js';

/**
 * Acuerdo de confidencialidad y autorización de datos del torneo (issue #173).
 * El texto es público (cualquiera puede leerlo antes de firmar); firmar y consultar exigen sesión.
 */
@Controller('tournament-agreement')
export class TournamentAgreementController {
  constructor(
    private readonly signUseCase: SignTournamentConfidentialityUseCase,
    private readonly listUseCase: ListTournamentSignaturesUseCase,
    @Inject(TOURNAMENT_CONFIDENTIALITY_SIGNATURE_REPOSITORY)
    private readonly signatures: TournamentConfidentialitySignatureRepository,
  ) {}

  @Get()
  current() {
    return {
      version: TOURNAMENT_AGREEMENT_VERSION,
      hash: TOURNAMENT_AGREEMENT_HASH,
      sections: TOURNAMENT_AGREEMENT_SECTIONS,
      text: TOURNAMENT_AGREEMENT_TEXT,
    };
  }

  @Get(':code/status')
  @UseGuards(JwtAuthGuard)
  async status(@CurrentUserId() userId: string, @Param('code') code: string) {
    const found = await this.signatures.findValid(userId, code.trim().toUpperCase(), TOURNAMENT_AGREEMENT_VERSION);
    return { signed: found !== null, version: TOURNAMENT_AGREEMENT_VERSION, signedAt: found?.signedAt ?? null };
  }

  @Post(':code/sign')
  @UseGuards(JwtAuthGuard)
  async sign(
    @CurrentUserId() userId: string,
    @Param('code') code: string,
    @Body() dto: SignTournamentConfidentialityDto,
    @Req() req: Request,
  ) {
    return this.signUseCase.execute({
      userId,
      tournamentCode: code,
      fullName: dto.fullName,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      contactEmail: dto.contactEmail,
      birthDate: new Date(`${dto.birthDate.slice(0, 10)}T00:00:00Z`),
      acceptedConfidentiality: dto.acceptedConfidentiality,
      acceptedDataProcessing: dto.acceptedDataProcessing,
      signatureName: dto.signatureName,
      textVersion: dto.textVersion,
      textHash: dto.textHash,
      guardian: dto.guardian,
      // Evidencia mínima declarada en el texto del acuerdo.
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  /** Respaldo para el moderador del torneo o un ADMIN; `?format=csv` lo descarga como CSV. */
  @Get(':code/signatures')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  async list(
    @CurrentUserId() requestingUserId: string,
    @Param('code') code: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rows = await this.listUseCase.execute({ requestingUserId, tournamentCode: code });
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="firmas-${code.replace(/[^A-Za-z0-9]/g, '')}.csv"`);
      return signaturesToCsv(rows);
    }
    return rows;
  }
}
