import { previewPath } from './helpers/preview-path.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'msedge',headless:true});
const contexts=await Promise.all([{width:1366,height:1000},{width:375,height:667},{width:844,height:390}].map(viewport=>browser.newContext({viewport})));
const pages=await Promise.all(contexts.map(context=>context.newPage()));const[a,b,c]=pages;
const url=process.env.GAME_URL||'http://127.0.0.1:5188';const errors=[];
for(const page of pages)page.on('pageerror',error=>errors.push(error.message));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){const end=Date.now()+15000;while(!await fn()){if(Date.now()>end)throw new Error('Settings browser timeout');await pause(100);}}
const combo=(page,label)=>page.getByRole('combobox',{name:label,exact:true});
async function select(page,label,value){await combo(page,label).click();await page.getByRole('option',{name:value,exact:true}).click();}

try{
  await a.goto(url);await a.getByRole('button',{name:/เลือก Spyfall/}).click();
  await a.getByLabel('ชื่อของคุณ').fill('Settings A');
  const expected={'เวลาถามตอบ':['5 นาที','7 นาที','10 นาที'],'โหวต':['1 นาที','2 นาที','3 นาที'],'สายลับตอบ':['1 นาที','2 นาที','3 นาที']};
  for(const[label,options]of Object.entries(expected))assert.match(await combo(a,label).textContent(),new RegExp(options[0]));
  await a.screenshot({path:previewPath('preview-spyfall-settings-default.png'),fullPage:true});
  for(const[width,height]of[[320,480],[375,667],[568,320],[844,390],[1366,1000]]){
    await a.setViewportSize({width,height});
    for(const[label,options]of Object.entries(expected)){
      await combo(a,label).click();const menu=a.getByRole('listbox',{name:label,exact:true});await menu.waitFor();
      assert.deepEqual(await menu.getByRole('option').allTextContents(),options);
      const report=await menu.evaluate(e=>{const r=e.getBoundingClientRect();return{outside:r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1,overflow:e.scrollWidth>e.clientWidth+1};});
      assert.deepEqual(report,{outside:false,overflow:false},`${label} ${width}x${height}`);
      await menu.getByRole('option').last().scrollIntoViewIfNeeded();
      if(width===375)await a.screenshot({path:previewPath(`preview-spyfall-settings-${Object.keys(expected).indexOf(label)}.png`)});
      await a.keyboard.press('Escape');assert.equal(await a.getByRole('listbox').count(),0);
      assert.match(await combo(a,label).textContent(),new RegExp(options[0]));
    }
    assert.equal(await combo(a,'ผู้เล่น').count(),0);
    assert.match(await a.locator('.spy-player-summary').textContent(),/ผู้เล่น3–8 คน/);
    assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await combo(a,'เวลาถามตอบ').focus();await a.keyboard.press('ArrowDown');await a.keyboard.press('ArrowDown');await a.keyboard.press('Enter');
  assert.match(await combo(a,'เวลาถามตอบ').textContent(),/7 นาที/);
  await select(a,'โหวต','2 นาที');await select(a,'สายลับตอบ','3 นาที');
  assert.equal(await combo(a,'ผู้เล่น').count(),0);
  assert.match(await a.locator('.spy-player-summary').textContent(),/ผู้เล่น3–8 คน/);
  await combo(a,'โหวต').click();assert.equal(await a.getByRole('option',{name:'2 นาที',exact:true}).getAttribute('aria-selected'),'true');
  await a.locator('.entry h2').click();assert.equal(await a.getByRole('listbox').count(),0);
  await combo(a,'โหวต').focus();await a.keyboard.press('ArrowDown');await a.keyboard.press('Tab');assert.equal(await a.getByRole('listbox').count(),0);
  await a.getByRole('button',{name:'สร้างห้อง Spyfall',exact:true}).click();await a.locator('.room-bar strong').waitFor();
  const code=await a.locator('.room-bar strong').textContent();
  for(const[page,name]of[[b,'Settings B'],[c,'Settings C']]){
    await page.goto(url);await page.getByRole('button',{name:/เลือก Spyfall/}).click();await page.getByRole('button',{name:'เข้าห้องเพื่อน',exact:true}).click();
    await page.getByLabel('ชื่อของคุณ').fill(name);await page.getByLabel('รหัสห้อง').fill(code);await page.getByRole('button',{name:'เข้าร่วมห้อง Spyfall',exact:true}).click();await page.locator('.room-bar strong').waitFor();
  }
  await until(async()=>await a.locator('.spy-player').count()===3);
  for(const page of pages){assert.match(await page.locator('.spy-settings-readonly').textContent(),/ถาม 7 นาที · โหวต 2 นาที/);assert.match(await page.locator('.spy-settings-readonly').textContent(),/ตอบ 3 นาที · สูงสุด 8 คน/);}
  assert.equal(await b.getByRole('combobox').count(),0);
  assert.equal(await combo(a,'ผู้เล่น').count(),0);
  assert.match(await a.locator('.spy-player-summary').textContent(),/ผู้เล่น3–8 คน/);
  await b.reload();await b.getByRole('button',{name:'พร้อมเล่น',exact:true}).waitFor();
  await b.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();await c.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();
  await until(()=>a.getByRole('button',{name:'เริ่มภารกิจ',exact:true}).isEnabled());
  await select(a,'โหวต','1 นาที');await b.getByRole('button',{name:'พร้อมเล่น',exact:true}).waitFor();await c.getByRole('button',{name:'พร้อมเล่น',exact:true}).waitFor();
  assert.equal(await a.getByRole('button',{name:'เริ่มภารกิจ',exact:true}).isDisabled(),true);
  await select(a,'โหวต','2 นาที');
  await b.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();await c.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();
  await until(()=>a.getByRole('button',{name:'เริ่มภารกิจ',exact:true}).isEnabled());await a.getByRole('button',{name:'เริ่มภารกิจ',exact:true}).click();
  for(const page of pages){await page.getByRole('button',{name:'เปิดบทบาทลับ',exact:true}).click();}
  assert.match(await a.locator('.mission-clock strong').textContent(),/^(07:00|06:\d\d)$/);
  const spyIndex=(await Promise.all(pages.map(page=>page.locator('.secret-card.revealed.spy').count()))).findIndex(count=>count===1);
  assert.notEqual(spyIndex,-1);const spy=pages[spyIndex],names=['Settings A','Settings B','Settings C'];
  const location=await pages.find((_,i)=>i!==spyIndex).locator('.secret-location').textContent();
  for(const page of pages)await page.getByRole('button',{name:'พร้อมโหวต',exact:true}).click();
  for(const page of pages){await page.getByRole('dialog',{name:'ใครคือ Spy?'}).waitFor();const seconds=Number(await page.locator('.spy-voting-clock strong').textContent());assert.ok(seconds>100&&seconds<=120);}
  for(let i=0;i<pages.length;i++){
    const target=i===spyIndex?names.find(name=>name!==names[i]):names[spyIndex];
    await pages[i].getByRole('button',{name:`สงสัย ${target}`,exact:true}).click();await pages[i].getByRole('button',{name:'ยืนยันโหวต',exact:true}).click();
  }
  await spy.getByRole('dialog',{name:'Spy ตอบสถานที่',exact:true}).waitFor();
  const answerSeconds=Number(await spy.locator('.spy-guess-footer .spy-voting-clock strong').textContent());assert.ok(answerSeconds>160&&answerSeconds<=180);
  await spy.getByLabel('เฉลยสถานที่').fill(location);await spy.getByRole('button',{name:'ยืนยันคำตอบ',exact:true}).click();
  for(const page of pages){await page.locator('.mission-result').waitFor();assert.match(await page.locator('.mission-result h2').textContent(),/สายลับชนะ/);}
  await a.getByRole('button',{name:'เตรียมภารกิจใหม่',exact:true}).click();await combo(a,'โหวต').waitFor();
  assert.match(await combo(a,'โหวต').textContent(),/2 นาที/);assert.match(await combo(a,'สายลับตอบ').textContent(),/3 นาที/);
  assert.deepEqual(errors,[]);
  for(const page of [...pages].reverse())await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();
  console.log('PASS: custom dropdown defaults/options, keyboard/outside dismissal, five viewport sizes, room settings sync/reload, readiness reset, 3/8-player start and real 7/2/3-minute timers');
}catch(error){console.error('Settings page errors:',errors);throw error;}finally{await browser.close();}
