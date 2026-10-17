import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {previewPath} from './helpers/preview-path.mjs';

const url=process.env.GAME_URL||'http://127.0.0.1:5188';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async code=>{if(window.__rejectCopy)throw new Error('clipboard denied');window.__copiedCode=code;}}}));
const sizes=[[1366,768],[1024,768],[768,1024],[390,844],[375,667],[320,568],[320,480],[932,430],[844,390],[667,375],[568,320]];
const games=[['pok','/rooms/create','สร้างโต๊ะใหม่ →'],['poker','/poker/rooms/create','สร้างโต๊ะ Poker →'],['spyfall','/spyfall/rooms/create','สร้างห้อง Spyfall →'],['oldmaid','/oldmaid/rooms/create','สร้างห้อง Old Maid →'],['whoami','/whoami/rooms/create','สร้างห้อง Who am I →'],['liar','/liar/rooms/create','สร้างห้อง Liar’s Card →']];
try{
 for(const[game,route,create]of games){
  await page.setViewportSize({width:1366,height:768});await page.goto(url+route);await page.getByLabel('ชื่อของคุณ').fill('Copy Test');await page.getByRole('button',{name:create,exact:true}).click();await page.locator('.room-bar').waitFor();
  const button=page.getByRole('button',{name:'คัดลอกรหัส',exact:true}),label=button.locator('.copy-room-code-label');
  const code=await page.locator('.room-bar strong').textContent();assert.match(code,/^[A-F0-9]{10}$/);
  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});const mobile=width<=720||(width>height&&height<=500);
   assert.equal(await label.isVisible(),!mobile,`${game} label ${width}x${height}`);assert.equal(await button.locator('svg').isVisible(),true);
   assert.equal(await page.locator('.room-bar .brand-name').textContent(),'วงเซียน');assert.equal(await page.locator('.room-bar .brand-descriptor').textContent(),'MINI GAME CLUB');assert.equal(await page.locator('.room-bar .brand-mark').isVisible(),true);
   const bad=await page.locator('.room-bar .brand-logo,.room-bar .brand-name,.room-bar .brand-descriptor,.room-bar strong,.copy-room-code,.room-bar button').evaluateAll(es=>es.flatMap(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1)?[e.className]:[]}));assert.deepEqual(bad,[],`${game} header fits ${width}x${height}`);
   const overlaps=await page.locator('.room-bar').evaluate(bar=>{const boxes=[...bar.querySelectorAll('.brand-logo,strong,button')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);return boxes.some((a,i)=>boxes.slice(i+1).some(b=>Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1));});assert.equal(overlaps,false,`${game} no header overlap ${width}x${height}`);
   if(width===1366||width===375)await page.screenshot({path:previewPath(`preview-copy-${game}-${width}x${height}.png`)});
  }
  await button.click();assert.equal(await page.evaluate(()=>window.__copiedCode),code,'complete room code copied');await page.waitForFunction(()=>document.querySelector('.copy-room-code')?.title==='คัดลอกแล้ว');assert.equal(await button.locator('[role="status"]').textContent(),'คัดลอกรหัสแล้ว');
  await page.setViewportSize({width:1366,height:768});assert.equal(await label.textContent(),'คัดลอกแล้ว','success survives rotation');await page.waitForFunction(()=>document.querySelector('.copy-room-code')?.title==='คัดลอกรหัส');
  await page.evaluate(()=>window.__rejectCopy=true);await button.click();assert.equal(await label.textContent(),'คัดลอกรหัส','denied clipboard never reports success');await page.evaluate(()=>window.__rejectCopy=false);
  await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();await page.getByLabel('ชื่อของคุณ').waitFor();
 }
 assert.deepEqual(errors,[]);console.log('PASS: shared copy UI in six real rooms at 11 viewports, desktop text/mobile icons, complete clipboard values, success/reset/rotation, denied clipboard, no header clipping or overlap');
}finally{await browser.close();}
