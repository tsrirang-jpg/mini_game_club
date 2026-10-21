import { previewPath } from './helpers/preview-path.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {selectOption} from './select-option.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.GAME_URL||'http://127.0.0.1:5188';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=15000){const end=Date.now()+timeout;while(!await fn()){if(Date.now()>end)throw new Error('Dropdown/bot browser timeout');await sleep(70);}}
const combo=label=>page.getByRole('combobox',{name:label,exact:true});
async function fitsMenu(label){const r=await page.getByRole('listbox',{name:label,exact:true}).evaluate(e=>{const r=e.getBoundingClientRect();return{fits:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,overflow:e.scrollWidth>e.clientWidth+1};});assert.deepEqual(r,{fits:true,overflow:false});}
try{
 for(const[route,count,initial]of[['/rooms/create',10,0],['/poker/rooms/create',6,1],['/oldmaid/rooms/create',8,2]]){
  await page.goto(url+route);await page.getByLabel('ชื่อของคุณ').fill('Dropdown Test');
  assert.match(await combo('จำนวนบอท').textContent(),initial?new RegExp(`บอท ${initial} ตัว`):/ไม่เพิ่มบอท/);
  for(const[width,height]of[[320,480],[375,667],[568,320],[844,390],[1366,768]]){
   await page.setViewportSize({width,height});await combo('จำนวนบอท').tap();assert.equal(await page.getByRole('listbox').getByRole('option').count(),count);await fitsMenu('จำนวนบอท');
   await page.keyboard.press('End');await page.keyboard.press('Enter');assert.match(await combo('จำนวนบอท').textContent(),new RegExp(`บอท ${count-1} ตัว`));
   await combo('จำนวนบอท').click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('listbox').count(),0);
   await combo('จำนวนบอท').click();await page.locator('.entry h2').click();assert.equal(await page.getByRole('listbox').count(),0);
   await selectOption(page,'จำนวนบอท',initial);assert.ok(page.url().endsWith(route));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
 }
 await page.setViewportSize({width:375,height:667});await page.goto(url+'/rooms/create');await page.getByLabel('ชื่อของคุณ').fill('Dealer Select');await selectOption(page,'จำนวนบอท',9);assert.match(await combo('จำนวนบอท').textContent(),/รวม 10 คน/);await page.getByRole('button',{name:'สร้างห้อง ป๊อกเด้ง',exact:true}).click();await combo('เจ้ามือ').waitFor();
 await combo('เจ้ามือ').click();await fitsMenu('เจ้ามือ');const dealer=await page.getByRole('listbox').getByRole('option').last().textContent();await page.getByRole('listbox').getByRole('option').last().click();await until(async()=>(await combo('เจ้ามือ').textContent()).includes(dealer));

 assert.equal(await page.locator('.pok-game .seat').count(),10);
 assert.equal(await combo('เจ้ามือ').count(),1);
 await combo('เจ้ามือ').click();assert.equal(await page.getByRole('listbox').getByRole('option').count(),10);await page.keyboard.press('Escape');
 assert.match(await page.locator('.pok-clock').textContent(),/10\/10 คน/);
 await page.getByRole('button',{name:'จัดการโต๊ะป๊อกเด้ง',exact:true}).click();
 assert.equal(await page.locator('.bot-row').count(),9);assert.equal(await page.getByRole('button',{name:'เพิ่มบอท',exact:true}).isDisabled(),true);
 await page.locator('.bot-row button').last().click();await until(async()=>await page.locator('.bot-row').count()===8);
 await page.getByRole('button',{name:'เพิ่มบอท',exact:true}).click();await until(async()=>await page.locator('.bot-row').count()===9);
 await page.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();
 await selectOption(page,'เจ้ามือ','Dealer Select');
 await page.getByRole('button',{name:'เริ่มรอบ',exact:true}).click();
 await until(async()=>await page.evaluate(async()=>{const {session}=await import('/src/session.ts');return session.getSnapshot().snapshot.phase==='DEALER_ACTION'||session.getSnapshot().snapshot.phase==='ROUND_END';}));
 if(await page.getByRole('button',{name:'จั่วอีกใบ',exact:true}).count())await page.getByRole('button',{name:'จั่วอีกใบ',exact:true}).click();
 await page.getByRole('button',{name:'เตรียมรอบใหม่',exact:true}).waitFor();
 const final=await page.evaluate(async()=>{const {session}=await import('/src/session.ts');return session.getSnapshot().snapshot;});
 assert.equal(final.players.length,10);assert.equal(final.results.length,10);assert.equal(final.players.reduce((sum,p)=>sum+p.points,0),10000);
 await page.screenshot({path:previewPath('pok-ten-bots-round-375x667.png'),scale:'css'});
 await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();
 await page.goto(url+'/poker/rooms/create');await page.getByLabel('ชื่อของคุณ').fill('Card Select');await selectOption(page,'จำนวนบอท',1);await page.getByRole('button',{name:'สร้างห้อง Poker',exact:true}).click();await page.getByRole('button',{name:'จัดการโต๊ะ',exact:true}).click();
 await combo('ขนาดไพ่บนจอคอม').click();await fitsMenu('ขนาดไพ่บนจอคอม');assert.equal(await page.getByRole('listbox').evaluate(e=>!!e.closest('dialog')),true);
 await page.getByRole('option',{name:'ปกติ',exact:true}).tap();assert.match(await combo('ขนาดไพ่บนจอคอม').textContent(),/ปกติ/);
 await combo('ขนาดไพ่บนจอคอม').click();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog:modal').count(),1);assert.equal(await page.getByRole('listbox').count(),0);
 await page.keyboard.press('Escape');await page.reload();await page.getByRole('button',{name:'จัดการโต๊ะ',exact:true}).click();assert.match(await combo('ขนาดไพ่บนจอคอม').textContent(),/ปกติ/);await selectOption(page,'ขนาดไพ่บนจอคอม','high');await page.keyboard.press('Escape');await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();
 await page.goto(url+'/oldmaid/rooms/create');await page.getByLabel('ชื่อของคุณ').fill('Bot Host');assert.match(await combo('จำนวนบอท').textContent(),/บอท 2 ตัว/);await page.getByRole('button',{name:'สร้างห้อง อีแก่กินน้ำ',exact:true}).click();await page.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).waitFor();assert.equal(await page.locator('.oldmaid-seat').count(),2);assert.equal(await page.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'จัดการโต๊ะ Old Maid',exact:true}).click();assert.equal(await page.locator('.bot-row').count(),2);await page.getByRole('button',{name:'เพิ่มบอท',exact:true}).click();await until(async()=>await page.locator('.bot-row').count()===3);await page.locator('.bot-row button').last().click();await until(async()=>await page.locator('.bot-row').count()===2);await page.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();
 await page.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).click();await page.locator('.oldmaid-draw-card').first().waitFor();
 let draws=0;const finish=Date.now()+180000;
 while(!await page.locator('.oldmaid-result').count()&&Date.now()<finish){
  const confirm=page.getByRole('button',{name:'ยืนยันการจั่ว',exact:true});
  if(await confirm.count()&&await page.getByRole('button',{name:'เลือกไพ่ใบที่ 1',exact:true}).isEnabled()){await page.getByRole('button',{name:'เลือกไพ่ใบที่ 1',exact:true}).click();await confirm.click();draws++;}
  await sleep(100);
 }
 await page.locator('.oldmaid-result').waitFor();assert.ok(draws>0);assert.match(await page.locator('.oldmaid-discard').textContent(),/25 คู่/);await page.getByRole('button',{name:'เตรียมรอบใหม่',exact:true}).click();await page.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'จัดการโต๊ะ Old Maid',exact:true}).click();await page.locator('.bot-row button').last().click();await until(async()=>await page.locator('.bot-row').count()===1);await page.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();assert.equal(await page.getByRole('button',{name:'เริ่มเกม Old Maid',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'จัดการโต๊ะ Old Maid',exact:true}).click();for(let i=1;i<7;i++){await page.getByRole('button',{name:'เพิ่มบอท',exact:true}).click();await until(async()=>await page.locator('.bot-row').count()===i+1);}assert.equal(await page.getByRole('button',{name:'เพิ่มบอท',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();assert.equal(await page.locator('.oldmaid-seat').count(),7);
 await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();assert.deepEqual(errors,[]);
 console.log('PASS: shared popovers across 3 creation pages at 5 sizes, touch/keyboard/Escape/outside, ten-player Pok round and bot capacity/management, dealer/string choices, modal-safe card-size persistence, Old Maid 1 human + 2 bots full round and 7-bot capacity/management');
}catch(e){console.error('Browser errors:',errors);await page.screenshot({path:previewPath('preview-dropdown-bots-debug.png'),fullPage:true});throw e;}finally{await browser.close();}
