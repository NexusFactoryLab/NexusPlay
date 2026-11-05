// Vite local. Reutiliza Playwright mediante PLAYWRIGHT_MODULE sin instalar dependencias.
// Pantalla completa de "Salvando el mundo": durante la partida y fuera de ella
// (estaciones de la expedición, Pacto, volver a jugar, salir). Corre todos los
// casos aunque alguno falle y al final lista los que no pasaron.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.DEMO_TEST_URL || 'http://127.0.0.1:5173'

const fixture = (mode) => `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
const mainCode=await (await fetch('/src/main.tsx')).text(); const depUrl=(name)=>{const at=mainCode.indexOf('/node_modules/.vite/deps/'+name+'?v=');return mainCode.slice(at,mainCode.indexOf('"',at))};
const reactModule=await import(depUrl('react.js')); const React=reactModule.default??reactModule;
const domModule=await import(depUrl('react-dom_client.js')); const {createRoot}=domModule.default??domModule;
await import('/src/index.css');
const {AuthProvider}=await import('/src/hooks/useAuth.tsx'); const {ThemeProvider}=await import('/src/hooks/useTheme.tsx');
const T=await import('/src/components/home/games/mazeCollectorTypes.ts');
const {MazeCollectorGame}=await import('/src/components/home/games/MazeCollectorGame.tsx');
const {MazeExpedition}=await import('/src/components/home/games/MazeExpedition.tsx');
const {expeditionStations}=await import('/src/components/home/games/mazeExpeditionStations.ts');
const Q=await import('/src/components/home/games/mazeCollectorQuestions.ts');
const items=['Botella','Lata','Caja','Vidrio'].map((l,i)=>({itemId:'i'+i,label:l,icon:'target',color:'#2ecc71'}));
const config={...T.DEFAULT_MAZE_CONFIG,layout:'AMAZON',enemySpeed:0.2,lives:1};
function App(){
  const [open,setOpen]=React.useState(true);
  if(!open) return React.createElement('p',{id:'outside'},'Fuera del juego');
  const onExit=()=>setOpen(false);
  if('${mode}'==='EXPEDITION') return React.createElement(MazeExpedition,{title:'Territorios',primaryColor:'#2ecc71',items,config,stations:expeditionStations(['AMAZON','OCEAN']),onExit});
  return React.createElement(MazeCollectorGame,{title:'Salvando el mundo',primaryColor:'#2ecc71',layout:T.MAZE_LAYOUTS.AMAZON,items,config,questions:Q.QUESTIONS_BY_MAP.AMAZON,skipGuide:true,onExit});
}
createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(ThemeProvider,null,React.createElement(App))));
</script></body></html>`

const isFull = (page) => page.evaluate(() => Boolean(document.fullscreenElement))

async function open(browser, mode, viewport = { width: 1366, height: 768 }) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' })
  page.setDefaultTimeout(9000)
  await page.addInitScript(() => localStorage.removeItem('nexusplay-maze-collector-fullscreen'))
  await page.route('**/__maze-fs-fixture', (route) => route.fulfill({ contentType: 'text/html', body: fixture(mode) }))
  await page.route('**/auth/refresh', (route) => route.fulfill({ status: 401, json: {} }))
  await page.goto(base + '/__maze-fs-fixture')
  return page
}

async function startGame(page) {
  await page.getByRole('button', { name: /^Empezar$/ }).click()
  await page.getByRole('button', { name: /A buscarla/ }).click({ timeout: 6000 })
  await page.waitForTimeout(1800)
}

const cases = {
  'Empezar pasa a pantalla completa': async (browser) => {
    const page = await open(browser, 'SINGLE')
    await startGame(page)
    if (!(await isFull(page))) throw new Error('no entró')
    await page.close()
  },
  'la pantalla completa es de toda la página (se ven también los avisos fuera del juego)': async (browser) => {
    const page = await open(browser, 'SINGLE')
    await startGame(page)
    const tag = await page.evaluate(() => document.fullscreenElement?.tagName)
    if (tag !== 'HTML') throw new Error(`el elemento es ${tag}`)
    await page.close()
  },
  'Jugar otra vez no saca de pantalla completa': async (browser) => {
    const page = await open(browser, 'SINGLE')
    await startGame(page)
    await page.getByRole('button', { name: /Jugar otra vez/ }).waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: /Jugar otra vez/ }).click()
    await page.getByRole('button', { name: /^Empezar$/ }).waitFor()
    await page.waitForTimeout(400)
    if (!(await isFull(page))) throw new Error('salió de pantalla completa')
    await page.close()
  },
  'el botón de salir de pantalla completa no abre el menú de pausa': async (browser) => {
    const page = await open(browser, 'SINGLE')
    await startGame(page)
    await page.getByRole('button', { name: 'Salir de pantalla completa' }).first().click()
    await page.waitForTimeout(400)
    if (await isFull(page)) throw new Error('no salió')
    if (await page.getByRole('dialog', { name: 'Juego en pausa' }).isVisible()) throw new Error('se abrió la pausa')
    await page.close()
  },
  'el botón no dice solo "Salir" (se confunde con salir del juego)': async (browser) => {
    const page = await open(browser, 'SINGLE')
    await startGame(page)
    const text = (await page.getByRole('button', { name: 'Salir de pantalla completa' }).first().innerText()).trim()
    if (text === 'Salir') throw new Error('el texto visible es "Salir"')
    await page.close()
  },
  'salir con Esc (el navegador) pausa y ofrece volver desde la pausa': async (browser) => {
    const page = await open(browser, 'SINGLE')
    await startGame(page)
    await page.evaluate(() => document.exitFullscreen())
    await page.getByRole('dialog', { name: 'Juego en pausa' }).waitFor({ timeout: 2000 })
    await page.getByRole('button', { name: 'Pantalla completa' }).last().click()
    await page.waitForTimeout(400)
    if (!(await isFull(page))) throw new Error('no volvió')
    await page.close()
  },
  'mantener F presionada no parpadea': async (browser) => {
    const page = await open(browser, 'SINGLE')
    await startGame(page)
    await page.evaluate(() => {
      window.fsChanges = 0
      document.addEventListener('fullscreenchange', () => window.fsChanges++)
    })
    await page.keyboard.down('f')
    await page.keyboard.down('f')
    await page.keyboard.down('f')
    await page.keyboard.up('f')
    await page.waitForTimeout(500)
    const changes = await page.evaluate(() => window.fsChanges)
    if (changes > 1) throw new Error(`${changes} cambios`)
    await page.close()
  },
  'el aviso de volver a pantalla completa no habla de la ciudad en Amazonia': async (browser) => {
    const page = await open(browser, 'SINGLE')
    await startGame(page)
    await page.evaluate(() => document.exitFullscreen())
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.waitForTimeout(300)
    if ((await page.locator('body').innerText()).includes('toda la ciudad')) throw new Error('dice "toda la ciudad"')
    await page.close()
  },
  'salir del juego deja la pantalla completa': async (browser) => {
    const page = await open(browser, 'SINGLE')
    await startGame(page)
    await page.keyboard.press('p')
    await page.getByRole('button', { name: 'Salir del juego' }).click()
    await page.locator('#outside').waitFor()
    await page.waitForTimeout(300)
    if (await isFull(page)) throw new Error('sigue en pantalla completa')
    await page.close()
  },
  'expedición: la tarjeta de la estación tiene botón de pantalla completa': async (browser) => {
    const page = await open(browser, 'EXPEDITION')
    await page.getByRole('button', { name: /Empezar estación 1/ }).waitFor()
    await page.getByRole('button', { name: 'Pantalla completa' }).click({ timeout: 1500 })
    await page.waitForTimeout(300)
    if (!(await isFull(page))) throw new Error('no entró')
    await page.close()
  },
  'expedición: al volver a las estaciones sigue en pantalla completa': async (browser) => {
    const page = await open(browser, 'EXPEDITION')
    await page.getByRole('button', { name: /Empezar estación 1/ }).click()
    await startGame(page)
    await page.keyboard.press('p')
    await page.getByRole('button', { name: 'Salir del juego' }).click()
    await page.getByRole('button', { name: /Empezar estación 1/ }).waitFor()
    await page.waitForTimeout(400)
    if (!(await isFull(page))) throw new Error('salió de pantalla completa')
    await page.close()
  },
  'expedición: Empezar estación ya pasa a pantalla completa': async (browser) => {
    const page = await open(browser, 'EXPEDITION')
    await page.getByRole('button', { name: /Empezar estación 1/ }).click()
    await page.getByRole('button', { name: /^Empezar$/ }).waitFor()
    await page.waitForTimeout(300)
    if (!(await isFull(page))) throw new Error('no entró')
    await page.close()
  },
  'expedición: salir de las estaciones deja la pantalla completa': async (browser) => {
    const page = await open(browser, 'EXPEDITION')
    await page.getByRole('button', { name: /Empezar estación 1/ }).click()
    await startGame(page)
    await page.keyboard.press('p')
    await page.getByRole('button', { name: 'Salir del juego' }).click()
    await page.getByRole('button', { name: /^Salir$/ }).click()
    await page.locator('#outside').waitFor()
    await page.waitForTimeout(300)
    if (await isFull(page)) throw new Error('sigue en pantalla completa')
    await page.close()
  },
  'el mapa cabe sin barras de desplazamiento dentro y fuera de pantalla completa': async (browser) => {
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
      const page = await open(browser, 'SINGLE', viewport)
      await startGame(page)
      for (const label of ['pantalla completa', 'ventana']) {
        const overflow = await page.evaluate(() =>
          [...document.querySelectorAll('div')].filter((el) => {
            const style = getComputedStyle(el)
            return style.overflowY === 'auto' && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 200
          }).length,
        )
        if (overflow) throw new Error(`${viewport.width}x${viewport.height} ${label}: hay scroll`)
        await page.keyboard.press('f')
        await page.waitForTimeout(400)
      }
      await page.close()
    }
  },
}

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  const failed = []
  for (const [name, run] of Object.entries(cases)) {
    try {
      await run(browser)
      console.log(`PASS ${name}`)
    } catch (error) {
      failed.push(name)
      console.log(`FAIL ${name}: ${String(error.message).split('\n')[0]}`)
    }
    for (const context of browser.contexts()) await context.close()
  }
  await browser.close()
  console.log(failed.length ? `\n${failed.length} de ${Object.keys(cases).length} fallaron` : `\nTodos pasan (${Object.keys(cases).length})`)
  process.exit(failed.length ? 1 : 0)
})()
