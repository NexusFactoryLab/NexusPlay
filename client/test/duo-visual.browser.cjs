// Recorrido visual de Dúo Lógico (issue #125): monta el motor del juego sin
// servidor, pone a los personajes en las zonas clave de cada escenario y saca
// capturas en .scratch/duo-visual-*.png para revisar sprites y animaciones.
// También comprueba que el motor no lanza errores y que las partículas viven.
//   1. Vite local: cd client && npx vite --port 5174
//   2. node client/test/duo-visual.browser.cjs
// PLAYWRIGHT_MODULE permite usar una instalación de Playwright fuera del proyecto.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.DEMO_TEST_URL || 'http://127.0.0.1:5174'

const fixture = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b1220;overflow:hidden}#host{position:fixed;inset:0}</style></head>
<body><div id="host"></div><script type="module">
const { DuoGame } = await import('/src/components/home/games/duo-logico/engine/DuoGame.ts');
const { duoLevel } = await import('/src/components/home/games/duo-logico/shared/levels/index.ts');
const { createWorldState } = await import('/src/components/home/games/duo-logico/shared/duoWorld.ts');
let game = null;
let world = null;
let partner = null;
window.start = async (levelId) => {
  if (game) game.destroy();
  document.getElementById('host').innerHTML = '';
  const level = duoLevel(levelId);
  world = createWorldState(level);
  game = new DuoGame({ level, role: 'FIRE', names: { FIRE: 'Ana', WATER: 'Luis' }, sendState: () => {} });
  await game.mount(document.getElementById('host'));
  game.setPhase('PLAYING', 1);
  window.game = game;
};
window.place = (col, row) => {
  game.me.x = col * 64 + 32; game.me.y = (row + 1) * 64;
  game.prevMe.x = game.me.x; game.prevMe.y = game.me.y;
  game.me.vx = 0; game.me.vy = 0; game.cam.ready = false;
};
window.partnerAt = (col, row, anim) => {
  partner = { x: col * 64 + 32, y: (row + 1) * 64, vx: 0, vy: 0, facing: -1, anim, dead: false };
};
window.setWorld = (patch) => {
  for (const k of ['switches', 'gates', 'coins', 'mirrors', 'scales', 'keys', 'locks', 'flags', 'gems', 'pools']) Object.assign(world[k], patch[k] || {});
  // Cajas: { id: [x, y] } en píxeles.
  for (const [id, [x, y]] of Object.entries(patch.crates || {})) Object.assign(world.crates.find((c) => c.id === id), { x, y });
};
// El "servidor" de mentira reparte el mundo y la posición del compañero.
setInterval(() => {
  if (!game || !world) return;
  const now = Date.now();
  const players = partner ? { WATER: { ...partner } } : {};
  game.applySnapshot({ t: now, players, at: partner ? { WATER: now } : {}, world: JSON.parse(JSON.stringify(world)) }, now);
}, 33);
window.liveParticles = () => game.fx.count;
</script></body></html>`

async function main() {
  mkdirSync('.scratch', { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const view of [{ width: 1280, height: 720, tag: 'desktop' }, { width: 844, height: 390, tag: 'mobile' }]) {
      const page = await browser.newPage({ viewport: { width: view.width, height: view.height } })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
      await page.route('**/__duo-visual', (route) => route.fulfill({ contentType: 'text/html', body: fixture }))
      await page.goto(base + '/__duo-visual')
      await page.waitForFunction(() => typeof window.start === 'function')

      const shots = [
        // Bosque: islas flotantes y botón; pozos de lava y agua con los dos nadando; el portal.
        { level: 'bosque', me: [5, 9], partner: [8, 9, 'idle'], world: {}, name: 'bosque-inicio' },
        { level: 'bosque', me: [33, 11], partner: [41, 11, 'swim'], world: { switches: { 'palanca-lumen': true } }, name: 'bosque-pozos' },
        { level: 'bosque', me: [24, 9], partner: [22, 9, 'idle'], world: { gates: { 'puerta-1': true } }, name: 'bosque-puerta' },
        { level: 'bosque', me: [66, 6], partner: [68, 6, 'idle'], world: { gates: { 'puerta-1': true, 'puerta-2': true } }, name: 'bosque-portal' },
        // Retos en pareja (issue #128).
        { level: 'bosque', me: [49, 9], partner: [47, 9, 'idle'], world: {}, name: 'bosque-zarzas' },
        { level: 'bosque', me: [53, 9], partner: [48, 9, 'idle'], world: { switches: { 'boton-zarzas-a': true } }, name: 'bosque-zarzas-abiertas' },
        { level: 'bosque', me: [62, 7], partner: [58, 11, 'idle'], world: { scales: { bascula: 128 }, flags: { 'bandera-pozos': true } }, name: 'bosque-bascula' },
        { level: 'bosque', me: [68, 9], partner: [64, 9, 'idle'], world: { keys: { llave: 'FIRE' } }, name: 'bosque-llave' },
        { level: 'bosque', me: [79, 9], partner: [80, 9, 'push'], world: { gates: { 'puerta-2': true } }, name: 'bosque-caja-metal' },
        { level: 'bosque', me: [94, 6], partner: [97, 1, 'idle'], world: { gates: { 'puerta-2': true }, flags: { 'bandera-muro': true } }, name: 'bosque-hongo-ramas' },
        // Planta solar: espejos con la luz, tanques de agua y sales, portal.
        { level: 'solar', me: [30, 9], partner: [26, 9, 'idle'], world: { mirrors: { 'espejo-1': 2, 'espejo-2': 1 } }, name: 'solar-espejos' },
        { level: 'solar', me: [69, 11], partner: [62, 11, 'swim'], world: { gates: { 'puerta-1': true, 'puerta-2': true }, switches: { 'boton-fondo': true } }, name: 'solar-tanques' },
        { level: 'solar', me: [74, 9], partner: [72, 9, 'idle'], world: { gates: { 'puerta-1': true, 'puerta-2': true } }, name: 'solar-portal' },
        { level: 'solar', me: [47, 9], partner: [44, 9, 'idle'], world: {}, name: 'solar-rayo' },
        { level: 'solar', me: [64, 9], partner: [65, 9, 'idle'], world: { gates: { 'puerta-2': true } }, name: 'solar-caja-placa' },
        { level: 'solar', me: [103, 7], partner: [99, 11, 'idle'], world: { scales: { bascula: 128 }, locks: { candado: true }, keys: { llave: 'used' } }, name: 'solar-bascula' },
        // Río (issue #132): canal con válvula y troncos, túnel con corriente, pozo de la llave, vasos comunicantes, mirador.
        { level: 'rio', me: [5, 9], partner: [8, 9, 'idle'], world: {}, name: 'rio-canal-bajo' },
        { level: 'rio', me: [11, 9], partner: [7, 9, 'idle'], world: { switches: { 'valvula-a': true }, pools: { canal: 192 } }, name: 'rio-canal-lleno' },
        { level: 'rio', me: [36, 9], partner: [35, 12, 'swim'], world: { switches: { 'valvula-a': false }, pools: { canal: 64 }, gates: { 'puerta-1': true } }, name: 'rio-tunel-corriente' },
        { level: 'rio', me: [30, 9], partner: [42, 12, 'swim'], world: { switches: { compuerta: true }, gates: { 'puerta-1': true } }, name: 'rio-tunel-compuerta' },
        { level: 'rio', me: [54, 9], partner: [55, 11, 'swim'], world: { switches: { compuerta: false, 'palanca-zarzas': true, 'valvula-pozo': true }, pools: { pozo: 120 }, keys: { llave: 'WATER' }, flags: { 'bandera-tunel': true } }, name: 'rio-pozo' },
        { level: 'rio', me: [77, 9], partner: [80, 9, 'idle'], world: { switches: { 'valvula-pozo': false, 'valvula-media': true }, pools: { pozo: 0, 'vaso-1': 0, 'vaso-2': 192 }, keys: { llave: 'used' }, locks: { 'compuerta-llave': true }, gates: { 'puerta-2': true } }, name: 'rio-vasos' },
        { level: 'rio', me: [90, 5], partner: [95, 12, 'swim'], world: { switches: { 'valvula-media': false }, pools: { 'vaso-1': 192, 'vaso-2': 0 }, flags: { 'bandera-vasos': true } }, name: 'rio-mirador' },
        // Reciclaje: cinta y prensas, báscula con el cubo, pasillo de prensas, estante de la llave y cintas del final.
        { level: 'reciclaje', me: [9, 9], partner: [4, 9, 'idle'], world: { switches: { 'boton-cinta-a': true } }, name: 'reciclaje-cinta' },
        { level: 'reciclaje', me: [28, 7], partner: [24, 11, 'idle'], world: { switches: { 'boton-cinta-a': false }, scales: { bascula: 128 }, crates: { 'cubo-carton': [1585, 710] } }, name: 'reciclaje-bascula' },
        { level: 'reciclaje', me: [47, 9], partner: [51, 9, 'walk'], world: { switches: { 'freno-a': true }, gates: { 'puerta-1': true } }, name: 'reciclaje-prensas' },
        { level: 'reciclaje', me: [52, 9], partner: [47, 9, 'idle'], world: { switches: { 'freno-a': false } }, name: 'reciclaje-prensas-andando' },
        { level: 'reciclaje', me: [60, 9], partner: [64, 5, 'idle'], world: { switches: { 'boton-repisa': true }, keys: { llave: 'WATER' } }, name: 'reciclaje-estante' },
        { level: 'reciclaje', me: [93, 6], partner: [98, 6, 'walk'], world: { switches: { 'boton-repisa': false, cerrojo: true }, keys: { llave: 'used' }, locks: { 'puerta-llave': true }, gates: { 'puerta-2': true }, flags: { 'bandera-cubo': true } }, name: 'reciclaje-final' },
        // Ciudad: semáforos (en rojo y con el pulsador), teleférico, azotea de la llave, puerta de arco y terraza.
        { level: 'ciudad', me: [6, 9], partner: [3, 9, 'idle'], world: {}, name: 'ciudad-semaforos' },
        { level: 'ciudad', me: [14, 9], partner: [5, 9, 'idle'], world: { switches: { 'pulsador-a': true } }, name: 'ciudad-semaforos-verde' },
        { level: 'ciudad', me: [22, 9], partner: [36, 9, 'idle'], world: { switches: { 'pulsador-a': false } }, name: 'ciudad-teleferico' },
        { level: 'ciudad', me: [54, 3], partner: [45, 11, 'idle'], world: { scales: { bascula: 128 }, keys: { llave: 'FIRE' }, gates: { 'puerta-1': true }, crates: { 'caja-carga': [2915, 710] } }, name: 'ciudad-azotea' },
        { level: 'ciudad', me: [59, 9], partner: [57, 9, 'idle'], world: { scales: { bascula: 0 }, keys: { llave: 'FIRE' }, flags: { 'farol-1': true } }, name: 'ciudad-puerta' },
        { level: 'ciudad', me: [64, 9], partner: [60, 9, 'idle'], world: { keys: { llave: 'used' }, locks: { 'puerta-arco': true } }, name: 'ciudad-puerta-abierta' },
        { level: 'ciudad', me: [90, 5], partner: [80, 9, 'idle'], world: { gates: { 'puerta-2': true }, flags: { 'farol-2': true } }, name: 'ciudad-terraza' },
      ]
      let level = null
      for (const shot of shots) {
        if (shot.level !== level) {
          await page.evaluate((id) => window.start(id), shot.level)
          level = shot.level
        }
        // Primero el mundo (la báscula se acomoda) y después los personajes.
        await page.evaluate((s) => window.setWorld(s.world), shot)
        await page.waitForTimeout(450)
        await page.evaluate((s) => {
          window.place(s.me[0], s.me[1])
          window.partnerAt(s.partner[0], s.partner[1], s.partner[2])
        }, shot)
        await page.waitForTimeout(1400)
        await page.screenshot({ path: `.scratch/duo-visual-${shot.name}-${view.tag}.png` })
        assert.ok((await page.evaluate(() => window.liveParticles())) > 0, `${shot.name}: hay partículas vivas`)
      }
      assert.deepEqual(errors, [], `${view.tag}: sin errores del motor`)
      console.log(`PASS duo-visual ${view.tag}: ${shots.length} escenas`)
      await page.close()
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
