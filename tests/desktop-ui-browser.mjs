import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {checkPokerViewport} from './poker-viewport-check.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const sizes=[[1000,651],[1024,768],[1280,700],[1366,768],[1440,900],[1536,864],[1920,1080],[2560,1440]];
let round=100;
async function fixture(game,variant='play'){
 await page.goto('http://127.0.0.1:5188/games');await page.getByRole('heading',{name:'วันนี้เข้าวงไหน?'}).waitFor();
 await page.evaluate(async({game,variant,round})=>{
  const sessions=await import('/src/session.ts'),{navigate}=await import('/src/router.ts');
  const code='ABCDEF0123',card=(rank,suit='spades')=>({rank,suit}),own=[card(6),card(1,'diamonds')];
  const players=Array.from({length:game==='oldmaid'||game==='spyfall'?8:6},(_,seat)=>({id:'p'+seat,name:seat?'บอท '+seat:'ผู้เล่นชื่อยาวทดสอบ',seat,points:1000,bet:10,isBot:seat>0,connected:true,ready:true,acted:false,cardCount:2}));
  const state={status:'connected',playerId:'p0',handRound:round,hand:own,error:'',oldMaid:null,secret:null};
  let snapshot,session,path;
  if(game==='pok'){
   const phase=variant==='results'?'ROUND_END':variant==='lobby'?'LOBBY':'DEALER_ACTION';
   const cards=[card(4,'hearts'),card(2),card(1,'clubs')];
   players.forEach(p=>p.cardCount=phase==='LOBBY'?0:p.seat?3:2);
   snapshot={code,phase,roundId:round,deadline:Date.now()+30000,hostId:'p0',dealerId:'p0',players,settled:phase==='ROUND_END',results:phase==='ROUND_END'?players.map(p=>({id:p.id,cards,score:7,pok:false,multiplier:1,outcome:p.seat?'WIN':'DEALER',delta:p.seat?10:-50})):[],catches:[],rules:{actionMs:30000,dealMs:900,revealMs:1800,settlementMs:500,reconnectSeconds:60,initialPoints:1000,maxPlayers:6,bets:[10,20,50],pairMultiplier:2,suitedTwoMultiplier:2,suitedThreeMultiplier:3,yellowMultiplier:3,tripleMultiplier:5,straightMultiplier:3,straightFlushMultiplier:5}};
   session=sessions.session;path='/play/';
  }else if(game==='poker'){
   const results=variant==='results',many=variant==='pots'||results;
   players.forEach(p=>Object.assign(p,{folded:false,allIn:false,inHand:true,streetBet:0,contribution:20,lastAction:'Call 20',reconnectUntil:0}));
   snapshot={game,code,roundId:round,phase:results?'ROUND_END':variant==='lobby'?'LOBBY':'RIVER',deadline:Date.now()+30000,turnDurationMs:30000,hostId:'p0',buttonId:'p3',smallBlindId:'p1',bigBlindId:'p2',smallBlind:10,bigBlind:20,currentBet:20,minRaise:20,turnId:results||variant==='lobby'?'':'p0',raiseAllowedIds:['p0'],roomClosing:false,closeAt:0,players,board:[card(13),card(10,'diamonds'),card(2,'diamonds'),card(8,'hearts'),card(8,'clubs')],pot:120,pots:Array.from({length:many?6:1},(_,i)=>({amount:i?20:120,winners:results?['p'+i]:[],eligible:players.slice(i).map(p=>p.id),refund:i===5})),results:results?players.map(p=>({id:p.id,cards:[card(p.seat+1,'clubs'),card(p.seat+7,'hearts')],handName:'Two pair',payout:20,delta:0})):[]};
   state.hand=[card(9,'diamonds'),card(10,'clubs')];session=sessions.pokerSession;path='/poker/play/';
  }else if(game==='spyfall'){
   const phase=variant==='results'?'RESULTS':variant==='lobby'?'LOBBY':'QUESTION';
   players.forEach((p,i)=>Object.assign(p,{name:i?'ผู้เล่น '+i:'Game',isBot:false,readyVote:i<2,hasVoted:false,score:i}));
   snapshot={game,code,roundId:round,phase,deadline:Date.now()+300000,phaseDurationMs:300000,votingDurationMs:60000,guessDurationMs:60000,hostId:'p0',questionMinutes:5,votingMinutes:1,guessMinutes:1,playerCount:8,players,chat:Array.from({length:12},(_,i)=>({id:String(i),playerId:'p'+i%8,name:i%8?'ผู้เล่น '+i%8:'Game',text:i%2?'ช่วงวันหยุดค่อนข้างเยอะ':'ที่นี่คนเยอะไหม? มักไปกันช่วงไหน',timestamp:Date.now(),roundId:round})),caughtSpyId:null,result:phase==='RESULTS'?{winner:'spy',reason:'correct_guess',spyId:'p0',location:'บางแสน',guess:'บางแสน',accusedId:'p0',votes:{p0:'p1',p1:'p0',p2:'p0'},tally:{p0:2,p1:1}}:null};
   state.secret={roundId:round,role:variant==='citizen'?{kind:'citizen',location:'บางแสน',occupation:'นักท่องเที่ยว',ownVote:null}:{kind:'spy',ownVote:null}};
   session=sessions.spySession;path='/spyfall/play/';
  }else{
   const paired=variant==='pair',phase=variant==='lobby'?'LOBBY':variant==='results'?'RESULTS':'PLAYING';
   const hand=Array.from({length:paired?12:13},(_,i)=>card(paired&&i>=6?i+2:i+1,i%2?'hearts':'spades'));
   const drawnCard=paired?card(7,'hearts'):hand.at(-1),pair=paired?[drawnCard,card(7)]:[];
   const event={id:20,kind:'draw',turnNumber:12,playerId:'p0',playerName:players[0].name,targetId:'p1',targetName:'บอท 1',pair};
   players.forEach(p=>Object.assign(p,{cardCount:phase==='LOBBY'?0:p.seat?13:hand.length,finished:false,wins:0}));
   snapshot={game,code,roundId:round,phase,hostId:'p0',turnId:'p0',targetId:'p1',turnNumber:15,deadline:Date.now()+30000,turnDurationMs:30000,discardedPairs:9,lastPair:pair,lastAction:{playerId:'p0',targetId:'p1',paired},history:[event],players,result:phase==='RESULTS'?{loserId:'p0',lastCard:card(7),removedCard:card(7,'diamonds'),winners:players.slice(1).map(p=>p.id)}:null};
   state.hand=phase==='LOBBY'?[]:hand;state.oldMaid={roundId:round,draws:phase==='PLAYING'?[{...event,drawnCard}]:[]};session=sessions.oldMaidSession;path='/oldmaid/play/';
  }
  session.update({...state,snapshot});navigate(path+code);
 },{game,variant,round:++round});
 await page.locator('.room-bar').waitFor();
}
async function fit(game,label){
 const report=await page.evaluate(game=>{
  const groups={pok:'.room-bar,.pok-game .seat,.pok-turn-stage,.pok-action-dock,.pok-action-dock button',poker:'.room-bar,.poker-seat,.poker-center,.poker-action-dock',spyfall:'.room-bar,.mission-banner,.secret-card,.spy-player,.spy-chat-compose,.mission-actions > button,.desktop-spy-answer',oldmaid:'.room-bar,.oldmaid-seat,.oldmaid-draw-area,.oldmaid-feedback,.oldmaid-self,.oldmaid-discard,.oldmaid-confirm'};
  const box=e=>e.getBoundingClientRect(),visible=e=>{const r=box(e);return r.width&&r.height;};
  const clipped=[...document.querySelectorAll(groups[game])].filter(visible).filter(e=>{const r=box(e);return r.left< -1||r.right>innerWidth+1||r.top< -1||r.bottom>innerHeight+1;}).map(e=>e.className);
  const ranks=[];for(const c of document.querySelectorAll('.card:not(.back)')){
   if(!visible(c))continue;const label=c.querySelector('span:not(.bottom)'),suit=label.querySelector('small'),r=document.createRange();r.selectNodeContents(label.firstChild);const a=r.getBoundingClientRect(),b=box(suit),d=box(c),hit=document.elementFromPoint((a.left+a.right)/2,(a.top+a.bottom)/2);
   if(!a.width||a.left<d.left-1||a.right>d.right+1||a.top<d.top-1||b.bottom>d.bottom+1||a.bottom>b.top+1||!label.contains(hit))ranks.push(c.getAttribute('aria-label'));
  }
  const intersect=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1;
  const selectors=game==='pok'?['.pok-opponents','.pok-turn-stage','.pok-self','.pok-action-dock']:game==='spyfall'?['.role-panel','.spy-chat-panel','.spy-player-panel','.mission-actions']:game==='oldmaid'?['.oldmaid-opponents','.oldmaid-draw-area','.oldmaid-feedback','.oldmaid-self','.oldmaid-discard']:[];
  const blocks=selectors.flatMap(s=>[...document.querySelectorAll(s)]).filter(visible),overlaps=[];
  for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++)if(intersect(box(blocks[i]),box(blocks[j])))overlaps.push([blocks[i].className,blocks[j].className]);
  const hidden=[];
  for(const selector of ['.spy-player-panel .spy-player','.oldmaid-self .card','.oldmaid-feedback .card','.oldmaid-draw-area .oldmaid-draw-card'])for(const e of document.querySelectorAll(selector)){
   if(!visible(e))continue;const parent=e.closest('.spy-player-panel,.oldmaid-self,.oldmaid-feedback,.oldmaid-draw-area'),r=box(e),p=box(parent);
   if(r.left<p.left-1||r.right>p.right+1||r.top<p.top-1||r.bottom>p.bottom+1)hidden.push(e.className);
  }
  return{clipped,ranks,overlaps,hidden,scroll:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1||scrollY!==0};
 },game);
 assert.deepEqual(report,{clipped:[],ranks:[],overlaps:[],hidden:[],scroll:false},label+' '+JSON.stringify(report));
 if(game==='poker')await checkPokerViewport(page,label);
}
try{
 for(const[game,variants]of[['pok',['play','lobby','results']],['poker',['play','pots','results','lobby']],['spyfall',['play','citizen','results','lobby']],['oldmaid',['pair','keep','lobby','results']]])for(const variant of variants){
  if(process.env.ONLY_GAME&&process.env.ONLY_GAME!==game)continue;
  await fixture(game,variant);
  if(game==='spyfall'&&['play','citizen'].includes(variant))await page.getByRole('button',{name:'เปิดบทบาทลับ',exact:true}).click();
  for(const[width,height]of sizes){await page.setViewportSize({width,height});await page.waitForTimeout(50);await fit(game,`${game}/${variant} ${width}x${height}`);if(width===1366)await page.screenshot({path:`preview-desktop-${game}-${variant}.png`});}
  if(game==='spyfall'&&variant==='play'){
   await page.setViewportSize({width:1366,height:768});await page.getByRole('button',{name:'ตอบสถานที่',exact:true}).click();await page.getByLabel('เฉลยสถานที่').fill('บางแสน');await fit(game,'Spy answer form');
   await page.setViewportSize({width:844,height:390});assert.equal(await page.getByLabel('เฉลยสถานที่').inputValue(),'บางแสน');assert.equal(await page.locator('#spy-guess-form').count(),1);
   await page.setViewportSize({width:1366,height:768});assert.equal(await page.getByLabel('เฉลยสถานที่').inputValue(),'บางแสน');assert.equal(await page.locator('#spy-guess-form').count(),1);
   await page.getByRole('button',{name:'ปิดช่องตอบ',exact:true}).click();assert.equal(await page.locator('#spy-guess-form').count(),0);await page.getByRole('button',{name:'ตอบสถานที่',exact:true}).click();assert.equal(await page.getByLabel('เฉลยสถานที่').inputValue(),'บางแสน');
  }
  if(game==='oldmaid'&&variant==='pair'){await page.getByRole('button',{name:'ดูประวัติ ›',exact:true}).click();await page.getByRole('dialog',{name:'ประวัติ Old Maid'}).waitFor();await page.keyboard.press('Escape');}
 }
 assert.deepEqual(errors,[]);console.log(`PASS: ${process.env.ONLY_GAME||'four desktop designs'} at 8 window sizes, active/lobby/results, rank/suit visibility, no clipped content or page scroll`);
}catch(e){console.error(errors);await page.screenshot({path:'preview-desktop-debug.png',fullPage:true});throw e;}finally{await browser.close();}
