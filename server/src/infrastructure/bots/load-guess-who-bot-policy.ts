import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';
import type { GuessWhoBotPolicy } from '../../domain/ports/guess-who-bot-policy.port.js';
import { HeuristicGuessWhoBotPolicy } from '../../application/bots/heuristic-guess-who-bot.policy.js';
import { MlpGuessWhoBotPolicy, parseGuessWhoPolicyWeights } from '../../application/bots/mlp-guess-who-bot.policy.js';

/**
 * `server/assets/bots/guess-who-policy.json`, tanto desde `src/` (pruebas)
 * como desde `dist/` (producción): los dos están a la misma profundidad. El
 * Dockerfile copia `server/assets` a la imagen.
 */
export const DEFAULT_GUESS_WHO_MODEL_PATH = fileURLToPath(new URL('../../../assets/bots/guess-who-policy.json', import.meta.url));

/**
 * Política del bot de Identidad Oculta (issue #62): el modelo entrenado en
 * `ml/` si hay un archivo de pesos válido (ruta cambiable con
 * GUESS_WHO_BOT_MODEL_PATH); si no, las reglas de siempre. Un modelo
 * ausente o roto nunca impide arrancar ni jugar.
 */
export function loadGuessWhoBotPolicy(
  path = process.env.GUESS_WHO_BOT_MODEL_PATH || DEFAULT_GUESS_WHO_MODEL_PATH,
  logger: Pick<Logger, 'log' | 'warn'> = new Logger('GuessWhoBotPolicy'),
): GuessWhoBotPolicy {
  if (!existsSync(path)) {
    logger.log(`No hay modelo entrenado en ${path}: el bot Difícil juega con reglas.`);
    return new HeuristicGuessWhoBotPolicy();
  }
  try {
    const policy = new MlpGuessWhoBotPolicy(parseGuessWhoPolicyWeights(JSON.parse(readFileSync(path, 'utf8'))));
    logger.log(`El bot Difícil juega con el modelo entrenado de ${path}.`);
    return policy;
  } catch (error) {
    logger.warn(`El modelo del bot en ${path} no es válido (${error instanceof Error ? error.message : String(error)}): el bot Difícil juega con reglas.`);
    return new HeuristicGuessWhoBotPolicy();
  }
}
