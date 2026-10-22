// Vite local. Reutiliza Playwright mediante PLAYWRIGHT_MODULE sin instalar dependencias.
// Fase "Preguntas guiadas" del formulario de ¿Quién Es? (issue #58).
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.DEMO_TEST_URL || 'http://127.0.0.1:5177'
const fixture = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root" style="padding:16px"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
const reactModule=await import('/node_modules/.vite/deps/react.js'); const React=reactModule.default??reactModule;
const domModule=await import('/node_modules/.vite/deps/react-dom_client.js'); const {createRoot}=domModule.default??domModule;
await import('/src/index.css');
const {GuessWhoTraitsEditor}=await import('/src/components/home/games/GuessWhoTraitsEditor.tsx');
const {newTraitId,validateTraits}=await import('/src/components/home/games/guessWhoTraits.ts');
const root=createRoot(document.getElementById('root'));
const img=c=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><rect width="60" height="40" fill="'+c+'"/></svg>');
let cards=['Colombia','Argentina','Brasil','México','Francia','Italia','Japón','Alemania','España','Perú','Chile','Estados Unidos'].map((label,i)=>({imageUrl:img(i%2?'#bae6fd':'#fde68a'),label,traitIds:i<4||i>8?['america']:[]}));
let catalog=[{id:'america',question:'¿Es un país de América?'}];
window.state=()=>({catalog,cards:cards.map(c=>c.traitIds),error:validateTraits(catalog,cards.map(c=>c.traitIds))});
function render(){root.render(React.createElement(GuessWhoTraitsEditor,{catalog,cards,disabled:false,
  onAdd:()=>{catalog=[...catalog,{id:newTraitId(catalog),question:''}];render()},
  onRemove:id=>{catalog=catalog.filter(t=>t.id!==id);cards=cards.map(c=>({...c,traitIds:c.traitIds.filter(x=>x!==id)}));render()},
  onChangeQuestion:(id,question)=>{catalog=catalog.map(t=>t.id===id?{...t,question}:t);render()},
  onChangeCategory:(id,category)=>{catalog=catalog.map(t=>t.id===id?{...t,category}:t);render()},
  onToggleCard:(index,id)=>{cards=cards.map((c,i)=>i!==index?c:{...c,traitIds:c.traitIds.includes(id)?c.traitIds.filter(x=>x!==id):[...c.traitIds,id]});render()}}))}
render();
</script></body></html>`

async function main(){
  mkdirSync('.scratch',{recursive:true})
  const browser=await chromium.launch({channel:'chrome',headless:true})
  try {
    for(const width of [1280,390,320]){
      const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'})
      const errors=[]; page.on('pageerror',error=>errors.push(error.message))
      await page.route('**/__traits-fixture',route=>route.fulfill({contentType:'text/html',body:fixture}))
      await page.goto(base+'/__traits-fixture')
      const wide=width>=768
      // Escritorio: matriz preguntas x tarjetas. Móvil: acordeón por pregunta (la primera, con texto, empieza cerrada).
      const q1=page.getByRole('textbox',{name:'Pregunta 1',exact:true})
      if(!wide) await page.locator('summary').first().click()
      await q1.waitFor()
      const cell=(q,label)=>wide
        ? page.getByRole('button',{name:label+': pregunta '+q,exact:true})
        : page.getByRole('list',{name:'Tarjetas que responden «Sí» a la pregunta '+q}).getByRole('button',{name:label})

      // Marcar y desmarcar una celda cambia el estado accesible y el conteo.
      const japon=cell(1,'Japón')
      assert.equal(await japon.getAttribute('aria-pressed'),'false')
      await japon.click()
      assert.equal(await japon.getAttribute('aria-pressed'),'true')
      assert.equal((await page.evaluate(()=>window.state())).cards.flat().filter(id=>id==='america').length,8)
      await japon.click()

      // «Todas» marca la fila entera y «Ninguna» la vacía.
      await page.getByRole('button',{name:wide?'Todas':'Marcar todas'}).first().click()
      assert.equal((await page.evaluate(()=>window.state())).cards.flat().filter(id=>id==='america').length,12)
      await page.getByRole('button',{name:wide?'Ninguna':'Quitar todas'}).first().click()
      assert.equal((await page.evaluate(()=>window.state())).cards.flat().filter(id=>id==='america').length,0)
      // La pregunta 1 queda con unas pocas «Sí» para que separe las tarjetas.
      for(const label of ['Colombia','Argentina','Brasil']) await cell(1,label).click()

      // Una pregunta nueva se puede escribir, categorizar y marcar (el mínimo de 4 preguntas lo exige validateTraits).
      await page.getByRole('button',{name:'Agregar pregunta'}).click()
      if(!wide) await page.locator('summary').nth(1).waitFor()
      const input=page.getByRole('textbox',{name:'Pregunta 2',exact:true})
      await input.waitFor()
      assert.match((await page.evaluate(()=>window.state())).error,/al menos 4 preguntas/)
      await input.fill('es un país de Europa')
      await page.getByRole('combobox',{name:'Categoría de la pregunta 2 (opcional)'}).fill('Geografía')
      assert.equal((await page.evaluate(()=>window.state())).catalog[1].category,'Geografía')
      for(const label of ['Francia','Italia','Alemania','España']) await cell(2,label).click()
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true)
      await page.screenshot({path:'.scratch/guess-who-traits-'+width+'.png',fullPage:true})

      // Quitar la pregunta se lleva sus marcas.
      await page.getByRole('button',{name:wide?'Quitar la pregunta 2':'Quitar',exact:true}).last().click()
      const state=await page.evaluate(()=>window.state())
      assert.equal(state.catalog.length,1)
      assert.equal(state.cards.flat().includes('pregunta-2'),false)
      assert.deepEqual(errors,[])
      console.log('PASS '+width+'px: matriz/acordeón, marcar fila, pregunta nueva validada, quitar con sus marcas, sin scroll horizontal')
      await page.close()
    }
  } finally {await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
