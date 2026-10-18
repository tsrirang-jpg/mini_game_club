import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {previewPath} from './helpers/preview-path.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const sizes=[[1920,1080],[1366,768],[1024,768],[768,1024],[390,844],[375,667],[320,568],[320,480],[844,390],[667,375],[568,320]];
async function fixture(count=6,{viewer='p0',host='p0',waiting=true,connected=true,offline=false,long=false,undercoverCount=1,whiteCount=0}={}){
 await page.evaluate(async options=>{
  const{underSession}=await import('/src/session.ts'),{navigate}=await import('/src/router.ts');
  const {count,viewer,host,waiting,connected,offline,long,undercoverCount,whiteCount}=options;
  const names=['GGG','hhhh','มะนาว','ต้นกล้า','ใบเตย','นนท์','เมย์','บาส'];
  const players=Array.from({length:count},(_,seat)=>({id:'p'+seat,name:long?'ชื่อผู้เล่นยาวทดสอบ'+seat:names[seat],seat,connected:!(offline&&seat===count-1),ready:!(waiting&&seat===count-1),alive:true,isBot:false}));
  const s={game:'undercover',code:'A96FBFBEA6',roundId:0,phase:'LOBBY',hostId:host,players,turnMinutes:1,voteMinutes:1,undercoverCount,whiteCount,cycle:0,turnId:'',turnNumber:0,deadline:0,acknowledgedIds:[],describedIds:[],submittedIds:[],eligibleIds:[],runoff:false,hints:[],lastVote:null,guesserId:'',result:null};
  window.lobbyActions=[];underSession.send=(type,value)=>window.lobbyActions.push({type,value});
  underSession.update({status:connected?'connected':'reconnecting',playerId:viewer,error:'',snapshot:s,undercover:null});navigate('/undercover/play/A96FBFBEA6');
 },{count,viewer,host,waiting,connected,offline,long,undercoverCount,whiteCount});
 await page.locator('.under-lobby').waitFor();
}
async function fits(label){
 const report=await page.evaluate(()=>{
  const selectors=['.under-game .room-bar','.under-lobby','.under-lobby-content','.under-lobby-dock','.under-lobby-action'];
  const clipped=selectors.flatMap(selector=>[...document.querySelectorAll(selector)]).filter(e=>{const r=e.getBoundingClientRect();return r.top< -1||r.bottom>innerHeight+1||r.left< -1||r.right>innerWidth+1;}).map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON()}));
  const overflow=[...document.querySelectorAll('.under-lobby,.under-lobby-content,.under-lobby-players,.under-lobby-roster,.under-lobby-configuration,.under-lobby-player,.under-lobby-dock')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className);
  const content=document.querySelector('.under-lobby-content').getBoundingClientRect(),dock=document.querySelector('.under-lobby-dock').getBoundingClientRect(),button=document.querySelector('.under-lobby-action'),b=button.getBoundingClientRect();
  return {clipped,overflow,pageScroll:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,overlap:content.bottom>dock.top+1,reachable:button.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)),touch:b.height>=44};
 });
 assert.deepEqual(report.clipped,[],label+' clipped '+JSON.stringify(report));assert.deepEqual(report.overflow,[],label+' overflow');assert.equal(report.pageScroll,false,label+' page scroll');assert.equal(report.overlap,false,label+' overlap');assert.equal(report.reachable,true,label+' action reachable');assert.equal(report.touch,true,label+' touch target');
}
async function settle(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
try{
 await page.goto('http://127.0.0.1:5188/undercover/rooms/create');
 for(const count of [2,6,8]){
  await fixture(count);
  assert.equal(await page.locator('.under-lobby-player').count(),count);assert.equal(await page.locator('.under-lobby-empty').count(),8-count);
  assert.equal(await page.locator('.under-lobby-player.host').count(),1);assert.equal(await page.locator('.under-lobby .under-role-portrait,.under-lobby img').count(),0,'no role artwork');
  assert.equal(await page.locator('.under-lobby-player-status.ready').count(),count-1);
  assert.equal(await page.getByRole('button',{name:'เริ่มเกม',exact:true}).isDisabled(),true);
  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});await settle();await fits(`${count} players ${width}x${height}`);if(width>=1000&&height>=651)assert.equal(await page.locator('.under-lobby-configuration').evaluate(e=>e.scrollHeight<=e.clientHeight+1),true,'desktop settings/guide fit without clipping');
   if(count===6&&[1366,390,568].includes(width))await page.screenshot({path:previewPath(`preview-undercover-lobby-01-${width}x${height}.png`)});
  }
 }
 await page.setViewportSize({width:320,height:480});await fixture(8,{long:true});await fits('eight long names');
 // Time dropdowns retain every option and portal positioning when scrolled into view.
 for(const[width,height]of[[320,480],[568,320],[1366,768]]){
  await page.setViewportSize({width,height});await fixture();
  for(const label of ['เวลาพิมพ์ในรอบตัวเอง','เวลาโหวต']){
   await page.getByRole('combobox',{name:label,exact:true}).click();const list=page.getByRole('listbox',{name:label,exact:true});assert.deepEqual(await list.getByRole('option').allTextContents(),['1 นาที','2 นาที','3 นาที']);
   const box=await list.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'menu fits '+width+' '+label);
   await list.getByRole('option',{name:'3 นาที',exact:true}).click();assert.equal(await page.evaluate(()=>window.lobbyActions.at(-1).type),'setSettings');
  }
  await page.getByRole('button',{name:'เพิ่ม Mr. White',exact:true}).click();assert.equal(await page.evaluate(()=>window.lobbyActions.at(-1).value.whiteCount),1);await fits('after settings '+width);
 }
 await fixture(3,{waiting:false});assert.equal(await page.getByRole('button',{name:'เริ่มเกม',exact:true}).isEnabled(),true);await page.getByRole('button',{name:'เริ่มเกม',exact:true}).click();assert.equal(await page.evaluate(()=>window.lobbyActions.at(-1).type),'startRound');
 await fixture(3,{waiting:false,whiteCount:1});assert.equal(await page.getByRole('button',{name:'เริ่มเกม',exact:true}).isDisabled(),true);assert.match(await page.locator('.under-lobby-start-status').textContent(),/อย่างน้อย 4/);
 await fixture(6,{waiting:false,offline:true});assert.equal(await page.getByRole('button',{name:'เริ่มเกม',exact:true}).isDisabled(),true);assert.equal(await page.locator('.under-lobby-player-status.ready').count(),5);
 await fixture(6,{connected:false});assert.equal(await page.getByRole('button',{name:'เริ่มเกม',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('combobox',{name:'เวลาโหวต',exact:true}).isDisabled(),true);
 await fixture(6,{viewer:'p5'});assert.equal(await page.getByRole('combobox',{name:'เวลาโหวต',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.lobbyActions.at(-1)),{type:'setReady',value:true});
 await fixture(6,{viewer:'p5',waiting:false});await page.getByRole('button',{name:'ยกเลิกพร้อม',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.lobbyActions.at(-1)),{type:'setReady',value:false});
 await fixture(6,{viewer:'p5',host:'p5',waiting:false});assert.equal(await page.locator('.under-lobby-player.host .under-lobby-player-identity strong').textContent(),'นนท์');assert.equal(await page.getByRole('button',{name:'เริ่มเกม',exact:true}).isEnabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS lobby concept 01: 2/6/8 players at 11 sizes; empty seats, ready/host/offline state, long names, fixed reachable action dock, time dropdowns/stepper, role-dependent minimum and ready/start commands');
}catch(error){await page.screenshot({path:previewPath('preview-undercover-lobby-01-debug.png')});throw error;}finally{await browser.close();}
