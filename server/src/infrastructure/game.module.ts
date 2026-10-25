import { Module } from '@nestjs/common';
import { UserModule } from './user.module.js';
import { AiCoreModule } from './ai-core.module.js';
import { OrganizationCoreModule } from './organization-core.module.js';
import { ClassCoreModule } from './class-core.module.js';
import { GAME_REPOSITORY } from '../domain/ports/game.repository.port.js';
import { GAME_TYPE_SETTING_REPOSITORY } from '../domain/ports/game-type-setting.repository.port.js';
import { GAME_IMPORT_JOB_REPOSITORY } from '../domain/ports/game-import-job.repository.port.js';
import { TRANSACTION_RUNNER } from '../domain/ports/transaction-runner.port.js';
import { MongoService } from './persistence/mongo/mongo.service.js';
import { MongoGameRepository } from './persistence/mongo/mongo-game.repository.js';
import { PrismaGameTypeSettingRepository } from './persistence/prisma/game-type-setting.repository.js';
import { PrismaService } from './persistence/prisma/prisma.service.js';
import { MongoGameImportJobRepository } from './persistence/mongo/mongo-game-import-job.repository.js';
import { MongoSessionFactory } from './persistence/mongo/mongo-session.factory.js';
import { MemoryMatchContentValidator } from '../application/content-validators/memory-match.content-validator.js';
import { GuessWhoContentValidator } from '../application/content-validators/guess-who.content-validator.js';
import { DominoContentValidator } from '../application/content-validators/domino.content-validator.js';
import { MazeCollectorContentValidator } from '../application/content-validators/maze-collector.content-validator.js';
import { SnakesLaddersContentValidator } from '../application/content-validators/snakes-ladders.content-validator.js';
import { DualQuestContentValidator } from '../application/content-validators/dual-quest.content-validator.js';
import { DualQuestPixiContentValidator } from '../application/content-validators/dual-quest-pixi.content-validator.js';
import { TrueFalseMazeContentValidator } from '../application/content-validators/true-false-maze.content-validator.js';
import { ContentValidatorRegistry } from '../application/content-validators/content-validator.registry.js';
import { RequesterAdminResolver } from '../application/services/requester-admin-resolver.service.js';
import { GameAuthorizationService } from '../application/services/game-authorization.service.js';
import { ClassEnrollmentGameVisibilityService } from '../application/services/class-enrollment-game-visibility.service.js';
import { GameFactoryService } from '../application/services/game-factory.service.js';
import { GameImportExtractor } from '../application/etl/game-import.extractor.js';
import { CreateGameUseCase } from '../application/use-cases/create-game.use-case.js';
import { GetGameByIdUseCase } from '../application/use-cases/get-game-by-id.use-case.js';
import { GetGameBySlugUseCase } from '../application/use-cases/get-game-by-slug.use-case.js';
import { ListGamesUseCase } from '../application/use-cases/list-games.use-case.js';
import { UpdateGameUseCase } from '../application/use-cases/update-game.use-case.js';
import { PublishGameUseCase } from '../application/use-cases/publish-game.use-case.js';
import { UnpublishGameUseCase } from '../application/use-cases/unpublish-game.use-case.js';
import { SetGameFeaturedUseCase } from '../application/use-cases/set-game-featured.use-case.js';
import { SetGameTournamentEnabledUseCase } from '../application/use-cases/set-game-tournament-enabled.use-case.js';
import { DeleteGameUseCase } from '../application/use-cases/delete-game.use-case.js';
import { DonateGameToOrganizationUseCase } from '../application/use-cases/donate-game-to-organization.use-case.js';
import { ImportGamesBatchUseCase } from '../application/use-cases/import-games-batch.use-case.js';
import { ListGameTypeSettingsUseCase } from '../application/use-cases/list-game-type-settings.use-case.js';
import { ArchiveGameTypeUseCase } from '../application/use-cases/archive-game-type.use-case.js';
import { UnarchiveGameTypeUseCase } from '../application/use-cases/unarchive-game-type.use-case.js';
import { UpdateGameTypeSettingUseCase } from '../application/use-cases/update-game-type-setting.use-case.js';
import { DeterministicGameAdapter } from '../application/adaptation/deterministic-game-adapter.js';
import { AiUsagePolicy } from '../application/services/ai-usage-policy.service.js';
import { AdaptGameUseCase } from '../application/use-cases/adapt-game.use-case.js';
import { ContentImageResolver } from '../application/services/content-image-resolver.service.js';
import { GenerateGameDraftUseCase } from '../application/use-cases/generate-game-draft.use-case.js';
import { ListAiProviderAttemptsUseCase } from '../application/use-cases/list-ai-provider-attempts.use-case.js';
import { IMAGE_STORAGE } from '../domain/ports/image-storage.port.js';
import { ListAiAgentsUseCase } from '../application/use-cases/list-ai-agents.use-case.js';
import { UpdateAiAgentUseCase } from '../application/use-cases/update-ai-agent.use-case.js';
import { ResetAiAgentUseCase } from '../application/use-cases/reset-ai-agent.use-case.js';
import { TestAiAgentUseCase } from '../application/use-cases/test-ai-agent.use-case.js';
import { AiAgentsController } from './http/controllers/ai-agents.controller.js';
import { ListAiProviderConfigsUseCase } from '../application/use-cases/list-ai-provider-configs.use-case.js';
import { CreateAiProviderConfigUseCase } from '../application/use-cases/create-ai-provider-config.use-case.js';
import { ReencryptAiProviderConfigsUseCase } from '../application/use-cases/reencrypt-ai-provider-configs.use-case.js';
import { SetAiProviderEnabledUseCase } from '../application/use-cases/set-ai-provider-enabled.use-case.js';
import { UpdateAiProviderConfigUseCase } from '../application/use-cases/update-ai-provider-config.use-case.js';
import { DeleteAiProviderConfigUseCase } from '../application/use-cases/delete-ai-provider-config.use-case.js';
import { ReorderAiProviderConfigsUseCase } from '../application/use-cases/reorder-ai-provider-configs.use-case.js';
import { TestAiProviderConfigUseCase } from '../application/use-cases/test-ai-provider-config.use-case.js';
import { ListAiProviderModelsUseCase } from '../application/use-cases/list-ai-provider-models.use-case.js';
import { AI_MODEL_CATALOG } from '../domain/ports/ai-model-catalog.port.js';
import { HttpAiModelCatalog } from './ai/http-ai-model-catalog.js';
import { AiStatusController } from './http/controllers/ai-status.controller.js';
import { AiProviderConfigsController } from './http/controllers/ai-provider-configs.controller.js';
import { CloudinaryImageStorage } from './storage/cloudinary-image.storage.js';
import { CONTENT_IMAGE_FINDER } from '../domain/ports/content-image-finder.port.js';
import { WikimediaContentImageFinder } from './ai/wikimedia-content-image-finder.js';
import { FileTextExtractor } from './ai/file-text-extractor.js';
import { GameController } from './http/controllers/game.controller.js';
import { GameImportController } from './http/controllers/game-import.controller.js';
import { GameAiDraftController } from './http/controllers/game-ai-draft.controller.js';
import { GameCreationDraftController } from './http/controllers/game-creation-draft.controller.js';
import { PrismaGameCreationDraftRepository } from './persistence/prisma/game-creation-draft.repository.js';
import { GameCreationDraftService } from '../application/services/game-creation-draft.service.js';
import { GameCreationDraftExpirationJob } from './game-creation-draft-expiration.job.js';
import { GAME_CREATION_DRAFT_REPOSITORY } from '../domain/ports/game-creation-draft.repository.port.js';
import { DRAFT_ASSET_STORAGE } from '../domain/ports/draft-asset-storage.port.js';
import { GameTypeSettingController } from './http/controllers/game-type-setting.controller.js';
import { AI_AUDIT_LOG_REPOSITORY } from '../domain/ports/ai-audit-log.repository.port.js';
import { PrismaAiAuditLogRepository } from './persistence/prisma/ai-audit-log.repository.js';
import { AiAuditLogger } from '../application/services/ai-audit-logger.service.js';
import { ListAiAuditLogsUseCase } from '../application/use-cases/list-ai-audit-logs.use-case.js';
import { AiAuditController } from './http/controllers/ai-audit.controller.js';
import { AiProviderAttemptsController } from './http/controllers/ai-provider-attempts.controller.js';

@Module({
  imports: [UserModule, OrganizationCoreModule, ClassCoreModule, AiCoreModule],
  controllers: [
    GameCreationDraftController,
    GameController,
    GameImportController,
    GameAiDraftController,
    GameTypeSettingController,
    AiProviderAttemptsController,
    AiAuditController,
    AiProviderConfigsController,
    AiAgentsController,
    AiStatusController,
  ],
  providers: [
    MongoService,
    PrismaService,
    { provide: GAME_CREATION_DRAFT_REPOSITORY, useClass: PrismaGameCreationDraftRepository },
    { provide: DRAFT_ASSET_STORAGE, useClass: CloudinaryImageStorage },
    GameCreationDraftService,
    GameCreationDraftExpirationJob,
    { provide: GAME_REPOSITORY, useClass: MongoGameRepository },
    { provide: GAME_TYPE_SETTING_REPOSITORY, useClass: PrismaGameTypeSettingRepository },
    { provide: GAME_IMPORT_JOB_REPOSITORY, useClass: MongoGameImportJobRepository },
    { provide: TRANSACTION_RUNNER, useClass: MongoSessionFactory },
    MemoryMatchContentValidator,
    GuessWhoContentValidator,
    DominoContentValidator,
    MazeCollectorContentValidator,
    SnakesLaddersContentValidator,
    DualQuestContentValidator,
    DualQuestPixiContentValidator,
    TrueFalseMazeContentValidator,
    ContentValidatorRegistry,
    RequesterAdminResolver,
    GameAuthorizationService,
    ClassEnrollmentGameVisibilityService,
    GameFactoryService,
    GameImportExtractor,
    CreateGameUseCase,
    GetGameByIdUseCase,
    GetGameBySlugUseCase,
    ListGamesUseCase,
    UpdateGameUseCase,
    PublishGameUseCase,
    UnpublishGameUseCase,
    SetGameFeaturedUseCase,
    SetGameTournamentEnabledUseCase,
    DeleteGameUseCase,
    DonateGameToOrganizationUseCase,
    ImportGamesBatchUseCase,
    ListGameTypeSettingsUseCase,
    ArchiveGameTypeUseCase,
    UnarchiveGameTypeUseCase,
    UpdateGameTypeSettingUseCase,
    // IA agnóstica al proveedor: repositorios, cifrado, runtime de agentes y
    // asistentes viven en `AiCoreModule`; aquí solo la administración.
    ListAiProviderConfigsUseCase,
    CreateAiProviderConfigUseCase,
    UpdateAiProviderConfigUseCase,
    SetAiProviderEnabledUseCase,
    ReencryptAiProviderConfigsUseCase,
    DeleteAiProviderConfigUseCase,
    ReorderAiProviderConfigsUseCase,
    TestAiProviderConfigUseCase,
    ListAiProviderModelsUseCase,
    ListAiAgentsUseCase,
    UpdateAiAgentUseCase,
    ResetAiAgentUseCase,
    TestAiAgentUseCase,
    { provide: AI_MODEL_CATALOG, useClass: HttpAiModelCatalog },
    { provide: IMAGE_STORAGE, useClass: CloudinaryImageStorage },
    { provide: CONTENT_IMAGE_FINDER, useClass: WikimediaContentImageFinder },
    FileTextExtractor,
    ContentImageResolver,
    GenerateGameDraftUseCase,
    DeterministicGameAdapter,
    AiUsagePolicy,
    AdaptGameUseCase,
    ListAiProviderAttemptsUseCase,
    { provide: AI_AUDIT_LOG_REPOSITORY, useClass: PrismaAiAuditLogRepository },
    AiAuditLogger,
    ListAiAuditLogsUseCase,
  ],
})
export class GameModule {}
