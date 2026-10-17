import { previewPath } from './helpers/preview-path.mjs';
import { selectOption } from './select-option.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { checkPokerViewport } from './poker-viewport-check.mjs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const contexts = await Promise.all([0,1].map(() => browser.newContext({ viewport: { width: 360, height: 640 } })));
const [a,b] = await Promise.all(contexts.map(c => c.newPage()));
const errors = []; for (const p of [a,b]) p.on('pageerror', e => errors.push(e.message));
const url = process.env.GAME_URL || 'http://127.0.0.1:5188';
const pause = ms => new Promise(r => setTimeout(r, ms));
async function wait(fn) { const end=Date.now()+15000; while(!await fn()) { if(Date.now()>end)throw new Error('Show cards timeout'); await pause(80); } }
async function readable(page) {
  const failures = await page.evaluate(() => {
    const failures=[];
    for(const card of document.querySelectorAll('.poker-seat .card:not(.back)')) {
      const label=card.querySelector('span:not(.bottom)');
      const range=document.createRange(); range.selectNodeContents(label.firstChild);
      const r=range.getBoundingClientRect(), c=card.getBoundingClientRect();
      const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
      if(r.width===0||r.height===0||r.left<c.left||r.right>c.right||r.top<c.top||r.bottom>c.bottom||!label.contains(hit)) failures.push(card.getAttribute('aria-label'));
    }
    return failures;
  });
  assert.deepEqual(failures, [], 'Card ranks must fit and remain unobscured');
}
try {
  await a.goto(url+'/poker/rooms/create');
  await a.getByLabel('ชื่อของคุณ').fill('Host');
  await selectOption(a,'จำนวนบอท','0');
  await a.getByRole('button',{name:'สร้างโต๊ะ Poker →',exact:true}).click();
  await a.locator('.room-bar strong').waitFor();
  const code=await a.locator('.room-bar strong').textContent();
  await b.goto(url+'/poker/rooms/join');
  await b.getByLabel('ชื่อของคุณ').fill('Winner');
  await b.getByLabel('รหัสห้อง').fill(code);
  await b.getByRole('button',{name:'เข้าร่วมโต๊ะ Poker →',exact:true}).click();
  await b.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();
  await wait(()=>a.getByRole('button',{name:'เริ่มรอบ Poker',exact:true}).isEnabled());
  await a.getByRole('button',{name:'เริ่มรอบ Poker',exact:true}).click();
  await a.getByRole('button',{name:'Fold / หมอบ',exact:true}).waitFor();
  const privateCards=await b.locator('.poker-self .card').evaluateAll(cards=>cards.map(c=>c.getAttribute('aria-label')));
  assert.equal(await a.locator('.poker-opponents .card.back').count(),2);
  assert.equal(await b.locator('.show-cards-button').count(),0);
  await a.getByRole('button',{name:'Fold / หมอบ',exact:true}).click();
  await b.locator('.show-cards-button').waitFor();
  assert.equal(await a.locator('.poker-opponents .card.back').count(),2,'Winner remains private until clicking');
  assert.equal(await a.locator('.show-cards-button').count(),0,'Loser cannot reveal');
  await checkPokerViewport(b,'winner before showing');
  const points=await b.locator('.points').allTextContents();
  await b.getByRole('button',{name:'Show cards / เปิดไพ่',exact:true}).click();
  await wait(async()=>await a.locator('.poker-opponents .card:not(.back)').count()===2);
  assert.deepEqual(await a.locator('.poker-opponents .card').evaluateAll(cards=>cards.map(c=>c.getAttribute('aria-label'))),privateCards);
  assert.deepEqual(await b.locator('.points').allTextContents(),points);
  assert.equal(await b.locator('.show-cards-button').count(),0);
  for(const [width,height] of [[320,568],[360,640],[390,844],[568,320],[844,390],[1366,768]]) {
    await a.setViewportSize({width,height}); await pause(100);
    await checkPokerViewport(a,'revealed winner '+width+'x'+height);await readable(a);
  }
  await b.reload(); await b.locator('.poker-self .card:not(.back)').nth(1).waitFor();
  assert.equal(await b.locator('.show-cards-button').count(),0,'Reveal persists on reconnect');
  await a.setViewportSize({width:360,height:640});
  await a.screenshot({path:previewPath('preview-poker-show-cards.png')});
  await a.getByRole('button',{name:'เตรียมรอบใหม่',exact:true}).click();
  await wait(async()=>await a.locator('.poker-seat .card').count()===0);
  await b.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();
  await wait(()=>a.getByRole('button',{name:'เริ่มรอบ Poker',exact:true}).isEnabled());
  await a.getByRole('button',{name:'เริ่มรอบ Poker',exact:true}).click();
  await b.getByRole('button',{name:'Fold / หมอบ',exact:true}).click();
  await a.locator('.show-cards-button').waitFor();
  for (const [width,height] of [[320,568],[360,640],[568,320],[844,390]]) {
    await a.setViewportSize({width,height});await pause(100);
    await checkPokerViewport(a,'host winner with all result buttons '+width+'x'+height);
    assert.equal(await a.locator('.show-cards-button').isVisible(),true);
  }
  await a.locator('.show-cards-button').click();
  await wait(async()=>await b.locator('.poker-opponents .card:not(.back)').count()===2);
  await b.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();await a.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();
  assert.deepEqual(errors,[]);
  console.log('PASS: voluntary winner reveal, both clients see exact cards, loser privacy, reconnect/reset, clear ranks and six viewport sizes');
} finally { await browser.close(); }
