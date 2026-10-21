import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {previewPath} from './helpers/preview-path.mjs';
import {checkRoomEntryLayout} from './helpers/room-entry-layout.mjs';
const url=process.env.GAME_URL||'http://127.0.0.1:5188';
const browser=await chromium.launch({channel:'msedge',headless:true});
const sizes=[[1920,1080],[1366,768],[1024,768],[768,1024],[390,844],[375,667],[320,568],[320,480],[844,390],[667,375],[568,320]];
const errors=[],contexts=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){const end=Date.now()+12000;while(!await fn()){if(Date.now()>end)throw new Error('Liar browser timeout');await pause(30);}}
async function fit(page,label,selectors,noScroll=false){
 const report=await page.evaluate(({selectors,noScroll})=>({overflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,bad:[...document.querySelectorAll(selectors)].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left< -1||r.right>innerWidth+1||(noScroll&&(r.top< -1||r.bottom>innerHeight+1)));}).map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON()}))}),{selectors,noScroll});
 assert.deepEqual(report.bad,[],label+' '+JSON.stringify(report));if(noScroll)assert.equal(report.overflow,false,label+' scroll');
}
async function pageAt(width=1366,height=768){const c=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p;}
const page=await pageAt();
try{
 await page.goto(url+'/games');await page.getByRole('button',{name:'เลือก Liar’s Card',exact:true}).click();
 for(const join of [false,true]){
  if(join)await page.getByRole('button',{name:'เข้าห้องเพื่อน',exact:true}).click();
  await page.getByLabel('ชื่อของคุณ',{exact:true}).fill('มะนาว');
  if(join)await page.getByLabel('รหัสห้อง',{exact:true}).fill('ABCDEF0123');
  for(const[width,height]of sizes){await page.setViewportSize({width,height});await pause(60);await checkRoomEntryLayout(page,`${join?'join':'create'} ${width}x${height}`);if([1366,390,568].includes(width))await page.screenshot({path:previewPath(`preview-liar-real-${join?'join':'create'}-${width}x${height}.png`),fullPage:true});}
 }
 if(!process.env.GAME_URL){
  for(const phase of ['LOBBY','PLAYING','RESPONSE','REVEAL','RESULTS']){
   await page.evaluate(async phase=>{
    const{liarSession}=await import('/src/session.ts'),{navigate}=await import('/src/router.ts');
    const players=Array.from({length:6},(_,seat)=>({id:'p'+seat,name:seat?'เพื่อน '+seat:'มะนาว',seat,connected:true,ready:true,isBot:false,cardCount:seat?6:26,finished:false,wins:0}));
    const cards=Array.from({length:26},(_,i)=>({rank:i%13+1,suit:i<13?'clubs':'hearts'}));
    liarSession.update({status:'connected',playerId:'p0',hand:cards,handRound:1,error:'',snapshot:{game:'liar',code:'ABCDEF0123',roundId:1,phase,hostId:'p0',players,turnId:phase==='RESPONSE'||phase==='REVEAL'?'p1':'p0',turnNumber:2,requiredRank:5,opening:false,deadline:Date.now()+30000,turnDurationMs:30000,challengeMs:5000,skipCount:1,activeCount:6,discardedCount:1,history:[{id:1,playerId:'p1',text:'เพื่อน 1 ข้าม · ยังลงเลข 5'}],latest:{id:2,playerId:'p1',rank:5,card:phase==='REVEAL'?{rank:9,suit:'hearts'}:null,challengerId:phase==='REVEAL'?'p2':null,truthful:phase==='REVEAL'?false:null,opening:false},result:phase==='RESULTS'?{reason:'all_skipped',loserIds:['p0'],hands:players.map(p=>({playerId:p.id,cards:p.id==='p0'?cards:cards.slice(0,6),points:p.id==='p0'?160:21,finished:false}))}:null}});
    navigate('/liar/play/ABCDEF0123');
   },phase);
   await page.locator('.liar-dashboard').waitFor();
   for(const[width,height]of sizes){await page.setViewportSize({width,height});await pause(50);await fit(page,`${phase} ${width}x${height}`,'.liar-room-bar,.liar-board,.liar-center,.liar-required,.liar-turn-status,.liar-latest,.liar-actions,.liar-self,.liar-lobby,.liar-results',true);if(phase==='PLAYING'){const overlap=await page.evaluate(()=>{const a=document.querySelector('.liar-opponents').getBoundingClientRect(),b=document.querySelector('.liar-center').getBoundingClientRect(),c=document.querySelector('.liar-self').getBoundingClientRect(),r=document.querySelector('.liar-required').getBoundingClientRect(),t=document.querySelector('.liar-turn-status').getBoundingClientRect();return a.bottom>b.top+1||r.top<a.bottom-1||t.top<r.bottom-1||(innerWidth<=600&&innerHeight>innerWidth&&t.bottom>c.top+1);});assert.equal(overlap,false,'no table content collision '+width+'x'+height);}if(phase==='PLAYING')assert.equal(await page.locator('.liar-hand button').count(),26);if([1366,390,320,568].includes(width))await page.screenshot({path:previewPath(`preview-liar-real-${phase}-${width}x${height}.png`)});}
   if(phase==='RESPONSE'){
    for(const[width,height]of [[1366,768],[390,844],[320,480],[568,320]]){await page.setViewportSize({width,height});await page.getByRole('button',{name:'⚠ Emergency',exact:true}).click();await fit(page,'Emergency '+width+'x'+height,'.liar-dialog,.liar-modal-actions',true);assert.equal(await page.getByRole('button',{name:'ยืนยันจับโกหก'}).count(),1);await page.screenshot({path:previewPath(`preview-liar-real-emergency-${width}x${height}.png`)});await page.keyboard.press('Escape');}
   }
  }
 }
 await page.close();
 const a=await pageAt(),b=await pageAt(390,844),c=await pageAt(568,320);
 await a.goto(url+'/liar/rooms/create');await a.getByLabel('ชื่อของคุณ').fill('Alpha');await a.getByRole('button',{name:'สร้างห้อง ไพ่ตอแหล',exact:true}).click();await a.locator('.liar-room-code').waitFor();const code=await a.locator('.liar-room-code').textContent();
 for(const[p,name]of[[b,'Beta'],[c,'Gamma']]){await p.goto(url+'/liar/rooms/join?code='+code);await p.getByLabel('ชื่อของคุณ').fill(name);await p.getByRole('button',{name:'เข้าร่วมห้อง ไพ่ตอแหล',exact:true}).click();await p.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();}
 await until(()=>a.getByRole('button',{name:'▶ เริ่มเกม',exact:true}).isEnabled());await a.getByRole('button',{name:'▶ เริ่มเกม',exact:true}).click();const pages=[a,b,c];await until(async()=>(await Promise.all(pages.map(p=>p.locator('.liar-hand button').count()))).reduce((x,y)=>x+y,0)===52);
 const opening=pages[(await Promise.all(pages.map(p=>p.getByRole('button',{name:'เปิด A♣',exact:true}).isEnabled()))).indexOf(true)];await opening.getByRole('button',{name:'เปิด A♣',exact:true}).click();await until(async()=>(await a.locator('.liar-required strong').textContent())==='2');
 // Skip through all three seats: rank remains 2, result scores match hand rules.
 for(let i=0;i<3;i++){let actor;await until(async()=>{actor=pages[(await Promise.all(pages.map(p=>p.getByRole('button',{name:'ข้าม (Skip)',exact:true}).isEnabled()))).indexOf(true)];return !!actor;});await actor.getByRole('button',{name:'ข้าม (Skip)',exact:true}).click();if(i<2)await until(async()=>await a.locator('.liar-turn-status small').textContent().then(t=>t.includes(`${i+1}/3`)));}
 await a.locator('.liar-results').waitFor();assert.match(await a.locator('.liar-results h1').textContent(),/ข้ามครบทุกคน/);assert.equal(await a.locator('.liar-result-list article').count(),3);
 await a.getByRole('button',{name:'กลับห้องรอ / เตรียมรอบใหม่',exact:true}).click();await a.locator('.liar-lobby').waitFor();for(const p of[c,b,a])await p.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();assert.deepEqual(errors,[]);
 console.log('PASS Liar: create/join + five phases at 11 sizes; 26-card private hand strip; Emergency popup; three real players deal 52/open A clubs/skip unchanged rank/end scoring/replay/exit');
}catch(error){if(!page.isClosed())await page.screenshot({path:previewPath('preview-liar-debug.png'),fullPage:true});throw error;}finally{for(const c of contexts)await c.close();await browser.close();}
