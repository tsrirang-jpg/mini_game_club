import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { previewPath } from './helpers/preview-path.mjs';

// Run against npm run dev. Layout may scroll vertically, but no controls may
// escape their panels, overlap siblings, or become covered by the next panel.
const base = process.env.GAME_URL || 'http://127.0.0.1:5188';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const errors = [];
const watch = page => page.on('pageerror', error => errors.push(error.message));
const sizes = [
  [320,480],[360,640],[375,667],[390,844],[420,750],[600,800],
  [601,800],[768,1024],[820,1180],[999,768],[1000,768],[1024,768],
  [1024,500],[1024,360],[1274,590],[1280,720],[1366,768],[1440,900],
  [1672,941],[1920,1080],[2560,1440],[568,320],[844,390],[932,430],
];
const allGames = [
  {kind:'pok', root:'', store:'session', create:'สร้างห้อง ป๊อกเด้ง', join:'เข้าร่วมห้อง ป๊อกเด้ง', bots:[10,0]},
  {kind:'poker', root:'/poker', store:'pokerSession', create:'สร้างห้อง Poker', join:'เข้าร่วมห้อง Poker', bots:[6,1]},
  {kind:'spyfall', root:'/spyfall', store:'spySession', create:'สร้างห้อง Spyfall', join:'เข้าร่วมห้อง Spyfall',
    choices:[['เวลาถามตอบ','questionMinutes',10],['โหวต','votingMinutes',3],['สายลับตอบ','guessMinutes',3]]},
  {kind:'oldmaid', root:'/oldmaid', store:'oldMaidSession', create:'สร้างห้อง อีแก่กินน้ำ', join:'เข้าร่วมห้อง อีแก่กินน้ำ', bots:[8,2]},
  {kind:'whoami', root:'/whoami', store:'whoAmISession', create:'สร้างห้อง Who am I', join:'เข้าร่วมห้อง Who am I',
    choices:[['เวลาต่อคน','turnMinutes',3],['รอบการถาม','questionRounds',10],['รอบการเล่นเกม','gameRounds',10]]},
  {kind:'liar', root:'/liar', store:'liarSession', create:'สร้างห้อง ไพ่ตอแหล', join:'เข้าร่วมห้อง ไพ่ตอแหล', bots:[6,0],
    choices:[['เวลาต่อเทิร์น','turnSeconds',60]]},
  {kind:'undercover', root:'/undercover', store:'underSession', create:'สร้างห้อง Undercover', join:'เข้าร่วมห้อง Undercover',
    choices:[['เวลาพิมพ์ในรอบตัวเอง','turnMinutes',3],['เวลาโหวต','voteMinutes',3]]},
];
const requested=process.env.ROOM_ENTRY_GAMES?.split(',');
const games=requested?allGames.filter(game=>requested.includes(game.kind)):allGames;
assert.ok(games.length,'No room entry games selected');
const combo = (page, label) => page.getByRole('combobox', {name:label, exact:true});
const action = (page, name) => page.getByRole('button', {name, exact:true});
async function ready(page) {
  await page.locator('.room-entry-form form').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.room-entry-art img').evaluate(async img => {
    if (!img.complete) await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
    if (!img.naturalWidth) throw new Error('Room artwork did not load: '+img.src);
  });
}
async function fits(page, label) {
  const result = await page.evaluate(() => {
    const rect = e => e.getBoundingClientRect();
    const visible = e => { const r=rect(e); return r.width>0 && r.height>0; };
    const inside = (child,parent) => child.left>=parent.left-2 && child.right<=parent.right+2 && child.top>=parent.top-2 && child.bottom<=parent.bottom+2;
    const overlaps = (a,b) => Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
    const bad = [];
    const header=document.querySelector('.room-entry-header'), hr=rect(header);
    const headerChildren=[...header.children].filter(visible);
    for (const child of headerChildren) if (!inside(rect(child),hr)) bad.push('header clips '+child.className);
    for (let i=0;i<headerChildren.length;i++) for(let j=i+1;j<headerChildren.length;j++)
      if(overlaps(rect(headerChildren[i]),rect(headerChildren[j]))) bad.push('header children overlap');
    const form=document.querySelector('.room-entry-form'),fr=rect(form);
    for(const child of form.querySelectorAll('input,button,[role="combobox"]')) if(visible(child)){
      if(!inside(rect(child),fr)) bad.push('form clips '+(child.getAttribute('aria-label')||child.textContent||child.tagName));
      if(child.scrollWidth>child.clientWidth+2) bad.push('control text overflows '+child.textContent);
    }
    const panels=[...document.querySelectorAll('.room-entry-grid > *')].filter(visible);
    for(let i=0;i<panels.length;i++)for(let j=i+1;j<panels.length;j++)
      if(overlaps(rect(panels[i]),rect(panels[j])))bad.push(panels[i].className+' overlaps '+panels[j].className);
    for(const node of document.querySelectorAll('.room-entry-page,.room-entry-heading,.room-entry-art,.room-entry-form,.room-entry-facts,.room-entry-guide')){
      const r=rect(node);
      if(r.width && (r.left< -1||r.right>innerWidth+1))bad.push(node.className+' exceeds viewport');
    }
    const art=rect(document.querySelector('.room-entry-art'));
    if(innerWidth>=1000 && art.right>fr.left+2)bad.push('desktop artwork/form not side by side');
    if(art.width<80||art.height<80)bad.push('artwork collapsed');
    return {horizontal:document.documentElement.scrollWidth>innerWidth+1,bad};
  });
  assert.deepEqual(result,{horizontal:false,bad:[]},label+' '+JSON.stringify(result));
}
async function reachable(locator, label) {
  await locator.scrollIntoViewIfNeeded();
  assert.equal(await locator.evaluate(element => {
    const r=element.getBoundingClientRect();
    return r.width>0 && r.height>0 && element.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
  }),true,label+' is not covered');
}
async function dropdown(page,label,expectedCount) {
  const trigger=combo(page,label);
  await reachable(trigger,label);
  await trigger.focus(); await page.keyboard.press('ArrowDown');
  const list=page.getByRole('listbox',{name:label,exact:true});
  await list.waitFor();
  if(expectedCount!==undefined)assert.equal(await list.getByRole('option').count(),expectedCount,label+' options');
  assert.deepEqual(await list.evaluate(e=>{const r=e.getBoundingClientRect();return {fits:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,overflow:e.scrollWidth>e.clientWidth+1};}),{fits:true,overflow:false},label+' menu');
  const selected=(await trigger.textContent()).trim();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('listbox').count(),0,'Escape closes '+label);
  assert.equal((await trigger.textContent()).trim(),selected,'Escape preserves '+label);
}
async function chooseLast(page,label) {
  const trigger=combo(page,label);
  await trigger.scrollIntoViewIfNeeded(); await trigger.focus();
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
}
async function joined(page,pattern) {
  await page.waitForFunction(source=>new RegExp(source).test(location.href)||document.querySelector('[role="alert"]'),pattern.source,{timeout:15000});
  assert.deepEqual(await page.getByRole('alert').allTextContents(),[],'Room connection error');
  await page.waitForURL(pattern);
}
async function storeCall(page,game,method) {
  return page.evaluate(async ({name,method})=>{
    // Reuse the module already mounted by Vite, including a possible HMR query.
    const resources=performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/src/session.ts'));
    const loaded=resources.findLast(n=>n.includes('?t='))||resources.at(-1)||'/src/session.ts';
    const store=(await import(loaded))[name];
    return method==='leave'?store.leave():JSON.parse(JSON.stringify(store.getSnapshot()));
  },{name:game.store,method});
}
async function snapshot(page,game) {
  return (await storeCall(page,game,'snapshot')).snapshot;
}
async function waitForPlayers(page,game,count) {
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    const state=await snapshot(page,game);
    if(state?.players.length===count)return state;
    await page.waitForTimeout(80);
  }
  throw new Error(game.kind+' expected '+count+' players');
}
const context=await browser.newContext({viewport:{width:1366,height:768},hasTouch:true,reducedMotion:'reduce'});
const page=await context.newPage();watch(page);
try {
  // Both modes for every theme, including breakpoint boundaries and short landscape.
  for(const game of games)for(const mode of ['create','join']){
    await page.goto(base+game.root+'/rooms/'+mode);await ready(page);
    await page.getByLabel('ชื่อของคุณ',{exact:true}).fill('Layout Test');
    if(mode==='join')await page.getByLabel('รหัสห้อง',{exact:true}).fill('ABCDEF0123');
    assert.equal(await page.locator('.room-entry-shell.theme-'+game.kind).count(),1,game.kind+' theme');
    assert.equal(await page.locator('.room-entry-heading h1').count(),1);
    assert.equal(await action(page,'เลือกเกมอื่น').count(),1);
    assert.equal(await action(page,'วิธีเล่น').count(),1);
    assert.equal(await page.getByLabel('ชื่อของคุณ',{exact:true}).count(),1);
    assert.equal(await page.getByLabel('ชื่อของคุณ',{exact:true}).getAttribute('maxlength'),'20');
    assert.equal(await page.locator('.room-entry-art img').count(),1,'single reused artwork');
    assert.equal(await page.locator('.room-entry-form form').count(),1,'single shared form');
    const submit=action(page,mode==='create'?game.create:game.join);
    const visibleSubmitText=(await submit.textContent()).trim();
    assert.ok((await submit.getAttribute('aria-label')).startsWith(visibleSubmitText),game.kind+' '+mode+' accessible submit name starts with its visible text');
    assert.equal(await page.getByLabel('รหัสห้อง',{exact:true}).count(),mode==='join'?1:0);
    assert.equal(await combo(page,'จำนวนบอท').count(),mode==='create'&&game.bots?1:0);
    if(mode==='create'&&game.bots){
      assert.match(await combo(page,'จำนวนบอท').textContent(),game.bots[1]?new RegExp('บอท '+game.bots[1]+' ตัว'):/ไม่เพิ่มบอท/);
      await dropdown(page,'จำนวนบอท',game.bots[0]);
    }
    for(const [width,height]of sizes){
      await page.setViewportSize({width,height});await fits(page,game.kind+' '+mode+' '+width+'x'+height);
      // Hit-testing checks the actual target after natural scrolling, not just its bounding box.
      await reachable(action(page,mode==='create'?game.create:game.join),game.kind+' submit '+width+'x'+height);
      if(mode==='create'&&[320,768,1024].includes(width)){
        for(const choice of game.choices||[])await dropdown(page,choice[0]);
        if(game.bots)await dropdown(page,'จำนวนบอท',game.bots[0]);
      }
      if(mode==='create'&&[[390,844],[768,1024],[1366,768]].some(([w,h])=>w===width&&h===height)){
        await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:previewPath('room-entry-'+game.kind+'-'+width+'x'+height+'.png'),fullPage:true});
      }
    }
    await page.setViewportSize({width:390,height:844});
    await action(page,'วิธีเล่น').click();
    const dialog=page.locator('dialog:modal');await dialog.waitFor();
    assert.ok((await dialog.textContent()).trim().length>50,'rules content preserved');
    await page.keyboard.press('Escape');assert.equal(await page.locator('dialog:modal').count(),0);
    await action(page,'เลือกเกมอื่น').click();
    assert.equal(new URL(page.url()).pathname,'/games');
    console.log('layout '+game.kind+' '+mode+': '+sizes.length+' sizes passed');
  }
  for(const game of games){
    await page.goto(base+game.root+'/rooms/join?code=ABCDEF0123');await ready(page);
    assert.equal(await page.getByLabel('รหัสห้อง',{exact:true}).inputValue(),'ABCDEF0123',game.kind+' query prefill');
    assert.equal(await page.getByLabel('รหัสห้อง',{exact:true}).getAttribute('maxlength'),'10');
    await page.getByLabel('รหัสห้อง',{exact:true}).fill('   ');
    assert.equal(await action(page,game.join).isDisabled(),true,'empty code blocks join');
    await page.getByLabel('รหัสห้อง',{exact:true}).fill('abcdef9876');
    assert.equal(await page.getByLabel('รหัสห้อง',{exact:true}).inputValue(),'ABCDEF9876',game.kind+' uppercase');
    await action(page,'สร้างห้อง').click();assert.equal(new URL(page.url()).pathname,game.root+'/rooms/create');
    await action(page,'เข้าห้องเพื่อน').click();assert.equal(new URL(page.url()).pathname,game.root+'/rooms/join');
  }
  // Exercise actual sockets and existing session code through the shared form.
  for(const game of games){
    const live=await browser.newContext({viewport:{width:1024,height:768},reducedMotion:'reduce'});
    const host=await live.newPage(),guest=await live.newPage();watch(host);watch(guest);
    try {
      await host.goto(base+game.root+'/rooms/create');await ready(host);
      assert.equal(await action(host,game.create).isDisabled(),true,'blank name blocks create');
      const name='Entry '+game.kind;
      await host.getByLabel('ชื่อของคุณ',{exact:true}).fill('  '+name+'  ');
      if(game.bots){await combo(host,'จำนวนบอท').click();await host.getByRole('option').first().click();}
      for(const [label]of game.choices||[])await chooseLast(host,label);
      if(game.kind==='undercover'){await action(host,'เพิ่ม Undercover').click();await action(host,'เพิ่ม Mr. White').click();}
      if(game.kind==='spyfall')await host.getByLabel('ชื่อของคุณ',{exact:true}).press('Enter');
      else await action(host,game.create).click();
      await joined(host,new RegExp(game.root+'/play/[A-F0-9]{10}$'));
      const state=await waitForPlayers(host,game,1),code=state.code;
      assert.equal(state.players[0].name,name,'submitted name trimmed');
      for(const [,key,value]of game.choices||[])assert.equal(game.kind==='liar'?state.turnDurationMs:state[key],game.kind==='liar'?value*1000:value,game.kind+' setting '+key);
      if(game.kind==='undercover'){assert.equal(state.undercoverCount,2);assert.equal(state.whiteCount,1);}
      await guest.goto(base+game.root+'/rooms/join?code='+code);await ready(guest);
      assert.equal(await guest.getByLabel('ชื่อของคุณ',{exact:true}).inputValue(),name,'saved name reused');
      assert.equal(await guest.getByLabel('รหัสห้อง',{exact:true}).inputValue(),code);
      await guest.getByLabel('ชื่อของคุณ',{exact:true}).fill('Friend '+game.kind);
      await action(guest,game.join).click();
      await joined(guest,new RegExp(game.root+'/play/'+code+'$'));
      await waitForPlayers(host,game,2);await waitForPlayers(guest,game,2);
      // Back/resume/leave keeps the authoritative session, without reconnecting or duplicating seats.
      await host.goBack();await ready(host);
      assert.match(await host.locator('.room-entry-form .notice').textContent(),new RegExp(code));
      assert.equal(await action(host,game.create).isDisabled(),true,'connected room blocks second creation');
      await action(host,'กลับไปเล่น').click();await host.waitForURL(new RegExp('/play/'+code+'$'));
      await waitForPlayers(host,game,2);
      await host.goBack();await ready(host);await host.locator('.room-entry-form .notice').getByRole('button',{name:'ออกจากห้อง',exact:true}).click();
      await ready(host);assert.equal(await host.locator('.room-entry-form .notice').count(),0,'leave clears current room');
      await storeCall(guest,game,'leave');
      await host.goto(base+game.root+'/rooms/join?code=FFFFFFFFFF');await ready(host);
      await host.getByLabel('ชื่อของคุณ',{exact:true}).fill('Unknown room');
      await action(host,game.join).click();await host.getByRole('alert').waitFor();
      assert.equal(await action(host,game.join).isEnabled(),true,'failed join restores submit');
      await action(host,'ปิดข้อความ').click();assert.equal(await host.getByRole('alert').count(),0);
      console.log('socket '+game.kind+': create/join/settings/resume/leave/error passed');
    } catch(error) {
      await host.screenshot({path:previewPath('room-entry-'+game.kind+'-socket-debug.png'),fullPage:true}).catch(()=>{});
      console.error(game.kind+' socket alert:',await host.getByRole('alert').allTextContents());
      throw error;
    } finally {
      for(const p of [guest,host])if(!p.isClosed())await storeCall(p,game,'leave').catch(()=>{});
      await live.close();
    }
  }
  assert.deepEqual(errors,[],'Unexpected browser exceptions');
  console.log('PASS: shared room entry '+games.length*2+' paths × '+sizes.length+' viewports; panel/control containment, header and grid overlap, actual button hit-testing, responsive dropdowns, rules, mode navigation, query codes, name storage, real create/join for '+games.length+' games, settings transmission, current-room resume/leave and server errors');
} catch(error) {
  await page.screenshot({path:previewPath('room-entry-debug.png'),fullPage:true}).catch(()=>{});
  console.error('Browser exceptions:',errors);throw error;
} finally {
  await context.close();await browser.close();
}
