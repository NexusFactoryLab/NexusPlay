// Vite local. Reutiliza Playwright mediante PLAYWRIGHT_MODULE sin instalar dependencias.
// Partida en solitario contra el bot (issue #60): selector de formato y aviso del chat.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.DEMO_TEST_URL || 'http://127.0.0.1:5177'
const fixture = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><div id="chat" style="height:520px;max-width:360px;margin:16px"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
const reactModule=await import('/node_modules/.vite/deps/react.js'); const React=reactModule.default??reactModule;
const domModule=await import('/node_modules/.vite/deps/react-dom_client.js'); const {createRoot}=domModule.default??domModule;
// Misma URL (con ?v=) que usa el componente: otra copia del router no compartiría su contexto.
const roomSource=await (await fetch('/src/components/home/games/GuessWhoRoom.tsx')).text();
const routerAt=roomSource.indexOf('/node_modules/.vite/deps/react-router-dom.js'); const routerModule=await import(roomSource.slice(routerAt,roomSource.indexOf('"',routerAt))); const {MemoryRouter,Routes,Route,useLocation}=routerModule.default??routerModule;
await import('/src/index.css');
const {GuessWhoRoom}=await import('/src/components/home/games/GuessWhoRoom.tsx');
const {ChatPanel}=await import('/src/components/home/games/ChatPanel.tsx');
const {BOT_CHAT_NOTICE}=await import('/src/components/home/games/guessWhoBot.ts');
window.exited=0;
function Probe(){const location=useLocation();window.navigated=location.pathname+location.search;return React.createElement('p',null,'Sala: '+window.navigated)}
createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:['/']},React.createElement(Routes,null,
  React.createElement(Route,{path:'/',element:React.createElement(GuessWhoRoom,{gameId:'juego-1',onExit:()=>{window.exited++}})}),
  React.createElement(Route,{path:'/quien-es/sala',element:React.createElement(Probe)}))));
window.showChat=()=>createRoot(document.getElementById('chat')).render(React.createElement(ChatPanel,{inline:true,messages:[{userId:'bot:X',displayName:'Bot Nexus (difícil)',text:'¿Es un país de Europa?',sentAt:1},{userId:'bot:X',displayName:'Bot Nexus (difícil)',text:'Sí. (respondido con IA, puede equivocarse) Pregunta propia: descarta tú según la respuesta.',sentAt:Date.now()}],selfUserId:'ana',onSend:()=>{},notice:BOT_CHAT_NOTICE,
  guided:{cards:[],questions:[{id:'q',text:'¿Es un país de América?',cardIds:['0']}],pending:null,isMyTurn:true,opponentIsBot:true,onAsk:()=>{},onAskFree:t=>{window.free=t},onAnswer:()=>{}}}));
</script></body></html>`

async function main(){
  mkdirSync('.scratch',{recursive:true})
  const browser=await chromium.launch({channel:'chrome',headless:true})
  try {
    for(const width of [1280,390,320]){
      const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'})
      const errors=[]; page.on('pageerror',error=>errors.push(error.message))
      await page.route('**/__solo-fixture',route=>route.fulfill({contentType:'text/html',body:fixture}))
      await page.goto(base+'/__solo-fixture')
      const dialog=page.getByRole('dialog')
      await dialog.getByRole('heading',{name:'Elige tu formato'}).waitFor()
      await dialog.getByRole('button',{name:'Solo, contra el bot'}).click()
      await dialog.getByRole('heading',{name:'Elige la dificultad'}).waitFor()
      for(const label of ['Fácil','Medio','Difícil']) await dialog.getByRole('button',{name:new RegExp('^'+label)}).waitFor()
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true)
      await page.screenshot({path:'.scratch/guess-who-solo-picker-'+width+'.png'})
      // Volver regresa al formato sin cerrar; Cancelar sí cierra.
      await dialog.getByRole('button',{name:'Volver'}).click()
      await dialog.getByRole('heading',{name:'Elige tu formato'}).waitFor()
      assert.equal(await page.evaluate(()=>window.exited),0)
      await dialog.getByRole('button',{name:'Solo, contra el bot'}).click()
      await dialog.getByRole('button',{name:/^Difícil/}).click()
      await page.getByText('Sala: /quien-es/sala?gameId=juego-1&bot=HARD').waitFor()

      await page.evaluate(()=>window.showChat())
      await page.getByText('El bot no lee mensajes sueltos: hazle preguntas de Sí/No (sugeridas o tuyas, con «?»).').waitFor()
      await page.getByRole('status').filter({hasText:'respondió'}).getByText('Sí',{exact:true}).waitFor()
      await page.locator('#chat').screenshot({path:'.scratch/guess-who-answer-'+width+'.png'})
      await page.getByRole('button',{name:'Seguir preguntando'}).click()
      await page.getByText(/el bot la responde con IA/).waitFor()
      await page.locator('#chat').getByRole('textbox',{name:'Mensaje'}).fill('su capital es muy grande')
      await page.getByRole('button',{name:/Hacer esta pregunta/}).click()
      assert.equal(await page.evaluate(()=>window.free),'su capital es muy grande')
      const box=page.locator('#chat').getByRole('textbox',{name:'Mensaje'})
      await box.fill('¿Tiene costa?')
      await box.press('Enter')
      assert.equal(await page.evaluate(()=>window.free),'¿Tiene costa?')
      await page.locator('#chat').screenshot({path:'.scratch/guess-who-solo-chat-'+width+'.png'})
      assert.deepEqual(errors,[])
      console.log('PASS '+width+'px: formato → dificultad → ruta con bot, volver sin cerrar, aviso del chat, sin scroll horizontal')
      await page.close()
    }
  } finally {await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
