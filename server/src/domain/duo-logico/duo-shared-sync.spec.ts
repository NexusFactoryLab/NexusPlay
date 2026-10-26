import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SERVER_SHARED = resolve(__dirname, 'shared');
const CLIENT_SHARED = resolve(__dirname, '../../../../client/src/components/home/games/duo-logico/shared');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

describe('lógica compartida de Dúo Lógico', () => {
  it('la copia del cliente es idéntica a la del servidor (npm run sync:duo-shared)', () => {
    const server = files(SERVER_SHARED).map((f) => relative(SERVER_SHARED, f)).sort();
    const client = files(CLIENT_SHARED).map((f) => relative(CLIENT_SHARED, f)).sort();
    expect(client).toEqual(server);
    for (const file of server) {
      const a = readFileSync(join(SERVER_SHARED, file), 'utf8').replace(/\r\n/g, '\n');
      const b = readFileSync(join(CLIENT_SHARED, file), 'utf8').replace(/\r\n/g, '\n');
      expect(b, file).toBe(a);
    }
  });
});
