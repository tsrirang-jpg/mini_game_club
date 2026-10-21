import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const url = process.env.GAME_URL || 'http://127.0.0.1:5188';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: {width:390,height:844}, isMobile:true, hasTouch:true });
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
await context.addInitScript(() => {
  window.testHidden = false; window.testSockets = [];
  Object.defineProperty(document, 'hidden', {configurable:true,get:()=>window.testHidden});
  window.WebSocket = new Proxy(window.WebSocket, {construct(Target,args) {
    const socket = new Target(...args), send = socket.send.bind(socket);
    socket.send = data => {if (!socket.testSilent) send(data);};
    socket.addEventListener('message', event => {if(socket.testSilent) event.stopImmediatePropagation();});
    if(new URL(socket.url).searchParams.has('sessionId')) window.testSockets.push(socket); return socket;
  }});
});
const kinds = {pok:'session',poker:'pokerSession',spyfall:'spySession',oldmaid:'oldMaidSession',whoami:'whoAmISession',liar:'liarSession',undercover:'underSession'};
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function state() { return page.evaluate(()=>window.testSession.getSnapshot()); }
async function connected() { await page.waitForFunction(()=>window.testSession.getSnapshot().status==='connected' && window.testSession.getSnapshot().snapshot,{},{timeout:7000}); }
async function hide() { await page.evaluate(()=>{window.testHidden=true;document.dispatchEvent(new Event('visibilitychange'));}); }
async function show() { await page.evaluate(()=>{window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));window.dispatchEvent(new Event('online'));}); }
async function sockets() {return page.evaluate(()=>window.testSockets.length);}
try {
 for (const [kind,key] of Object.entries(kinds)) {
  await page.goto(url+'/games');
  await page.evaluate(async ({key,bots})=>{
    const moduleUrl=performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname==='/src/session.ts')?.name;
    if(!moduleUrl) throw new Error('Session module was not loaded');
    window.testSession=(await import(moduleUrl))[key];await window.testSession.connect('Resume test',undefined,bots);
  },{key,bots:['pok','poker'].includes(kind)?1:0});
  await connected();let original=await state();
  if(['pok','poker'].includes(kind)) {
   await page.evaluate(()=>window.testSession.send('startRound'));
   await page.waitForFunction(()=>window.testSession.getSnapshot().hand.length===2);
   original=await state();
  }
  const identity=original.playerId,code=original.snapshot.code,hand=original.hand;
  const baseline=await sockets();
  await hide();await sleep(100);
  // A healthy connection needs one foreground sync, not a new socket.
  const healthyAt=Date.now();await show();await connected();
  assert.equal(await sockets(),baseline,kind+': healthy socket must be retained');
  let resumed=await state();assert.equal(resumed.playerId,identity);assert.equal(resumed.snapshot.code,code);assert.deepEqual(resumed.hand,hand);
  console.log('PASS '+kind+': healthy foreground sync '+(Date.now()-healthyAt)+'ms');
  await sleep(300);await hide();
  // Simulate a half-open mobile connection: readyState stays OPEN but all app
  // traffic disappears. Browser offline APIs alone cannot reproduce this defect.
  await page.evaluate(()=>{window.testSockets.filter(s=>s.readyState===WebSocket.OPEN).forEach(s=>s.testSilent=true);});
  const stalledAt=Date.now();await show();await connected();const latency=Date.now()-stalledAt;
  assert.ok(latency<4500,kind+': silent socket recovery took '+latency+'ms');
  resumed=await state();assert.equal(resumed.playerId,identity);assert.equal(resumed.snapshot.code,code);assert.deepEqual(resumed.hand,hand);
  assert.equal(await sockets(),baseline+1,kind+': one replacement socket');
  await sleep(1200);assert.equal(await sockets(),baseline+1,kind+': queued SDK retry must not open a second socket');
  console.log('PASS '+kind+': stalled socket recovered '+latency+'ms, same seat/table/private hand');
  await sleep(300);await hide();await context.setOffline(true);await sleep(100);await context.setOffline(false);const onlineAt=Date.now();await show();await connected();
  resumed=await state();assert.equal(resumed.playerId,identity);assert.equal(resumed.snapshot.code,code);assert.deepEqual(resumed.hand,hand);
  console.log('PASS '+kind+': network restored '+(Date.now()-onlineAt)+'ms');
  await page.evaluate(()=>window.testSession.leave('/games'));await page.waitForURL('**/games');
  const afterExit=await sockets();await hide();await show();await sleep(300);assert.equal(await sockets(),afterExit,kind+': exit must stop wake reconnection');
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: all seven games resume healthy/stalled/offline sockets on a mobile viewport without duplicate sockets or new seats');
} finally {await context.close();await browser.close();}
