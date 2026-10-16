import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({channel:'msedge',headless:true});
const contexts=await Promise.all([{width:1366,height:1050},{width:360,height:850},{width:1024,height:900}].map(viewport=>browser.newContext({viewport})));
const pages=await Promise.all(contexts.map(context=>context.newPage()));const[a,b,c]=pages;const errors=[];
for(const p of pages)p.on('pageerror',e=>errors.push(e.message));
const url=process.env.GAME_URL||'http://127.0.0.1:5188';const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,ms=15000){const end=Date.now()+ms;while(!await fn()){if(Date.now()>end)throw new Error('Spyfall browser timeout');await pause(100);}}
const shot=(page,name)=>page.screenshot({path:fileURLToPath(new URL(`../${name}.png`,import.meta.url)),fullPage:true});
async function start(){await b.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();await c.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();await wait(()=>a.getByRole('button',{name:'เริ่มภารกิจ',exact:true}).isEnabled());await a.getByRole('button',{name:'เริ่มภารกิจ',exact:true}).click();await wait(()=>a.getByRole('button',{name:'เปิดบทบาทลับ',exact:true}).isVisible());for(const p of pages)await p.getByRole('button',{name:'เปิดบทบาทลับ',exact:true}).click();}
async function identities(){const spyIndex=(await Promise.all(pages.map(p=>p.locator('.secret-card.revealed.spy').count()))).findIndex(n=>n===1);assert.notEqual(spyIndex,-1);const citizen=pages.find((_,i)=>i!==spyIndex);return{spy:pages[spyIndex],spyName:['Agent A','Agent B','Agent C'][spyIndex],location:await citizen.locator('.secret-location').textContent()};}
async function catchSpy(spyName){
  await a.getByRole('button',{name:'พร้อมโหวต',exact:true}).click();await b.getByRole('button',{name:'พร้อมโหวต',exact:true}).click();assert.match(await a.locator('.mission-banner h1').textContent(),/ถามตอบ/);
  await c.getByRole('button',{name:'พร้อมโหวต',exact:true}).click();await wait(async()=>(await a.locator('.mission-banner h1').textContent()).includes('ลงคะแนน'));
  for(const p of pages){
    await p.getByRole('dialog',{name:'ใครคือ Spy?'}).waitFor();
    assert.equal(await p.locator('.spy-vote-option').count(),3);
    assert.equal(await p.getByRole('button',{name:'ยืนยันโหวต',exact:true}).isDisabled(),true);
    const seconds=Number(await p.locator('.spy-voting-clock strong').textContent());assert.ok(seconds>0&&seconds<=60);
  }
  await shot(a,'preview-spyfall-voting-desktop');await shot(b,'preview-spyfall-voting-mobile');
  const voters=[b,a,c];
  for(let i=0;i<voters.length;i++){
    const p=voters[i];const own=['Agent A','Agent B','Agent C'][pages.indexOf(p)];const target=own===spyName?['Agent A','Agent B','Agent C'].find(n=>n!==own):spyName;
    assert.equal(await p.getByRole('button',{name:`สงสัย ${own}`,exact:true}).isDisabled(),true);
    await p.getByRole('button',{name:`สงสัย ${target}`,exact:true}).click();
    await p.getByRole('button',{name:'ยืนยันโหวต',exact:true}).click();
    if(i<pages.length-1){
      await wait(()=>p.getByRole('button',{name:'✓ ยืนยันแล้ว',exact:true}).isVisible());
      assert.equal(await p.getByRole('button',{name:'✓ ยืนยันแล้ว',exact:true}).isDisabled(),true);
      assert.equal(await p.locator('.spy-vote-option:not(:disabled)').count(),0);
      await wait(async()=>(await c.locator('.spy-vote-stamp.done').count())===i+1);
      assert.equal(await p.locator('.mission-result').count(),0);
    }
    if(i===0){
      await p.reload();await p.getByRole('dialog',{name:'ใครคือ Spy?'}).waitFor();
      await wait(()=>p.getByRole('button',{name:'✓ ยืนยันแล้ว',exact:true}).isVisible());
      assert.equal(await p.locator('.spy-vote-option.chosen strong').textContent(),target);
    }
  }
  await wait(async()=>(await a.locator('.mission-banner h1').textContent()).includes('สายลับตอบ'));
  for(const p of pages){
    assert.equal(await p.getByRole('dialog',{name:'ใครคือ Spy?'}).count(),0);
    if(pages.indexOf(p)===['Agent A','Agent B','Agent C'].indexOf(spyName)){
      await p.getByRole('dialog',{name:'Spy ตอบสถานที่',exact:true}).waitFor();
      assert.equal(await p.getByLabel('เฉลยสถานที่').evaluate(el=>el===document.activeElement),true);
      assert.equal(await p.getByRole('button',{name:'ยืนยันคำตอบ',exact:true}).isDisabled(),true);
      assert.equal(await p.getByRole('button',{name:'ยอมแพ้',exact:true}).isEnabled(),true);
    }else{
      assert.equal(await p.getByRole('dialog').count(),0);
      assert.equal(await p.getByLabel('เฉลยสถานที่').count(),0);
      assert.equal(await p.getByRole('button',{name:'ยอมแพ้',exact:true}).count(),0);
    }
  }
}
try{
  await a.goto(url);await a.getByRole('button',{name:/เลือก Spyfall/}).click();await a.getByLabel('ชื่อของคุณ').fill('Agent A');await a.getByLabel('เวลาถามตอบ').selectOption('10');await shot(a,'preview-spyfall-create');
  await a.getByRole('button',{name:'สร้างห้อง Spyfall →',exact:true}).click();await a.locator('.room-bar strong').waitFor();const code=await a.locator('.room-bar strong').textContent();
  for(const[p,name]of[[b,'Agent B'],[c,'Agent C']]){await p.goto(url);await p.getByRole('button',{name:/เลือก Spyfall/}).click();await p.getByRole('button',{name:'เข้าห้องเพื่อน',exact:true}).click();await p.getByLabel('ชื่อของคุณ').fill(name);await p.getByLabel('รหัสห้อง').fill(code);await p.getByRole('button',{name:'เข้าร่วมภารกิจ →',exact:true}).click();await p.locator('.room-bar strong').waitFor();}
  await wait(async()=>await a.locator('.spy-player').count()===3);await start();let identity=await identities();
  assert.equal(await identity.spy.locator('.secret-location').textContent(),'Spy');
  for(const p of pages)assert.equal(await p.getByRole('button',{name:'ตอบสถานที่',exact:true}).count(),p===identity.spy?1:0);
  assert.match(new URL(b.url()).pathname,/^\/spyfall\/play\//);
  assert.match(await a.locator('.mission-clock strong').textContent(),/^(10:00|09:\d\d)$/);
  for(const p of pages){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await a.getByLabel('ข้อความแชต',{exact:true}).fill('ที่นี่มีพนักงานประจำไหม?');await a.getByRole('button',{name:'ส่ง',exact:true}).click();await wait(async()=>(await b.locator('.spy-chat-log').textContent()).includes('ที่นี่มีพนักงานประจำไหม?'));
  await b.getByLabel('ข้อความแชต',{exact:true}).fill('<img src=x onerror=alert(1)>');await b.getByRole('button',{name:'ส่ง',exact:true}).click();await wait(async()=>(await c.locator('.spy-chat-log').textContent()).includes('<img src=x onerror=alert(1)>'));assert.equal(await c.locator('.spy-chat-log img').count(),0);
  const oldRole=await b.locator('.secret-card').textContent();await b.reload();await wait(()=>b.getByRole('button',{name:'เปิดบทบาทลับ',exact:true}).isVisible());await b.getByRole('button',{name:'เปิดบทบาทลับ',exact:true}).click();assert.equal(await b.locator('.secret-card').textContent(),oldRole);
  await shot(a,'preview-spyfall-question');await shot(b,'preview-spyfall-mobile');
  await catchSpy(identity.spyName);assert.equal(await a.getByLabel('ข้อความแชต',{exact:true}).isDisabled(),true);assert.equal(await c.getByLabel('ข้อความแชต',{exact:true}).isDisabled(),true);
  assert.equal(await identity.spy.getByLabel('เฉลยสถานที่').evaluate(el=>el===document.activeElement),true);
  await shot(identity.spy,'preview-spyfall-guess-popup');
  await shot(a,'preview-spyfall-vote-result');
  await identity.spy.getByLabel('เฉลยสถานที่').fill('สถานที่ที่ไม่ถูกต้อง');await identity.spy.getByRole('button',{name:'ยืนยันคำตอบ',exact:true}).click();
  await wait(async()=>(await a.locator('.mission-result h2').textContent()).includes('คนทั่วไปชนะ'));assert.match(await a.locator('.mission-result').textContent(),new RegExp(identity.location));await shot(a,'preview-spyfall-result');
  await a.getByRole('button',{name:'เตรียมภารกิจใหม่',exact:true}).click();await a.getByLabel('เวลาถามตอบ').selectOption('5');await start();identity=await identities();
  assert.match(await a.locator('.mission-clock strong').textContent(),/^(05:00|04:\d\d)$/);
  await a.getByLabel('ข้อความแชต',{exact:true}).fill('ที่นี่มักมีคนเยอะไหม?');await a.getByRole('button',{name:'ส่ง',exact:true}).click();
  await b.getByLabel('ข้อความแชต',{exact:true}).fill('มีช่วงที่คนเยอะอยู่เหมือนกัน');await b.getByRole('button',{name:'ส่ง',exact:true}).click();
  await wait(async()=>(await a.locator('.spy-chat-log').textContent()).includes('มีช่วงที่คนเยอะอยู่เหมือนกัน'));
  await shot(a,'preview-spyfall-question');await shot(b,'preview-spyfall-mobile');
  await catchSpy(identity.spyName);
  await identity.spy.getByLabel('เฉลยสถานที่').fill(identity.location);await identity.spy.getByRole('button',{name:'ยืนยันคำตอบ',exact:true}).click();await wait(async()=>(await a.locator('.mission-result h2').textContent()).includes('สายลับชนะ'));
  await a.getByRole('button',{name:'เตรียมภารกิจใหม่',exact:true}).click();await start();identity=await identities();
  await identity.spy.getByRole('button',{name:'ตอบสถานที่',exact:true}).click();
  assert.equal(await identity.spy.getByLabel('เฉลยสถานที่').evaluate(el=>el===document.activeElement),true);
  for(const [width,height]of[[375,667],[568,320],[1366,768]]){
    await identity.spy.setViewportSize({width,height});await identity.spy.getByLabel('เฉลยสถานที่').scrollIntoViewIfNeeded();
    assert.equal(await identity.spy.getByLabel('เฉลยสถานที่').isVisible(),true);
    assert.equal(await identity.spy.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  for(const p of pages.filter(p=>p!==identity.spy))assert.equal(await p.getByLabel('เฉลยสถานที่').count(),0);
  assert.equal(await identity.spy.getByRole('button',{name:'ยืนยันคำตอบ',exact:true}).isDisabled(),true);
  await identity.spy.getByLabel('เฉลยสถานที่').fill(identity.location);await shot(identity.spy,'preview-spyfall-early-answer');
  await identity.spy.getByRole('button',{name:'ยืนยันคำตอบ',exact:true}).click();
  await wait(async()=>(await a.locator('.mission-result h2').textContent()).includes('สายลับชนะ'));
  assert.equal(await a.locator('.vote-results').textContent().then(t=>t.includes('ไม่ลงคะแนน')),true);
  await a.getByRole('button',{name:'เตรียมภารกิจใหม่',exact:true}).click();await start();identity=await identities();
  assert.equal(await identity.spy.getByLabel('เฉลยสถานที่').count(),0);
  await identity.spy.getByRole('button',{name:'ตอบสถานที่',exact:true}).click();
  assert.equal(await identity.spy.getByLabel('เฉลยสถานที่').inputValue(),'');
  await identity.spy.getByLabel('เฉลยสถานที่').fill('สถานที่ที่ไม่ถูกต้อง');await identity.spy.getByRole('button',{name:'ยืนยันคำตอบ',exact:true}).click();
  await wait(async()=>(await a.locator('.mission-result h2').textContent()).includes('คนทั่วไปชนะ'));
  await a.getByRole('button',{name:'เตรียมภารกิจใหม่',exact:true}).click();await start();identity=await identities();
  const wrongTarget=['Agent A','Agent B','Agent C'].find(n=>n!==identity.spyName);
  for(const p of pages)await p.getByRole('button',{name:'พร้อมโหวต',exact:true}).click();
  for(let i=0;i<pages.length;i++){
    const own=['Agent A','Agent B','Agent C'][i];const target=own===wrongTarget?identity.spyName:wrongTarget;
    await pages[i].getByRole('button',{name:`สงสัย ${target}`,exact:true}).click();
    await pages[i].getByRole('button',{name:'ยืนยันโหวต',exact:true}).click();
  }
  await wait(async()=>await a.locator('.mission-result h2').textContent()==='สายลับชนะ');
  for(const p of pages){assert.equal(await p.getByRole('dialog').count(),0);assert.match(await p.locator('.mission-result').textContent(),/จับผิดคน/);}
  await a.getByRole('button',{name:'เตรียมภารกิจใหม่',exact:true}).click();await start();identity=await identities();
  await catchSpy(identity.spyName);
  const secondsBeforeReload=Number(await identity.spy.locator('.spy-guess-footer .spy-voting-clock strong').textContent());
  await identity.spy.reload();await identity.spy.getByRole('dialog',{name:'Spy ตอบสถานที่',exact:true}).waitFor();
  const secondsAfterReload=Number(await identity.spy.locator('.spy-guess-footer .spy-voting-clock strong').textContent());
  assert.ok(secondsAfterReload>0&&secondsAfterReload<=secondsBeforeReload);
  assert.equal(await identity.spy.getByLabel('เฉลยสถานที่').inputValue(),'');
  await identity.spy.getByRole('button',{name:'ยอมแพ้',exact:true}).click();
  await wait(async()=>await a.locator('.mission-result h2').textContent()==='คนทั่วไปชนะ');
  for(const p of pages){assert.equal(await p.getByRole('dialog').count(),0);assert.match(await p.locator('.mission-result').textContent(),/สายลับยอมแพ้/);}
  assert.deepEqual(errors,[]);for(const p of [...pages].reverse())await p.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();
  console.log('PASS: 3 players, private roles, chat, 60-second voting, locked confirmations and refresh, automatic spy-only answer popup, correct/wrong answers, surrender with no answer, winners and modal cleanup, desktop/mobile');
}catch(error){console.error('Spyfall browser errors:',errors);console.error((await a.locator('body').textContent()).slice(0,4500));throw error;}finally{await browser.close();}
