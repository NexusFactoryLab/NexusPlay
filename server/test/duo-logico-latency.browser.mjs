// Prueba de latencia de Dúo Lógico (issue #120): mide cuánto atrasado se ve
// al compañero con una red lenta simulada. Entre el navegador y el servidor
// hay un proxy TCP que demora cada paquete (en los dos sentidos, sin
// desordenarlos, como una red móvil).
//   1. npm run build (en server/)
//   2. Vite en :5174 con VITE_API_URL=http://127.0.0.1:3107
//      (cd client && VITE_API_URL=http://127.0.0.1:3107 npx vite --port 5174)
//   3. node server/test/duo-logico-latency.browser.mjs [demora_ms=60] [variacion_ms=40] [max_atraso_ms]
// Ana camina de un lado a otro; se compara dónde estaba de verdad (su propia
// simulación) con dónde la dibuja la pantalla de Luis en cada cuadro.
// Con max_atraso_ms, falla si la mediana del atraso lo supera.
// PLAYWRIGHT_MODULE permite usar una instalación de Playwright fuera del proyecto.
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { createRequire } from 'node:module';
import net from 'node:net';
import assert from 'node:assert/strict';
import { RoomsGateway } from '../dist/infrastructure/rooms/rooms.gateway.js';
import { DuoLogicoGateway } from '../dist/infrastructure/rooms/duo-logico.gateway.js';
import { GAME_REPOSITORY } from '../dist/domain/ports/game.repository.port.js';
import { USER_REPOSITORY } from '../dist/domain/ports/user.repository.port.js';
import { ROOM_STORE } from '../dist/domain/ports/room-store.port.js';
import { TOURNAMENT_STORE } from '../dist/domain/ports/tournament-store.port.js';
import { DOMINO_ROOM_STORE } from '../dist/domain/ports/domino-room-store.port.js';
import { SNAKES_LADDERS_ROOM_STORE } from '../dist/domain/ports/snakes-ladders-room-store.port.js';
import { DUO_ROOM_STORE } from '../dist/domain/ports/duo-room-store.port.js';
import { InMemoryRoomStore } from '../dist/infrastructure/rooms/in-memory-room.store.js';
import { InMemoryTournamentStore } from '../dist/infrastructure/rooms/in-memory-tournament.store.js';
import { InMemoryDominoRoomStore } from '../dist/infrastructure/rooms/in-memory-domino-room.store.js';
import { InMemorySnakesLaddersRoomStore } from '../dist/infrastructure/rooms/in-memory-snakes-ladders-room.store.js';
import { InMemoryDuoRoomStore } from '../dist/infrastructure/rooms/in-memory-duo-room.store.js';
import { AnalyticsTrackerService } from '../dist/application/services/analytics-tracker.service.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DUO_TEST_URL || 'http://127.0.0.1:5174';
const api = 'http://127.0.0.1:3107';
const DELAY = Number(process.argv[2] ?? 60);
const JITTER = Number(process.argv[3] ?? 40);
const MAX_LAG = process.argv[4] ? Number(process.argv[4]) : null;
const GAME = { id: 'duo-game', title: 'Dúo Lógico: el bosque', gameType: 'DUAL_QUEST_PIXI', slug: 'duo-prueba' };

class TestModule {}
Module({
  providers: [
    RoomsGateway,
    DuoLogicoGateway,
    { provide: JwtService, useValue: { verifyAsync: async (token) => ({ sub: token }) } },
    { provide: GAME_REPOSITORY, useValue: { findById: async (id) => (id === GAME.id ? { id, title: GAME.title, gameType: { getName: () => GAME.gameType }, config: {}, content: [] } : null) } },
    { provide: USER_REPOSITORY, useValue: { findById: async (id) => ({ name: { getFullName: () => id } }) } },
    { provide: AnalyticsTrackerService, useValue: { track: async () => {} } },
    { provide: ROOM_STORE, useClass: InMemoryRoomStore },
    { provide: TOURNAMENT_STORE, useClass: InMemoryTournamentStore },
    { provide: DOMINO_ROOM_STORE, useClass: InMemoryDominoRoomStore },
    { provide: SNAKES_LADDERS_ROOM_STORE, useClass: InMemorySnakesLaddersRoomStore },
    { provide: DUO_ROOM_STORE, useClass: InMemoryDuoRoomStore },
  ],
})(TestModule);

/** Proxy TCP que demora cada trozo DELAY ± JITTER ms, sin desordenarlos (como TCP en una red lenta). */
function slowProxy(listenPort, targetPort) {
  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, '127.0.0.1');
    const pipe = (from, to) => {
      let lastAt = 0;
      from.on('data', (chunk) => {
        const at = Math.max(lastAt, Date.now() + DELAY + Math.random() * JITTER);
        lastAt = at;
        setTimeout(() => {
          if (!to.destroyed) to.write(chunk);
        }, at - Date.now());
      });
      from.on('close', () => setTimeout(() => to.destroy(), DELAY + JITTER + 10));
      from.on('error', () => {});
    };
    pipe(client, upstream);
    pipe(upstream, client);
  });
  return new Promise((resolve) => server.listen(listenPort, '127.0.0.1', () => resolve(server)));
}

async function until(predicate, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timeout: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

/**
 * Para cada cuadro de Luis, busca cuándo estuvo Ana de verdad en la x que
 * Luis dibuja (la más reciente antes de ese cuadro, mientras caminaba).
 * El atraso es la diferencia de horas. También cuenta los cuadros en que
 * Luis la dibuja quieta aunque ella camina («congelados») y los que la
 * hacen retroceder («saltos atrás»).
 */
function analyze(truth, drawn) {
  const lags = [];
  let moving = 0;
  let frozen = 0;
  let backwards = 0;
  for (let i = 1; i < drawn.length; i++) {
    const [t, x] = drawn[i];
    let match = null;
    for (let j = truth.length - 1; j > 0; j--) {
      const [t1, x1] = truth[j];
      const [t0, x0] = truth[j - 1];
      if (t1 > t) continue;
      if (t - t0 > 1500) break;
      const speed = Math.abs(x1 - x0) / Math.max(1, t1 - t0);
      if (speed < 0.12) continue;
      if ((x0 <= x && x <= x1) || (x1 <= x && x <= x0)) {
        const k = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
        match = { at: t0 + (t1 - t0) * k, dir: Math.sign(x1 - x0) };
        break;
      }
    }
    if (!match) continue;
    lags.push(t - match.at);
    moving += 1;
    const dx = x - drawn[i - 1][1];
    if (Math.abs(dx) < 0.01) frozen += 1;
    else if (Math.sign(dx) !== match.dir) backwards += 1;
  }
  return {
    frames: moving,
    median: Math.round(percentile(lags, 50)),
    p90: Math.round(percentile(lags, 90)),
    max: Math.round(Math.max(...lags)),
    frozenPct: Math.round((frozen / Math.max(1, moving)) * 1000) / 10,
    backwardsPct: Math.round((backwards / Math.max(1, moving)) * 1000) / 10,
  };
}

const app = await NestFactory.create(TestModule, { logger: false });
let browser;
let proxy;
const errors = [];
try {
  app.enableCors({ origin: base, credentials: true });
  await app.listen(3108, '127.0.0.1');
  proxy = await slowProxy(3107, 3108);
  const store = app.get(DUO_ROOM_STORE);
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  async function openPage(id) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', (error) => errors.push(`${id}: ${error.message}`));
    await page.addInitScript((user) => {
      localStorage.setItem('nexusplay-theme', 'dark');
      localStorage.setItem(`nexusplay-welcome-v1:${user}:STUDENT`, 'seen');
    }, id);
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      const json = (data) => route.fulfill({ json: data });
      if (url.pathname.endsWith('/auth/refresh')) return json({ accessToken: id });
      if (url.pathname.endsWith('/users/me')) return json({ id, role: 'STUDENT', hasChosenRole: true, displayName: id, email: `${id}@example.test`, avatarUrl: null });
      if (url.pathname.includes('/games/slug/')) return json({ ...GAME, description: '', content: [], config: {}, subject: null });
      if (url.pathname.endsWith('/subjects')) return json([]);
      if (url.pathname.endsWith('/games')) return json({ items: [], total: 0 });
      if (url.pathname.includes('/organizations/')) return json([]);
      if (url.pathname.endsWith('/analytics/events')) return json({});
      if (url.origin === base || url.origin === api) return route.continue();
      return route.abort();
    });
    return page;
  }
  const continueGuide = (page) => page.getByRole('button', { name: /continuar|Saltar guía/ }).first().click();

  const ana = await openPage('Ana');
  await ana.goto(`${base}/dual-quest-pixi/${GAME.slug}`);
  await continueGuide(ana);
  await ana.getByRole('button', { name: /Lumen/ }).first().click();
  await ana.getByRole('button', { name: 'Crear sala e invitar a mi compañero' }).click();
  await ana.waitForURL(/\/dual-quest-pixi\/sala\/[A-Z0-9]{6}$/);
  const code = ana.url().split('/').pop();
  const room = () => store.get(code);

  const luis = await openPage('Luis');
  await luis.goto(`${base}/dual-quest-pixi/sala/${code}`);
  await continueGuide(luis);
  await until(() => room().players.length === 2, 'Luis en la sala');
  const lobby = (page) => page.getByRole('dialog', { name: 'Sala de espera', exact: true });
  for (const page of [ana, luis]) await lobby(page).getByRole('button', { name: 'Listo para jugar' }).click();
  await until(() => room().phase === 'PLAYING', 'a jugar', 20000);
  await until(() => room().players.every((p) => p.state), 'posiciones de los dos');
  await sleep(1500);

  for (const page of [ana, luis]) await page.evaluate(() => (window.__duoTrace = { me: [], partner: [] }));
  // Ana va y viene por el primer tramo (sin llegar al foso de lodo).
  for (let i = 0; i < 3; i++) {
    await ana.keyboard.down('ArrowRight');
    await sleep(1500);
    await ana.keyboard.up('ArrowRight');
    await sleep(350);
    await ana.keyboard.down('ArrowLeft');
    await sleep(1500);
    await ana.keyboard.up('ArrowLeft');
    await sleep(350);
  }
  await sleep(600);
  const truth = await ana.evaluate(() => window.__duoTrace.me);
  const drawn = await luis.evaluate(() => window.__duoTrace.partner);
  const result = analyze(truth, drawn);
  console.log(
    `Red simulada: ${DELAY} ms ± ${JITTER} ms por sentido.\n` +
      `Atraso del compañero (${result.frames} cuadros): mediana ${result.median} ms · p90 ${result.p90} ms · máx ${result.max} ms\n` +
      `Cuadros congelados mientras camina: ${result.frozenPct} % · saltos atrás: ${result.backwardsPct} %`,
  );
  assert.ok(result.frames > 100, 'hubo suficientes cuadros con Ana caminando');
  if (MAX_LAG !== null) assert.ok(result.median <= MAX_LAG, `la mediana del atraso (${result.median} ms) no supera ${MAX_LAG} ms`);
  assert.deepEqual(errors, []);
  console.log('PASS duo-logico-latency');
} finally {
  await browser?.close();
  proxy?.close();
  await app.close();
}
process.exit(0);
