// Vite local. Reutiliza Playwright mediante PLAYWRIGHT_MODULE sin instalar dependencias.
// Tutoriales jugables sobre el juego real (issue #93): al final de la guía se
// pregunta «¿Deseas jugar un tutorial?»; «Sí» abre el tutorial por partes y
// «No» (o «Saltar tutorial») lleva directo al juego.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.DEMO_TEST_URL || 'http://127.0.0.1:5173'
const only = process.argv[2]

const fixture = (game) => `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
const reactModule=await import('/node_modules/.vite/deps/react.js'); const React=reactModule.default??reactModule;
const domModule=await import('/node_modules/.vite/deps/react-dom_client.js'); const {createRoot}=domModule.default??domModule;
await import('/src/index.css');
const {AuthProvider}=await import('/src/hooks/useAuth.tsx'); const {ThemeProvider}=await import('/src/hooks/useTheme.tsx');
let el;
if ('${game}'==='MAZE') {
  const T=await import('/src/components/home/games/mazeCollectorTypes.ts');
  const {MazeCollectorGame}=await import('/src/components/home/games/MazeCollectorGame.tsx');
  const items=['Botella','Lata','Caja','Vidrio'].map((l,i)=>({itemId:'i'+i,label:l,icon:'target',color:'#2ecc71'}));
  el=React.createElement(MazeCollectorGame,{title:'Camión reciclador',primaryColor:'#2ecc71',layout:T.MAZE_LAYOUTS.CITY,items,config:{...T.DEFAULT_MAZE_CONFIG,layout:'CITY'},onExit:()=>{window.exited=1}});
}
createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(ThemeProvider,null,el)));
</script></body></html>`

async function openGame(browser, game, viewport, touch) {
  const page = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/__tutorial-fixture', (route) => route.fulfill({ contentType: 'text/html', body: fixture(game) }))
  await page.route('**/auth/refresh', (route) => route.fulfill({ status: 401, json: {} }))
  await page.goto(base + '/__tutorial-fixture')
  return { page, errors }
}

const press = async (page, key, wait = 0) => {
  await page.keyboard.press(key)
  if (wait) await page.waitForTimeout(wait)
}

async function mazeTutorial(browser, viewport, touch) {
  const tag = `${viewport.width}${touch ? '-touch' : ''}`
  const { page, errors } = await openGame(browser, 'MAZE', viewport, touch)
  const guide = page.locator('[data-game-guide="MAZE_COLLECTOR"]')
  await guide.waitFor()
  for (let i = 0; i < 4; i++) await guide.getByRole('button', { name: /Siguiente/ }).click()
  await guide.getByRole('group', { name: '¿Deseas jugar un tutorial?' }).waitFor()
  assert.equal(await guide.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), true, 'La guía no tiene scroll')
  await page.screenshot({ path: `.scratch/tutorial-maze-pregunta-${tag}.png` })
  await guide.getByRole('button', { name: /Sí/ }).click()

  const runner = page.locator('[data-game-tutorial]')
  await runner.waitFor()
  await page.getByText('Parte 1 de 4').waitFor()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `.scratch/tutorial-maze-parte1-${tag}.png` })
  if (touch) {
    // En celular no hay teclado: se maneja con la cruceta del juego.
    await page.getByRole('button', { name: 'Derecha' }).tap()
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Abajo' }).tap()
  } else {
    await press(page, 'ArrowRight', 1200)
    await press(page, 'ArrowDown')
  }
  const card = page.getByRole('dialog', { name: /Tutorial de/ })
  await card.waitFor({ timeout: 8000 })
  await card.getByText('Parte 2 de 4').waitFor()
  await page.screenshot({ path: `.scratch/tutorial-maze-entre-partes-${tag}.png` })
  await card.getByRole('button', { name: /Siguiente/ }).click()

  // Parte 2: recoger 4 botellas (derecha, abajo por la columna 5, izquierda y de vuelta a la derecha).
  await page.getByText('Recoge las 4 botellas PET de esta zona.').waitFor()
  if (!touch) {
    await press(page, 'ArrowRight', 60)
    await press(page, 'ArrowDown', 1550)
    await press(page, 'ArrowLeft', 1400)
    await press(page, 'ArrowRight')
    await card.getByText('Parte 3 de 4').waitFor({ timeout: 8000 })
    await page.screenshot({ path: `.scratch/tutorial-maze-parte3-${tag}.png` })
    await card.getByRole('button', { name: /Siguiente/ }).click()
    await page.getByText('Parte 3 de 4').waitFor()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `.scratch/tutorial-maze-parte3-juego-${tag}.png` })
  }
  // «Saltar tutorial» (la X de la barra) lleva al juego real.
  await page.getByRole('button', { name: 'Salir del tutorial' }).click()
  await runner.waitFor({ state: 'detached' })
  await page.getByRole('heading', { name: '¡A limpiar la ciudad!' }).waitFor()
  assert.deepEqual(errors, [])
  console.log(`PASS ${tag} Camión: pregunta sin scroll, Sí → parte 1 enfocada y lograda, explicación, parte 2${touch ? '' : ' lograda'}, salir → juego`)
  await page.close()
}

async function main() {
  mkdirSync('.scratch', { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    if (!only || only === 'MAZE') {
      await mazeTutorial(browser, { width: 1280, height: 800 }, false)
      await mazeTutorial(browser, { width: 390, height: 844 }, true)
    }
  } finally {
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
