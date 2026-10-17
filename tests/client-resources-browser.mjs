import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:844,height:390}}),page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(()=>{
 window.__resource={timers:new Map(),fired:0,visibility:new Set(),hidden:false,resolveCopy:null};
 const set=window.setTimeout.bind(window),clear=window.clearTimeout.bind(window);
 window.setTimeout=(fn,delay,...args)=>{const id=set((...values)=>{window.__resource.timers.delete(id);window.__resource.fired++;fn(...values)},delay,...args);window.__resource.timers.set(id,delay);return id};
 window.clearTimeout=id=>{window.__resource.timers.delete(id);clear(id)};
 const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
 document.addEventListener=(type,listener,options)=>{if(type==='visibilitychange')window.__resource.visibility.add(listener);add(type,listener,options)};
 document.removeEventListener=(type,listener,options)=>{if(type==='visibilitychange')window.__resource.visibility.delete(listener);remove(type,listener,options)};
 Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__resource.hidden});
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>window.__resource.pendingCopy?new Promise(resolve=>window.__resource.resolveCopy=resolve):Promise.resolve()}});
});
async function fixture(deadline){await page.evaluate(async deadline=>{const{session}=await import('/src/session.ts'),{navigate}=await import('/src/router.ts');session.update({status:'connected',playerId:'p0',hand:[],handRound:1,error:'',snapshot:{code:'ABCDEF0123',phase:deadline?'DEALER_ACTION':'LOBBY',roundId:1,deadline:deadline?Date.now()+deadline:0,hostId:'p0',dealerId:'p0',players:[0,1].map(seat=>({id:'p'+seat,name:'User '+seat,seat,points:1000,bet:10,isBot:false,ready:true,connected:true,acted:false,cardCount:2})),settled:false,results:[],catches:[],rules:{actionMs:30000,dealMs:900,revealMs:1800,settlementMs:500,reconnectSeconds:60,initialPoints:1000,maxPlayers:6,bets:[10,20,50],pairMultiplier:2,suitedTwoMultiplier:2,suitedThreeMultiplier:3,yellowMultiplier:3,tripleMultiplier:5,straightMultiplier:3,straightFlushMultiplier:5}}});navigate('/play/ABCDEF0123');},deadline);await page.locator('.room-bar').waitFor();}
const reset=()=>page.evaluate(()=>window.__resource.fired=0);
try{
 await page.goto('http://127.0.0.1:5188/games');await fixture(0);await page.waitForTimeout(100);await reset();await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.__resource.fired),0,'lobby does not poll');
 await fixture(1800);await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>window.__resource.fired)>0);
 await page.evaluate(()=>{window.__resource.hidden=true;document.dispatchEvent(new Event('visibilitychange'));window.__resource.fired=0});await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.__resource.fired),0,'hidden clock pauses');
 await page.evaluate(()=>{window.__resource.hidden=false;document.dispatchEvent(new Event('visibilitychange'))});await page.waitForTimeout(1100);assert.match(await page.locator('.pok-clock').textContent(),/0 วินาที/);assert.equal(await page.evaluate(()=>window.__resource.timers.size),0,'expired deadline stops its timer');
 await fixture(0);await page.getByRole('button',{name:'คัดลอกรหัส',exact:true}).click();assert.equal(await page.evaluate(()=>[...window.__resource.timers.values()].filter(ms=>ms===1800).length),1);
 await page.evaluate(async()=>{const{navigate}=await import('/src/router.ts');navigate('/games')});await page.locator('.game-options').waitFor();assert.equal(await page.evaluate(()=>window.__resource.timers.size),0,'copy timer cleared on unmount');assert.equal(await page.evaluate(()=>window.__resource.visibility.size),0);
 await fixture(0);await page.evaluate(()=>window.__resource.pendingCopy=true);await page.getByRole('button',{name:'คัดลอกรหัส',exact:true}).click();await page.evaluate(async()=>{const{navigate}=await import('/src/router.ts');navigate('/games')});await page.locator('.game-options').waitFor();await page.evaluate(()=>window.__resource.resolveCopy());await page.waitForTimeout(20);assert.equal(await page.evaluate(()=>window.__resource.timers.size),0,'late clipboard resolution does not start a timer');
 for(let i=0;i<10;i++){await fixture(5000);await page.evaluate(async()=>{const{navigate}=await import('/src/router.ts');navigate('/games')});await page.locator('.game-options').waitFor();}
 assert.equal(await page.evaluate(()=>window.__resource.timers.size),0);assert.equal(await page.evaluate(()=>window.__resource.visibility.size),0);assert.deepEqual(errors,[]);
 console.log('PASS: idle/hidden/expired clocks stop, 10 mount cycles release listeners/timers, clipboard cleanup and cancelled async clipboard');
}finally{await browser.close()}
