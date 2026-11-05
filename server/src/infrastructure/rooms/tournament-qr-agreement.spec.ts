import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'socket.io';
import type { GameRepository } from '../../domain/ports/game.repository.port.js';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import type { AnalyticsTrackerService } from '../../application/services/analytics-tracker.service.js';
import type { TournamentState } from '../../domain/ports/tournament-store.port.js';
import { TOURNAMENT_AGREEMENT_HASH, TOURNAMENT_AGREEMENT_VERSION } from '../../domain/legal/tournament-confidentiality-agreement.js';
import { TournamentConfidentialitySignature } from '../../domain/entities/tournament-confidentiality-signature.entity.js';
import { InMemoryTournamentSignatureRepository } from '../../application/use-cases/testing/tournament-signature-fakes.helper-spec.js';
import { RoomsGateway } from './rooms.gateway.js';
import { InMemoryRoomStore } from './in-memory-room.store.js';
import { InMemoryTournamentStore } from './in-memory-tournament.store.js';
import { InMemoryDominoRoomStore } from './in-memory-domino-room.store.js';
import { InMemorySnakesLaddersRoomStore } from './in-memory-snakes-ladders-room.store.js';

type Client = Parameters<RoomsGateway['handleQuestion']>[0];
const client = (userId: string) =>
  ({ id: `s-${userId}`, data: { userId, displayName: userId }, join: vi.fn(), leave: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }) as unknown as Client;

function setup() {
  const tournaments = new InMemoryTournamentStore();
  const signatures = new InMemoryTournamentSignatureRepository();
  const gateway = new RoomsGateway(
    new JwtService(),
    {} as unknown as GameRepository,
    {} as unknown as UserRepository,
    new InMemoryRoomStore(),
    tournaments,
    new InMemoryDominoRoomStore(),
    new InMemorySnakesLaddersRoomStore(),
    { track: async () => {} } as unknown as AnalyticsTrackerService,
    undefined,
    undefined,
    undefined,
    signatures,
  );
  gateway.server = { to: () => ({ emit: () => {} }) } as unknown as Server;
  tournaments.create({
    code: 'QR0001',
    gameId: 'g',
    gameTitle: 'T',
    maxParticipants: 8,
    maxAccusationCount: 3,
    turnDurationSeconds: 30,
    phase: 'WAITING',
    participants: [],
    creatorUserId: 'mod',
    totalRounds: 3,
    currentRound: 0,
    matches: [],
    winnerUserId: null,
    createdAt: 0,
  } as TournamentState);
  return { gateway, tournaments, signatures };
}

async function sign(signatures: InMemoryTournamentSignatureRepository, userId: string, version = TOURNAMENT_AGREEMENT_VERSION) {
  await signatures.append(
    TournamentConfidentialitySignature.record({
      id: userId, userId, tournamentCode: 'QR0001', tournamentCreatorUserId: 'mod', fullName: 'Ana Pérez', documentType: null,
      documentNumber: null, contactEmail: null, birthDate: new Date('2000-01-01'), isMinor: false, guardianFullName: null,
      guardianDocumentType: null, guardianDocumentNumber: null, guardianRelationship: null, acceptedConfidentiality: true,
      acceptedDataProcessing: true, guardianAccepted: null, signatureName: 'Ana Pérez', textVersion: version,
      textHash: TOURNAMENT_AGREEMENT_HASH, ipAddress: null, userAgent: null, signedAt: new Date(),
    }),
  );
}

const joined = (t: TournamentState, id: string) => t.participants.some((p) => p.userId === id);

it('por QR sin firma no entra y recibe signature-required', async () => {
  const { gateway, tournaments } = setup();
  const ana = client('ana');
  await gateway.handleTournamentJoin(ana, { code: 'qr0001', via: 'qr' });
  expect(joined(tournaments.get('QR0001')!, 'ana')).toBe(false);
  expect(ana.emit).toHaveBeenCalledWith('tournament:signature-required', expect.objectContaining({ code: 'QR0001' }));
});

it('por QR con la firma vigente entra', async () => {
  const { gateway, tournaments, signatures } = setup();
  await sign(signatures, 'ana');
  await gateway.handleTournamentJoin(client('ana'), { code: 'QR0001', via: 'qr' });
  expect(joined(tournaments.get('QR0001')!, 'ana')).toBe(true);
});

it('una firma de otra versión del texto no vale', async () => {
  const { gateway, tournaments, signatures } = setup();
  await sign(signatures, 'ana', 'version-vieja');
  await gateway.handleTournamentJoin(client('ana'), { code: 'QR0001', via: 'qr' });
  expect(joined(tournaments.get('QR0001')!, 'ana')).toBe(false);
});

it('con el código tecleado a mano no se pide firma', () => {
  const { gateway, tournaments } = setup();
  gateway.handleTournamentJoin(client('ana'), { code: 'QR0001' });
  expect(joined(tournaments.get('QR0001')!, 'ana')).toBe(true);
});

it('el moderador no pasa por la firma aunque use el enlace con origen=qr', async () => {
  const { gateway } = setup();
  const mod = client('mod');
  await gateway.handleTournamentJoin(mod, { code: 'QR0001', via: 'qr' });
  expect(mod.emit).not.toHaveBeenCalledWith('tournament:signature-required', expect.anything());
  expect(mod.join).toHaveBeenCalled();
});
