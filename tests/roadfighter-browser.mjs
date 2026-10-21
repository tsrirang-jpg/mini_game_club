import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {previewPath} from './helpers/preview-path.mjs';
const url=process.env.GAME_URL||'http://127.0.0.1:5188';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:768},hasTouch:true}),page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const sizes=[[1274,590],[1280,590],[1911,885],[999,768],[1000,768],[1024,500],[1024,430],[1024,360],[1366,650],[1366,651],[1920,600],[1199,800],[1200,800],[380,700],[381,700],[600,800],[601,800],[1101,651],[1100,650],[600,651],[601,650],[900,901],[880,590],[320,480],[320,568],[360,640],[375,667],[390,844],[420,750],[768,1024],[1024,768],[1366,768],[1672,941],[1920,1080],[2560,1440],[568,320],[667,375],[844,390],[932,430],[1024,600]];
async function fits(label,playing=false){
 const report=await page.evaluate(playing=>{const box=e=>e.getBoundingClientRect();const nodes=[...document.querySelectorAll(playing?'.arcade-header,.road-hud,.road-track-frame,.road-game-footer,.road-touch-controls button,.road-footer-actions button':'.arcade-header,.menu-filters,.game-option,.road-setup,.road-start-preview')];return {horizontal:document.documentElement.scrollWidth>innerWidth+1,vertical:playing&&document.documentElement.scrollHeight>innerHeight+1,bad:nodes.filter(e=>{const r=box(e);return r.width&&r.height&&(r.left< -1||r.right>innerWidth+1||playing&&(r.top< -1||r.bottom>innerHeight+1));}).map(e=>e.className),overflow:playing?[...document.querySelectorAll('.road-hud,.road-sidebar,.road-instruments')].filter(e=>{const r=box(e);return r.width&&r.height&&(e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2);}).map(e=>({class:e.className,width:e.clientWidth,sw:e.scrollWidth,height:e.clientHeight,sh:e.scrollHeight})):[]};},playing);
 assert.deepEqual(report,{horizontal:false,vertical:false,bad:[],overflow:[]},label+' '+JSON.stringify(report));
 const setup=page.locator('.road-setup');
 if(await setup.count()){
  const bad=await setup.evaluate(form=>{
   const r=form.getBoundingClientRect(),bad=[];
   for(const child of form.children){const c=child.getBoundingClientRect();if(c.width&&c.height&&(c.left<r.left-1||c.right>r.right+1||c.top<r.top-1||c.bottom>r.bottom-1))bad.push(child.className||child.tagName);}
   const guide=document.querySelector('.road-start-grid > .road-help').getBoundingClientRect();
   if(guide.top<r.bottom-1&&guide.right>r.left&&guide.left<r.right)bad.push('guide overlaps setup');
   return bad;
  });
  assert.deepEqual(bad,[],label+' all setup controls fit inside form');
 }
 if(playing){
  const details=await page.evaluate(()=>{
   const bounds=e=>e.getBoundingClientRect(),bad=[];
   for(const selector of ['.road-race-grid','.road-hud','.road-instruments','.road-sidebar','.road-stage-card','.road-game-footer','.road-speed','.road-fuel']){
    const panel=document.querySelector(selector),outer=bounds(panel);
    if(!outer.width||!outer.height)continue;
    const children=[...panel.children].filter(e=>bounds(e).width&&bounds(e).height);
    for(const child of children){
     const r=bounds(child);
     if(r.left<outer.left-2||r.right>outer.right+2||r.top<outer.top-2||r.bottom>outer.bottom+2)bad.push(selector+' > '+child.className+' clipped');
    }
    for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++){
     const a=bounds(children[i]),b=bounds(children[j]);
     if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)bad.push(children[i].className+' overlaps '+children[j].className);
    }
   }
   const track=bounds(document.querySelector('.road-track-frame'));
   if(innerWidth>=1000&&getComputedStyle(document.querySelector('.road-sidebar')).display==='none')bad.push('desktop sidebar missing');
   if(innerWidth>=1000&&track.width/track.height>1.2)bad.push('desktop track stretched');
   if(innerWidth<1000&&innerWidth>innerHeight&&innerHeight<=650&&track.height<innerHeight*.45)bad.push('landscape track collapsed');
   return bad;
  });
  assert.deepEqual(details,[],label+' nested panels');
 }

}
async function waitPhase(phase){await page.waitForFunction(phase=>document.querySelector('.road-play-page')?.getAttribute('data-phase')===phase,phase,{timeout:10000});}
async function forcePhase(setup){await page.evaluate(async setup=>{const loaded=performance.getEntriesByType('resource').map(e=>e.name).filter(name=>name.includes('/src/roadfighter/engine.ts'));const moduleUrl=loaded.find(name=>name.includes('?t='))||loaded[0]||'/src/roadfighter/engine.ts';const {RoadEngine}=await import(moduleUrl);const original=RoadEngine.prototype.step;RoadEngine.prototype.step=function(dt){if(setup==='gameover')this.fuel=0;else{this.phase='running';this.stage=2;this.distance=11999.99;this.speed=200;this.shield=2;}original.call(this,dt);RoadEngine.prototype.step=original;};},setup);}
try{
 await page.goto(url+'/games');await page.getByRole('heading',{name:'เลือกเกมของคุณ',exact:true}).waitFor();
 assert.equal(await page.getByRole('tab').count(),4);assert.equal(await page.locator('.game-option').count(),8);
 for(const [name,count]of [['อาร์เคด',1],['เกมไพ่',4],['ปาร์ตี้',3],['ทั้งหมด',8]]){await page.getByRole('tab',{name,exact:true}).click();assert.equal(await page.locator('.game-option').count(),count);assert.equal(await page.getByRole('tab',{name,exact:true}).getAttribute('aria-selected'),'true');}
 await page.getByRole('tab',{name:'อาร์เคด',exact:true}).click();await page.reload();assert.equal(await page.locator('.game-option').count(),1);await page.getByRole('tab',{name:'อาร์เคด',exact:true}).focus();await page.keyboard.press('End');assert.equal(await page.getByRole('tab',{name:'ปาร์ตี้',exact:true}).getAttribute('aria-selected'),'true');await page.keyboard.press('Home');assert.equal(await page.locator('.game-option').count(),8);
 for(const [width,height]of sizes){await page.setViewportSize({width,height});await fits('menu '+width+'x'+height);
  const layout=await page.evaluate(()=>{
   const cards=[...document.querySelectorAll('.game-option')],grid=document.querySelector('.game-options');
   const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
   const bad=cards.flatMap(card=>{
    const r=card.getBoundingClientRect(),art=card.querySelector('.menu-card-art').getBoundingClientRect(),copy=card.querySelector('.menu-card-copy'),heading=card.querySelector('h2');
    const children=[...copy.querySelectorAll('.menu-genre,h2,p,.player-count-pill,.menu-start-cta')];
    return children.some(e=>{const c=e.getBoundingClientRect();return c.left<r.left-1||c.right>r.right+1||c.bottom>r.bottom+1||e.scrollWidth>e.clientWidth+1;})||copy.scrollHeight>copy.clientHeight+1||art.width<1||art.height<1||heading.clientHeight<1?[card.dataset.game]:[];
   });
   return {columns,bad,horizontal:innerWidth>=1200?cards.every(e=>{const art=e.querySelector('.menu-card-art').getBoundingClientRect(),copy=e.querySelector('.menu-card-copy').getBoundingClientRect();return art.right<=copy.left+1;}):true};
  });
  assert.deepEqual(layout,{columns:width<=600?1:2,bad:[],horizontal:true},'catalogue grid '+width+'x'+height);
 if([390,768,1366].includes(width))await page.screenshot({path:previewPath('road-menu-'+width+'x'+height+'.png'),fullPage:true});}
 const catalogue=await page.locator('.game-option').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),cta=e.querySelector('.menu-start-cta').getBoundingClientRect();return {ctaFits:cta.left>=r.left&&cta.right<=r.right+1&&cta.bottom<=r.bottom+1,description:!!e.querySelector('p'),button:!!e.querySelector('.menu-start-cta')};}));
 assert.ok(catalogue.every(e=>e.ctaFits&&e.description&&e.button),'every game has a visible description and start action');
 await page.getByRole('button',{name:'ตั้งค่า',exact:true}).click();await page.getByRole('switch',{name:'เสียงเกมอาร์เคด',exact:true}).click();await page.getByRole('button',{name:'เรียบร้อย',exact:true}).click();
 await page.getByRole('button',{name:'เลือก Road Fighter',exact:true}).click();await page.getByRole('heading',{name:'ROAD FIGHTER',exact:true}).waitFor();await page.getByLabel('ชื่อผู้เล่น',{exact:true}).fill('Yee');await page.getByRole('radio',{name:'ปกติ',exact:true}).check();
 for(const [width,height]of sizes){await page.setViewportSize({width,height});await fits('start '+width+'x'+height);if([390,768,1366].includes(width))await page.screenshot({path:previewPath('road-start-'+width+'x'+height+'.png'),fullPage:true});}
 for(const [width,height]of [[1274,590],[1024,768],[1911,885]]){
  await page.setViewportSize({width,height});
  const toggle=page.getByRole('switch',{name:'เสียงเกม',exact:true}),previous=await toggle.getAttribute('aria-checked');
  await toggle.scrollIntoViewIfNeeded();
  assert.equal(await toggle.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'setup toggle is not covered '+width+'x'+height);
  await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),previous==='true'?'false':'true');
  await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),previous);
 }
 await page.setViewportSize({width:1366,height:768});await page.getByRole('button',{name:'เริ่มแข่ง',exact:true}).click();await waitPhase('countdown');assert.equal(await page.locator('.road-title').count(),0);await waitPhase('running');
 await page.keyboard.down('KeyW');await page.waitForTimeout(1100);await page.keyboard.up('KeyW');assert.ok(Number(await page.getByRole('meter',{name:'ความเร็ว',exact:true}).getAttribute('aria-valuenow'))>30);
 const beforeX=Number(await page.locator('.road-play-page').getAttribute('data-player-x'));await page.keyboard.down('KeyA');await page.waitForTimeout(350);await page.keyboard.up('KeyA');assert.ok(Number(await page.locator('.road-play-page').getAttribute('data-player-x'))<beforeX);
 await page.locator('.arcade-header').getByRole('button',{name:'พักเกม',exact:true}).click();await waitPhase('paused');const paused=await page.getByTestId('road-score').textContent();await page.waitForTimeout(350);assert.equal(await page.getByTestId('road-score').textContent(),paused);
 await page.locator('.road-overlay-card').getByRole('button',{name:'เล่นต่อ',exact:true}).click();await waitPhase('running');await page.locator('.arcade-header').getByRole('button',{name:'วิธีเล่น',exact:true}).click();await page.locator('dialog:modal').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog:modal').count(),0);await waitPhase('paused');await page.keyboard.press('Space');await waitPhase('running');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await waitPhase('paused');
 for(const [width,height]of sizes){await page.setViewportSize({width,height});await fits('play '+width+'x'+height,true);if([390,768,1366].includes(width))await page.screenshot({path:previewPath('road-play-'+width+'x'+height+'.png'),fullPage:true});}
 await page.setViewportSize({width:390,height:844});await page.locator('.road-overlay-card').getByRole('button',{name:'เล่นต่อ',exact:true}).click();await waitPhase('running');
 const accel=await page.getByRole('button',{name:'เร่งความเร็ว',exact:true}).boundingBox(),left=await page.getByRole('button',{name:'เลี้ยวซ้าย',exact:true}).boundingBox();const cdp=await context.newCDPSession(page);const touch=(r,id)=>({x:r.x+r.width/2,y:r.y+r.height/2,id});
 const startX=Number(await page.locator('.road-play-page').getAttribute('data-player-x'));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(accel,1),touch(left,2)]});await page.waitForTimeout(450);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(Number(await page.locator('.road-play-page').getAttribute('data-player-x'))<startX);await cdp.detach();
 await forcePhase('gameover');await waitPhase('gameover');await page.getByRole('heading',{name:'น้ำมันหมด',exact:true}).waitFor();assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('wongsian.roadfighter.records.v1')).score)>0);await page.locator('.road-overlay-card').getByRole('button',{name:'เล่นใหม่',exact:true}).click();await waitPhase('countdown');assert.equal(await page.getByTestId('road-score').textContent(),'000,000');await waitPhase('running');await forcePhase('finished');await waitPhase('finished');await page.getByRole('heading',{name:'เข้าเส้นชัยแล้ว!',exact:true}).waitFor();await page.screenshot({path:previewPath('road-finished-390x844.png')});
 await page.locator('.road-overlay-card').getByRole('button',{name:'กลับหน้าเริ่มเกม',exact:true}).click();assert.equal(await page.getByLabel('ชื่อผู้เล่น',{exact:true}).inputValue(),'Yee');await page.reload();assert.equal(await page.getByLabel('ชื่อผู้เล่น',{exact:true}).inputValue(),'Yee');await page.getByRole('button',{name:'เลือกเกมอื่น',exact:true}).click();await page.locator('.game-options').waitFor();await page.getByRole('button',{name:'เลือกป๊อกเด้ง',exact:true}).click();await page.getByLabel('ชื่อของคุณ').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: four real filters, browser history/reload, setup, keyboard and multi-touch driving, pause/help/blur, restart/end/win records, old-game navigation and responsive layout at '+sizes.length+' sizes.');
}catch(error){console.error(errors);await page.screenshot({path:previewPath('road-browser-debug.png'),fullPage:true});throw error;}finally{await browser.close();}
