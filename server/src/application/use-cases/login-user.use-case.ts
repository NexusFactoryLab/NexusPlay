import { Inject, Injectable } from '@nestjs/common';
import { Email } from '../../domain/value-objects/email.vo.js';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.port.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../domain/ports/password-hasher.port.js';
import {
  InvalidCredentialsError,
  UserInactiveError,
} from '../errors/application.errors.js';
import {
  USER_CONSENT_REPOSITORY,
  type UserConsentRepository,
} from '../../domain/ports/user-consent.repository.port.js';
import { ConsentType } from '../../domain/entities/user-consent.entity.js';
import { toCurrentUserResponseDto, type CurrentUserResponseDto } from '../dtos/user-response.dto.js';
import type { UseCase } from '../ports/use-case.port.js';
import { TokenPairIssuer } from '../services/token-pair-issuer.service.js';
import { OrganizationAutoJoinService } from '../services/organization-auto-join.service.js';

export interface LoginUserInput {
  email: string;
  plainPassword: string;
}

export interface LoginUserOutput {
  user: CurrentUserResponseDto;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class LoginUserUseCase implements UseCase<LoginUserInput, LoginUserOutput> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(USER_CONSENT_REPOSITORY) private readonly consentRepository: UserConsentRepository,
    private readonly tokenPairIssuer: TokenPairIssuer,
    private readonly organizationAutoJoin: OrganizationAutoJoinService,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserOutput> {
    const email = Email.create(input.email);
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    // Usuario con cuenta solo por proveedor externo (ej. Google): no tiene
    // hash contra el cual comparar, así que el login con password falla igual
    // que credenciales inválidas, sin llegar a bcrypt.compare.
    if (!user.password.hasPassword()) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.compare(
      input.plainPassword,
      user.password.getHashedValue(),
    );

    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new UserInactiveError();
    }

    user.registerLogin();
    await this.userRepository.save(user);

    // También en login, no solo en signup: cubre a los usuarios que ya existían
    // cuando alguien reclamó su dominio después de su registro.
    await this.organizationAutoJoin.joinByEmailDomain(user.id, user.email);

    const { accessToken, refreshToken } = await this.tokenPairIssuer.issueFor(user);

    const rankingConsent = await this.consentRepository.findLatest(user.id, ConsentType.PUBLIC_RANKING);

    return { user: toCurrentUserResponseDto(user, rankingConsent), accessToken, refreshToken };
  }
}
