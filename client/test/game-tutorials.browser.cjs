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
if ('${game}'==='TF') {
  const {TrueFalseMazeGame}=await import('/src/components/home/games/true-false-maze/TrueFalseMazeGame.tsx');
  const {DEFAULT_TRUE_FALSE_MAZE_CONFIG}=await import('/src/components/home/games/true-false-maze/trueFalseMazeTypes.ts');
  const qs=[1,2,3].map(i=>({questionId:'q'+i,statement:'Afirmación de prueba '+i+'.',answer:i%2==0,explanation:'Explicación.'}));
  el=React.createElement(TrueFalseMazeGame,{title:'Misión Galáctica',questions:qs,config:DEFAULT_TRUE_FALSE_MAZE_CONFIG,onExit:()=>{window.exited=1}});
}
if ('${game}'==='MEMORY') {
  const {MemoryMatchGame}=await import('/src/components/home/games/MemoryMatchGame.tsx');
  // Cada imagen lleva su nombre dentro del SVG: así la prueba sabe qué cartas hacen pareja.
  const image=(label)=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#c7d2fe"/><text x="60" y="66" font-size="18" text-anchor="middle">'+label+'</text></svg>');
  const pairs=['Perro','Gato','Pez','Loro'].map((label,i)=>({mode:'PAIRS',pairId:'p'+i,imageUrl:image(label),label}));
  el=React.createElement(MemoryMatchGame,{title:'Animales',primaryColor:'#7c3aed',pairs,pairCount:4,difficulty:'normal',showPreview:true,perZone:4,timePerZoneSeconds:90,previewSeconds:5,onExit:()=>{window.exited=1}});
}
createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(ThemeProvider,null,el)));
</script></body></html>`

/** Pares del tablero de MatchMente que siguen sin descubrir: [índice de la imagen, índice del nombre]. */
async function memoryPairs(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-game-tutorial] .grid > button')]
    const keyOf = (card) => {
      const img = card.querySelector('img')
      if (img) return decodeURIComponent(img.getAttribute('src')).match(/>([^<]+)<\/text>/)?.[1] ?? '?'
      // El reverso trae un ✦ y las cartas de palabra, la etiqueta «Aa»: solo cuenta el nombre.
      return card.textContent.replace(/✦|Aa/g, '').trim()
    }
    const groups = {}
    cards.forEach((card, index) => {
      if (card.disabled) return
      const key = keyOf(card)
      ;(groups[key] ??= []).push(index)
    })
    return Object.values(groups).filter((group) => group.length === 2)
  })
}

async function flipPair(page, [a, b]) {
  const cards = page.locator('[data-game-tutorial] .grid > button')
  await cards.nth(a).click()
  await cards.nth(b).click()
  await page.waitForTimeout(900)
}

async function memoryTutorial(browser, viewport, touch) {
  const tag = `${viewport.width}${touch ? '-touch' : ''}`
  const { page, errors } = await openGame(browser, 'MEMORY', viewport, touch)
  const intro = page.locator('[data-game-instructions]')
  await intro.waitFor()
  const question = intro.getByRole('group', { name: '¿Deseas jugar un tutorial?' })
  await question.waitFor()
  const dialog = page.getByRole('dialog').last()
  assert.equal(await dialog.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), true, 'La guía no tiene scroll')
  await page.screenshot({ path: `.scratch/tutorial-memoria-pregunta-${tag}.png` })
  await question.getByRole('button', { name: 'Sí' }).click()

  await page.locator('[data-game-tutorial]').waitFor()
  await page.getByText('Parte 1 de 3').waitFor()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `.scratch/tutorial-memoria-parte1-${tag}.png` })
  const card = page.getByRole('dialog', { name: /Tutorial de/ })
  await card.getByText('Parte 2 de 3').waitFor({ timeout: 12000 })
  await card.getByRole('button', { name: /Siguiente/ }).click()

  await page.getByText('Parte 2 de 3').waitFor()
  await page.waitForTimeout(500)
  await flipPair(page, (await memoryPairs(page))[0])
  await card.getByText('Parte 3 de 3').waitFor({ timeout: 6000 })
  await card.getByRole('button', { name: /Siguiente/ }).click()

  await page.getByRole('button', { name: /¡Ya, a jugar!/ }).click()
  await page.waitForTimeout(400)
  for (const pair of await memoryPairs(page)) await flipPair(page, pair)
  await card.getByRole('heading', { name: '¡Tutorial completado!' }).waitFor({ timeout: 8000 })
  await page.screenshot({ path: `.scratch/tutorial-memoria-fin-${tag}.png` })
  await card.getByRole('button', { name: /¡A jugar!/ }).click()
  await page.locator('[data-game-tutorial]').waitFor({ state: 'detached' })
  await page.getByText(/Zona 1 de/).waitFor()
  assert.deepEqual(errors, [])
  console.log(`PASS ${tag} MatchMente: pregunta sin scroll, Sí → memorizar, pareja y zona en el tablero real, ¡A jugar! → juego`)
  await page.close()
}

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

async function tfTutorial(browser, viewport, touch) {
  const tag = `${viewport.width}${touch ? '-touch' : ''}`
  const { page, errors } = await openGame(browser, 'TF', viewport, touch)
  const guide = page.locator('[data-game-guide]')
  await guide.waitFor()
  for (let i = 0; i < 4; i++) await guide.getByRole('button', { name: /Siguiente/ }).click()
  await guide.getByRole('group', { name: '¿Deseas jugar un tutorial?' }).waitFor()
  assert.equal(await guide.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), true, 'La guía no tiene scroll')
  await page.screenshot({ path: `.scratch/tutorial-tf-pregunta-${tag}.png` })
  await guide.getByRole('button', { name: /Sí/ }).click()
  await page.locator('[data-game-tutorial]').waitFor()
  await page.getByText('Parte 1 de 3').waitFor()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `.scratch/tutorial-tf-parte1-${tag}.png` })
  assert.equal(await page.getByRole('button', { name: 'Despegar' }).count(), 0, 'El tutorial arranca solo, sin la pantalla de inicio')
  await page.getByRole('button', { name: 'Salir del tutorial' }).click()
  await page.locator('[data-game-tutorial]').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: /Despegar/ }).waitFor()
  assert.deepEqual(errors, [])
  console.log(`PASS ${tag} Laberinto V/F: pregunta sin scroll, Sí → parte 1 en la nave real sin pantalla de inicio, salir → juego`)
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
    if (!only || only === 'TF') {
      await tfTutorial(browser, { width: 1280, height: 800 }, false)
      await tfTutorial(browser, { width: 390, height: 844 }, true)
    }
    if (!only || only === 'MEMORY') {
      await memoryTutorial(browser, { width: 1280, height: 800 }, false)
      await memoryTutorial(browser, { width: 390, height: 844 }, true)
    }
  } finally {
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
