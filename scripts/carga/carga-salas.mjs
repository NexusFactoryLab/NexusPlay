#!/usr/bin/env node
/**
 * Prueba de carga de salas multijugador (Socket.IO) para medir CPU y memoria
 * del servidor con N jugadores simulados.
 *
 * Escenarios:
 *   duo     Dúo Lógico: parejas que juegan y mandan su posición ~30 veces por
 *           segundo (el juego más pesado: además hay un tick de 33 ms en el servidor).
 *   domino  Dominó 1v1: parejas que crean/entran/se marcan listas y quedan en
 *           partida (turnos y temporizadores del servidor, sin jugadas).
 *   mixto   Mitad de las parejas en cada juego.
 *
 * Uso:
 *   node scripts/carga/carga-salas.mjs --url http://localhost:3001 --jugadores 30 \
 *        --escenario duo --duracion 60 [--pid 1234] [--hz 30]
 *
 * Crea usuarios `carga-<corrida>-<i>@carga.test` (contraseña fija) en la base a
 * la que apunte el servidor: úsalo SOLO contra un servidor de pruebas, nunca
 * contra producción. Los juegos deben estar sembrados (db:seed:dual-quest-pixi-demo
 * y db:seed:domino-niveles-demo).
 *
 * Mide, en el proceso del servidor (--pid, o el que escuche en el puerto de --url):
 * CPU % y memoria (RSS). Y desde los bots: mensajes y bytes recibidos por segundo,
 * y la separación entre `duo:snapshot` consecutivos (ideal 33 ms; si crece, el
 * servidor no da abasto con el tick).
 */
import { io } from 'socket.io-client';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------- argumentos
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
    return acc;
  }, []),
);
const URL_BASE = (args.url ?? 'http://localhost:3001').replace(/\/+$/, '');
const JUGADORES = Math.max(2, Number(args.jugadores ?? 30)) & ~1; // siempre par
const ESCENARIO = args.escenario ?? 'duo';
const DURACION_S = Number(args.duracion ?? 60);
const HZ = Number(args.hz ?? 30);
const CORRIDA = Date.now().toString(36);
const PASSWORD = 'Carga-12345-ok';
const SLUGS = { duo: 'ciudad-sostenible-dual-quest-pixi', domino: 'dominexo-niveles-demo' };

if (!['duo', 'domino', 'mixto'].includes(ESCENARIO)) {
  console.error('--escenario debe ser duo, domino o mixto');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------- HTTP / sesión
async function http(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return json;
}

async function crearSesion(i) {
  const email = `carga-${CORRIDA}-${i}@carga.test`;
  await http('/auth/register', {
    method: 'POST',
    body: { email, plainPassword: PASSWORD, firstName: 'Bot', lastName: `Carga${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}` }, // el nombre no admite dígitos
  });
  const { accessToken } = await http('/auth/login', { method: 'POST', body: { email, plainPassword: PASSWORD } });
  return accessToken;
}

// ------------------------------------------------------- métricas de proceso
function pidDelPuerto(port) {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
      // Sin depender del idioma de Windows ("LISTENING"/"ESCUCHANDO"): un puerto en escucha tiene destino ":0".
      const linea = out.split('\n').find((l) => new RegExp(`:${port}\\s+\\S+:0\\s`).test(l));
      return linea ? Number(linea.trim().split(/\s+/).pop()) : null;
    }
    const out = execFileSync('sh', ['-c', `ss -ltnp 2>/dev/null | grep ':${port} ' | grep -o 'pid=[0-9]*' | head -1`], { encoding: 'utf8' });
    return Number(out.replace('pid=', '')) || null;
  } catch {
    return null;
  }
}

/** { cpuSeg, rssMb } acumulado del proceso. */
function leerProceso(pid) {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync(
        'powershell',
        ['-NoProfile', '-Command', `$p=Get-Process -Id ${pid}; "$($p.TotalProcessorTime.TotalSeconds) $($p.WorkingSet64)"`],
        { encoding: 'utf8' },
      ).trim();
      const [cpu, ws] = out.split(' ');
      return { cpuSeg: Number(cpu.replace(',', '.')), rssMb: Number(ws) / 1048576 };
    }
    const cpu = execFileSync('sh', ['-c', `awk '{print ($14+$15)/100}' /proc/${pid}/stat`], { encoding: 'utf8' }).trim();
    const rss = execFileSync('sh', ['-c', `awk '/VmRSS/{print $2}' /proc/${pid}/status`], { encoding: 'utf8' }).trim();
    return { cpuSeg: Number(cpu), rssMb: Number(rss) / 1024 };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------- bots
const stats = { msgs: 0, bytes: 0, errores: [], gaps: [], enviados: 0 };

function conectar(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`${URL_BASE}/rooms`, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.onAny((evento, payload) => {
      stats.msgs += 1;
      stats.bytes += JSON.stringify(payload ?? '').length;
    });
    socket.on('exception', (e) => stats.errores.push(JSON.stringify(e).slice(0, 160)));
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (e) => reject(new Error(`connect_error: ${e.message}`)));
  });
}

function esperar(socket, evento, filtro = () => true, ms = 15000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(evento, h);
      reject(new Error(`timeout esperando ${evento}`));
    }, ms);
    const h = (p) => {
      if (!filtro(p)) return;
      clearTimeout(t);
      socket.off(evento, h);
      resolve(p);
    };
    socket.on(evento, h);
  });
}

async function parejaDuo(a, b, gameId, fin) {
  a.emit('duo:create', { gameId, role: 'FIRE' });
  const sala = await esperar(a, 'duo:room');
  b.emit('duo:join', { code: sala.code });
  await esperar(b, 'duo:room', (v) => v.players?.length === 2);
  a.emit('duo:ready', { ready: true });
  b.emit('duo:ready', { ready: true });

  // Mide la separación entre snapshots (solo un bot por pareja, basta).
  let ultimo = 0;
  a.on('duo:snapshot', () => {
    const ahora = performance.now();
    if (ultimo) stats.gaps.push(ahora - ultimo);
    ultimo = ahora;
  });

  await Promise.all([a, b].map((s) => esperar(s, 'duo:room', (v) => v.phase === 'PLAYING', 30000)));
  const fase = Math.random() * Math.PI * 2;
  const timer = setInterval(() => {
    const t = performance.now() / 1000;
    [a, b].forEach((s, k) => {
      s.emit('duo:state', {
        player: { x: 200 + 80 * Math.sin(t + fase + k), y: 300, vx: 80 * Math.cos(t + fase + k), vy: 0, facing: 1, anim: 'run', dead: false },
        crates: [],
      });
      stats.enviados += 1;
    });
  }, 1000 / HZ);
  await fin;
  clearInterval(timer);
}

async function parejaDomino(a, b, gameId, fin) {
  a.emit('domino:create', { gameId });
  const sala = await esperar(a, 'domino:state');
  b.emit('domino:join', { code: sala.code });
  await esperar(b, 'domino:state');
  a.emit('domino:ready', { ready: true });
  b.emit('domino:ready', { ready: true });
  await fin;
}

// ---------------------------------------------------------------------- main
async function main() {
  console.log(`Corrida ${CORRIDA}: ${JUGADORES} bots, escenario=${ESCENARIO}, ${DURACION_S}s, ${HZ} Hz, ${URL_BASE}`);
  const pid = Number(args.pid) || pidDelPuerto(new URL(URL_BASE).port || 80);
  console.log(pid ? `Midiendo el proceso del servidor PID ${pid}` : 'AVISO: no se encontró el PID; solo habrá métricas de los bots.');

  const tokens = [];
  for (let i = 0; i < JUGADORES; i++) tokens.push(await crearSesion(i));
  console.log(`${tokens.length} sesiones creadas.`);

  const ids = {};
  for (const [tipo, slug] of Object.entries(SLUGS)) ids[tipo] = (await http(`/games/slug/${slug}`, { token: tokens[0] })).id;

  const sockets = await Promise.all(tokens.map(conectar));
  console.log(`${sockets.length} sockets conectados.`);

  const base = pid ? leerProceso(pid) : null;
  const muestras = [];
  let terminar;
  const fin = new Promise((r) => (terminar = r));

  const parejas = [];
  for (let i = 0; i < sockets.length; i += 2) {
    const tipo = ESCENARIO === 'mixto' ? (i / 2) % 2 === 0 ? 'duo' : 'domino' : ESCENARIO;
    const f = tipo === 'duo' ? parejaDuo : parejaDomino;
    parejas.push(f(sockets[i], sockets[i + 1], ids[tipo], fin).catch((e) => stats.errores.push(`pareja ${i / 2} (${tipo}): ${e.message}`)));
  }

  // Espera a que las salas arranquen y mide la ventana estable.
  await sleep(8000);
  stats.msgs = 0;
  stats.bytes = 0;
  stats.gaps.length = 0;
  stats.enviados = 0;
  let previo = pid ? leerProceso(pid) : null;
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < DURACION_S) {
    await sleep(2000);
    if (!pid) continue;
    const m = leerProceso(pid);
    if (m && previo) muestras.push({ cpuPct: ((m.cpuSeg - previo.cpuSeg) / 2) * 100, rssMb: m.rssMb });
    previo = m;
  }
  const segs = (Date.now() - t0) / 1000;
  terminar();
  await Promise.allSettled(parejas);
  sockets.forEach((s) => s.disconnect());

  // --------------------------------------------------------------- resultado
  const pct = (arr, p) => (arr.length ? [...arr].sort((x, y) => x - y)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : null);
  const prom = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
  const cpus = muestras.map((m) => m.cpuPct);
  const rss = muestras.map((m) => m.rssMb);
  const r = (x, d = 1) => (x === null ? 'n/d' : Number(x.toFixed(d)));
  const resultado = {
    corrida: CORRIDA,
    escenario: ESCENARIO,
    jugadores: JUGADORES,
    duracionS: Math.round(segs),
    hz: HZ,
    servidor: pid
      ? {
          // En Windows el % es de un núcleo = 100%; 100% = un núcleo completo.
          cpuPromPct: r(prom(cpus)),
          cpuP95Pct: r(pct(cpus, 0.95)),
          cpuMaxPct: r(Math.max(...cpus)),
          rssInicialMb: r(base?.rssMb ?? null),
          rssPromMb: r(prom(rss)),
          rssMaxMb: r(Math.max(...rss)),
        }
      : null,
    bots: {
      mensajesRecibidosPorSeg: r(stats.msgs / segs, 0),
      kbRecibidosPorSeg: r(stats.bytes / segs / 1024),
      mensajesEnviadosPorSeg: r(stats.enviados / segs, 0),
      snapshotGapMsProm: r(prom(stats.gaps)),
      snapshotGapMsP95: r(pct(stats.gaps, 0.95)),
      snapshotGapMsMax: r(Math.max(0, ...stats.gaps)),
    },
    errores: stats.errores.length,
    erroresMuestra: [...new Set(stats.errores)].slice(0, 5),
  };
  console.log('\n=== RESULTADO ===\n' + JSON.stringify(resultado, null, 2));
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'resultados');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${ESCENARIO}-${JUGADORES}-${CORRIDA}.json`), JSON.stringify(resultado, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error('Fallo la prueba:', e);
  process.exit(1);
});
