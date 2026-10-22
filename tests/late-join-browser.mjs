import { chromium } from 'playwright';
import { Client } from '@colyseus/sdk';
import assert from 'node:assert/strict';
import { previewPath } from './helpers/preview-path.mjs';
const url=process.env.GAME_URL||'http://127.0.0.1:5188',endpoint=process.env.GAME_WS||'ws://127.0.0.1:2567';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await context.newPage(),hostPage=await context.newPage(),errors=[],rooms=[];let serial=0;
for(const p of [page,hostPage])p.on('pageerror',error=>errors.push(error.message));
const config={pok:{base:'',key:'session'},poker:{base:'/poker',key:'pokerSession'},spyfall:{base:'/spyfall',key:'spySession'},oldmaid:{base:'/oldmaid',key:'oldMaidSession'},liar:{base:'/liar',key:'liarSession'},whoami:{base:'/whoami',key:'whoAmISession'},undercover:{base:'/undercover',key:'underSession'}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout=10000){const end=Date.now()+timeout;while(!await fn()){if(Date.now()>end)throw Error('Late join timeout');await sleep(15);}}
function observe(room){rooms.push(room);room.reconnection.enabled=false;const o={room,state:null,hand:[],private:null,errors:[]};room.onMessage('snapshot',s=>o.state=s);room.onMessage('hand',m=>o.hand=m.cards);for(const type of ['secret','identities','undercover'])room.onMessage(type,m=>o.private=m);room.onMessage('error',m=>o.errors.push(m.message));room.send('sync');return o;}
function send(o,type,value){o.room.send('action',{type,value,roundId:o.state.roundId,turnNumber:o.state.turnNumber,actionId:'late-browser-'+(++serial)});}
async function session(page,key){return page.evaluate(async key=>{const moduleUrl=performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname==='/src/session.ts').name;return(await import(moduleUrl))[key].getSnapshot();},key);}
async function injectHost(o,key,base){await hostPage.evaluate(async({snapshot,key,base,id,hand,privateData})=>{const u=performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname==='/src/session.ts').name;const store=(await import(u))[key];store.update({status:'connected',snapshot,playerId:id,hand,handRound:snapshot.roundId,secret:key==='spySession'?privateData:null,whoAmI:key==='whoAmISession'?privateData:null,undercover:key==='underSession'?privateData:null});const {navigate}=await import('/src/router.ts');navigate(base+'/play/'+snapshot.code);},{snapshot:o.state,key,base,id:o.room.sessionId,hand:o.hand,privateData:o.private});}
async function finish(kind,group){const host=group[0];
 if(kind==='pok'){while(!['ROUND_END'].includes(host.state.phase)){const s=host.state;if(['PLAYER_ACTIONS','DEALER_ACTION'].includes(s.phase)){for(const o of group)if(!s.players.find(p=>p.id===o.room.sessionId).acted&&(s.phase==='PLAYER_ACTIONS'?o.room.sessionId!==s.dealerId:o.room.sessionId===s.dealerId))send(o,'stand');}await sleep(100);}}
 else if(kind==='poker'){while(host.state.phase!=='ROUND_END'){const actor=group.find(o=>o.room.sessionId===host.state.turnId);if(actor)send(actor,'fold');await sleep(100);}}
 else if(kind==='spyfall'){const spy=group.find(o=>o.private?.role?.kind==='spy');send(spy,'guess','คำตอบที่ไม่ใช่สถานที่');}
 else if(kind==='whoami'){while(host.state.phase==='PLAYING'){const n=host.state.turnNumber;send(group.find(o=>o.room.sessionId===host.state.turnId),'endTurn');await until(()=>host.state.turnNumber!==n||host.state.phase!=='PLAYING');}}
 else if(kind==='oldmaid'){let count=0;while(host.state.phase==='PLAYING'&&count++<2000){const n=host.state.turnNumber,actor=group.find(o=>o.room.sessionId===host.state.turnId),target=group.find(o=>o.room.sessionId===host.state.targetId);const match=target.hand.findIndex(card=>actor.hand.some(c=>c.rank===card.rank));send(actor,'draw',n+':'+Math.max(0,match));await until(()=>host.state.turnNumber!==n||host.state.phase!=='PLAYING');}assert.ok(count<2000);}
 else if(kind==='liar'){send(group.find(o=>o.room.sessionId===host.state.turnId),'play',host.state.turnNumber+'|1:clubs');await until(()=>host.state.requiredRank===2);while(host.state.phase==='PLAYING'){const n=host.state.turnNumber;send(group.find(o=>o.room.sessionId===host.state.turnId),'skip',String(n));await until(()=>host.state.turnNumber!==n||host.state.phase!=='PLAYING');}}
 else {for(const o of group)send(o,'acknowledge');await until(()=>host.state.phase==='DESCRIBE');while(host.state.phase==='DESCRIBE'){const n=host.state.turnNumber;send(group.find(o=>o.room.sessionId===host.state.turnId),'hint','ตัวอย่างคำใบ้');await until(()=>host.state.turnNumber!==n);}for(const o of group)send(o,'readyVote');await until(()=>host.state.phase==='VOTING');const words=group.map(o=>o.private.word);const target=group.find(o=>words.filter(word=>word===o.private.word).length===1);for(const o of group)send(o,'vote',{targetId:o===target?group.find(other=>other!==target).room.sessionId:target.room.sessionId});}
 await until(()=>['ROUND_END','RESULTS','GAME_END'].includes(host.state.phase),12000);
}
try{
 for(const [kind,{base,key}]of Object.entries(config)){
  const group=[observe(await new Client(endpoint).create(kind,{name:'Host'}))];for(let i=1;i<3;i++)group.push(observe(await new Client(endpoint).joinById(group[0].room.roomId,{name:'Friend '+i,game:kind})));
  const host=group[0];await until(()=>group.every(o=>o.state?.players.length===3));for(const o of group.slice(1))send(o,'setReady',true);await until(()=>host.state.players.filter(p=>p.ready).length===2);send(host,'startRound');
  await until(()=>!['LOBBY','RESULTS','ROUND_END'].includes(host.state.phase));
  if(kind==='pok'){await until(()=>host.state.phase!=='DEALING');let attempt=0;while(!['PLAYER_ACTIONS','DEALER_ACTION'].includes(host.state.phase)&&attempt++<10){await until(()=>host.state.phase==='ROUND_END');send(host,'prepareRound');await until(()=>host.state.phase==='LOBBY');for(const o of group.slice(1))send(o,'setReady',true);await until(()=>host.state.players.filter(p=>p.ready).length===2);send(host,'startRound');await until(()=>host.state.phase!=='LOBBY'&&host.state.phase!=='DEALING');}}
  if(kind==='poker')await until(()=>host.state.phase==='PREFLOP');
  await hostPage.goto(url+'/games');await injectHost(host,key,base);await hostPage.locator('.room-bar').waitFor();
  const pokerFrames=kind==='poker'?await hostPage.locator('.poker-seat').count():null;
  await page.goto(url+base+'/rooms/join?code='+host.room.roomId);await page.getByLabel('ชื่อของคุณ',{exact:true}).fill('Waiting friend');await page.locator('form button[type="submit"],form button.primary').last().click();
  await page.getByRole('heading',{name:'รอเข้าร่วมรอบถัดไป',exact:true}).waitFor();const queued=await session(page,key);assert.equal(queued.status,'connected');assert.equal(queued.snapshot.players.find(p=>p.id===queued.playerId).waiting,true);assert.equal(queued.hand.length,0);
  if(kind==='spyfall')assert.equal(queued.secret.role,null);if(kind==='whoami')assert.deepEqual(queued.whoAmI.identities,[]);if(kind==='undercover')assert.equal(queued.undercover.word,null);
  await until(()=>host.state.players.length===4);await injectHost(host,key,base);await hostPage.getByRole('button',{name:'ผู้รอรอบถัดไป 1 คน',exact:true}).click();await hostPage.getByRole('dialog',{name:'ผู้รอรอบถัดไป'}).waitFor();assert.match(await hostPage.getByRole('dialog').textContent(),/Waiting friend/);await hostPage.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();
  if(kind==='poker')assert.equal(await hostPage.locator('.poker-seat').count(),pokerFrames,'waiting seat must not resize the existing player row');
  for(const [width,height]of [[320,480],[390,844],[568,320],[844,390],[1024,768],[1366,768],[1920,1080],[2560,1440]]){
   await page.setViewportSize({width,height});await sleep(30);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),kind+' '+width+': horizontal overflow');
   const clipped=await page.locator('.round-waiting-page button,.round-waiting-roster li').evaluateAll(nodes=>nodes.filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5}).length);assert.equal(clipped,0,kind+': waiting controls must fit');
   if(width===390||width===1366)await page.screenshot({path:previewPath('late-join-'+kind+'-'+width+'.png'),fullPage:true});
  }
  await page.reload();await page.getByRole('heading',{name:'รอเข้าร่วมรอบถัดไป',exact:true}).waitFor();assert.equal((await session(page,key)).playerId,queued.playerId,'refresh preserves reserved seat');
  await finish(kind,group);send(host,'prepareRound');await until(()=>host.state.phase==='LOBBY');await page.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();for(const o of group.slice(1))send(o,'setReady',true);
  await until(()=>host.state.players.filter(p=>p.ready).length===3);send(host,'startRound');await until(async()=>{const s=await session(page,key);return s.snapshot.roundId>queued.snapshot.roundId&&!s.snapshot.players.find(p=>p.id===s.playerId).waiting;});
  const joined=await session(page,key);assert.equal(await page.locator('.round-waiting-page').count(),0);if(['pok','poker'].includes(kind))await until(async()=>(await session(page,key)).hand.length===2);
  if(kind==='whoami')assert.ok(joined.whoAmI.identities.length===3);if(kind==='spyfall')assert.ok(joined.secret.role);if(kind==='undercover')assert.ok(joined.undercover.word);
  await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();for(const o of group)await o.room.leave();console.log('PASS '+kind+': active join, private waiting seat, queue UI, eight sizes, refresh, next-round ready/deal');
 }
 assert.deepEqual(errors,[]);console.log('PASS: late join works across all seven multiplayer games');
}finally{for(const room of rooms){room.reconnection.enabled=false;room.connection.close(1000);}await browser.close();}
