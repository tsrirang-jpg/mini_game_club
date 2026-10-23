import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {previewPath} from './helpers/preview-path.mjs';
const url=process.env.GAME_URL||'http://127.0.0.1:5188';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const sizes=[[1920,1080],[1366,768],[1024,768],[768,1024],[390,844],[375,667],[320,568],[320,480],[844,390],[667,375],[568,320]];
const pause=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function fixture({count=6,own=true,long=false,phase='DESCRIBE'}={}){
 await page.evaluate(async({count,own,long,phase})=>{
  const{underSession}=await import('/src/session.ts'),{navigate}=await import('/src/router.ts');
  const names=['GGG','hhhh','มะนาว','ต้นกล้า','ใบเตย','นนท์','เมย์','บาส'],clues=['ดื่มตอนเช้า','มีกลิ่นหอม'];
  const players=Array.from({length:count},(_,seat)=>({id:'p'+seat,name:long?'ชื่อยาวทดสอบผู้เล่น'+seat:names[seat],seat,connected:true,alive:true,ready:true,isBot:false}));
  const snapshot={game:'undercover',code:'A96FBFBEA6',roundId:1,phase,hostId:'p0',players,turnMinutes:1,voteMinutes:1,undercoverCount:1,whiteCount:0,cycle:2,turnId:own?'p2':'p3',turnNumber:9,deadline:Date.now()+60000,acknowledgedIds:[],describedIds:['p0','p1'],submittedIds:[],eligibleIds:players.map(p=>p.id),runoff:false,hints:[...players.map((p,i)=>({id:i,playerId:p.id,name:p.name,cycle:1,text:'รอบก่อนหน้า '+i})),...clues.map((text,i)=>({id:20+i,playerId:'p'+i,name:names[i],cycle:2,text:long?'ทดสอบคำใบ้ยาว'.repeat(10):text}))],chat:[{id:1,playerId:'p0',name:names[0],text:'ขอถามเพิ่มนิดนึง',timestamp:Date.now()},{id:2,playerId:'p1',name:names[1],text:long?'แชทยาว'.repeat(80):'เจอบ่อยในชีวิตประจำวันไหม',timestamp:Date.now()}],lastVote:null,guesserId:'',result:null};
  window.discussionActions=[];underSession.send=(type,value)=>window.discussionActions.push({type,value});
  underSession.update({status:'connected',playerId:'p2',error:'',undercover:{roundId:1,word:'กาแฟ',canGuess:false,vote:null},snapshot});navigate('/undercover/play/A96FBFBEA6');
 },{count,own,long,phase});await page.locator('.under-discussion').waitFor();await pause();
}
async function fits(label){
 const report=await page.evaluate(()=>{
  const selectors=['.under-game .room-bar','.under-discussion','.under-chat-toggle','.under-chat-sidebar','.under-chat-sheet','.under-chat-compose'];
  const outside=selectors.flatMap(s=>[...document.querySelectorAll(s)]).filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.top< -1||r.bottom>innerHeight+1||r.left< -1||r.right>innerWidth+1);}).map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON()}));
  return {outside,pageScroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,overflow:[...document.querySelectorAll('.under-discussion,.under-writing,.under-clue-grid,.under-clue-card,.under-chat-panel,.under-chat-message')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.className)};
 });assert.deepEqual(report,{outside:[],pageScroll:false,overflow:[]},label+' '+JSON.stringify(report));
}
try{
 await page.goto(url+'/undercover/rooms/create');
 for(const count of[3,6,8]){
  await fixture({count});
  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});await pause();await fits(`${count} ${width}x${height}`);
   assert.equal(await page.locator('.under-clue-card').count(),count);assert.equal(await page.locator('.under-clue-card.submitted').count(),2);
   assert.deepEqual(await page.locator('.under-clue-card').evaluateAll(cards=>cards.map(c=>c.dataset.playerId)),Array.from({length:count},(_,i)=>'p'+i));
   if(count===6&&width>=1000&&height>=900)assert.equal(await page.locator('.under-clue-grid').evaluate(e=>e.scrollHeight<=e.clientHeight+1),true,'all six clues visible on desktop '+width);
   if(width>=1000&&height>=651){assert.equal(await page.locator('.under-chat-sidebar').isVisible(),true);assert.equal(await page.getByLabel('ข้อความแชท',{exact:true}).count(),1);}
   else {await page.getByRole('button',{name:/แชทห้อง/}).click();await page.getByRole('dialog',{name:'แชทห้อง',exact:true}).waitFor();await fits('chat '+count+' '+width);assert.equal(await page.locator('.under-chat-log').count(),1);assert.ok((await page.getByRole('button',{name:'ส่งข้อความแชท',exact:true}).boundingBox()).height>=44);await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'แชทห้อง',exact:true}).waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:/แชทห้อง/}).evaluate(e=>document.activeElement===e),true);}
   if(count===6&&[1366,390,568].includes(width)){await page.getByLabel('คำใบ้ของคุณ',{exact:true}).fill('ใส่นมได้');await page.screenshot({path:previewPath(`preview-undercover-discussion-chat-${width}x${height}.png`)});if(width===390){await page.getByRole('button',{name:/แชทห้อง/}).click();await page.screenshot({path:previewPath('preview-undercover-discussion-chat-mobile-sheet.png')});await page.keyboard.press('Escape');}}
  }
 }
 await page.setViewportSize({width:1366,height:768});await fixture();
 assert.equal(await page.locator('.under-word strong').textContent(),'กาแฟ');assert.equal(await page.locator('.under-word button').count(),0);
 await page.getByLabel('คำใบ้ของคุณ',{exact:true}).fill('ใส่นมได้');await page.getByRole('button',{name:'ส่งคำใบ้',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.discussionActions.at(-1)),{type:'hint',value:'ใส่นมได้'});assert.doesNotMatch(await page.locator('.under-clue-grid').textContent(),/ใส่นมได้|กาแฟ/);
 await page.getByLabel('ข้อความแชท',{exact:true}).fill('<b>คุยกัน</b>');await page.getByRole('button',{name:'ส่งข้อความแชท',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.discussionActions.at(-1)),{type:'chat',value:'<b>คุยกัน</b>'});
 await page.evaluate(async()=>{const{underSession}=await import('/src/session.ts'),s=underSession.getSnapshot().snapshot;underSession.update({snapshot:{...s,chat:[...s.chat,{id:3,playerId:'p2',name:'มะนาว',text:'<b>คุยกัน</b>',timestamp:Date.now()}]}});});await page.getByLabel('ข้อความแชท',{exact:true}).waitFor();assert.equal(await page.getByLabel('ข้อความแชท',{exact:true}).inputValue(),'');assert.equal(await page.locator('.under-chat-log b').count(),0);
 await page.getByLabel('ข้อความแชท',{exact:true}).fill('เก็บข้อความเมื่อส่งไม่สำเร็จ');await page.getByRole('button',{name:'ส่งข้อความแชท',exact:true}).click();
 await page.evaluate(async()=>{const{underSession}=await import('/src/session.ts');underSession.update({error:'ส่งแชทเร็วเกินไป รอสักครู่'});});assert.equal(await page.getByLabel('ข้อความแชท',{exact:true}).inputValue(),'เก็บข้อความเมื่อส่งไม่สำเร็จ');assert.equal(await page.getByRole('button',{name:'ส่งข้อความแชท',exact:true}).isEnabled(),true);
 await page.evaluate(async()=>{const{underSession}=await import('/src/session.ts');underSession.update({status:'reconnecting',error:''});});assert.equal(await page.getByLabel('ข้อความแชท',{exact:true}).isDisabled(),true);await page.evaluate(async()=>{const{underSession}=await import('/src/session.ts');underSession.update({status:'connected'});});assert.equal(await page.getByLabel('ข้อความแชท',{exact:true}).inputValue(),'เก็บข้อความเมื่อส่งไม่สำเร็จ');
 // All past clues remain readable and switching rounds does not affect the turn.
 await page.getByRole('combobox',{name:'ดูคำใบ้รอบอื่น',exact:true}).click();await page.getByRole('option',{name:'รอบ 1',exact:true}).click();assert.equal(await page.locator('.under-clue-card.submitted').count(),6);assert.match(await page.locator('.under-clue-text').first().textContent(),/รอบก่อนหน้า/);
 await page.setViewportSize({width:390,height:844});await fixture({own:false});assert.equal(await page.getByLabel('คำใบ้ของคุณ',{exact:true}).count(),0);
 await page.evaluate(async()=>{const{underSession}=await import('/src/session.ts'),s=underSession.getSnapshot().snapshot;underSession.update({snapshot:{...s,chat:[...s.chat,{id:4,playerId:'p0',name:'GGG',text:'new message',timestamp:Date.now()}]}});});await page.getByLabel('1 ข้อความใหม่',{exact:true}).waitFor();await page.getByRole('button',{name:/แชทห้อง/}).click();await page.getByLabel('ข้อความแชท',{exact:true}).fill('draft stays');await page.keyboard.press('Escape');await page.getByRole('button',{name:/แชทห้อง/}).click();assert.equal(await page.getByLabel('ข้อความแชท',{exact:true}).inputValue(),'draft stays');
 // A phase transition closes chat before voting and never exposes the private word.
 await page.evaluate(async()=>{const{underSession}=await import('/src/session.ts'),s=underSession.getSnapshot().snapshot;underSession.update({snapshot:{...s,phase:'VOTING',turnId:'',turnNumber:10}});});await page.getByRole('dialog',{name:'ใครคือผู้ต้องสงสัย?',exact:true}).waitFor();assert.equal(await page.getByRole('dialog',{name:'แชทห้อง',exact:true}).count(),0);assert.equal(await page.locator('.under-word').count(),0);await page.evaluate(async()=>{const{underSession}=await import('/src/session.ts');underSession.leave();});
 for(const[width,height]of sizes){await page.setViewportSize({width,height});await fixture({count:8,long:true});await fits('long '+width);}
 assert.deepEqual(errors,[]);console.log('PASS discussion concept 01 + chat: 3/6/8 players at 11 sizes, private drafts, ordered grid, prior cycles, single chat panel, mobile focus/unread/drafts, send/ack and escaped text, voting privacy');
}catch(error){await page.screenshot({path:previewPath('preview-undercover-discussion-debug.png')});throw error;}finally{await browser.close();}
