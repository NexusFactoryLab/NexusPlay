// Prueba integrada de Dúo Lógico (issue #105): dos navegadores juegan juntos
// contra el gateway Nest/Socket.IO real, con repositorios de prueba.
//   1. npm run build --workspace=server
//   2. Vite en :5174 con VITE_API_URL=http://127.0.0.1:3107
//      (cd client && VITE_API_URL=http://127.0.0.1:3107 npx vite --port 5174)
//   3. node server/test/duo-logico.browser.mjs
// Ana juega en computador con el teclado; Luis en celular con los botones
// táctiles. Cruzan el foso de lodo cooperando con los botones, se paran en
// los pedestales, fallan una vez (pierden un corazón) y aciertan los dos.
// PLAYWRIGHT_MODULE permite usar una instalación de Playwright fuera del proyecto.
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { RoomsGateway } from '../dist/infrastructure/rooms/rooms.gateway.js';
import { DuoLogicoGateway } from '../dist/infrastructure/rooms/duo-logico.gateway.js';
import { GAME_REPOSITORY } from '../dist/domain/ports/game.repository.port.js';
import { USER_REPOSITORY } from '../dist/domain/ports/user.repository.port.js';
import { ROOM_STORE } from '../dist/domain/ports/room-store.port.js';
import { TOURNAMENT_STORE } from '../dist/domain/ports/tournament-store.port.js';
import { DOMINO_ROOM_STORE } from '../dist/domain/ports/domino-room-store.port.js';
import { SNAKES_LADDERS_ROOM_STORE } from '../dist/domain/ports/snakes-ladders-room-store.port.js';
import { DUAL_QUEST_ROOM_STORE } from '../dist/domain/ports/dual-quest-room-store.port.js';
import { DUO_ROOM_STORE } from '../dist/domain/ports/duo-room-store.port.js';
import { InMemoryRoomStore } from '../dist/infrastructure/rooms/in-memory-room.store.js';
import { InMemoryTournamentStore } from '../dist/infrastructure/rooms/in-memory-tournament.store.js';
import { InMemoryDominoRoomStore } from '../dist/infrastructure/rooms/in-memory-domino-room.store.js';
import { InMemorySnakesLaddersRoomStore } from '../dist/infrastructure/rooms/in-memory-snakes-ladders-room.store.js';
import { InMemoryDualQuestRoomStore } from '../dist/infrastructure/rooms/in-memory-dual-quest-room.store.js';
import { InMemoryDuoRoomStore } from '../dist/infrastructure/rooms/in-memory-duo-room.store.js';
import { optionsFor } from '../dist/domain/duo-logico/duo-questions.js';
import { AnalyticsTrackerService } from '../dist/application/services/analytics-tracker.service.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DUO_TEST_URL || 'http://127.0.0.1:5174';
const api = 'http://127.0.0.1:3107';
const TILE = 64;
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
    { provide: DUAL_QUEST_ROOM_STORE, useClass: InMemoryDualQuestRoomStore },
    { provide: DUO_ROOM_STORE, useClass: InMemoryDuoRoomStore },
  ],
})(TestModule);

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
const openPages = [];
try {
  app.enableCors({ origin: base, credentials: true });
  await app.listen(3107, '127.0.0.1');
  const store = app.get(DUO_ROOM_STORE);
  const gateway = app.get(DuoLogicoGateway);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  mkdirSync('.scratch', { recursive: true });

  async function openPage(id, mobile) {
    const context = await browser.newContext(
      mobile
        ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
        : { viewport: { width: 1280, height: 800 } },
    );
    const page = await context.newPage();
    openPages.push([id, page]);
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => errors.push(`${id}: ${error.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(`${id} console: ${m.text()}`);
    });
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

  // --- Ana crea la sala eligiendo a Lumen ---
  const ana = await openPage('Ana', false);
  await ana.goto(`${base}/dual-quest-pixi/${GAME.slug}`);
  await continueGuide(ana);
  await ana.getByRole('button', { name: /Lumen/ }).first().click();
  await ana.getByRole('button', { name: 'Crear sala e invitar a mi compañero' }).click();
  await ana.waitForURL(/\/dual-quest-pixi\/sala\/[A-Z0-9]{6}$/);
  const code = ana.url().split('/').pop();
  const room = () => store.get(code);
  assert.equal(room().players[0].role, 'FIRE');

  // --- Luis entra por el enlace desde el celular ---
  const luis = await openPage('Luis', true);
  await luis.goto(`${base}/dual-quest-pixi/sala/${code}`);
  await continueGuide(luis);
  await until(() => room().players.length === 2, 'Luis en la sala');
  assert.equal(room().players[1].role, 'WATER');
  const lobby = (page) => page.getByRole('dialog', { name: 'Sala de espera', exact: true });
  await lobby(ana).getByText('Luis').first().waitFor();
  await ana.screenshot({ path: '.scratch/duo-lobby-desktop.png' });
  await luis.screenshot({ path: '.scratch/duo-lobby-mobile.png' });

  for (const page of [ana, luis]) await lobby(page).getByRole('button', { name: 'Listo para jugar' }).click();
  await until(() => room().phase === 'COUNTDOWN', 'cuenta regresiva');
  await ana.getByText('¡Prepárense!').waitFor();
  await until(() => room().phase === 'PLAYING', 'a jugar');
  await ana.locator('canvas').waitFor();
  await luis.locator('[data-testid="duo-touch"]').waitFor();
  await until(() => room().players.every((p) => p.state), 'posiciones de los dos');

  const pos = (id) => room().players.find((p) => p.userId === id).state;
  // Controles: Ana con el teclado; Luis con los botones táctiles.
  const keys = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp' };
  const pads = { left: 'Izquierda', right: 'Derecha', jump: 'Saltar' };
  // Un solo puntero no sostiene dos botones a la vez: para saltar en carrera Luis usa el teclado.
  async function press(id, key, down, keyboard = id === 'Ana') {
    const page = id === 'Ana' ? ana : luis;
    if (keyboard) return down ? page.keyboard.down(keys[key]) : page.keyboard.up(keys[key]);
    const box = await luis.getByRole('button', { name: pads[key] }).boundingBox();
    await luis.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    return down ? luis.mouse.down() : luis.mouse.up();
  }
  /** Camina hasta x; si algo bajo lo frena (un pedestal), salta por encima como haría un jugador. */
  async function walkTo(id, x, tolerance = 14, keyboard) {
    const page = id === 'Ana' ? ana : luis;
    const dir = pos(id).x < x ? 'right' : 'left';
    const reached = () => (dir === 'right' ? pos(id).x >= x - tolerance : pos(id).x <= x + tolerance);
    await press(id, dir, true, keyboard);
    const deadline = Date.now() + 15000;
    let stuckSince = null;
    while (!reached()) {
      if (Date.now() > deadline) throw new Error(`Timeout: ${id} llega a x=${x} (está en ${pos(id).x})`);
      if (Math.abs(pos(id).vx) < 5) {
        stuckSince ??= Date.now();
        if (Date.now() - stuckSince > 150) {
          await page.keyboard.down('ArrowUp');
          await new Promise((resolve) => setTimeout(resolve, 250));
          await page.keyboard.up('ArrowUp');
          stuckSince = null;
        }
      } else stuckSince = null;
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    await press(id, dir, false, keyboard);
    await until(() => Math.abs(pos(id).vx) < 5 && Math.abs(pos(id).vy) < 5, `${id} se detiene en el piso`);
  }
  /** Sube a su pedestal: camina hasta el borde, salta y se suelta encima. */
  async function climbPedestal(id, col) {
    const center = col * TILE + TILE / 2;
    await walkTo(id, center - 92, 6, true);
    await press(id, 'right', true, true);
    await press(id, 'jump', true, true);
    await until(() => pos(id).x >= center - 10, `${id} sobre el pedestal`);
    await press(id, 'right', false, true);
    await press(id, 'jump', false, true);
    await until(() => Math.abs(pos(id).y - (10 * TILE - 50)) < 2 && Math.abs(pos(id).vy) < 5, `${id} parado en el pedestal`, 4000);
  }

  // --- Foso de lodo: Ana sostiene el botón, Luis cruza y sostiene el del otro lado ---
  await walkTo('Ana', 10 * TILE + TILE / 2);
  await until(() => room().world.switches['boton-orilla'], 'botón de la orilla');
  await ana.screenshot({ path: '.scratch/duo-boton-desktop.png' });
  await walkTo('Luis', 18 * TILE + TILE / 2);
  assert.ok(!pos('Luis').dead, 'Luis cruzó el puente sin caer al lodo');
  await until(() => room().world.switches['boton-lejano'], 'botón lejano');
  await luis.screenshot({ path: '.scratch/duo-puente-mobile.png' });

  // Un emote del celular le llega a Ana.
  await luis.getByRole('button', { name: 'Mensajes rápidos' }).click();
  await luis.getByRole('button', { name: /Pisa el botón/ }).click();

  // --- Los dos a sus pedestales ---
  await climbPedestal('Ana', 22);
  await climbPedestal('Luis', 24);
  await until(() => room().phase === 'QUESTION', 'pregunta de la Puerta 1');
  const panel = (page) => page.getByRole('dialog', { name: 'Puerta del Saber' });
  await panel(ana).getByText('Pregunta espejo').waitFor();
  await panel(luis).getByText('Pregunta espejo').waitFor();
  await ana.screenshot({ path: '.scratch/duo-pregunta-desktop.png' });
  await luis.screenshot({ path: '.scratch/duo-pregunta-mobile.png' });
  const right = (role) => optionsFor(room().question.question, role)[0];

  // Primer intento: Luis se equivoca; pierden un corazón.
  await panel(ana).getByTestId('duo-option').filter({ hasText: right('FIRE') }).click();
  await panel(ana).getByText(/Esperando a Gota/).waitFor();
  await panel(luis).getByText(/ya respondió/).waitFor();
  await panel(luis).getByTestId('duo-option').filter({ hasNotText: right('WATER') }).first().click();
  await until(() => room().phase === 'REVEAL', 'revelado');
  await panel(ana).locator('[data-testid="duo-reveal"][data-success="false"]').waitFor();
  assert.equal(room().hearts, 2);
  await ana.screenshot({ path: '.scratch/duo-fallo-desktop.png' });
  await until(() => room().phase === 'QUESTION' && room().question.attempt === 2, 'segundo intento', 6000);

  // Segundo intento: aciertan los dos y la puerta se abre.
  await panel(luis).getByTestId('duo-option').filter({ hasText: right('WATER') }).click();
  await panel(ana).getByTestId('duo-option').filter({ hasText: right('FIRE') }).click();
  await panel(luis).locator('[data-testid="duo-reveal"][data-success="true"]').waitFor();
  await luis.screenshot({ path: '.scratch/duo-acierto-mobile.png' });
  await until(() => room().phase === 'PLAYING' && room().world.gates['puerta-1'], 'puerta 1 abierta', 8000);

  // --- Luis recarga la página: Ana lo espera y él vuelve donde estaba ---
  const before = pos('Luis');
  await luis.reload();
  await until(() => room().waitingPartnerUntil !== null, 'esperando a Luis');
  await ana.getByText(/Esperando a Luis/).waitFor();
  await continueGuide(luis);
  await until(() => room().waitingPartnerUntil === null && room().players.every((p) => p.socketId), 'Luis volvió');
  await luis.locator('canvas').waitFor();
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.ok(Math.abs(pos('Luis').x - before.x) < 40, `Luis retoma su posición (${before.x} → ${pos('Luis').x})`);

  // Pasan por la puerta abierta.
  await walkTo('Ana', 28 * TILE + TILE / 2);
  assert.ok(pos('Ana').x > 27 * TILE, 'Ana cruzó la Puerta del Saber');
  await ana.screenshot({ path: '.scratch/duo-tramo-b-desktop.png' });

  // --- Fin de la partida y revancha ---
  const r = room();
  r.phase = 'VICTORY';
  r.finishedAt = Date.now();
  gateway.broadcastRoom(r);
  await ana.getByRole('heading', { name: '¡Salvaron el bosque!' }).waitFor();
  await luis.screenshot({ path: '.scratch/duo-victoria-mobile.png' });
  await ana.getByRole('button', { name: 'Jugar otra vez' }).click();
  await luis.getByRole('button', { name: /quiere jugar otra vez/ }).click();
  await until(() => room().phase === 'COUNTDOWN' && room().runId === 2, 'revancha');
  await until(() => room().phase === 'PLAYING', 'revancha en juego');
  await until(() => pos('Ana') && pos('Ana').x < 4 * TILE, 'Ana vuelve al inicio');

  assert.deepEqual(errors, []);
  console.log('PASS duo-logico: sala, cooperación, pedestales, pregunta (fallo y acierto), reconexión y revancha');
} catch (error) {
  for (const [id, page] of openPages) await page.screenshot({ path: `.scratch/duo-fallo-${id}.png` }).catch(() => {});
  console.error('Errores de página:', errors);
  throw error;
} finally {
  await browser?.close();
  await app.close();
}
