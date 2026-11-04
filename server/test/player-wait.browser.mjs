// Prueba integrada de la espera al jugador desconectado (issue #120), con el
// gateway Nest/Socket.IO real y dos navegadores en una partida de Identidad
// Oculta (las demás salas usan la misma lógica, probada en
// player-wait.gateway.spec.ts):
//   - a Beto se le corta la conexión: Ana ve «Esperando a Beto…», la partida
//     queda en pausa y Salir pide confirmación («No, esperar al jugador»);
//   - Beto vuelve por el enlace y la partida sigue donde iba;
//   - se corta otra vez y Ana elige «Sí, salir»: vuelve al inicio y la sala se cierra.
//   1. npm run build (en server/)
//   2. Vite en :5174 con VITE_API_URL=http://127.0.0.1:3107
//      (cd client && VITE_API_URL=http://127.0.0.1:3107 npx vite --port 5174)
//   3. node server/test/player-wait.browser.mjs
// PLAYWRIGHT_MODULE permite usar una instalación de Playwright fuera del proyecto.
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { RoomsGateway } from '../dist/infrastructure/rooms/rooms.gateway.js';
import { GAME_REPOSITORY } from '../dist/domain/ports/game.repository.port.js';
import { USER_REPOSITORY } from '../dist/domain/ports/user.repository.port.js';
import { ROOM_STORE } from '../dist/domain/ports/room-store.port.js';
import { TOURNAMENT_STORE } from '../dist/domain/ports/tournament-store.port.js';
import { DOMINO_ROOM_STORE } from '../dist/domain/ports/domino-room-store.port.js';
import { SNAKES_LADDERS_ROOM_STORE } from '../dist/domain/ports/snakes-ladders-room-store.port.js';
import { InMemoryRoomStore } from '../dist/infrastructure/rooms/in-memory-room.store.js';
import { InMemoryTournamentStore } from '../dist/infrastructure/rooms/in-memory-tournament.store.js';
import { InMemoryDominoRoomStore } from '../dist/infrastructure/rooms/in-memory-domino-room.store.js';
import { InMemorySnakesLaddersRoomStore } from '../dist/infrastructure/rooms/in-memory-snakes-ladders-room.store.js';
import { AnalyticsTrackerService } from '../dist/application/services/analytics-tracker.service.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DUO_TEST_URL || 'http://127.0.0.1:5174';
const api = 'http://127.0.0.1:3107';
const CODE = 'ESPERA';

class TestModule {}
Module({
  providers: [
    RoomsGateway,
    { provide: JwtService, useValue: { verifyAsync: async (token) => ({ sub: token }) } },
    { provide: GAME_REPOSITORY, useValue: { findById: async () => null } },
    { provide: USER_REPOSITORY, useValue: { findById: async (id) => ({ name: { getFullName: () => id } }) } },
    { provide: AnalyticsTrackerService, useValue: { track: async () => {} } },
    { provide: ROOM_STORE, useClass: InMemoryRoomStore },
    { provide: TOURNAMENT_STORE, useClass: InMemoryTournamentStore },
    { provide: DOMINO_ROOM_STORE, useClass: InMemoryDominoRoomStore },
    { provide: SNAKES_LADDERS_ROOM_STORE, useClass: InMemorySnakesLaddersRoomStore },
  ],
})(TestModule);

const svg = (fill) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="${fill}"/></svg>`);
const CARDS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'].map((fill, i) => ({
  cardId: `c${i}`,
  label: `Bandera ${i + 1}`,
  imageUrl: svg(fill),
  audioUrl: null,
}));

async function until(predicate, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timeout: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

const app = await NestFactory.create(TestModule, { logger: false });
let browser;
const errors = [];
try {
  app.enableCors({ origin: base, credentials: true });
  await app.listen(3107, '127.0.0.1');
  const store = app.get(ROOM_STORE);
  const gateway = app.get(RoomsGateway);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  mkdirSync('.scratch', { recursive: true });

  // Partida ya repartida, con el turno de Ana corriendo: los dos entran por el enlace.
  store.create({
    code: CODE,
    gameId: 'g',
    gameTitle: 'Banderas',
    cards: CARDS,
    hostUserId: 'Ana',
    maxAccusationCount: 6,
    turnDurationSeconds: 60,
    autoDiscard: false,
    phase: 'PLAYING',
    players: [
      { socketId: 'previo-ana', userId: 'Ana', displayName: 'Ana', ready: true, secretCardId: 'c1', discardedCardIds: [] },
      { socketId: 'previo-beto', userId: 'Beto', displayName: 'Beto', ready: true, secretCardId: 'c2', discardedCardIds: [] },
    ],
    winnerUserId: null,
    createdAt: Date.now(),
    rematchVotes: {},
    activePlayerUserId: null,
    turnDeadline: null,
    pendingQuestion: null,
    guidedChat: [],
    answerLog: [],
  });
  const room = () => store.get(CODE);
  gateway.setActiveTurn(room(), 'Ana');

  async function openPage(id, viewport = { width: 1280, height: 800 }) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => errors.push(`${id}: ${error.message}`));
    await page.addInitScript((user) => {
      localStorage.setItem('nexusplay-theme', 'dark');
      localStorage.setItem(`nexusplay-welcome-v1:${user}:STUDENT`, 'seen');
      // El paso de elegir avatar del primer inicio (sin avatar en el mock) se da por saltado.
      localStorage.setItem(`nexusplay-avatar-onboarding-v1:${user}`, 'skipped');
    }, id);
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      const json = (data) => route.fulfill({ json: data });
      if (url.pathname.endsWith('/auth/refresh')) return json({ accessToken: id });
      if (url.pathname.endsWith('/users/me')) return json({ id, role: 'STUDENT', hasChosenRole: true, displayName: id, email: `${id}@example.test`, avatarUrl: null });
      if (url.pathname.endsWith('/subjects')) return json([]);
      if (url.pathname.endsWith('/games')) return json({ items: [], total: 0 });
      if (url.pathname.includes('/organizations/')) return json([]);
      if (url.pathname.endsWith('/analytics/events')) return json({});
      if (url.origin === base || url.origin === api) return route.continue();
      return route.abort();
    });
    await page.goto(`${base}/quien-es/sala/${CODE}`);
    await page.getByRole('button', { name: /Saltar guía/ }).first().click();
    return page;
  }
  const connected = (id) => {
    const player = room()?.players.find((p) => p.userId === id);
    return !!player && !player.socketId.startsWith('previo-') && !player.socketId.startsWith('esperando:');
  };

  const ana = await openPage('Ana');
  let beto = await openPage('Beto', { width: 390, height: 844 });
  await until(() => connected('Ana') && connected('Beto'), 'los dos conectados');
  await ana.getByRole('button', { name: 'Bandera 1', exact: true }).first().waitFor();
  const wait = ana.locator('[data-player-wait]');
  assert.equal(await wait.count(), 0, 'sin desconexiones no hay ventana de espera');

  // --- A Beto se le corta la conexión: la partida queda en pausa ---
  await beto.context().close();
  await until(() => room().awaiting?.Beto !== undefined, 'el servidor espera a Beto');
  assert.equal(room().phase, 'PLAYING');
  assert.equal(room().turnDeadline, null, 'el reloj del turno quedó congelado');
  await wait.getByRole('heading', { name: 'Esperando a Beto…' }).waitFor();
  await wait.getByText(/Quedan \d+ s/).waitFor();
  await ana.waitForTimeout(400); // que termine la animación de entrada antes de la captura
  await ana.screenshot({ path: '.scratch/espera-desktop.png' });
  await ana.setViewportSize({ width: 390, height: 844 });
  await ana.waitForTimeout(200);
  await ana.screenshot({ path: '.scratch/espera-mobile.png' });
  await ana.setViewportSize({ width: 1280, height: 800 });

  // Salir pide confirmación; «No, esperar al jugador» vuelve a la espera.
  await wait.getByRole('button', { name: 'Salir' }).click();
  await wait.getByRole('alertdialog').getByText('¿Seguro que deseas salir?').waitFor();
  assert.ok(await wait.getByRole('button', { name: 'No, esperar al jugador' }).evaluate((el) => el === document.activeElement), 'el foco queda en la opción segura');
  await ana.waitForTimeout(300);
  await ana.screenshot({ path: '.scratch/espera-confirmar-desktop.png' });
  await wait.getByRole('button', { name: 'No, esperar al jugador' }).click();
  await wait.getByRole('heading', { name: 'Esperando a Beto…' }).waitFor();
  // Escape también cancela la confirmación.
  await wait.getByRole('button', { name: 'Salir' }).click();
  await ana.keyboard.press('Escape');
  await wait.getByRole('heading', { name: 'Esperando a Beto…' }).waitFor();
  assert.ok(store.get(CODE), 'la sala sigue abierta');

  // --- Beto vuelve por el enlace: la partida sigue donde iba ---
  beto = await openPage('Beto', { width: 390, height: 844 });
  await until(() => connected('Beto') && room().awaiting?.Beto === undefined, 'Beto volvió');
  assert.equal(room().phase, 'PLAYING');
  assert.ok(room().turnDeadline !== null && room().turnDeadline > Date.now(), 'el turno volvió a correr');
  await wait.waitFor({ state: 'detached' });

  // --- Se corta otra vez y Ana decide salir ---
  await beto.context().close();
  await wait.getByRole('heading', { name: 'Esperando a Beto…' }).waitFor();
  await wait.getByRole('button', { name: 'Salir' }).click();
  await wait.getByRole('button', { name: 'Sí, salir' }).click();
  await ana.waitForURL((url) => url.pathname === '/');
  await until(() => !store.get(CODE), 'la sala se cerró al salir Ana');

  assert.deepEqual(errors, []);
  console.log('PASS player-wait: pausa, confirmación de salida, regreso y salida');
} finally {
  await browser?.close();
  await app.close();
}
process.exit(0);
