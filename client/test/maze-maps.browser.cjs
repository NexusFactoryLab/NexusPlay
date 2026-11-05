// Vite local. Reutiliza Playwright mediante PLAYWRIGHT_MODULE sin instalar dependencias.
// Los 4 mapas de "Salvando el mundo con sostenibilidad" (issue #162): el fondo
// de 24x19 coincide con la cuadrícula, y en Amazonia, Océano y Páramo el muñeco
// cambia de tira según hacia dónde avanza (sin girar). Deja capturas en .scratch/.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.DEMO_TEST_URL || 'http://127.0.0.1:5173'

const fixture = (layout, guide) => `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
const mainCode=await (await fetch('/src/main.tsx')).text(); const depUrl=(name)=>{const at=mainCode.indexOf('/node_modules/.vite/deps/'+name+'?v=');return mainCode.slice(at,mainCode.indexOf('"',at))};
const reactModule=await import(depUrl('react.js')); const React=reactModule.default??reactModule;
const domModule=await import(depUrl('react-dom_client.js')); const {createRoot}=domModule.default??domModule;
await import('/src/index.css');
const {AuthProvider}=await import('/src/hooks/useAuth.tsx'); const {ThemeProvider}=await import('/src/hooks/useTheme.tsx');
const T=await import('/src/components/home/games/mazeCollectorTypes.ts');
const {MazeCollectorGame}=await import('/src/components/home/games/MazeCollectorGame.tsx');
const Q=await import('/src/components/home/games/mazeCollectorQuestions.ts');
const items=['Botella','Lata','Caja','Vidrio'].map((l,i)=>({itemId:'i'+i,label:l,icon:'target',color:'#2ecc71'}));
const el=React.createElement(MazeCollectorGame,{title:'Salvando el mundo',primaryColor:'#2ecc71',layout:T.MAZE_LAYOUTS['${layout}'],items,config:{...T.DEFAULT_MAZE_CONFIG,layout:'${layout}',enemySpeed:0.2},questions:Q.QUESTIONS_BY_MAP['${layout}'],skipGuide:${guide ? 'false' : 'true'},onExit:()=>{window.exited=1}});
createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(ThemeProvider,null,el)));
</script></body></html>`

const MAPS = { CITY: '¡A limpiar la ciudad!', AMAZON: '¡A salvar la selva!', OCEAN: '¡A limpiar el océano!', PARAMO: '¡A proteger el páramo!' }

async function open(browser, layout, guide = false) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  const errors = []
  const missing = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) => missing.push(request.url()))
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes('maze-collector')) missing.push(response.url())
  })
  await page.route('**/__maze-maps-fixture', (route) => route.fulfill({ contentType: 'text/html', body: fixture(layout, guide) }))
  await page.route('**/auth/refresh', (route) => route.fulfill({ status: 401, json: {} }))
  await page.goto(base + '/__maze-maps-fixture')
  return { page, errors, missing }
}

/** Imágenes de fondo de los sprites del jugador que se ven ahora (nombres de archivo). */
async function truckSprites(page, root = 'body') {
  return page.evaluate((root) =>
    [...document.querySelectorAll(root + ' [aria-hidden="true"]')]
      .map((el) => el.style.backgroundImage)
      .filter((bg) => bg.includes('truck-'))
      .map((bg) => bg.slice(bg.lastIndexOf('/') + 1).split('.')[0]),
  root)
}

;(async () => {
  mkdirSync('.scratch', { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const [layout, title] of Object.entries(MAPS)) {
      const { page, errors, missing } = await open(browser, layout)
      await page.getByRole('heading', { name: title }).waitFor()
      await page.screenshot({ path: `.scratch/mapa-${layout}-inicio.png` })
      await page.getByRole('button', { name: /Empezar/ }).click()
      // La primera pregunta se presenta encima del juego: se cierra para poder manejar.
      const intro = page.getByRole('button', { name: /A buscarla/ })
      await intro.waitFor({ timeout: 4000 }).then(() => intro.click(), () => {})
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `.scratch/mapa-${layout}-juego.png` })
      const seen = {}
      for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
        await page.keyboard.down(key)
        await page.waitForTimeout(700)
        await page.keyboard.up(key)
        seen[key] = await truckSprites(page)
      }
      await page.screenshot({ path: `.scratch/mapa-${layout}-moviendo.png` })
      const all = Object.values(seen).flat()
      if (layout === 'CITY') {
        assert.ok(all.every((name) => !/-(down|left|right|up)$/.test(name)), `Ciudad sin tiras por dirección: ${all}`)
      } else {
        assert.ok(all.length > 0, `${layout}: se ve el muñeco`)
        assert.ok(all.every((name) => /-(down|left|right|up)$/.test(name)), `${layout}: tiras por dirección: ${all}`)
        assert.ok(new Set(all).size >= 2, `${layout}: cambia de tira al girar: ${JSON.stringify(seen)}`)
      }
      assert.deepEqual(errors, [])
      assert.deepEqual(missing, [])
      console.log(`PASS ${layout}: fondo, inicio y muñeco ${JSON.stringify(seen)}`)
      await page.close()
    }
    // La guía, con el muñeco de Amazonia: la tira de frente, sin girar.
    const { page, errors, missing } = await open(browser, 'AMAZON', true)
    const guide = page.locator('[data-game-guide="MAZE_COLLECTOR"]')
    await guide.waitFor()
    for (let step = 1; step <= 5; step++) {
      await page.screenshot({ path: `.scratch/guia-AMAZON-paso${step}.png` })
      const names = await truckSprites(page, '[data-game-guide="MAZE_COLLECTOR"]')
      assert.ok(names.every((name) => name.startsWith('amazon-truck-') && name.endsWith('-down')), `guía paso ${step}: ${names}`)
      await guide.getByRole('button', { name: /Siguiente/ }).click()
    }
    assert.deepEqual(errors, [])
    assert.deepEqual(missing, [])
    console.log('PASS guía de Amazonia con la tira de frente')
    await page.close()
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
