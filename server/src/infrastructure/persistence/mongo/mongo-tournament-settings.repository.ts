import { Injectable } from '@nestjs/common';
import type {
  TournamentSettings,
  TournamentSettingsRepository,
} from '../../../domain/ports/tournament-settings.repository.port.js';
import { MongoService } from './mongo.service.js';

const COLLECTION = 'tournament_settings';
/** Un solo documento: el torneo habilitado. */
const DOCUMENT_ID = 'current';

interface TournamentSettingsDocument {
  _id: string;
  games: TournamentSettings['games'];
  maxParticipants: number;
  totalRounds: number;
  updatedByUserId: string;
  updatedAt: Date;
}

@Injectable()
export class MongoTournamentSettingsRepository implements TournamentSettingsRepository {
  constructor(private readonly mongo: MongoService) {}

  private get collection() {
    return this.mongo.collection<TournamentSettingsDocument>(COLLECTION);
  }

  async get(): Promise<TournamentSettings | null> {
    const doc = await this.collection.findOne({ _id: DOCUMENT_ID });
    if (!doc) return null;
    return {
      games: doc.games,
      maxParticipants: doc.maxParticipants,
      totalRounds: doc.totalRounds,
      updatedByUserId: doc.updatedByUserId,
      updatedAt: doc.updatedAt,
    };
  }

  async save(settings: TournamentSettings): Promise<void> {
    await this.collection.updateOne(
      { _id: DOCUMENT_ID },
      { $set: { ...settings } },
      { upsert: true },
    );
  }

  async clear(): Promise<void> {
    await this.collection.deleteOne({ _id: DOCUMENT_ID });
  }
}
