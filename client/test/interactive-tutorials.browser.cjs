// Vite local. Reutiliza Playwright mediante PLAYWRIGHT_MODULE sin instalar dependencias.
// Juega de punta a punta el mini tutorial de cada juego (issue #93): cada paso
// solo avanza si se hace el movimiento que enseña, así que si un mapa o un
// paso no se puede completar, esta prueba lo detecta.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.DEMO_TEST_URL || 'http://127.0.0.1:5173'

const fixture = (kind) => `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
const reactModule=await import('/node_modules/.vite/deps/react.js'); const React=reactModule.default??reactModule;
const domModule=await import('/node_modules/.vite/deps/react-dom_client.js'); const {createRoot}=domModule.default??domModule;
await import('/src/index.css');
const {GameInstructionsGate}=await import('/src/components/home/games/GameInstructionsGate.tsx');
window.finished=0;
function Done(){ window.finished++; return React.createElement('p',{id:'game'},'Juego montado') }
createRoot(document.getElementById('root')).render(React.createElement(GameInstructionsGate,{kind:'${kind}'},React.createElement(Done)));
</script></body></html>`

const key = (page, keys) => keys.reduce((p, k) => p.then(() => page.keyboard.press(k)).then(() => page.waitForTimeout(170)), Promise.resolve())
const R = (n) => Array(n).fill('ArrowRight')
const L = (n) => Array(n).fill('ArrowLeft')
const U = (n) => Array(n).fill('ArrowUp')
const D = (n) => Array(n).fill('ArrowDown')
const repeat = (k, n) => Array(n).fill(k)

const clickCards = async (page, indexes) => {
  for (const i of indexes) {
    await page.locator('[data-memory-card]').nth(i).click()
    await page.waitForTimeout(650)
  }
}

// Cómo completar cada paso de cada tutorial.
const SOLUTIONS = {
  PAIRS: [(p) => clickCards(p, [0]), (p) => clickCards(p, [0, 3]), (p) => clickCards(p, [0, 3, 1, 2])],
  OPPOSITES: [(p) => clickCards(p, [0]), (p) => clickCards(p, [0, 3]), (p) => clickCards(p, [0, 3, 1, 2])],
  DOMINO: [
    (p) => p.locator('[data-domino-tile="h2"]').click(),
    async (p) => {
      await p.locator('[data-domino-tile="h1"]').click()
      await p.locator('[data-domino-tile="h3"]').click()
    },
    async (p) => {
      await p.getByRole('button', { name: /Robar ficha/ }).click()
      await p.locator('[data-domino-tile="p1"]').click()
    },
  ],
  GUESS_WHO: guessWho(),
  GUESS_WHO_GROUP: guessWho(),
  SNAKES_LADDERS: [
    (p) => p.getByRole('button', { name: 'Tirar el dado' }).click(),
    async (p) => {
      await p.getByRole('button', { name: 'Tirar el dado' }).click()
      await p.getByRole('button', { name: 'Dióxido de carbono' }).click({ timeout: 6000 })
    },
    (p) => p.getByRole('button', { name: 'Tirar el dado' }).click(),
  ],
  MAZE_COLLECTOR: [
    (p) => key(p, [...R(4), ...D(2)]),
    (p) => key(p, [...R(4), ...D(2), ...L(4)]),
    (p) => key(p, [...R(4), ...D(2), ...U(2), ...L(4), ...D(2)]),
    (p) => key(p, [...U(2), ...R(4)]),
  ],
  TRUE_FALSE_MAZE: [
    (p) => key(p, [...R(4), ...D(2)]),
    (p) => key(p, [...L(2), ...U(2)]),
    (p) => key(p, [...R(2), ...U(2)]),
    (p) => key(p, [...R(2), ...U(2)]),
  ],
  DUAL_QUEST: [
    (p) => key(p, [...R(4), ...D(2), ...L(4), ...U(2), ...R(2)]),
    async (p) => {
      await key(p, [...R(4), ...D(2), ...L(1)])
      await p.getByRole('button', { name: 'Tres' }).click()
    },
    (p) => key(p, [...repeat('s', 2), ...repeat('d', 2), ...D(2), ...L(1)]),
  ],
  DUAL_QUEST_PIXI: [
    (p) => key(p, repeat('d', 4)),
    (p) => key(p, L(4)),
    (p) => key(p, [...repeat('s', 2), ...repeat('d', 2), ...D(2), ...L(1)]),
  ],
}

function guessWho() {
  return [
    (p) => p.getByRole('button', { name: /¿Tu tarjeta vuela\?/ }).click(),
    async (p) => {
      for (const id of ['pez', 'pulpo', 'tortuga']) await p.locator(`[data-guess-card="${id}"]`).click()
    },
    (p) => p.locator('[data-guess-card="aguila"]').click(),
    async (p) => {
      await p.getByRole('button', { name: /Adivinar/ }).click()
      await p.locator('[data-guess-card="buho"]').click()
    },
  ]
}

async function main() {
  mkdirSync('.scratch', { recursive: true })
  const only = process.argv[2]
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const [width, height] of [[1280, 860], [390, 844]]) {
      for (const [kind, steps] of Object.entries(SOLUTIONS)) {
        if (only && only !== kind) continue
        const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 500 })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.route('**/__tutorial-fixture', (route) => route.fulfill({ contentType: 'text/html', body: fixture(kind) }))
        await page.goto(base + '/__tutorial-fixture')
        await page.locator('[data-interactive-tutorial]').waitFor()
        const next = page.getByRole('button', { name: /Siguiente paso|¡A jugar!/ })
        for (let i = 0; i < steps.length; i++) {
          assert.equal(await page.locator('[data-interactive-tutorial]').getAttribute('data-tutorial-step'), String(i + 1))
          assert.equal(await next.isDisabled(), true, `${kind} paso ${i + 1}: no se puede avanzar sin hacerlo`)
          if (i === 0) await page.screenshot({ path: `.scratch/tutorial-${kind}-${width}.png` })
          await steps[i](page)
          await page.getByRole('status').filter({ hasText: /./ }).first().waitFor({ timeout: 9000 }).catch(() => {})
          await assert.doesNotReject(() => page.waitForFunction(() => {
            const button = [...document.querySelectorAll('button')].find((b) => /Siguiente paso|¡A jugar!/.test(b.textContent || ''))
            return button && !button.disabled
          }, null, { timeout: 9000 }), `${kind} paso ${i + 1} no se completó`)
          if (i === steps.length - 1) await page.screenshot({ path: `.scratch/tutorial-${kind}-${width}-fin.png` })
          await next.click()
        }
        await page.locator('#game').waitFor()
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${kind}: sin scroll horizontal`)
        assert.deepEqual(errors, [])
        console.log(`PASS ${width}px ${kind}: ${steps.length} pasos jugados`)
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
