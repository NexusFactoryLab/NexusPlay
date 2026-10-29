// Migra a Dúo Lógico nuevo (DUAL_QUEST_PIXI) lo que quedó del Dúo de cuadrícula
// (DUAL_QUEST, eliminado en #108) y los juegos Pixi con la estructura vieja.
//
//   node scripts/migrate-duo-logico.mjs           → solo muestra qué cambiaría
//   node scripts/migrate-duo-logico.mjs --apply   → aplica los cambios
//
// Mongo (games): cada juego DUAL_QUEST pasa a DUAL_QUEST_PIXI con todos los
// escenarios y sin preguntas propias (usa el banco); los DUAL_QUEST_PIXI sin
// `config.levels` se normalizan igual. Postgres (game_type_settings): se borra
// la fila de DUAL_QUEST y la de DUAL_QUEST_PIXI pasa a llamarse "Dúo Lógico".
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const LEVELS = ['bosque', 'solar'];
const DISPLAY_NAME = 'Dúo Lógico';
const DESCRIPTION = 'Cooperativo en línea para 2: Lumen y Gota superan escenarios juntos y solo avanzan si los dos responden bien.';

const mongo = new MongoClient(process.env.MONGODB_URI);
const sql = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await mongo.connect();
  await sql.connect();
  const games = mongo.db().collection('games');
  const targets = await games
    .find({ $or: [{ gameType: 'DUAL_QUEST' }, { gameType: 'DUAL_QUEST_PIXI', 'config.levels': { $exists: false } }] })
    .project({ title: 1, slug: 1, gameType: 1 })
    .toArray();
  console.log(`Juegos a convertir: ${targets.length}`);
  for (const g of targets) console.log(`  - ${g.title} (${g.slug}) [${g.gameType}]`);
  const settings = (await sql.query("select game_type, status, display_name from game_type_settings where game_type in ('DUAL_QUEST', 'DUAL_QUEST_PIXI')")).rows;
  console.log('Tipos en game_type_settings:', settings);

  if (!APPLY) {
    console.log('\nNo se cambió nada. Para aplicar: node scripts/migrate-duo-logico.mjs --apply');
  } else {
    const ids = targets.map((g) => g._id);
    const result = await games.updateMany(
      { _id: { $in: ids } },
      { $set: { gameType: 'DUAL_QUEST_PIXI', config: { levels: LEVELS }, content: [], updatedAt: new Date() } },
    );
    console.log(`Juegos convertidos: ${result.modifiedCount}`);
    const deleted = await sql.query("delete from game_type_settings where game_type = 'DUAL_QUEST'");
    const renamed = await sql.query('update game_type_settings set display_name = $1, description = $2, updated_at = now() where game_type = $3', [DISPLAY_NAME, DESCRIPTION, 'DUAL_QUEST_PIXI']);
    console.log(`Configuración: ${deleted.rowCount} fila DUAL_QUEST borrada, ${renamed.rowCount} renombrada a "${DISPLAY_NAME}".`);
  }
} finally {
  await mongo.close();
  await sql.end();
}
