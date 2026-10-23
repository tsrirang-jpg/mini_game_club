import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {previewPath} from './helpers/preview-path.mjs';
const url=process.env.GAME_URL||'http://127.0.0.1:5188';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const sizes=[[1920,1080],[1366,768],[1024,768],[768,1024],[390,844],[375,667],[320,568],[320,480],[844,390],[667,375],[568,320]];
let round=10;
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function fixture(phase='DISCUSS',count=6,options={}){
 await page.evaluate(async({phase,count,round,options})=>{
  const {underSession}=await import('/src/session.ts'),{navigate}=await import('/src/router.ts');
  const names=['GGG','hhhh','มะนาว','ต้นกล้า','ใบเตย','นนท์','เมย์','บาส'],clues=['ดื่มตอนเช้า','มีกลิ่นหอม','ใส่นมได้','มีทั้งร้อนและเย็น','อยู่ในแก้ว','บางคนดื่มทุกวัน','หาซื้อได้ง่าย','มีหลายแบบ'];
  const players=names.slice(0,count).map((name,seat)=>({id:'p'+seat,name:options.long?'ชื่อผู้เล่นที่ยาวมาก'+seat:name,seat,connected:true,ready:true,alive:!(options.spectator&&seat===2),isBot:false}));
  const hints=players.map((p,i)=>({id:count+i,playerId:p.id,name:p.name,cycle:2,text:options.long?'ข้อความคำใบ้ยาว'.repeat(8):clues[i]}));
  const s={game:'undercover',code:'A96FBFBEA6',roundId:round,phase,hostId:'p0',players,turnMinutes:1,voteMinutes:1,undercoverCount:1,whiteCount:0,cycle:2,turnId:phase==='DESCRIBE'?'p2':'',turnNumber:12,deadline:phase==='DISCUSS'?0:Date.now()+60000,acknowledgedIds:[],describedIds:players.map(p=>p.id),voteReadyIds:options.ready?['p2']:count===6?['p0','p1','p3','p5']:[],submittedIds:options.confirmed?['p0','p1','p2']:phase==='VOTING'?['p0','p1']:[],eligibleIds:options.runoff?['p1','p4']:players.filter(p=>p.alive).map(p=>p.id),runoff:!!options.runoff,hints:[...players.map((p,i)=>({id:i,playerId:p.id,name:p.name,cycle:1,text:'OLD clue '+i})),...hints],chat:[{id:1,playerId:'p0',name:'GGG',text:'ขอคุยกันอีกนิดก่อนโหวต',timestamp:Date.now()}],lastVote:null,guesserId:'',result:null};
  window.votingActions=[];underSession.send=(type,value)=>window.votingActions.push({type,value});
  underSession.update({status:options.offline?'reconnecting':'connected',playerId:'p2',error:'',snapshot:s,undercover:{roundId:round,word:'กาแฟ',canGuess:false,vote:options.confirmed?{targetId:'p1'}:null}});navigate('/undercover/play/A96FBFBEA6');
 },{phase,count,round:++round,options});await page.locator('.under-game').waitFor();await settle();
}
async function fits(label){
 const r=await page.evaluate(()=>{
  const selectors=['.under-game .room-bar','.under-discussion','.under-ready-dock','.under-vote-dialog','.spy-voting-list','.spy-voting-footer','.spy-voting-confirm'];
  return {pageScroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,
   outside:selectors.flatMap(s=>[...document.querySelectorAll(s)]).filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.x< -1||r.right>innerWidth+1||r.y< -1||r.bottom>innerHeight+1);}).map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON()})),
   overflow:[...document.querySelectorAll('.under-ready-dock,.under-vote-dialog,.spy-voting-list,.spy-vote-option,.spy-voting-footer')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className)};
 });assert.deepEqual(r,{pageScroll:false,outside:[],overflow:[]},label+' '+JSON.stringify(r));
 for(const selector of['.under-ready-dock>button','.spy-voting-confirm'])if(await page.locator(selector).count()){const rect=await page.locator(selector).boundingBox();assert.ok(rect.height>=44,label+' touch target');assert.equal(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,label+' reachable action');}
}
try{
 await page.goto(url+'/undercover/rooms/create');
 for(const count of[3,6,8])for(const phase of['DISCUSS','VOTING']){
  await fixture(phase,count);
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});await settle();await fits(`${phase} ${count} players ${width}x${height}`);
   if(phase==='DISCUSS'){
    assert.equal(await page.locator('.under-word strong').textContent(),'กาแฟ');assert.equal(await page.locator('.under-word button').count(),0);assert.equal(await page.locator('.under-clue-grid').evaluate(e=>e.getBoundingClientRect().height>=70),true,'clue board stays visible '+width+'x'+height);assert.equal(await page.locator('.under-vote-dialog').count(),0);assert.equal(await page.locator('.under-compose').count(),0);assert.equal(await page.getByRole('button',{name:'พร้อมโหวต',exact:true}).isEnabled(),true);
    if(width>=1000&&height>=651)assert.equal(await page.getByLabel('ข้อความแชท',{exact:true}).isEnabled(),true);
   }else{
    assert.equal(await page.locator('.spy-vote-clue').count(),count);assert.equal(await page.locator('.spy-voting-list button').count(),count);assert.doesNotMatch(await page.locator('.under-vote-dialog').textContent(),/OLD clue|กาแฟ/);
    assert.equal(await page.locator('.spy-vote-option.own').isDisabled(),true);
    if(count===6&&height>=768)assert.equal(await page.locator('.spy-voting-list').evaluate(e=>e.scrollHeight<=e.clientHeight+1),true,'all six vote cards fit '+width+'x'+height);
    if(width<601&&height>width)assert.equal(await page.locator('.spy-voting-list').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1,'single column phone vote');
   }
   if(count===6&&phase==='VOTING')await page.getByRole('button',{name:'สงสัย ใบเตย',exact:true}).click();
   if(count===6&&[1366,390,568].includes(width))await page.screenshot({path:previewPath(`preview-undercover-ready-vote-01-${phase.toLowerCase()}-${width}x${height}.png`)});
  }
 }
 await fixture('DESCRIBE');assert.equal(await page.getByRole('button',{name:'รอคำใบ้ครบทุกคน',exact:true}).isDisabled(),true);
 await fixture('DISCUSS');await page.getByRole('button',{name:'พร้อมโหวต',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.votingActions),[{type:'readyVote',value:undefined}]);assert.equal(await page.getByRole('button',{name:'กำลังส่ง…',exact:true}).isDisabled(),true);
 await page.evaluate(async()=>{const{underSession}=await import('/src/session.ts'),s=underSession.getSnapshot().snapshot;underSession.update({snapshot:{...s,voteReadyIds:[...s.voteReadyIds,'p2']}});});await page.getByRole('button',{name:'พร้อมแล้ว',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'พร้อมแล้ว',exact:true}).isDisabled(),true);
 for(const options of[{offline:true},{spectator:true},{ready:true}]){await fixture('DISCUSS',6,options);assert.equal(await page.locator('.under-ready-dock>button').isDisabled(),true);}
 await page.setViewportSize({width:390,height:844});await fixture('DISCUSS');await page.locator('.under-chat-toggle').click();await page.getByRole('dialog',{name:'แชทห้อง',exact:true}).waitFor();assert.equal(await page.getByLabel('ข้อความแชท',{exact:true}).isEnabled(),true);await page.keyboard.press('Escape');
 await fixture('VOTING');await page.getByRole('button',{name:'สงสัย ใบเตย',exact:true}).click();assert.equal(await page.getByRole('button',{name:'สงสัย ใบเตย',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'ยืนยันโหวต',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.votingActions),[{type:'vote',value:{targetId:'p4'}}]);assert.equal(await page.getByRole('button',{name:'กำลังส่ง…',exact:true}).isDisabled(),true);
 await fixture('VOTING',6,{confirmed:true});assert.equal(await page.getByRole('button',{name:'✓ ยืนยันแล้ว',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'สงสัย hhhh',exact:true}).getAttribute('aria-pressed'),'true');
 await fixture('VOTING',6,{runoff:true});assert.equal(await page.getByRole('button',{name:'สงสัย GGG',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'สงสัย ใบเตย',exact:true}).isEnabled(),true);assert.equal(await page.locator('.spy-vote-clue').count(),6);
 for(const [width,height]of sizes){await page.setViewportSize({width,height});await fixture('VOTING',8,{long:true});await fits('long vote '+width);}
 assert.deepEqual(errors,[]);console.log('PASS ready/voting concept 01: 3/6/8 players at 11 sizes, ready gate/payload/locks/chat, dark clue cards/latest cycle/self restriction, confirmation/runoff/long text and reachable fixed actions');
}catch(error){await page.screenshot({path:previewPath('preview-undercover-ready-vote-debug.png')});throw error;}finally{await browser.close();}
