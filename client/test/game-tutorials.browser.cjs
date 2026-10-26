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
  const Q=await import('/src/components/home/games/mazeCollectorQuestions.ts');
  const items=['Botella','Lata','Caja','Vidrio'].map((l,i)=>({itemId:'i'+i,label:l,icon:'target',color:'#2ecc71'}));
  el=React.createElement(MazeCollectorGame,{title:'Camión reciclador',primaryColor:'#2ecc71',layout:T.MAZE_LAYOUTS.CITY,items,config:{...T.DEFAULT_MAZE_CONFIG,layout:'CITY'},questions:Q.SUSTAINABLE_CITY_QUESTIONS,onExit:()=>{window.exited=1}});
}
if ('${game}'==='TF') {
  const {TrueFalseMazeGame}=await import('/src/components/home/games/true-false-maze/TrueFalseMazeGame.tsx');
  const {DEFAULT_TRUE_FALSE_MAZE_CONFIG}=await import('/src/components/home/games/true-false-maze/trueFalseMazeTypes.ts');
  const qs=[1,2,3].map(i=>({questionId:'q'+i,statement:'Afirmación de prueba '+i+'.',answer:i%2==0,explanation:'Explicación.'}));
  el=React.createElement(TrueFalseMazeGame,{title:'Misión Galáctica',questions:qs,config:DEFAULT_TRUE_FALSE_MAZE_CONFIG,onExit:()=>{window.exited=1}});
}
if ('${game}'==='GUESS_WHO') {
  const {GameInstructionsGate}=await import('/src/components/home/games/GameInstructionsGate.tsx');
  const {GuessWhoTutorial}=await import('/src/components/home/games/tutorial/GuessWhoTutorial.tsx');
  el=React.createElement(GameInstructionsGate,{kind:'GUESS_WHO',tutorial:(onFinish)=>React.createElement(GuessWhoTutorial,{tournament:false,onFinish})},React.createElement('p',{id:'room'},'Sala real'));
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
      // Las cartas del tutorial son universales: cada emoji de la imagen se corresponde con su nombre.
      const names = { '🐶': 'Perro', '🐱': 'Gato', '🍓': 'Fresa', '🐠': 'Pez' }
      if (img) {
        const emoji = decodeURIComponent(img.getAttribute('src')).match(/>([^<]+)<\/text>/)?.[1] ?? '?'
        return names[emoji] ?? emoji
      }
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
  // La guía de MatchMente es la misma de 5 pasos del Laberinto V/F (aquí son 4).
  const intro = page.locator('[data-game-guide="PAIRS"]')
  await intro.waitFor()
  await page.screenshot({ path: `.scratch/guia-memoria-paso1-${tag}.png` })
  for (let i = 0; i < 3; i++) await intro.getByRole('button', { name: /Siguiente/ }).click()
  const question = intro.getByRole('group', { name: '¿Deseas jugar un tutorial?' })
  await question.waitFor()
  assert.equal(await intro.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), true, 'La guía no tiene scroll')
  await page.screenshot({ path: `.scratch/tutorial-memoria-pregunta-${tag}.png` })
  await question.getByRole('button', { name: 'Sí' }).click()

  await page.locator('[data-game-tutorial]').waitFor()
  await page.screenshot({ path: `.scratch/tutorial-memoria-instruccion-${tag}.png` })
  await understood(page, 'Parte 1 de 3')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `.scratch/tutorial-memoria-parte1-${tag}.png` })
  const card = page.getByRole('dialog', { name: /Tutorial de/ })
  await understood(page, 'Parte 2 de 3')

  await page.waitForTimeout(500)
  await flipPair(page, (await memoryPairs(page))[0])
  await understood(page, 'Parte 3 de 3')

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
  // Sin animaciones continuas: Playwright espera a que un elemento deje de moverse antes de tocarlo.
  const page = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch, reducedMotion: process.env.TUT_MOTION ? 'no-preference' : 'reduce' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/__tutorial-fixture', (route) => route.fulfill({ contentType: 'text/html', body: fixture(game) }))
  await page.route('**/auth/refresh', (route) => route.fulfill({ status: 401, json: {} }))
  await page.goto(base + '/__tutorial-fixture')
  return { page, errors }
}

/** Cada parte empieza con su instrucción en el centro: «Entendido» la cierra y arranca el juego. */
async function understood(page, part) {
  const card = page.getByRole('dialog', { name: /Tutorial de/ })
  if (part) await card.getByText(part).waitFor({ timeout: 12000 })
  await card.getByRole('button', { name: /Entendido/ }).click()
  await card.waitFor({ state: 'hidden' })
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
  for (let i = 0; i < 5; i++) await guide.getByRole('button', { name: /Siguiente/ }).click()
  await guide.getByRole('group', { name: '¿Deseas jugar un tutorial?' }).waitFor()
  assert.equal(await guide.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), true, 'La guía no tiene scroll')
  await page.screenshot({ path: `.scratch/tutorial-maze-pregunta-${tag}.png` })
  await guide.getByRole('button', { name: /Sí/ }).click()

  const runner = page.locator('[data-game-tutorial]')
  await runner.waitFor()
  await understood(page, 'Parte 1 de 5')
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
  await card.getByText('Parte 2 de 5').waitFor({ timeout: 8000 })
  await page.screenshot({ path: `.scratch/tutorial-maze-entre-partes-${tag}.png` })
  await understood(page)

  // Parte 2: recoger 4 botellas (derecha, abajo por la columna 5, izquierda y de vuelta a la derecha).
  if (!touch) {
    await press(page, 'ArrowRight', 60)
    await press(page, 'ArrowDown', 1550)
    await press(page, 'ArrowLeft', 1400)
    await press(page, 'ArrowRight')
    await card.getByText('Parte 3 de 5').waitFor({ timeout: 8000 })
    await page.screenshot({ path: `.scratch/tutorial-maze-parte3-${tag}.png` })
    await understood(page)
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
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `.scratch/tutorial-tf-instruccion-${tag}.png` })
  await understood(page, 'Parte 1 de 6')
  await page.waitForTimeout(800)
  assert.equal(await page.getByRole('button', { name: 'Despegar' }).count(), 0, 'El tutorial arranca solo, sin la pantalla de inicio')
  // Parte 1: mover el robot en UNA dirección no basta; hay que usar las cuatro.
  const card = page.getByRole('dialog', { name: /Tutorial de/ })
  if (touch) {
    await page.getByRole('button', { name: 'Derecha' }).tap()
    await page.waitForTimeout(900)
    assert.equal(await card.isVisible(), false, 'Con una sola dirección la parte no avanza')
    for (const name of ['Abajo', 'Izquierda', 'Arriba']) {
      await page.getByRole('button', { name }).tap()
      await page.waitForTimeout(900)
    }
  } else {
    await press(page, 'ArrowRight', 900)
    assert.equal(await card.isVisible(), false, 'Con una sola dirección la parte no avanza')
    await press(page, 'ArrowDown', 900)
    await press(page, 'ArrowLeft', 900)
    await press(page, 'ArrowUp', 900)
  }
  await page.screenshot({ path: `.scratch/tutorial-tf-instruccion2-${tag}.png` })
  await understood(page, 'Parte 2 de 6')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `.scratch/tutorial-tf-parte2-${tag}.png` })
  if (!touch) {
    // El juego deja su estado en window.__tfMaze (solo en desarrollo): así la prueba sabe dónde está el robot.
    const robotAt = (row, col) => page.waitForFunction(([r, c]) => {
      const pos = window.__tfMaze?.state.player.pos
      return pos && pos.row === r && pos.col === c
    }, [row, col], { timeout: 8000 })
    // 2. Cruzar: derecha hasta la puerta; si la medusa atrapa al robot tres veces, la parte se reintenta.
    for (let attempt = 0; attempt < 6; attempt++) {
      for (let i = 0; i < 4 && !(await card.isVisible()); i++) {
        await page.keyboard.press('ArrowRight')
        if (attempt === 0 && i === 0) {
          await page.screenshot({ path: `.scratch/tutorial-tf-puerta-cerrada-${tag}.png` })
          await page.waitForFunction(() => window.__tfMaze?.state.player.pos.col === 7, null, { timeout: 5000 }).catch(() => {})
          await page.waitForTimeout(260)
          await page.screenshot({ path: `.scratch/tutorial-tf-puerta-${tag}.png` })
        }
        await page.waitForTimeout(2300)
        if (!(await card.isVisible())) await press(page, 'ArrowLeft', 900)
      }
      // El logro se disfruta un momento antes de mostrar la tarjeta: se espera a que salga.
      await card.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {})
      if (await card.getByText('Parte 3 de 6').isVisible()) break
      await understood(page)
    }
    await understood(page, 'Parte 3 de 6')
    // 3. Núcleo arriba a la izquierda y después hacia la medusa, a la derecha.
    // La medusa sale al azar: si alcanza al robot antes de aturdirla, la parte se reintenta desde el principio.
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.waitForTimeout(400)
      await press(page, 'ArrowUp', 350)
      await press(page, 'ArrowLeft')
      await robotAt(1, 1)
      for (let i = 0; i < 6 && !(await card.isVisible()); i++) await press(page, i % 2 ? 'ArrowLeft' : 'ArrowRight', 1200)
      // El logro se disfruta un momento antes de mostrar la tarjeta: se espera a que salga.
      await card.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {})
      if (await card.getByText('Parte 4 de 6').isVisible()) break
      await understood(page)
    }
    await understood(page, 'Parte 4 de 6')
    // 4. Rejilla: abajo hasta la rejilla de la izquierda.
    await page.waitForTimeout(400)
    await press(page, 'ArrowDown')
    await understood(page, 'Parte 5 de 6')
    // 5. Apagón: zigzag por los pasillos hasta la puerta.
    await page.waitForTimeout(400)
    await press(page, 'ArrowRight', 60)
    await press(page, 'ArrowDown')
    await robotAt(3, 6)
    await page.screenshot({ path: `.scratch/tutorial-tf-apagon-${tag}.png` })
    await press(page, 'ArrowLeft')
    await robotAt(3, 1)
    await press(page, 'ArrowDown')
    await robotAt(5, 1)
    await press(page, 'ArrowRight')
    await understood(page, 'Parte 6 de 6')
    // 6. Responder: la afirmación es verdadera; se va a la sala VERDADERO.
    await page.waitForFunction(() => window.__tfMaze?.state.phase === 'playing' && window.__tfMaze.state.zones.TRUE.pos, null, { timeout: 8000 })
    const zone = await page.evaluate(() => window.__tfMaze.state.zones.TRUE.pos)
    await press(page, 'ArrowUp', 350)
    await press(page, zone.col < 4 ? 'ArrowLeft' : 'ArrowRight')
    await card.getByRole('heading', { name: '¡Tutorial completado!' }).waitFor({ timeout: 10000 })
    await page.screenshot({ path: `.scratch/tutorial-tf-fin-${tag}.png` })
    await card.getByRole('button', { name: /¡A jugar!/ }).click()
    await page.locator('[data-game-tutorial]').waitFor({ state: 'detached' })
    await page.getByRole('button', { name: /Despegar/ }).waitFor()
    assert.deepEqual(errors, [])
    console.log(`PASS ${tag} Laberinto V/F: las 6 partes jugadas (mover, cruzar, aturdir, rejilla, apagón y responder), ¡A jugar! → juego`)
    await page.close()
    return
  }
  await page.getByRole('button', { name: 'Salir del tutorial' }).click()
  await page.locator('[data-game-tutorial]').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: /Despegar/ }).waitFor()
  assert.deepEqual(errors, [])
  console.log(`PASS ${tag} Laberinto V/F: pregunta sin scroll, Sí → instrucción y Entendido, mover el robot pasa a la parte 2 (nave de tutorial), salir → juego`)
  await page.close()
}

async function guessWhoTutorial(browser, viewport, touch) {
  const tag = `${viewport.width}${touch ? '-touch' : ''}`
  const { page, errors } = await openGame(browser, 'GUESS_WHO', viewport, touch)
  const intro = page.locator('[data-game-guide="GUESS_WHO"]')
  await intro.waitFor()
  await page.screenshot({ path: `.scratch/guia-quienes-paso1-${tag}.png` })
  for (let i = 0; i < 4; i++) await intro.getByRole('button', { name: /Siguiente/ }).click()
  const question = intro.getByRole('group', { name: '¿Deseas jugar un tutorial?' })
  await question.waitFor()
  assert.equal(await intro.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), true, 'La guía no tiene scroll')
  await page.screenshot({ path: `.scratch/tutorial-quienes-pregunta-${tag}.png` })
  await question.getByRole('button', { name: 'Sí' }).click()

  const card = page.getByRole('dialog', { name: /Tutorial de/ })
  const next = (n) => understood(page, `Parte ${n} de 7`)
  const boardCard = (label) => page.locator('.guess-who-board-cards button', { hasText: label })
  await page.screenshot({ path: `.scratch/tutorial-quienes-instruccion-${tag}.png` })
  await next(1)
  // 1. Mirar la tarjeta secreta: tocar «Tú eres…».
  await page.waitForTimeout(500)
  await page.screenshot({ path: `.scratch/tutorial-quienes-parte1-${tag}.png` })
  // Solo se puede tocar lo que la parte pide: «Pasar turno» y una tarjeta del tablero no responden.
  await page.getByRole('button', { name: /Pasar turno/ }).click({ force: true })
  await boardCard('Pulpo').click({ force: true })
  await page.waitForTimeout(300)
  assert.equal(await page.getByText('En el tutorial no hace falta pasar el turno').count(), 0, 'Pasar turno no responde en esta parte')
  assert.equal(await page.locator('.guess-who-board-cards button[aria-pressed="true"]').count(), 0, 'Las tarjetas no se descartan en esta parte')
  await page.getByRole('button', { name: 'Tu tarjeta secreta' }).click()
  await next(2)
  // 2. Preguntar desde el chat guiado.
  await page.getByRole('listitem', { name: 'Preguntar: ¿Tu tarjeta vuela?' }).click()
  await next(3)
  // 3. Descartar una (tocar una que sí vuela es un error y no la descarta).
  await boardCard('Búho').click()
  await page.getByText('Búho sí vuela').waitFor()
  await boardCard('Pulpo').click()
  await next(4)
  // 4. Descartar las que faltan (el Pez ya viene descartado; falta el Pulpo y la Tortuga).
  await boardCard('Pulpo').click()
  await boardCard('Tortuga').click()
  await next(5)
  // 5. Responder la pregunta del rival (mi tarjeta es el Pez: vive en el agua).
  await page.getByRole('button', { name: 'No', exact: true }).click()
  await page.getByText('Esa respuesta no coincide con tu tarjeta').waitFor()
  await page.getByRole('button', { name: 'Sí', exact: true }).click()
  await next(6)
  // 6. Abrir la selección para adivinar.
  await page.getByRole('button', { name: /¡Creo que es esta!/ }).click()
  await next(7)
  // 7. Elegir la tarjeta y confirmar.
  await page.getByRole('dialog').getByRole('button', { name: /Búho/ }).click()
  await page.getByRole('button', { name: 'Sí, confirmar' }).click()
  await card.getByRole('heading', { name: '¡Tutorial completado!' }).waitFor({ timeout: 6000 })
  await page.screenshot({ path: `.scratch/tutorial-quienes-fin-${tag}.png` })
  await card.getByRole('button', { name: /¡A jugar!/ }).click()
  await page.locator('#room').waitFor()
  assert.deepEqual(errors, [])
  console.log(`PASS ${tag} Identidad Oculta: pregunta sin scroll, Sí → preguntar, descartar, responder y adivinar en la pantalla real, ¡A jugar! → sala`)
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
    if (!only || only === 'GUESS_WHO') {
      await guessWhoTutorial(browser, { width: 1280, height: 800 }, false)
      await guessWhoTutorial(browser, { width: 390, height: 844 }, true)
    }
  } finally {
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
