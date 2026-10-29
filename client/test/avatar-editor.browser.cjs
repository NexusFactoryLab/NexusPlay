// Editor de avatar (issues #138 y #140): sin scroll de página, barra de
// categorías con scroll propio visible y fluido, y flechas Atrás / Adelante
// sobre el historial.
//   1. Vite local: cd client && npx vite --port 5175
//   2. node client/test/avatar-editor.browser.cjs
// Todas las respuestas de API son simuladas. PLAYWRIGHT_MODULE permite usar
// una instalación de Playwright fuera del proyecto.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.AVATAR_TEST_URL || 'http://127.0.0.1:5175'

const AVATAR = {
  top: 'short', hairColor: '5a3825', hatColor: 'e64980', skinColor: 'eab890', outfit: 'jacket', shirtColor: 'f2f2f2',
  jacketColor: '6b4f3a', pantsColor: '3b5b8c', shoesColor: 'e03131', eyes: 'open', mouth: 'smile', nose: 'small',
}

async function openEditor(browser, viewport) {
  const page = await browser.newPage({ viewport })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    const json = (data) => route.fulfill({ json: data })
    if (url.pathname.endsWith('/auth/refresh')) return json({ accessToken: 'avatar-test-token' })
    if (url.pathname.endsWith('/users/me')) {
      return json({
        id: 'avatar-test', role: 'TEACHER', displayName: 'Alex Demo', firstName: 'Alex', lastName: 'Demo', email: 'demo@example.test',
        avatarUrl: null, hasChosenRole: true, birthDate: null, avatarConfig: AVATAR,
      })
    }
    if (url.pathname.endsWith('/subjects')) return json([])
    if (url.pathname.endsWith('/games')) return json({ items: [], total: 0, page: 1, pageSize: 40 })
    if (url.pathname.includes('/organizations/')) return json([])
    if (url.pathname.endsWith('/analytics/events')) return json({})
    if (url.origin === base) return route.continue()
    return route.abort()
  })
  await page.goto(base + '/avatar')
  await page.getByRole('navigation', { name: 'Categorías del avatar' }).waitFor()
  await page.keyboard.press('Escape')
  return { page, errors }
}

/** Lo que mide el scroll de la página: el documento y el <main> de la app. */
const pageScroll = (page) =>
  page.evaluate(() => {
    const main = document.querySelector('.app-main')
    const doc = document.scrollingElement
    return { doc: doc.scrollHeight - doc.clientHeight, main: main ? main.scrollHeight - main.clientHeight : 0 }
  })

async function run() {
  mkdirSync('.scratch', { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    // 1. Sin scroll de página en escritorio y tablet (en el celular sí, a propósito).
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 860 }, { width: 1280, height: 720 }, { width: 1366, height: 640 }, { width: 1024, height: 768 }, { width: 800, height: 700 }]) {
      const { page, errors } = await openEditor(browser, viewport)
      const scroll = await pageScroll(page)
      assert.ok(scroll.doc <= 1 && scroll.main <= 1, `${viewport.width}x${viewport.height}: la página se desplaza ${JSON.stringify(scroll)}`)
      // Las flechas no se salen del tablero.
      const board = await page.locator('.avatar-board').boundingBox()
      for (const arrow of await page.locator('.avatar-turn-arrow').all()) {
        const box = await arrow.boundingBox()
        assert.ok(box.x >= board.x && box.x + box.width <= board.x + board.width + 1, `${viewport.width}x${viewport.height}: una flecha queda fuera del tablero`)
      }
      assert.deepEqual(errors, [])
      await page.close()
    }

    const { page, errors } = await openEditor(browser, { width: 1280, height: 720 })
    const rail = page.locator('.avatar-rail')
    const railTop = () => rail.evaluate((element) => element.scrollTop)

    // Las miniaturas se dibujan por turnos (issue #140): al poco rato todas tienen imagen.
    await page.waitForFunction(() => [...document.querySelectorAll('.avatar-tile > span')].every((span) => span.classList.contains('avatar-tile-none') || span.querySelector('img')))

    // 2a. Desplazar la barra no toca nada fuera de ella (issue #140: antes se
    //     redibujaba todo el editor en cada movimiento) ni deja tareas largas.
    const outside = await page.evaluate(async () => {
      const rail = document.querySelector('.avatar-rail')
      const wrap = document.querySelector('.avatar-rail-wrap')
      const changes = []
      const observer = new MutationObserver((records) => {
        for (const record of records) if (!wrap.contains(record.target)) changes.push(record.target.className || record.target.nodeName)
      })
      observer.observe(document.querySelector('.avatar-board'), { subtree: true, childList: true, attributes: true, characterData: true })
      let longest = 0
      const longTasks = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longest = Math.max(longest, entry.duration)
      })
      longTasks.observe({ type: 'longtask' })
      for (let step = 0; step < 30; step += 1) {
        rail.scrollTop = step < 15 ? step * 20 : (30 - step) * 20
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
      observer.disconnect()
      longTasks.disconnect()
      return { changes, longest }
    })
    assert.deepEqual(outside.changes, [], 'El scroll de la barra cambió cosas fuera de ella')
    assert.ok(outside.longest < 150, `El scroll de la barra dejó una tarea de ${outside.longest} ms`)

    // 2b. Scroll propio visible: hay barrita, arrastrarla baja la barra, y la flecha "más" también.
    const thumb = page.locator('.avatar-rail-thumb')
    await thumb.waitFor()
    const thumbBox = await thumb.boundingBox()
    assert.ok(thumbBox.width >= 10 && thumbBox.height >= 36, 'La barrita del scroll se ve')
    await page.screenshot({ path: '.scratch/avatar-editor-rail.png' })
    await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + 10)
    await page.mouse.down()
    await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + 400, { steps: 8 })
    await page.mouse.up()
    const atBottom = await rail.evaluate((element) => element.scrollTop + element.clientHeight >= element.scrollHeight - 2)
    assert.ok(atBottom, 'Arrastrar la barrita lleva al final de las categorías')
    await page.getByRole('button', { name: 'Accesorios' }).isVisible()
    assert.equal(await page.getByRole('button', { name: 'Ver más categorías' }).count(), 0, 'Al final ya no hay flecha de "más"')
    await rail.evaluate((element) => { element.scrollTop = 0 })
    await page.getByRole('button', { name: 'Ver más categorías' }).click()
    await page.waitForFunction(() => document.querySelector('.avatar-rail').scrollTop > 50)
    // Elegir una categoría escondida la deja a la vista.
    await rail.evaluate((element) => { element.scrollTop = 0 })
    await page.getByRole('button', { name: 'Accesorios' }).click()
    assert.ok(await railTop() > 0, 'La barra se desplaza hasta la categoría elegida')
    await page.getByRole('tab', { name: 'Lentes' }).waitFor()

    // 3. Flechas Atrás / Adelante con "Sorpresa".
    const back = page.getByRole('button', { name: 'Atrás: volver al cambio anterior' })
    const forward = page.getByRole('button', { name: 'Adelante: rehacer el cambio' })
    const undoButton = page.getByRole('button', { name: 'Deshacer' })
    const figure = () => page.locator('.avatar-stage-figure img').getAttribute('src')
    assert.ok(await back.isDisabled(), 'Al empezar no hay nada atrás')
    assert.ok(await forward.isDisabled(), 'Al empezar no hay nada adelante')
    const states = [await figure()]
    for (let round = 0; round < 3; round += 1) {
      await page.getByRole('button', { name: 'Sorpresa' }).click()
      states.push(await figure())
    }
    assert.equal(new Set(states).size, 4, 'Cada sorpresa da un avatar distinto')
    for (let step = 2; step >= 0; step -= 1) {
      await back.click()
      assert.equal(await figure(), states[step], `Atrás vuelve al avatar ${step}`)
    }
    assert.ok(await back.isDisabled())
    for (let step = 1; step <= 3; step += 1) {
      await forward.click()
      assert.equal(await figure(), states[step], `Adelante recupera el avatar ${step}`)
    }
    assert.ok(await forward.isDisabled())

    // Deshacer (abajo) y Ctrl+Z / Ctrl+Y usan el mismo historial.
    await undoButton.click()
    assert.equal(await figure(), states[2])
    await page.keyboard.press('Control+z')
    assert.equal(await figure(), states[1])
    await page.keyboard.press('Control+y')
    assert.equal(await figure(), states[2])
    await page.keyboard.press('Control+Shift+Z')
    assert.equal(await figure(), states[3])

    // Un cambio nuevo después de ir atrás borra lo de adelante.
    await back.click()
    await page.getByRole('tab', { name: 'Barba' }).click()
    await page.getByRole('button', { name: 'Bigote' }).click()
    assert.ok(await forward.isDisabled(), 'Tras un cambio nuevo no queda nada adelante')
    await back.click()
    assert.equal(await figure(), states[2])

    await page.screenshot({ path: '.scratch/avatar-editor-arrows.png' })
    assert.deepEqual(errors, [])
    await page.close()
    console.log('Editor de avatar: OK')
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
