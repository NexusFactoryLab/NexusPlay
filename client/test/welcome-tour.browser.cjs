// Ejecutar contra Vite local. Requiere Playwright (o PLAYWRIGHT_MODULE con su ruta).
// Todas las respuestas de API son simuladas: no se usan cuentas reales.
// Recorrido interactivo del inicio (issue #93): cada paso se HACE (no hay
// "Siguiente" hasta lograrlo) y, si un paso lleva a otra página, la barra
// obligatoria "Volver a la guía" regresa al inicio en el paso siguiente.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = process.env.TOUR_TEST_URL || 'http://127.0.0.1:5173'

async function run() {
  fs.mkdirSync('.scratch', { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const scenario of ['TEACHER', 'KIDS']) {
      const role = scenario === 'KIDS' ? 'STUDENT' : scenario
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      const errors = []
      const page = await context.newPage()
      page.setDefaultTimeout(15000)
      page.on('pageerror', (error) => errors.push(error.message))
      await page.route('**/*', (route) => {
        const url = new URL(route.request().url())
        const json = (data) => route.fulfill({ json: data })
        if (url.pathname.endsWith('/auth/refresh')) return json({ accessToken: 'tour-test-token' })
        if (url.pathname.endsWith('/users/me')) {
          return json({
            id: `tour-${scenario}`, role, displayName: 'Alex Demo', firstName: 'Alex', lastName: 'Demo', email: 'demo@example.test',
            avatarUrl: null, hasChosenRole: true, birthDate: scenario === 'KIDS' ? '2019-01-01' : null,
          })
        }
        if (url.pathname.endsWith('/subjects')) return json([{ id: 'math', name: 'Matemáticas', slug: 'math', parentSubjectId: null, status: 'PUBLIC', gameCount: 1 }])
        if (url.pathname.endsWith('/games')) return json({ items: [], total: 0, page: 1, pageSize: 40 })
        if (url.pathname.includes('/organizations/')) return json([])
        if (url.pathname.endsWith('/analytics/events')) return json({})
        if (url.origin === base) return route.continue()
        return route.abort()
      })
      const card = page.getByRole('region', { name: 'Recorrido de NexusPlay' })
      const bar = page.getByRole('region', { name: 'Guía de NexusPlay' })
      const guide = page.getByRole('button', { name: 'Repetir recorrido de bienvenida' })
      const next = card.getByRole('button', { name: /Siguiente|¡Listo!/ })
      await page.goto(base)
      await guide.waitFor()
      await page.keyboard.press('Escape')
      await guide.click()
      await card.waitFor()

      async function expectStep(n) {
        await card.getByText(new RegExp(`Paso ${n} de \\d+`)).waitFor()
      }
      async function doneThenNext() {
        await card.getByRole('status').waitFor()
        await next.click()
      }

      if (scenario === 'TEACHER') {
        // 1. Unirme con código: se abre la ventana y el paso queda hecho.
        await expectStep(1)
        assert.equal(await next.count(), 0, 'No hay "Siguiente" hasta hacer el paso')
        await page.locator('[data-tour="join"]').click()
        await page.getByPlaceholder('CÓDIGO').waitFor()
        // Sin cerrar la ventana a mano: «Siguiente» la cierra (antes la guía seguía con la ventana encima).
        await doneThenNext()
        await page.getByPlaceholder('CÓDIGO').waitFor({ state: 'detached' })

        // 2. Crear juego: lleva a otra página y la barra obliga a volver.
        await expectStep(2)
        await page.locator('[data-tour="create"]').click()
        await page.waitForURL('**/juegos/crear')
        await bar.waitFor()
        assert.match(await bar.innerText(), /tipo de juego/)
        await page.screenshot({ path: '.scratch/tour-away-create.png' })
        await bar.getByRole('button', { name: 'Volver a la guía' }).click()
        await page.waitForURL(base + '/')
        await card.waitFor()
        await expectStep(3)

        // 3. Solo mirar el menú: aquí sí hay "Siguiente" de entrada.
        await next.click()

        // 4. Inicio (ya está en el inicio: el paso cuenta sin salir).
        await expectStep(4)
        await page.locator('[data-tour="nav-home"]').click()
        await doneThenNext()

        // 5. Áreas: otra página dentro del inicio; volver con el botón atrás del navegador también retoma.
        await expectStep(5)
        await page.locator('[data-tour="nav-subjects"]').click()
        await page.waitForURL('**/areas')
        await bar.waitFor()
        await page.goBack()
        await card.waitFor()
        await expectStep(6)
        await page.screenshot({ path: '.scratch/tour-resumed.png' })
        assert.deepEqual(errors, [])
        console.log('PASS TEACHER: hacer cada paso, barra obligatoria al salir y retomar en el paso siguiente')
      } else {
        await expectStep(1)
        await page.locator('[data-tour="worlds"] button').first().click()
        await doneThenNext()
        await expectStep(2)
        await page.screenshot({ path: '.scratch/tour-kids-step2.png' })
        // Sin juegos en el mundo no hay portada que tocar: tras un rato se ofrece saltar.
        await card.getByRole('button', { name: 'Saltar este paso' }).click({ timeout: 16000 })
        await expectStep(3)
        await page.locator('[data-tour="worlds-back"]').click()
        await doneThenNext()
        await expectStep(4)
        await page.locator('[data-tour="profile"]').first().click()
        await card.getByRole('status').waitFor()
        await card.getByRole('button', { name: '¡Listo!' }).click()
        await card.waitFor({ state: 'hidden' })
        assert.deepEqual(errors, [])
        console.log('PASS KIDS: elegir mundo, saltar si no hay juegos, volver a los mundos y abrir el perfil')
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
