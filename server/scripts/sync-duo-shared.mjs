// Copia la lógica compartida de Dúo Lógico del servidor al cliente.
// La fuente es server/src/domain/duo-logico/shared; el cliente recibe una copia
// idéntica (duo-shared-sync.spec.ts falla si se separan).
// Uso: npm run sync:duo-shared
import { cpSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const from = resolve(root, 'server/src/domain/duo-logico/shared');
const to = resolve(root, 'client/src/components/home/games/duo-logico/shared');
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
console.log(`Copiado ${from} -> ${to}`);
