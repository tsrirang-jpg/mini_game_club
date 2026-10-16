import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const contexts=await Promise.all([{width:390,height:844},{width:375,height:667},{width:844,height:390}].map(viewport=>browser.newContext({viewport,hasTouch:true,isMobile:true,reducedMotion:'reduce'})));
const pages=await Promise.all(contexts.map(c=>c.newPage()));const[a,b,c]=pages,errors=[];for(const p of pages)p.on('pageerror',e=>errors.push(e.message));
const url=process.env.GAME_URL||'http://127.0.0.1:5188';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){const end=Date.now()+15000;while(!await fn()){if(Date.now()>end)throw new Error('Old Maid browser timeout');await sleep(50);}}
try{
 await a.goto(url+'/oldmaid/rooms/create');await a.getByLabel('ชื่อของคุณ').fill('Game');await a.getByRole('button',{name:'สร้างห้อง Old Maid →',exact:true}).click();await a.locator('.room-bar strong').waitFor();const code=await a.locator('.room-bar strong').textContent();
 assert.equal(await a.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).isDisabled(),true);
 for(const[p,name]of[[b,'มะลิ'],[c,'ใบชา']]){await p.goto(url+'/oldmaid/rooms/join?code='+code);await p.getByLabel('ชื่อของคุณ').fill(name);await p.getByRole('button',{name:'เข้าร่วมวง Old Maid →',exact:true}).click();await p.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();}
 await until(()=>a.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).isEnabled());await a.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).click();for(const p of pages)await p.locator('.oldmaid-draw-card').first().waitFor();
 for(const p of pages){assert.equal(await p.locator('.oldmaid-opponents .card:not(.back)').count(),0);assert.equal(await p.locator('.oldmaid-draw-card .card:not(.back)').count(),0);assert.equal(await p.locator('.club-own-pill').textContent(),'คุณ');}
 const hand=await b.locator('.oldmaid-hand .card').evaluateAll(cs=>cs.map(e=>e.getAttribute('aria-label')));await b.reload();await b.locator('.oldmaid-hand .card').first().waitFor();assert.deepEqual(await b.locator('.oldmaid-hand .card').evaluateAll(cs=>cs.map(e=>e.getAttribute('aria-label'))),hand);
 let n=0;
 while(await a.locator('.oldmaid-result').count()===0&&n++<250){
  const turns=await Promise.all(pages.map(p=>p.locator('.oldmaid-confirm').textContent().catch(()=>'')));const i=turns.findIndex(s=>s==='ยืนยันการจั่ว');
  if(i<0){await sleep(50);continue;}const p=pages[i],targetName=await p.locator('.oldmaid-seat.target strong').textContent();
  const names=await Promise.all(pages.map(p=>p.locator('.oldmaid-self-name > strong').textContent()));const target=pages[names.indexOf(targetName)];
  const own=await p.locator('.oldmaid-hand .card').evaluateAll(cs=>cs.map(e=>e.getAttribute('aria-label').split(' ')[0]));
  const targetCards=await target.locator('.oldmaid-hand .card').evaluateAll(cs=>cs.map(e=>e.getAttribute('aria-label').split(' ')[0]));let index=targetCards.findIndex(r=>own.includes(r));if(index<0)index=0;
  await p.getByRole('button',{name:`เลือกไพ่ใบที่ ${index+1}`,exact:true}).click();await p.getByRole('button',{name:'ยืนยันการจั่ว',exact:true}).click();await sleep(80);
 }
 for(const p of pages){await p.locator('.oldmaid-result').waitFor();assert.equal(await p.locator('.oldmaid-final-cards .card').count(),2);assert.equal(await p.locator('.oldmaid-final-cards .card').first().getAttribute('aria-label').then(s=>s.split(' ')[0]),await p.locator('.oldmaid-final-cards .card').last().getAttribute('aria-label').then(s=>s.split(' ')[0]));}
 assert.ok(n<250);await a.screenshot({path:'preview-club-oldmaid-real-result.png'});
 await a.getByRole('button',{name:'เตรียมรอบใหม่',exact:true}).click();await a.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).waitFor();assert.equal(await a.locator('.oldmaid-self .card').count(),0);assert.equal(await a.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).isDisabled(),true);
 await a.getByRole('button',{name:'กติกา',exact:true}).click();await a.getByRole('dialog',{name:'กติกา Old Maid'}).waitFor();await a.keyboard.press('Escape');assert.equal(await a.getByRole('dialog').count(),0);
 for(const p of [...pages].reverse())await p.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();assert.deepEqual(errors,[]);console.log('PASS: Old Maid 3 browser players, ready/start, secret hands, one-card selection/confirmation, refresh, full round/random removed-card reveal, next round, rules/exit');
}catch(e){console.error('Old Maid browser errors:',errors);throw e;}finally{await browser.close();}
