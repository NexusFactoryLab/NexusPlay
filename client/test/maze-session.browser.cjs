// Vite local. Reutiliza Playwright mediante PLAYWRIGHT_MODULE sin instalar dependencias.
// La partida de "Salvando el mundo" con una cuenta: pop-up de la pregunta con el
// avatar, instrucción del libro en el panel derecho, «¿Necesitas más tiempo?» sin
// límite, mapa más grande y ambiente de cada escenario. Deja capturas en .scratch/.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.DEMO_TEST_URL || 'http://127.0.0.1:5173'

const AVATAR = {
  top: 'short', hairColor: '5a3825', hatColor: 'e64980', skinColor: 'eab890', outfit: 'jacket', shirtColor: 'f2f2f2',
  jacketColor: '6b4f3a', pantsColor: '3b5b8c', shoesColor: 'e03131', eyes: 'open', mouth: 'smile', nose: 'small',
}

const fixture = (layout) => `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
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
const el=React.createElement(MazeCollectorGame,{title:'Salvando el mundo',primaryColor:'#2ecc71',layout:T.MAZE_LAYOUTS['${layout}'],items,config:{...T.DEFAULT_MAZE_CONFIG,layout:'${layout}',enemySpeed:0.2},questions:Q.QUESTIONS_BY_MAP['${layout}'],skipGuide:true,onExit:()=>{}});
createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(ThemeProvider,null,el)));
</script></body></html>`

async function open(browser, layout, viewport) {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/__maze-session-fixture')) return route.fulfill({ contentType: 'text/html', body: fixture(layout) })
    if (url.pathname.endsWith('/auth/refresh')) return route.fulfill({ json: { accessToken: 'maze-test-token' } })
    if (url.pathname.endsWith('/users/me')) {
      return route.fulfill({
        json: {
          id: 'maze-test', role: 'TEACHER', displayName: 'Alex Demo', firstName: 'Alex', lastName: 'Demo', email: 'demo@example.test',
          avatarUrl: null, hasChosenRole: true, birthDate: null, avatarConfig: AVATAR,
        },
      })
    }
    return route.continue()
  })
  await page.goto(base + '/__maze-session-fixture')
  return { page, errors }
}

const secondsLeft = async (page) => Number((await page.getByLabel(/Quedan \d+ segundos/).first().getAttribute('aria-label')).match(/\d+/)[0])

;(async () => {
  mkdirSync('.scratch', { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const layout of ['AMAZON', 'OCEAN', 'PARAMO', 'CITY']) {
      const { page, errors } = await open(browser, layout, { width: 1920, height: 1080 })
      await page.getByRole('button', { name: /^Empezar$/ }).click()

      // Pop-up de la pregunta: título grande, opciones grandes y el avatar dando la instrucción.
      const dialog = page.getByRole('dialog', { name: 'Pregunta' })
      await dialog.waitFor()
      await page.waitForTimeout(900)
      await page.screenshot({ path: `.scratch/sesion-${layout}-popup.png` })
      const badge = await dialog.getByText(/^Pregunta 1$/).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
      assert.ok(badge >= 40, `«Pregunta 1» grande: ${badge}px`)
      const option = await dialog.locator('li').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
      assert.ok(option >= 18, `opciones grandes: ${option}px`)
      assert.ok(await dialog.locator('[data-maze-coach] svg, [data-maze-coach] img').first().isVisible(), 'el avatar de la cuenta se dibuja')
      assert.match(await dialog.locator('[data-book-hint]').innerText(), /libro/i)
      assert.ok((await dialog.innerText()).length < 420, 'el pop-up solo trae lo necesario')

      await page.getByRole('button', { name: /A buscarla/ }).click()
      await page.waitForTimeout(1800)

      // La instrucción del libro pasa al panel derecho, con el avatar.
      const aside = page.locator('aside')
      assert.ok(await aside.locator('[data-maze-coach]').first().isVisible(), 'avatar en el panel')
      assert.match(await aside.locator('[data-book-hint]').innerText(), /página \d+/)
      await aside.getByText('¿Necesitas más tiempo?').waitFor()

      // Mapa más grande: más de un 10 % frente a las 19 filas que se veían antes.
      const fit = await page.evaluate(() => {
        const map = document.querySelector('[data-maze-window]')
        const stage = map.parentElement
        return { width: map.clientWidth, height: map.clientHeight, stage: stage.clientHeight }
      })
      const before = Math.floor((fit.stage - 16) / 19)
      const cell = fit.width / 24
      assert.ok(cell / before >= 1.1, `celda ${cell} frente a ${before}`)

      // La pantalla no se corre: el encabezado sigue arriba y nada se desplazó.
      const shifted = await page.evaluate(() => ({
        header: document.querySelector('header').getBoundingClientRect().top,
        scrolled: [...document.querySelectorAll('div')].filter((el) => el.scrollTop > 0).length,
      }))
      assert.ok(shifted.header >= 0 && shifted.scrolled === 0, `pantalla corrida: ${JSON.stringify(shifted)}`)

      // Ambiente: partículas por escenario, sin tocar la imagen del mapa.
      const particles = await page.locator('.maze-amb-p').count()
      assert.equal(particles > 0, layout !== 'CITY', `${layout}: ${particles} partículas`)
      assert.equal(await page.locator('[data-maze-ambience]').getAttribute('data-maze-ambience'), layout)
      await page.screenshot({ path: `.scratch/sesion-${layout}-juego.png` })

      // «¿Necesitas más tiempo?»: detiene el reloj y se puede usar las veces que haga falta.
      for (let use = 1; use <= 3; use++) {
        await aside.getByRole('button', { name: 'Pausar el juego' }).click()
        await aside.getByText('Juego en pausa').waitFor()
        const stopped = await secondsLeft(page)
        await page.waitForTimeout(1600)
        assert.equal(await secondsLeft(page), stopped, `el reloj se detiene (uso ${use})`)
        assert.equal(await page.getByRole('dialog', { name: 'Juego en pausa' }).count(), 0, 'no abre el menú de pausa')
        if (use === 1) await page.screenshot({ path: `.scratch/sesion-${layout}-mas-tiempo.png` })
        await aside.getByRole('button', { name: 'Seguir jugando' }).click()
        await aside.getByRole('button', { name: 'Pausar el juego' }).waitFor()
      }
      // También se sale con la tecla P.
      await aside.getByRole('button', { name: 'Pausar el juego' }).click()
      await page.keyboard.press('p')
      await aside.getByRole('button', { name: 'Pausar el juego' }).waitFor()

      assert.deepEqual(errors, [])
      console.log(`PASS ${layout}: pop-up ${badge}px/${option}px, celda ${cell} (antes ${before}), ${particles} partículas, pausa ilimitada`)
      await page.close()
    }
    // En pantallas angostas el panel es una franja: ahí también están el avatar y el botón.
    const { page, errors } = await open(browser, 'OCEAN', { width: 820, height: 1000 })
    await page.getByRole('button', { name: /^Empezar$/ }).click()
    await page.getByRole('button', { name: /A buscarla/ }).click()
    await page.getByRole('button', { name: '¿Más tiempo?' }).click()
    await page.getByRole('button', { name: 'Seguir jugando' }).waitFor()
    await page.screenshot({ path: '.scratch/sesion-angosta.png' })
    assert.deepEqual(errors, [])
    console.log('PASS pantalla angosta: botón de más tiempo en la franja')
    await page.close()
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
