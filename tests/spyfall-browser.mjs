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
  for(let i=0;i<pages.length;i++){const own=['Agent A','Agent B','Agent C'][i];const target=own===spyName?['Agent A','Agent B','Agent C'].find(n=>n!==own):spyName;await pages[i].getByRole('button',{name:`สงสัย ${target}`,exact:true}).click();await pages[i].getByRole('button',{name:'ยืนยันโหวต',exact:true}).click();}
  await wait(async()=>(await a.locator('.mission-banner h1').textContent()).includes('สายลับตอบ'));
}
try{
  await a.goto(url);await a.getByRole('button',{name:/เลือก Spyfall/}).click();await a.getByLabel('ชื่อของคุณ').fill('Agent A');await a.getByLabel('เวลาถามตอบ').selectOption('10');await shot(a,'preview-spyfall-create');
  await a.getByRole('button',{name:'สร้างห้อง Spyfall →',exact:true}).click();await a.locator('.room-bar strong').waitFor();const code=await a.locator('.room-bar strong').textContent();
  for(const[p,name]of[[b,'Agent B'],[c,'Agent C']]){await p.goto(url);await p.getByRole('button',{name:/เลือก Spyfall/}).click();await p.getByRole('button',{name:'เข้าห้องเพื่อน',exact:true}).click();await p.getByLabel('ชื่อของคุณ').fill(name);await p.getByLabel('รหัสห้อง').fill(code);await p.getByRole('button',{name:'เข้าร่วมภารกิจ →',exact:true}).click();await p.locator('.room-bar strong').waitFor();}
  await wait(async()=>await a.locator('.spy-player').count()===3);await start();let identity=await identities();
  assert.match(new URL(b.url()).pathname,/^\/spyfall\/play\//);
  assert.match(await a.locator('.mission-clock strong').textContent(),/^(10:00|09:\d\d)$/);
  for(const p of pages){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await a.getByLabel('ข้อความแชต',{exact:true}).fill('ที่นี่มีพนักงานประจำไหม?');await a.getByRole('button',{name:'ส่ง',exact:true}).click();await wait(async()=>(await b.locator('.spy-chat-log').textContent()).includes('ที่นี่มีพนักงานประจำไหม?'));
  await b.getByLabel('ข้อความแชต',{exact:true}).fill('<img src=x onerror=alert(1)>');await b.getByRole('button',{name:'ส่ง',exact:true}).click();await wait(async()=>(await c.locator('.spy-chat-log').textContent()).includes('<img src=x onerror=alert(1)>'));assert.equal(await c.locator('.spy-chat-log img').count(),0);
  const oldRole=await b.locator('.secret-card').textContent();await b.reload();await wait(()=>b.getByRole('button',{name:'เปิดบทบาทลับ',exact:true}).isVisible());await b.getByRole('button',{name:'เปิดบทบาทลับ',exact:true}).click();assert.equal(await b.locator('.secret-card').textContent(),oldRole);
  await shot(a,'preview-spyfall-question');await shot(b,'preview-spyfall-mobile');
  await catchSpy(identity.spyName);assert.equal(await a.getByLabel('ข้อความแชต',{exact:true}).isDisabled(),true);assert.equal(await c.getByLabel('ข้อความแชต',{exact:true}).isDisabled(),true);
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
  assert.deepEqual(errors,[]);for(const p of [...pages].reverse())await p.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();
  console.log('PASS: 3 players, private role, 5/10-minute settings, chat/XSS rendering, refresh, unanimous readiness, voting, paused guess chat, wrong/correct spy guess outcomes, desktop/mobile');
}catch(error){console.error('Spyfall browser errors:',errors);console.error((await a.locator('body').textContent()).slice(0,4500));throw error;}finally{await browser.close();}
