import { chromium } from 'playwright';
import { Client } from '@colyseus/sdk';
import assert from 'node:assert/strict';
import { selectOption } from './select-option.mjs';
import { checkPokerViewport } from './poker-viewport-check.mjs';
import { previewPath } from './helpers/preview-path.mjs';

const browser = await chromium.launch({channel:'msedge',headless:true});
const url = process.env.GAME_URL || 'http://127.0.0.1:5188';
const endpoint = process.env.GAME_WS || 'ws://127.0.0.1:2567';
const sizes = [
  {width:1366,height:768}, {width:952,height:442},
  {width:768,height:1024,touch:true}, {width:390,height:844,touch:true},
  {width:844,height:390,touch:true}, {width:375,height:667,touch:true},
  {width:1366,height:768,reduced:true},
];
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const rooms = [];
try {
  for (const size of sizes) {
    const label = `${size.width}x${size.height}${size.reduced?' reduced motion':''}`;
    const context = await browser.newContext({viewport:{width:size.width,height:size.height},isMobile:!!size.touch,hasTouch:!!size.touch,reducedMotion:size.reduced?'reduce':'no-preference'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.pokerAnimations = [];
      document.addEventListener('animationstart', event => {
        if (!event.target.matches('.poker-seat .hand .card')) return;
        window.pokerAnimations.push({name:event.animationName,seat:event.target.closest('.poker-seat').getAttribute('data-seat'),card:[...event.target.parentElement.children].indexOf(event.target)});
      },true);
    });
    await page.goto(url+'/poker/rooms/create');
    await page.getByLabel('ชื่อของคุณ').fill('Deal Host');
    await selectOption(page,'จำนวนบอท','0');
    await page.getByRole('button',{name:'สร้างโต๊ะ Poker →',exact:true}).click();
    await page.locator('.room-bar strong').waitFor();
    const code = await page.locator('.room-bar strong').textContent();
    const peers=[];
    let folding=false;
    for(let i=0;i<5;i++) {
      const room = await new Client(endpoint).joinById(code,{name:'Deal '+i,game:'poker'});
      rooms.push(room);peers.push(room);room.reconnection.enabled=false;
      room.onMessage('hand',()=>{});
      room.onMessage('snapshot',snapshot=>{
        const me=snapshot.players.find(player=>player.id===room.sessionId);
        if(folding&&snapshot.turnId===room.sessionId) room.send('action',{type:'fold',roundId:snapshot.roundId,actionId:'fold-'+snapshot.roundId});
        if(snapshot.phase==='LOBBY'&&!me?.ready) room.send('action',{type:'setReady',value:true,roundId:snapshot.roundId,actionId:'ready-'+snapshot.roundId});
      });
      room.send('sync');
    }
    const start=page.getByRole('button',{name:'เริ่มรอบ Poker',exact:true});
    await page.waitForFunction(()=>!document.querySelector('.poker-dock-idle .primary')?.disabled);
    for(let round=1;round<=(size===sizes[0]?2:1);round++) {
      await page.evaluate(()=>window.pokerAnimations=[]);
      await start.click();
      await page.locator('.deal-label').waitFor();
      await page.waitForFunction(()=>document.querySelector('.phase')?.textContent.includes('Pre-flop'));
      await pause(1500);
      const events=await page.evaluate(()=>window.pokerAnimations);
      const counts={};
      for(const event of events) {const key=event.seat+':'+event.card;counts[key]=(counts[key]||0)+1;}
      assert.equal(events.length,size.reduced?0:12,label+' round '+round+': one animation per dealt card: '+JSON.stringify(events));
      assert.ok(Object.values(counts).every(count=>count===1),label+': no duplicate deal');
      if(!size.reduced) assert.ok(events.every(event=>event.name==='arena-deal'),label+': both own and opponent hands use the same deal animation');
      await checkPokerViewport(page,'deal complete '+label);
      assert.equal(await page.locator('.poker-self .card:not(.back)').count(),2,label+': private hand visible');
      assert.equal(await page.locator('.poker-opponents .card.back').count(),10,label+': opponent hands remain private');
      // A repeated snapshot/private-hand sync must not restart any card animation.
      for(const peer of peers) peer.send('sync');
      await pause(250);
      assert.equal(await page.evaluate(()=>window.pokerAnimations.length),events.length,label+': sync does not redeal');
      if(size===sizes[0]) {
        await page.screenshot({path:previewPath('poker-deal-once-desktop.png')});
        // Crossing the responsive boundary after dealing must not re-deal the local hand.
        await page.setViewportSize({width:390,height:844});
        await page.locator('.poker-table > .poker-self').waitFor();
        await pause(1200);
        assert.equal(await page.evaluate(()=>window.pokerAnimations.length),events.length,'resize to mobile must not redeal');
        await checkPokerViewport(page,'after deal resized to mobile');
        await page.setViewportSize({width:size.width,height:size.height});
        await page.locator('.poker-console > .poker-self').waitFor();
        await pause(1200);
        assert.equal(await page.evaluate(()=>window.pokerAnimations.length),events.length,'resize to desktop must not redeal');
        if(round===1) {
          folding=true;
          for(const peer of peers) peer.send('sync');
          await page.getByRole('button',{name:'Fold / หมอบ',exact:true}).click();
          await page.getByRole('button',{name:'เตรียมรอบใหม่',exact:true}).waitFor();
          folding=false;
          await page.getByRole('button',{name:'เตรียมรอบใหม่',exact:true}).click();
          await page.waitForFunction(()=>!document.querySelector('.poker-dock-idle .primary')?.disabled);
        }
      }
      if(size.touch&&!size.reduced) await page.screenshot({path:previewPath('poker-deal-once-'+size.width+'x'+size.height+'.png'),fullPage:true});
    }
    assert.deepEqual(errors,[],label+': no browser errors');
    for(const peer of peers) await peer.leave();
    await page.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();
    await context.close();
    console.log('PASS: one deal per card, privacy and responsive layout '+label);
  }
} finally {
  for(const room of rooms) { room.reconnection.enabled=false; if(room.connection.isOpen) await room.leave(); }
  await browser.close();
}
