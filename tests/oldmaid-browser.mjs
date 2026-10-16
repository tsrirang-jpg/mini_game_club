import {selectOption} from './select-option.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const viewports=process.env.DESKTOP_UI? [{width:1366,height:768},{width:1280,height:700},{width:1000,height:651}]:[{width:390,height:844},{width:375,height:667},{width:844,height:390}];
const contexts=await Promise.all(viewports.map(viewport=>browser.newContext({viewport,hasTouch:!process.env.DESKTOP_UI,isMobile:!process.env.DESKTOP_UI,reducedMotion:'reduce'})));
const pages=await Promise.all(contexts.map(c=>c.newPage()));const[a,b,c]=pages,errors=[];for(const p of pages)p.on('pageerror',e=>errors.push(e.message));
const url=process.env.GAME_URL||'http://127.0.0.1:5188';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){const end=Date.now()+15000;while(!await fn()){if(Date.now()>end)throw new Error('Old Maid browser timeout');await sleep(50);}}
try{
 await a.goto(url+'/oldmaid/rooms/create');await a.getByLabel('ชื่อของคุณ').fill('Game');await selectOption(a,'จำนวนบอท',0);await a.getByRole('button',{name:'สร้างห้อง Old Maid →',exact:true}).click();await a.locator('.room-bar strong').waitFor();const code=await a.locator('.room-bar strong').textContent();
 assert.equal(await a.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).isDisabled(),true);
 for(const[p,name]of[[b,'มะลิ'],[c,'ใบชา']]){await p.goto(url+'/oldmaid/rooms/join?code='+code);await p.getByLabel('ชื่อของคุณ').fill(name);await p.getByRole('button',{name:'เข้าร่วมวง Old Maid →',exact:true}).click();await p.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();}
 await until(()=>a.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).isEnabled());await a.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).click();for(const p of pages)await p.locator('.oldmaid-draw-card').first().waitFor();
 for(const p of pages){assert.equal(await p.locator('.oldmaid-opponents .card:not(.back)').count(),0);assert.equal(await p.locator('.oldmaid-draw-card .card:not(.back)').count(),0);assert.equal(await p.locator('.club-own-pill').textContent(),'คุณ');}
 const hand=await b.locator('.oldmaid-hand .card').evaluateAll(cs=>cs.map(e=>e.getAttribute('aria-label')));await b.reload();await b.locator('.oldmaid-hand .card').first().waitFor();assert.deepEqual(await b.locator('.oldmaid-hand .card').evaluateAll(cs=>cs.map(e=>e.getAttribute('aria-label'))),hand);
 let n=0,feedbackChecked=0;
 while(await a.locator('.oldmaid-result').count()===0&&n++<250){
  const turns=await Promise.all(pages.map(p=>p.locator('.oldmaid-confirm').textContent().catch(()=>'')));const i=turns.findIndex(s=>s==='ยืนยันการจั่ว');
  if(i<0){await sleep(50);continue;}const p=pages[i],targetName=await p.locator('.oldmaid-seat.target strong').textContent();
  const names=await Promise.all(pages.map(p=>p.locator('.oldmaid-self-name > strong').textContent()));const target=pages[names.indexOf(targetName)];
  const own=await p.locator('.oldmaid-hand .card').evaluateAll(cs=>cs.map(e=>e.getAttribute('aria-label').split(' ')[0]));
  const faces=await target.locator('.oldmaid-hand .card').evaluateAll(cs=>cs.map(e=>e.getAttribute('aria-label')));const targetCards=faces.map(s=>s.split(' ')[0]);let index=targetCards.findIndex(r=>own.includes(r)===(n%2===0));if(index<0)index=0;
  const face=faces[index],matched=own.includes(targetCards[index]);const previous=await p.locator('.oldmaid-feedback').count()?await p.locator('.oldmaid-feedback').getAttribute('data-draw-id'):null;
  await p.getByRole('button',{name:`เลือกไพ่ใบที่ ${index+1}`,exact:true}).click();await p.getByRole('button',{name:'ยืนยันการจั่ว',exact:true}).click();await sleep(80);
  if(!await p.locator('.oldmaid-result').count()){
   await until(async()=>(await p.locator('.oldmaid-feedback').getAttribute('data-draw-id'))!==previous);
   assert.equal(await p.locator('.oldmaid-drawn .card').getAttribute('aria-label'),face);
   assert.equal(await p.locator('.oldmaid-pair-cards .card').count(),matched?2:0);assert.equal(await p.locator('.oldmaid-new-badge').count(),matched?0:1);
   await p.getByRole('button',{name:'ดูประวัติ ›',exact:true}).click();await p.getByRole('dialog',{name:'ประวัติ Old Maid'}).waitFor();assert.ok(await p.locator('.oldmaid-history li').count()>0);await p.keyboard.press('Escape');
   if(feedbackChecked++===0){await p.reload();await p.locator('.oldmaid-feedback').waitFor();assert.equal(await p.locator('.oldmaid-drawn .card').getAttribute('aria-label'),face);}
  }
 }
 for(const p of pages){await p.locator('.oldmaid-result').waitFor();assert.equal(await p.locator('.oldmaid-final-cards .card').count(),2);assert.equal(await p.locator('.oldmaid-final-cards .card').first().getAttribute('aria-label').then(s=>s.split(' ')[0]),await p.locator('.oldmaid-final-cards .card').last().getAttribute('aria-label').then(s=>s.split(' ')[0]));}
 assert.ok(n<250);await a.screenshot({path:'preview-club-oldmaid-real-result.png'});
 assert.ok(feedbackChecked>0);await a.getByRole('button',{name:'ดูประวัติ ›',exact:true}).click();assert.ok(await a.locator('.oldmaid-history-cards .card').count()>0);await a.keyboard.press('Escape');
 await a.getByRole('button',{name:'เตรียมรอบใหม่',exact:true}).click();await a.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).waitFor();assert.equal(await a.locator('.oldmaid-self .card').count(),0);assert.equal(await a.locator('.oldmaid-feedback').count(),0);assert.equal(await a.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).isDisabled(),true);
 await a.getByRole('button',{name:'กติกา',exact:true}).click();await a.getByRole('dialog',{name:'กติกา Old Maid'}).waitFor();await a.keyboard.press('Escape');assert.equal(await a.getByRole('dialog').count(),0);
 for(const p of [...pages].reverse())await p.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();assert.deepEqual(errors,[]);console.log('PASS: Old Maid 3 browser players, private drawn-card feedback, exact discarded pairs/new badges, history/refresh, full round, next-round reset, rules/exit');
}catch(e){console.error('Old Maid browser errors:',errors);await a.screenshot({path:'preview-oldmaid-real-debug.png',fullPage:true});console.error(await a.locator('.error,.notice').allTextContents());throw e;}finally{await browser.close();}
