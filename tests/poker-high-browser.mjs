import { chromium } from 'playwright';
import { Client } from '@colyseus/sdk';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkPokerViewport } from './poker-viewport-check.mjs';
const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext({viewport:{width:952,height:442},deviceScaleFactor:2});
const page = await context.newPage(), rooms=[], errors=[];
page.on('pageerror', e=>errors.push(e.message));
const url=process.env.GAME_URL||'http://127.0.0.1:2568';
const endpoint=url.replace(/^http/,'ws');
let allInMode=false;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn){const end=Date.now()+15000;while(!await fn()){if(Date.now()>end)throw new Error('High card test timeout');await pause(80);}}
async function dimensions(){return page.evaluate(()=>{
  const box=s=>document.querySelector(s).getBoundingClientRect();
  const t=box('.poker-table'),c=box('.poker-center'),self=box('.poker-self');
  return {centerX:Math.abs((c.left+c.right-t.left-t.right)/2),centerY:Math.abs((c.top+c.bottom-t.top-t.bottom)/2),
    selfX:Math.abs((self.left+self.right-t.left-t.right)/2),bottom:t.bottom-self.bottom,
    board:box('.card-slot,.community .card').width,own:box('.poker-self .card').width,
    opponent:box('.poker-opponents .card').width};
});}
async function fits(label){
  await checkPokerViewport(page,label);
  const d=await dimensions();
  assert.ok(d.centerX<=1&&d.centerY<=1,label+': board/POT centered in table '+JSON.stringify(d));
  assert.ok(d.selfX<=1&&d.bottom<=24,label+': own hand at bottom center '+JSON.stringify(d));
  return d;
}
try{
  await page.goto(url+'/poker/rooms/create');
  await page.getByLabel('ชื่อของคุณ').fill('High Test');
  await page.getByLabel('จำนวนบอท').selectOption('0');
  await page.getByRole('button',{name:'สร้างโต๊ะ Poker →',exact:true}).click();
  await page.locator('.room-bar strong').waitFor();
  const code=await page.locator('.room-bar strong').textContent();
  for(let i=0;i<5;i++){
    const room=await new Client(endpoint).joinById(code,{name:'Opponent '+(i+1),game:'poker'});
    rooms.push(room);room.reconnection.enabled=false;let last='';
    room.onMessage('hand',()=>{});room.onMessage('error',e=>errors.push(e.message));
    room.onMessage('snapshot',s=>{
      if(s.phase==='LOBBY'&&!s.players.find(p=>p.id===room.sessionId)?.ready) room.send('action',{type:'setReady',value:true,roundId:s.roundId,actionId:'ready-'+s.roundId});
      const me=s.players.find(p=>p.id===room.sessionId),key=s.roundId+':'+s.phase+':'+s.currentBet+':'+me?.streetBet;
      if(s.turnId===room.sessionId&&last!==key){last=key;room.send('action',{type:allInMode?'allIn':me.streetBet<s.currentBet?'call':'check',roundId:s.roundId,actionId:'act-'+key.replaceAll(':','-')});}
    });room.send('sync');
  }
  await wait(()=>page.getByRole('button',{name:'เริ่มรอบ Poker',exact:true}).isEnabled());
  await page.getByRole('button',{name:'เริ่มรอบ Poker',exact:true}).click();
  await page.getByRole('button',{name:/^All-in \d/}).waitFor();await pause(750);
  assert.equal(await page.getByRole('button',{name:'ยืนยัน Raise',exact:true}).isVisible(),true);
  assert.equal(await page.locator('.card-size-high').count(),1);
  const high=await fits('Windows scaled 952x442 at DPR 2');
  assert.ok(high.board>=48&&high.own>=42&&high.opponent>=36,'High sizes on scaled Windows '+JSON.stringify(high));
  await page.getByRole('button',{name:'จัดการโต๊ะ',exact:true}).click();
  await page.getByLabel('ขนาดไพ่บนจอคอม').selectOption('normal');
  await page.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();
  const normal=await fits('Normal size');
  assert.ok(normal.board<high.board&&normal.own<high.own&&normal.opponent<high.opponent,'Normal/High must differ');
  await page.getByRole('button',{name:'จัดการโต๊ะ',exact:true}).click();
  await page.getByLabel('ขนาดไพ่บนจอคอม').selectOption('high');
  await page.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();
  for(const [width,height] of [[952,442],[800,400],[1268,590],[1280,700],[1366,768],[1903,885],[2560,1080],[1024,600]]){
    await page.setViewportSize({width,height});await pause(100);await fits('High '+width+'x'+height);
  }
  allInMode=true;await page.getByRole('button',{name:/^All-in \d/}).click();
  await wait(async()=> (await page.locator('.phase').textContent()).includes('จบรอบ'));
  assert.equal(await page.locator('.poker-seat .card:not(.back)').count(),12);
  for(const [width,height] of [[952,442],[800,400],[1268,590],[1280,700],[1366,768],[1903,885],[2560,1080],[1024,600]]){
    await page.setViewportSize({width,height});await pause(100);await fits('Shown cards '+width+'x'+height);
    if(width===952||width===1903) await page.screenshot({path:fileURLToPath(new URL('../preview-poker-high-'+width+'x'+height+'.png',import.meta.url)),...(width===1903?{scale:'css'}:{})});
  }
  await page.reload();await page.locator('.poker-self .card:not(.back)').nth(1).waitFor();
  assert.equal(await page.locator('.card-size-high').count(),1,'High preference survives refresh');
  assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();
  console.log('PASS: High cards, centered board/POT, own hand at bottom, scaled Windows DPR 2 and eight desktop viewports during Raise/showdown, Normal/High preference, 12 shown ranks');
}catch(error){await page.screenshot({path:fileURLToPath(new URL('../preview-debug.png',import.meta.url))});throw error;}
finally{for(const room of rooms)await room.leave().catch(()=>{});await browser.close();}
