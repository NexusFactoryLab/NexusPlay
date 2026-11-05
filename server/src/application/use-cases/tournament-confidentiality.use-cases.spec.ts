import { describe, expect, it, vi } from 'vitest';
import type { TournamentStore, TournamentState } from '../../domain/ports/tournament-store.port.js';
import type { UserRepository } from '../../domain/ports/user.repository.port.js';
import {
  TOURNAMENT_AGREEMENT_HASH,
  TOURNAMENT_AGREEMENT_TEXT,
  TOURNAMENT_AGREEMENT_VERSION,
  ageInYears,
  hashAgreementText,
} from '../../domain/legal/tournament-confidentiality-agreement.js';
import { InvalidTournamentSignatureError } from '../../domain/errors/user.errors.js';
import { ForbiddenActionError } from '../../domain/errors/authorization.errors.js';
import { TournamentNotFoundError } from '../errors/application.errors.js';
import { InMemoryTournamentSignatureRepository } from './testing/tournament-signature-fakes.helper-spec.js';
import {
  SignTournamentConfidentialityUseCase,
  type SignTournamentConfidentialityInput,
} from './sign-tournament-confidentiality.use-case.js';
import { ListTournamentSignaturesUseCase, signaturesToCsv } from './list-tournament-signatures.use-case.js';

const NOW = new Date('2026-11-05T15:00:00Z');

function setup(open = true) {
  const tournament = { code: 'ABC234', creatorUserId: 'mod-1' } as TournamentState;
  const store = { get: vi.fn((code: string) => (open && code === 'ABC234' ? tournament : undefined)) } as unknown as TournamentStore;
  const repo = new InMemoryTournamentSignatureRepository();
  return { store, repo, sign: new SignTournamentConfidentialityUseCase(store, repo) };
}

function adultInput(overrides: Partial<SignTournamentConfidentialityInput> = {}): SignTournamentConfidentialityInput {
  return {
    userId: 'u1',
    tournamentCode: 'abc234',
    fullName: 'Ana María Pérez',
    birthDate: new Date('2000-01-10T00:00:00Z'),
    acceptedConfidentiality: true,
    acceptedDataProcessing: true,
    signatureName: 'ana maria perez',
    textVersion: TOURNAMENT_AGREEMENT_VERSION,
    textHash: TOURNAMENT_AGREEMENT_HASH,
    ipAddress: '10.0.0.1',
    userAgent: 'vitest',
    now: NOW,
    ...overrides,
  };
}

const guardian = { fullName: 'Luis Pérez', documentType: 'CC', documentNumber: '123456', relationship: 'Padre', accepted: true };

describe('texto del acuerdo', () => {
  it('el hash corresponde al texto y cambia si el texto cambia', () => {
    expect(hashAgreementText(TOURNAMENT_AGREEMENT_TEXT)).toBe(TOURNAMENT_AGREEMENT_HASH);
    expect(hashAgreementText(TOURNAMENT_AGREEMENT_TEXT + ' ')).not.toBe(TOURNAMENT_AGREEMENT_HASH);
    expect(TOURNAMENT_AGREEMENT_HASH).toMatch(/^[0-9a-f]{64}$/);
  });

  it('calcula la edad cumplida', () => {
    expect(ageInYears(new Date('2008-11-06T00:00:00Z'), NOW)).toBe(17);
    expect(ageInYears(new Date('2008-11-05T00:00:00Z'), NOW)).toBe(18);
  });
});

describe('SignTournamentConfidentialityUseCase', () => {
  it('registra la firma de un adulto con fecha, versión, hash y evidencia', async () => {
    const { sign, repo } = setup();
    const out = await sign.execute(adultInput());
    expect(out).toEqual({ signedAt: NOW, textVersion: TOURNAMENT_AGREEMENT_VERSION, alreadySigned: false });
    const row = repo.rows[0].toProps();
    expect(row).toMatchObject({
      userId: 'u1',
      tournamentCode: 'ABC234',
      tournamentCreatorUserId: 'mod-1',
      isMinor: false,
      textHash: TOURNAMENT_AGREEMENT_HASH,
      signedAt: NOW,
      ipAddress: '10.0.0.1',
      guardianAccepted: null,
    });
  });

  it('es idempotente para la misma versión', async () => {
    const { sign, repo } = setup();
    await sign.execute(adultInput());
    const again = await sign.execute(adultInput());
    expect(again.alreadySigned).toBe(true);
    expect(repo.rows).toHaveLength(1);
  });

  it('rechaza si el torneo no existe', async () => {
    const { sign } = setup(false);
    await expect(sign.execute(adultInput())).rejects.toBeInstanceOf(TournamentNotFoundError);
  });

  it.each([
    ['versión desactualizada', { textVersion: 'vieja' }],
    ['hash distinto', { textHash: 'x'.repeat(64) }],
    ['sin aceptar confidencialidad', { acceptedConfidentiality: false }],
    ['sin autorizar datos', { acceptedDataProcessing: false }],
    ['firma que no coincide con el nombre', { signatureName: 'Otra Persona' }],
    ['nombre incompleto', { fullName: 'Ana', signatureName: 'Ana' }],
    ['fecha de nacimiento futura', { birthDate: new Date('2030-01-01T00:00:00Z') }],
    ['documento sin tipo', { documentNumber: '999' }],
    ['correo inválido', { contactEmail: 'no-es-correo' }],
  ] as [string, Partial<SignTournamentConfidentialityInput>][])('rechaza: %s', async (_name, override) => {
    const { sign, repo } = setup();
    await expect(sign.execute(adultInput(override))).rejects.toBeInstanceOf(InvalidTournamentSignatureError);
    expect(repo.rows).toHaveLength(0);
  });

  it('menor de 18 sin acudiente no puede firmar', async () => {
    const { sign, repo } = setup();
    const minor = adultInput({ birthDate: new Date('2012-03-01T00:00:00Z') });
    await expect(sign.execute(minor)).rejects.toBeInstanceOf(InvalidTournamentSignatureError);
    await expect(sign.execute({ ...minor, guardian: { ...guardian, relationship: '' } })).rejects.toBeInstanceOf(
      InvalidTournamentSignatureError,
    );
    await expect(sign.execute({ ...minor, guardian: { ...guardian, accepted: false } })).rejects.toBeInstanceOf(
      InvalidTournamentSignatureError,
    );
    expect(repo.rows).toHaveLength(0);
  });

  it('menor con acudiente completo y aceptación queda registrado como menor', async () => {
    const { sign, repo } = setup();
    await sign.execute(adultInput({ birthDate: new Date('2012-03-01T00:00:00Z'), guardian }));
    expect(repo.rows[0].toProps()).toMatchObject({
      isMinor: true,
      guardianFullName: 'Luis Pérez',
      guardianRelationship: 'Padre',
      guardianAccepted: true,
    });
  });
});

describe('ListTournamentSignaturesUseCase', () => {
  async function listSetup() {
    const { store, repo, sign } = setup();
    await sign.execute(adultInput({ documentType: 'CC', documentNumber: '1020304050' }));
    const users = {
      findById: vi.fn(async (id: string) => (id ? ({ isAdmin: () => id === 'admin-1' } as never) : null)),
    } as unknown as UserRepository;
    return { list: new ListTournamentSignaturesUseCase(store, users, repo), repo };
  }

  it('el moderador ve las firmas con el documento enmascarado y sin evidencia técnica', async () => {
    const { list } = await listSetup();
    const rows = await list.execute({ requestingUserId: 'mod-1', tournamentCode: 'abc234' });
    expect(rows).toHaveLength(1);
    expect(rows[0].document).toBe('CC ***4050');
    expect(rows[0]).not.toHaveProperty('ipAddress');
    expect(rows[0].signedAt).toBe(NOW.toISOString());
  });

  it('el admin ve la evidencia completa', async () => {
    const { list } = await listSetup();
    const rows = await list.execute({ requestingUserId: 'admin-1', tournamentCode: 'ABC234' });
    expect(rows[0]).toMatchObject({ document: 'CC 1020304050', textHash: TOURNAMENT_AGREEMENT_HASH, ipAddress: '10.0.0.1' });
  });

  it('cualquier otra persona recibe Forbidden', async () => {
    const { list } = await listSetup();
    await expect(list.execute({ requestingUserId: 'u9', tournamentCode: 'ABC234' })).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
  });

  it('el CSV escapa comillas y neutraliza fórmulas', () => {
    const csv = signaturesToCsv([
      { userId: 'u', fullName: '=cmd|"x"', document: null, isMinor: false, guardianFullName: null, guardianRelationship: null, signedAt: 'x', textVersion: 'v' },
    ]);
    expect(csv.split('\r\n')[1].startsWith('"\'=cmd|""x"""')).toBe(true);
  });
});
