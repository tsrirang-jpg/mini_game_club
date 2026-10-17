import {chromium} from 'playwright';
import {Client} from '@colyseus/sdk';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const origin=process.env.BENCH_URL||'http://127.0.0.1:2568';
const cleanupOnly=process.env.BENCH_ONLY_CLEANUP==='1';
const phase=process.env.BENCH_PHASE||'before',samples=Number(process.env.BENCH_SAMPLES||3),idleMs=3000;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
const games=[{game:'pok',path:'/rooms/create',create:'สร้างโต๊ะใหม่ →'},{game:'poker',path:'/poker/rooms/create',create:'สร้างโต๊ะ Poker →'},{game:'spyfall',path:'/spyfall/rooms/create',create:'สร้างห้อง Spyfall →'},{game:'oldmaid',path:'/oldmaid/rooms/create',create:'สร้างห้อง Old Maid →'}];
const browser=await chromium.launch({channel:'msedge',headless:true});
let result={phase,origin,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),measuredAt:new Date().toISOString(),environment:{browser:browser.version(),node:process.version,platform:process.platform,viewport:'1366x768',samples,idleMs,notes:'Local compiled production build, fresh browser context per cold sample; warm samples reuse HTTP cache. Heap values follow forced GC and are not proof of a memory leak.'},cold:{},warmImages:{},idle:{},sync:{}};
try{
 if(cleanupOnly)result=JSON.parse(await readFile(`reports/performance/${phase}.json`,'utf8'));
 if(!cleanupOnly){
 for(const spec of [{game:'menu',path:'/games'},...games]){
  const runs=[];
  for(let i=0;i<samples;i++){
   const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});const page=await context.newPage();
   await page.goto(origin+spec.path);await page.locator(spec.game==='menu'?'.game-options':'.entry form').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);
   const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');const {metrics}=await cdp.send('Performance.getMetrics');
   const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:r.name,bytes:r.decodedBodySize,transfer:r.transferSize})));
   const js=resources.filter(r=>/\.js(?:\?|$)/.test(r.name));runs.push({jsBytes:js.reduce((sum,r)=>sum+r.bytes,0),jsRequests:js.length,heapBytes:metrics.find(m=>m.name==='JSHeapUsedSize')?.value??(await cdp.send('Runtime.getHeapUsage')).usedSize});
   if(spec.game!=='menu'&&spec.game!=='pok'){
    await page.locator('.entry-hero-art').evaluate(e=>e.decode());await page.reload();await page.locator('.entry-hero-art').evaluate(e=>e.decode());
    const images=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/images/entry/')).map(r=>({name:r.name.split('/').at(-1),transfer:r.transferSize,decoded:r.decodedBodySize})));
    (result.warmImages[spec.game]??=[]).push({networkRequests:images.filter(r=>r.transfer>0).length,transferBytes:images.reduce((sum,r)=>sum+r.transfer,0)});
   }
   await context.close();
  }
  result.cold[spec.game]={samples:runs,medianJsBytes:median(runs.map(r=>r.jsBytes)),medianJsRequests:median(runs.map(r=>r.jsRequests)),medianHeapBytes:median(runs.map(r=>r.heapBytes))};console.log('Measured cold/warm:',phase,spec.game,result.cold[spec.game].medianJsBytes);
 }
 for(const spec of games){
  const runs=[];
  for(let i=0;i<samples;i++){
   const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});
   await context.addInitScript(()=>{window.__bench={callbacks:0};for(const method of ['setTimeout','setInterval']){const original=window[method].bind(window);window[method]=(callback,delay,...args)=>original(typeof callback==='function'?function(...values){window.__bench.callbacks++;return callback(...values)}:callback,delay,...args);}});
   const page=await context.newPage();await page.goto(origin+spec.path);await page.getByLabel('ชื่อของคุณ').fill('Performance Host');await page.getByRole('button',{name:spec.create,exact:true}).click();await page.locator('.room-bar').waitFor();await page.waitForTimeout(300);
   const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('HeapProfiler.collectGarbage');await page.evaluate(()=>window.__bench.callbacks=0);
   const start=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
   await page.waitForTimeout(idleMs);
   const end=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
   runs.push({timerCallbacks:await page.evaluate(()=>window.__bench.callbacks),scriptMs:(end.ScriptDuration-start.ScriptDuration)*1000,taskMs:(end.TaskDuration-start.TaskDuration)*1000});
   await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();await context.close();
  }
  result.idle[spec.game]={samples:runs,medianTimerCallbacks:median(runs.map(r=>r.timerCallbacks)),medianScriptMs:median(runs.map(r=>r.scriptMs)),medianTaskMs:median(runs.map(r=>r.taskMs))};console.log('Measured idle:',phase,spec.game,result.idle[spec.game].medianTimerCallbacks);
 }
 for(const spec of games){
  const runs=[];
  for(let i=0;i<samples;i++){
   const a=await new Client(origin.replace('http','ws')).create(spec.game,{name:'Benchmark Host',botCount:0});a.reconnection.enabled=false;let peer=0,own=0;
   a.onMessage('snapshot',()=>peer++);a.onMessage('hand',()=>{});a.onMessage('secret',()=>{});
   const b=await new Client(origin.replace('http','ws')).joinById(a.roomId,{name:'Benchmark Guest',game:spec.game});b.reconnection.enabled=false;b.onMessage('snapshot',()=>own++);b.onMessage('hand',()=>{});b.onMessage('secret',()=>{});
   await sleep(100);peer=0;own=0;for(let n=0;n<5;n++){b.send('sync');await sleep(100);}runs.push({peerSnapshots:peer,requesterSnapshots:own});await b.leave();await a.leave();
  }
  result.sync[spec.game]={samples:runs,medianPeerSnapshots:median(runs.map(r=>r.peerSnapshots)),medianRequesterSnapshots:median(runs.map(r=>r.requesterSnapshots))};console.log('Measured sync:',phase,spec.game,result.sync[spec.game].medianPeerSnapshots);
 }
 }
 const cleanupRuns=[];
 for(let i=0;i<samples;i++){
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  await context.addInitScript(()=>{
   window.__cleanup=new Map();const set=window.setTimeout.bind(window),clear=window.clearTimeout.bind(window);
   window.setTimeout=(fn,delay,...args)=>{const id=set((...values)=>{window.__cleanup.delete(id);fn(...values)},delay,...args);window.__cleanup.set(id,delay);return id};
   window.clearTimeout=id=>{window.__cleanup.delete(id);clear(id)};
   Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.resolve()},configurable:true});
  });
  const page=await context.newPage();await page.goto(origin+'/rooms/create');await page.getByLabel('ชื่อของคุณ').fill('Cleanup Test');await page.getByRole('button',{name:'สร้างโต๊ะใหม่ →',exact:true}).click();await page.locator('.room-bar').waitFor();
  await page.getByRole('button',{name:'คัดลอกรหัสห้อง',exact:true}).click();await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();await page.locator('.entry form').waitFor();await page.waitForTimeout(50);
  cleanupRuns.push(await page.evaluate(()=>[...window.__cleanup.values()].filter(delay=>delay===1800).length));await context.close();
 }
 result.cleanup={samples:cleanupRuns,medianPendingClipboardTimeouts:median(cleanupRuns),note:'Pending 1800 ms clipboard callbacks shortly after leaving. This measures temporary retained callbacks, not an unbounded heap leak.'};
 console.log('Measured clipboard cleanup:',phase,result.cleanup.medianPendingClipboardTimeouts);
 await mkdir('reports/performance',{recursive:true});await writeFile(`reports/performance/${phase}.json`,JSON.stringify(result,null,2)+'\n');console.log('Saved',`reports/performance/${phase}.json`);
}finally{await browser.close()}
