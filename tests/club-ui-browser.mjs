import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.GAME_URL||'http://127.0.0.1:5188';
let fixtureRound=10;
const sizes=[[320,480],[375,667],[390,844],[568,320],[844,390],[1366,768]];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function fit(label,selectors){const report=await page.evaluate(selectors=>{const bad=[...document.querySelectorAll(selectors)].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left< -1||r.top< -1||r.right>innerWidth+1||r.bottom>innerHeight+1);}).map(e=>e.className);return{bad,pageScroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1};},selectors);assert.deepEqual(report,{bad:[],pageScroll:false},label+' '+JSON.stringify(report));}
try{
 await page.goto(url+'/games');await page.getByRole('heading',{name:'วันนี้เข้าวงไหน?'}).waitFor();assert.equal(await page.locator('.game-option').count(),4);
 const colors=await page.locator('.game-option').evaluateAll(es=>es.map(e=>getComputedStyle(e).getPropertyValue('--club-bg').trim()));assert.equal(new Set(colors).size,4);
 assert.equal(await page.locator('.game-option.theme-oldmaid').evaluate(e=>getComputedStyle(e).boxShadow.includes('230, 196, 126')),false);
 for(const[route,kind]of[['/rooms/create','pok'],['/poker/rooms/create','poker'],['/spyfall/rooms/create','spyfall'],['/oldmaid/rooms/create','oldmaid']]){
  await page.goto(url+route);await page.getByLabel('ชื่อของคุณ').waitFor();assert.equal(await page.locator('.club-shell').evaluate((e,kind)=>e.classList.contains('theme-'+kind),kind),true);
  await page.getByLabel('ชื่อของคุณ').fill('Game');await page.screenshot({path:`preview-club-${kind}-create.png`,fullPage:true});
 }
 if(!process.env.GAME_URL){
  for(const count of [3,8])for(const cards of [5,13]){
   await page.evaluate(async({count,cards,roundId})=>{const{oldMaidSession}=await import('/src/session.ts');const{navigate}=await import('/src/router.ts');oldMaidSession.update({status:'connected',playerId:'p0',handRound:roundId,hand:Array.from({length:cards},(_,i)=>({rank:i+1,suit:i%2?'hearts':'spades'})),error:'',snapshot:{game:'oldmaid',code:'ABCDEF0123',roundId,phase:'PLAYING',hostId:'p0',turnId:'p0',targetId:'p1',turnNumber:1,deadline:Date.now()+30000,turnDurationMs:30000,discardedPairs:8,lastPair:[],lastAction:null,result:null,players:Array.from({length:count},(_,i)=>({id:'p'+i,name:i===0?'Game':'ผู้เล่น '+i,seat:i,connected:true,ready:false,cardCount:cards,finished:false,wins:0}))}});navigate('/oldmaid/play/ABCDEF0123');},{count,cards,roundId:++fixtureRound});
   await page.locator('.oldmaid-draw-card').last().waitFor();
   for(const[width,height]of sizes){await page.setViewportSize({width,height});await fit(`Old Maid ${count} players/${cards} cards ${width}x${height}`,'.oldmaid-seat,.oldmaid-self,.oldmaid-self .card,.oldmaid-draw-card,.oldmaid-confirm,.oldmaid-sort,.room-bar');if(count===8&&cards===5)await page.screenshot({path:`preview-club-oldmaid-play-${width}x${height}.png`});}
   assert.equal(await page.locator('.oldmaid-draw-card .card:not(.back)').count(),0);
   assert.equal(await page.getByRole('button',{name:'ยืนยันการจั่ว',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'เลือกไพ่ใบที่ 2',exact:true}).click();assert.equal(await page.locator('.oldmaid-draw-card.chosen').count(),1);assert.equal(await page.getByRole('button',{name:'ยืนยันการจั่ว',exact:true}).isEnabled(),true);
  }
  for(const phase of ['QUESTION','VOTING','GUESS','RESULTS']){
   await page.evaluate(async phase=>{const{spySession}=await import('/src/session.ts');const{navigate}=await import('/src/router.ts');const players=Array.from({length:8},(_,seat)=>({id:'p'+seat,name:seat?'ผู้เล่น '+seat:'Game',seat,connected:true,ready:false,readyVote:seat>4,hasVoted:false,score:0}));spySession.update({status:'connected',playerId:'p0',error:'',snapshot:{game:'spyfall',code:'ABCDEF0123',roundId:3,phase,deadline:phase==='RESULTS'?0:Date.now()+60000,hostId:'p0',questionMinutes:5,votingMinutes:1,guessMinutes:1,playerCount:8,phaseDurationMs:60000,votingDurationMs:60000,guessDurationMs:60000,players,chat:[{id:'1',playerId:'p1',name:'มะลิ',text:'ที่นี่คนเยอะไหม?',timestamp:Date.now(),roundId:3}],caughtSpyId:phase==='GUESS'?'p0':null,result:phase==='RESULTS'?{winner:'spy',reason:'correct_guess',spyId:'p0',location:'บางแสน',guess:'บางแสน',accusedId:'p0',votes:{p0:'p1',p1:'p0',p2:'p0',p3:'p0'},tally:{p0:3,p1:1}}:null},secret:{roundId:3,role:phase==='GUESS'?{kind:'spy',ownVote:null}:{kind:'citizen',location:'บางแสน',occupation:'นักท่องเที่ยว',ownVote:null}}});navigate('/spyfall/play/ABCDEF0123');},phase);
   if(phase==='QUESTION')await page.getByRole('button',{name:'เปิดบทบาทลับ',exact:true}).click();
   for(const[width,height]of sizes){await page.setViewportSize({width,height});await pause(40);if(phase==='QUESTION'||phase==='RESULTS')await fit(`Spyfall ${phase} ${width}x${height}`,'.room-bar,.mission-banner,.spy-player,.secret-card,.spy-chat-compose,.mission-actions > button,.mission-result');if([375,844,1366].includes(width))await page.screenshot({path:`preview-club-spyfall-${phase}-${width}x${height}.png`});}
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS: four game themes/menu/create screens, Old Maid 3/8 players with 5/13 cards, turn selection and Spyfall gameplay/results at six viewports');
}catch(e){await page.screenshot({path:'preview-club-ui-debug.png',fullPage:true});throw e;}finally{await browser.close();}
