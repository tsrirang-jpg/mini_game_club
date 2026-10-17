import { previewPath } from './helpers/preview-path.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const sizes=[[320,480],[375,667],[390,844],[568,320],[667,375],[844,390],[1366,768]];
try{
 await page.goto('http://127.0.0.1:5188/games');await page.getByRole('heading',{name:'วันนี้เข้าวงไหน?'}).waitFor();
 for(const count of[3,8])for(const total of[5,13])for(const paired of[true,false]){
  await page.evaluate(async({count,total,paired})=>{
   const{oldMaidSession}=await import('/src/session.ts'),{navigate}=await import('/src/router.ts');
   const cards=Array.from({length:paired&&total===13?12:total},(_,i)=>({rank:paired&&i>=6?i+2:i+1,suit:i%2?'hearts':'spades'}));
   const drawnCard=paired?{rank:7,suit:'hearts'}:cards.at(-1),pair=paired?[drawnCard,{rank:7,suit:'spades'}]:[];
   const event={id:20,kind:'draw',turnNumber:12,playerId:'p0',playerName:'Game',targetId:'p1',targetName:'บอท 1',pair};
   const dealt={id:1,kind:'deal',turnNumber:0,playerId:'p2',playerName:'บอท 2',pair:[{rank:10,suit:'hearts'},{rank:10,suit:'clubs'}]};
   oldMaidSession.update({status:'connected',playerId:'p0',handRound:1,hand:cards,error:'',oldMaid:{roundId:1,draws:[{...event,drawnCard}]},snapshot:{game:'oldmaid',code:'ABCDEF0123',roundId:1,phase:'PLAYING',hostId:'p0',turnId:'p0',targetId:'p1',turnNumber:15,deadline:Date.now()+30000,turnDurationMs:30000,discardedPairs:9,lastPair:pair,lastAction:{playerId:'p0',targetId:'p1',paired},history:[dealt,event],result:null,players:Array.from({length:count},(_,i)=>({id:'p'+i,name:i?'บอท '+i:'Game',seat:i,connected:true,ready:false,isBot:!!i,cardCount:i?total:cards.length,finished:false,wins:0}))}});
   navigate('/oldmaid/play/ABCDEF0123');
  },{count,total,paired});
  await page.locator('.oldmaid-feedback').waitFor();assert.equal(await page.locator('.oldmaid-pair-cards .card').count(),paired?2:0);assert.equal(await page.locator('.oldmaid-new-badge').count(),paired?0:1);
  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});await page.waitForTimeout(40);
   const report=await page.evaluate(()=>{
    const selectors='.oldmaid-seat,.oldmaid-self,.oldmaid-self .card,.oldmaid-draw-card,.oldmaid-confirm,.room-bar,.oldmaid-feedback,.oldmaid-feedback .card,.oldmaid-history-button';
    const bad=[...document.querySelectorAll(selectors)].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left< -1||r.top< -1||r.right>innerWidth+1||r.bottom>innerHeight+1);}).map(e=>({c:e.className,r:e.getBoundingClientRect().toJSON()}));
    const feedback=document.querySelector('.oldmaid-feedback').getBoundingClientRect(),self=document.querySelector('.oldmaid-self').getBoundingClientRect(),draw=document.querySelector('.oldmaid-draw-area').getBoundingClientRect();
    const overlaps=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
    const clippedRanks=[...document.querySelectorAll('.oldmaid-self .card > span:not(.bottom),.oldmaid-feedback .card > span:not(.bottom)')].filter(e=>{const r=e.getBoundingClientRect(),c=e.closest('.card').getBoundingClientRect();return r.width&&r.height&&(r.left<c.left-1||r.right>c.right+1||r.top<c.top-1||r.bottom>c.bottom+1);}).map(e=>e.textContent);
    return{bad,clippedRanks,scroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,overlap:overlaps(feedback,self)||overlaps(feedback,draw)};
   });
   assert.deepEqual(report,{bad:[],clippedRanks:[],scroll:false,overlap:false},`${count} players ${total} cards paired=${paired} ${width}x${height}: ${JSON.stringify(report)}`);
   if(count===3&&total===5&&[390,844].includes(width))await page.screenshot({path:previewPath(`preview-oldmaid-feedback-${paired?'pair':'keep'}-${width}x${height}.png`)});
  }
  await page.getByRole('button',{name:'ดูประวัติ ›',exact:true}).click();await page.getByRole('dialog',{name:'ประวัติ Old Maid'}).waitFor();assert.equal(await page.locator('.oldmaid-history li').count(),2);assert.match(await page.locator('.oldmaid-history').textContent(),/จั่วได้/);await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);console.log('PASS: Old Maid private draw/pair feedback, new-card badges and history at 7 portrait/landscape/desktop sizes, 3/8 players and 5/13 cards');
}catch(e){await page.screenshot({path:previewPath('preview-oldmaid-feedback-debug.png'),fullPage:true});console.error(await page.locator('.oldmaid-feedback,.oldmaid-feedback header,.oldmaid-drawn,.oldmaid-drawn h2,.oldmaid-drawn p,.oldmaid-self,.oldmaid-hand .card,.oldmaid-hand .card > span:not(.bottom),.oldmaid-draw-area,.oldmaid-table').evaluateAll(es=>es.map(e=>({c:e.className,text:e.textContent,r:e.getBoundingClientRect().toJSON(),rows:getComputedStyle(e).gridTemplateRows,font:getComputedStyle(e).fontSize,display:getComputedStyle(e).display,position:getComputedStyle(e).position}))));throw e;}finally{await browser.close();}
