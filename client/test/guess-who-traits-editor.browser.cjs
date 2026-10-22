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
      const count=async()=>(await page.evaluate(()=>window.state())).cards.flat().filter(id=>id==='america').length
      const cell=(q,label)=>page.getByRole('list',{name:'Tarjetas que responden «Sí» a la pregunta '+q}).getByRole('button',{name:label,exact:true})
      await page.getByRole('textbox',{name:'Pregunta 1',exact:true}).waitFor()

      // Marcar y desmarcar una ficha cambia el estado accesible y el conteo.
      const japon=cell(1,'Japón')
      assert.equal(await japon.getAttribute('aria-pressed'),'false')
      await japon.click()
      assert.equal(await japon.getAttribute('aria-pressed'),'true')
      assert.equal(await count(),8)
      await japon.click()

      // «Marcar todas» y «Quitar todas» actúan sobre la pregunta elegida.
      await page.getByRole('button',{name:'Marcar todas'}).click()
      assert.equal(await count(),12)
      await page.getByText('Marca solo algunas tarjetas').waitFor()
      await page.getByRole('button',{name:'Quitar todas'}).click()
      assert.equal(await count(),0)
      for(const label of ['Colombia','Argentina','Brasil']) await cell(1,label).click()
      await page.getByText('Marca solo algunas tarjetas').waitFor({state:'detached'})

      // Una pregunta nueva queda elegida: se escribe, se categoriza y se marca (el mínimo de 4 lo exige validateTraits).
      await page.getByRole('button',{name:'Agregar pregunta'}).click()
      const input=page.getByRole('textbox',{name:'Pregunta 2',exact:true})
      await input.waitFor()
      assert.match((await page.evaluate(()=>window.state())).error,/al menos 4 preguntas/)
      await input.fill('es un país de Europa')
      await page.getByRole('button',{name:'Geografía',exact:true}).click()
      assert.equal((await page.evaluate(()=>window.state())).catalog[1].category,'Geografía')
      for(const label of ['Francia','Italia','Alemania','España']) await cell(2,label).click()
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true)
      await page.screenshot({path:'.scratch/guess-who-traits-'+width+'.png',fullPage:true})

      // Volver a la pregunta 1 desde la lista conserva su texto.
      await page.getByRole('list',{name:'Preguntas',exact:true}).getByRole('button').first().click()
      assert.equal(await page.getByRole('textbox',{name:'Pregunta 1',exact:true}).inputValue(),'¿Es un país de América?')
      await page.getByRole('list',{name:'Preguntas',exact:true}).getByRole('button').nth(1).click()

      // Quitar la pregunta se lleva sus marcas.
      await page.getByRole('button',{name:'Quitar esta pregunta'}).click()
      const state=await page.evaluate(()=>window.state())
      assert.equal(state.catalog.length,1)
      assert.equal(state.cards.flat().includes('pregunta-2'),false)
      assert.deepEqual(errors,[])
      console.log('PASS '+width+'px: lista + fichas, marcar todas, pregunta nueva, quitar con sus marcas, sin scroll horizontal')
      await page.close()
    }
  } finally {await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
