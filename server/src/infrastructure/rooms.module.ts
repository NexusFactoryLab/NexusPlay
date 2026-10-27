import { Module } from '@nestjs/common';
import { UserModule } from './user.module.js';
import { AnalyticsModule } from './analytics.module.js';
import { GAME_REPOSITORY } from '../domain/ports/game.repository.port.js';
import { ROOM_STORE } from '../domain/ports/room-store.port.js';
import { TOURNAMENT_STORE } from '../domain/ports/tournament-store.port.js';
import { DOMINO_ROOM_STORE } from '../domain/ports/domino-room-store.port.js';
import { SNAKES_LADDERS_ROOM_STORE } from '../domain/ports/snakes-ladders-room-store.port.js';
import { DUO_ROOM_STORE } from '../domain/ports/duo-room-store.port.js';
import { MongoService } from './persistence/mongo/mongo.service.js';
import { MongoGameRepository } from './persistence/mongo/mongo-game.repository.js';
import { InMemoryRoomStore } from './rooms/in-memory-room.store.js';
import { InMemoryTournamentStore } from './rooms/in-memory-tournament.store.js';
import { InMemoryDominoRoomStore } from './rooms/in-memory-domino-room.store.js';
import { InMemorySnakesLaddersRoomStore } from './rooms/in-memory-snakes-ladders-room.store.js';
import { InMemoryDuoRoomStore } from './rooms/in-memory-duo-room.store.js';
import { RoomsGateway } from './rooms/rooms.gateway.js';
import { DuoLogicoGateway } from './rooms/duo-logico.gateway.js';
import { GUESS_WHO_BOT_POLICY } from '../domain/ports/guess-who-bot-policy.port.js';
import { loadGuessWhoBotPolicy } from './bots/load-guess-who-bot-policy.js';
import { GUESS_WHO_FREE_ANSWERER } from '../domain/ports/guess-who-free-answerer.port.js';
import { AiGuessWhoFreeAnswerer } from './bots/ai-free-answerer.js';
import { AiCoreModule } from './ai-core.module.js';

@Module({
  imports: [UserModule, AnalyticsModule, AiCoreModule],
  providers: [
    MongoService,
    { provide: GAME_REPOSITORY, useClass: MongoGameRepository },
    { provide: ROOM_STORE, useClass: InMemoryRoomStore },
    { provide: TOURNAMENT_STORE, useClass: InMemoryTournamentStore },
    { provide: DOMINO_ROOM_STORE, useClass: InMemoryDominoRoomStore },
    { provide: SNAKES_LADDERS_ROOM_STORE, useClass: InMemorySnakesLaddersRoomStore },
    { provide: DUO_ROOM_STORE, useClass: InMemoryDuoRoomStore },
    // Bot de las partidas en solitario de Identidad Oculta (issue #60): el
    // Difícil usa el modelo entrenado en ml/ si hay pesos válidos (issue #62).
    { provide: GUESS_WHO_BOT_POLICY, useFactory: () => loadGuessWhoBotPolicy() },
    // El agente Jugador responde con IA las preguntas propias del jugador (issue #64);
    // su proveedor, modelo y enfoque se configuran en el panel de IA.
    { provide: GUESS_WHO_FREE_ANSWERER, useClass: AiGuessWhoFreeAnswerer },
    RoomsGateway,
    DuoLogicoGateway,
  ],
})
export class RoomsModule {}
