import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { HeuristicGuessWhoBotPolicy } from '../../application/bots/heuristic-guess-who-bot.policy.js';
import { MlpGuessWhoBotPolicy } from '../../application/bots/mlp-guess-who-bot.policy.js';
import { POLICY_ACTIONS, POLICY_FEATURES } from '../../application/bots/guess-who-policy-features.js';
import { DEFAULT_GUESS_WHO_MODEL_PATH, loadGuessWhoBotPolicy } from './load-guess-who-bot-policy.js';

const logger = () => ({ log: vi.fn(), warn: vi.fn() });
const folder = mkdtempSync(join(tmpdir(), 'nexus-bot-'));

describe('carga del modelo del bot (issue #62)', () => {
  it('sin archivo de pesos, el bot Difícil juega con reglas y el servidor arranca igual', () => {
    const log = logger();
    expect(loadGuessWhoBotPolicy(join(folder, 'no-existe.json'), log)).toBeInstanceOf(HeuristicGuessWhoBotPolicy);
    expect(log.log).toHaveBeenCalledWith(expect.stringContaining('juega con reglas'));
  });

  it('un archivo roto o de otro contrato tampoco impide jugar: avisa y usa reglas', () => {
    const broken = join(folder, 'roto.json');
    writeFileSync(broken, '{ esto no es json');
    const log = logger();
    expect(loadGuessWhoBotPolicy(broken, log)).toBeInstanceOf(HeuristicGuessWhoBotPolicy);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('no es válido'));

    const otherContract = join(folder, 'otro.json');
    writeFileSync(otherContract, JSON.stringify({ format: 'nexus-mlp', version: 1, features: ['x'], actions: ['y'], layers: [] }));
    expect(loadGuessWhoBotPolicy(otherContract, logger())).toBeInstanceOf(HeuristicGuessWhoBotPolicy);
  });

  it('con pesos válidos usa el modelo', () => {
    const valid = join(folder, 'valido.json');
    writeFileSync(valid, JSON.stringify({
      format: 'nexus-mlp',
      version: 1,
      features: POLICY_FEATURES,
      actions: POLICY_ACTIONS,
      layers: [{ weight: POLICY_ACTIONS.map(() => POLICY_FEATURES.map(() => 0)), bias: POLICY_ACTIONS.map(() => 0), activation: 'identity' }],
    }));
    const log = logger();
    expect(loadGuessWhoBotPolicy(valid, log)).toBeInstanceOf(MlpGuessWhoBotPolicy);
    expect(log.log).toHaveBeenCalledWith(expect.stringContaining('modelo entrenado'));
  });

  it('la ruta por defecto apunta a server/assets/bots, igual desde src/ que desde dist/', () => {
    expect(DEFAULT_GUESS_WHO_MODEL_PATH.replace(/\\/g, '/')).toMatch(/\/server\/assets\/bots\/guess-who-policy\.json$/);
  });
});
