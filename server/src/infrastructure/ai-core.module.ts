import { Module } from '@nestjs/common';
import { PrismaService } from './persistence/prisma/prisma.service.js';
import { AI_PROVIDER_ATTEMPT_REPOSITORY } from '../domain/ports/ai-provider-attempt.repository.port.js';
import { AI_PROVIDER_CONFIG_REPOSITORY } from '../domain/ports/ai-provider-config.repository.port.js';
import { AI_AGENT_CONFIG_REPOSITORY } from '../domain/ports/ai-agent-config.repository.port.js';
import { SECRET_CIPHER } from '../domain/ports/secret-cipher.port.js';
import { AI_ASSISTANT_FACTORY } from '../domain/ports/ai-assistant.factory.port.js';
import { AI_AGENT_PROBE } from '../domain/ports/ai-agent-probe.port.js';
import { AI_AVAILABILITY } from '../domain/ports/ai-availability.port.js';
import { AI_CONTENT_ASSISTANT, AI_GAME_PLAYER_ASSISTANT } from '../domain/ports/ai-content-assistant.port.js';
import { PrismaAiProviderAttemptRepository } from './persistence/prisma/ai-provider-attempt.repository.js';
import { PrismaAiProviderConfigRepository } from './persistence/prisma/ai-provider-config.repository.js';
import { PrismaAiAgentConfigRepository } from './persistence/prisma/ai-agent-config.repository.js';
import { AesGcmSecretCipher } from './security/aes-gcm-secret-cipher.adapter.js';
import { DefaultAiAssistantFactory } from './ai/ai-assistant.factory.js';
import { AiProviderChainResolver } from './ai/ai-provider-chain-resolver.js';
import { AiAgentRuntime } from './ai/ai-agent-runtime.js';
import { AgentAiContentAssistant } from './ai/agent-ai-content-assistant.js';
import { AiProviderAttemptTracker } from '../application/services/ai-provider-attempt-tracker.service.js';
import { AiProviderConfigChangeNotifier } from '../application/services/ai-provider-config-change-notifier.service.js';

/**
 * Núcleo de la IA agnóstica al proveedor, compartido por los módulos que
 * necesitan un agente: `GameModule` (agente Configurador, más el panel de
 * administración) y `RoomsModule` (agente Jugador). Cada agente recibe su
 * propio asistente por un token distinto; ninguno conoce proveedores.
 */
@Module({
  providers: [
    PrismaService,
    { provide: AI_PROVIDER_ATTEMPT_REPOSITORY, useClass: PrismaAiProviderAttemptRepository },
    { provide: AI_PROVIDER_CONFIG_REPOSITORY, useClass: PrismaAiProviderConfigRepository },
    { provide: AI_AGENT_CONFIG_REPOSITORY, useClass: PrismaAiAgentConfigRepository },
    { provide: SECRET_CIPHER, useClass: AesGcmSecretCipher },
    { provide: AI_ASSISTANT_FACTORY, useClass: DefaultAiAssistantFactory },
    AiProviderAttemptTracker,
    AiProviderConfigChangeNotifier,
    AiProviderChainResolver,
    { provide: AI_AVAILABILITY, useExisting: AiProviderChainResolver },
    AiAgentRuntime,
    { provide: AI_AGENT_PROBE, useExisting: AiAgentRuntime },
    {
      provide: AI_CONTENT_ASSISTANT,
      useFactory: (runtime: AiAgentRuntime) => new AgentAiContentAssistant('GAME_CONFIGURATOR', runtime),
      inject: [AiAgentRuntime],
    },
    {
      provide: AI_GAME_PLAYER_ASSISTANT,
      useFactory: (runtime: AiAgentRuntime) => new AgentAiContentAssistant('GAME_PLAYER', runtime),
      inject: [AiAgentRuntime],
    },
  ],
  exports: [
    AI_PROVIDER_ATTEMPT_REPOSITORY,
    AI_PROVIDER_CONFIG_REPOSITORY,
    AI_AGENT_CONFIG_REPOSITORY,
    SECRET_CIPHER,
    AI_ASSISTANT_FACTORY,
    AI_AVAILABILITY,
    AI_CONTENT_ASSISTANT,
    AI_GAME_PLAYER_ASSISTANT,
    AI_AGENT_PROBE,
    AiProviderAttemptTracker,
    AiProviderConfigChangeNotifier,
    AiAgentRuntime,
  ],
})
export class AiCoreModule {}
