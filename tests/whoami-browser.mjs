import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {previewPath} from './helpers/preview-path.mjs';
const url=process.env.GAME_URL||'http://127.0.0.1:5188';
const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];
const sizes=[[1920,1080],[1366,768],[1024,768],[768,1024],[390,844],[375,667],[320,568],[320,480],[844,390],[667,375],[568,320]];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){const end=Date.now()+15000;while(!await fn()){if(Date.now()>end)throw new Error('Who am I browser timeout');await pause(50);}}
async function fit(page,label,selectors,allowPageScroll=false){const report=await page.evaluate(selectors=>({overflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,bad:[...document.querySelectorAll(selectors)].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.x< -1||r.y< -1||r.right>innerWidth+1||r.bottom>innerHeight+1);}).map(e=>e.className)}),selectors);assert.deepEqual(report.bad,[],label+' '+JSON.stringify(report));if(!allowPageScroll)assert.equal(report.overflow,false,label+' page overflow');}
async function select(page,label,text){await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name:text,exact:true}).click();}
async function guess(page,word){await page.getByRole('button',{name:'ขอทายคำตอบ',exact:true}).click();await page.getByLabel('คำตอบของคุณ',{exact:true}).fill(word);await page.getByRole('button',{name:'ยืนยันคำตอบ',exact:true}).click();await page.getByRole('dialog',{name:'ทายตัวตนของคุณ'}).waitFor({state:'hidden'});}
const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(url+'/games');await page.getByRole('button',{name:'เลือก Who am I →',exact:true}).click();await page.getByLabel('ชื่อของคุณ').fill('Alpha');
 for(const [label,values] of [['รอบการถาม',['4 รอบ','6 รอบ','8 รอบ','10 รอบ']],['รอบการเล่นเกม',['3 รอบ','5 รอบ','7 รอบ','10 รอบ']]]){
  await page.getByRole('combobox',{name:label}).click();assert.deepEqual(await page.getByRole('listbox',{name:label}).getByRole('option').allTextContents(),values);await page.keyboard.press('Escape');
 }
 await select(page,'รอบการถาม','6 รอบ');await select(page,'รอบการเล่นเกม','5 รอบ');
 for(const[width,height]of sizes){await page.setViewportSize({width,height});await pause(40);assert.match(await page.getByRole('combobox',{name:'รอบการถาม'}).textContent(),/6 รอบ/);assert.match(await page.getByRole('combobox',{name:'รอบการเล่นเกม'}).textContent(),/5 รอบ/);await fit(page,`create ${width}x${height}`,'.who-entry-navigation,.who-entry input,.who-settings .spy-select-trigger,.who-entry .primary',true);await page.screenshot({path:previewPath(`preview-whoami-create-${width}x${height}.png`)});}
 await page.setViewportSize({width:1366,height:768});await select(page,'รอบการถาม','4 รอบ');await select(page,'รอบการเล่นเกม','3 รอบ');
 if(!process.env.GAME_URL){
  for(const phase of ['LOBBY','PLAYING','ANSWERING','GAME_END','RESULTS']){
   await page.evaluate(async phase=>{const{whoAmISession}=await import('/src/session.ts'),{navigate}=await import('/src/router.ts');const players=Array.from({length:8},(_,seat)=>({id:'p'+seat,name:seat?'ผู้เล่น '+seat:'Alpha',seat,connected:true,ready:true,score:seat%3,solved:false}));const question={id:1,turnNumber:1,playerId:'p1',name:'ผู้เล่น 1',text:'ฉันเป็นสิ่งมีชีวิตที่อาศัยอยู่ในบ้านใช่ไหม?',answer:null,counts:null,respondedIds:[]};const identities=players.map(p=>({playerId:p.id,name:p.name,word:p.seat%2?'นักบิน':'แมว',icon:p.seat%2?'✈️':'🐱',solved:false,score:p.score}));whoAmISession.update({status:'connected',playerId:'p0',error:'',whoAmI:{roundId:201,turnNumber:1,identities:identities.filter(p=>p.playerId!=='p0'),ownAnswer:null},snapshot:{game:'whoami',code:'ABCDEF0123',phase:phase==='ANSWERING'?'PLAYING':phase,roundId:201,hostId:'p0',category:'mixed',turnMinutes:1,questionRounds:4,gameRounds:3,gameNumber:phase==='RESULTS'?3:1,questionRound:1,turnId:phase==='ANSWERING'?'p1':'p0',turnNumber:1,deadline:phase==='PLAYING'||phase==='ANSWERING'?Date.now()+60000:0,turnDurationMs:60000,players,question:phase==='ANSWERING'?question:null,history:[{...question,answer:'yes',counts:{yes:7,no:0,unknown:0},respondedIds:players.slice(1).map(p=>p.id)}],lastGuess:null,result:phase==='GAME_END'||phase==='RESULTS'?{gameNumber:1,reason:'round_limit',identities}:null}});navigate('/whoami/play/ABCDEF0123');},phase);
   await page.locator('.who-dashboard').waitFor();
   for(const[width,height]of sizes){await page.setViewportSize({width,height});await pause(40);await fit(page,`${phase} ${width}x${height}`,'.room-bar,.who-status,.who-panel,.who-history-shortcut,.who-compose,.who-answer-actions');if([1366,390,320,844,568].includes(width))await page.screenshot({path:previewPath(`preview-whoami-${phase}-${width}x${height}.png`)});}
   if(phase==='PLAYING'){
    for(const[width,height]of [[390,844],[568,320]]){await page.setViewportSize({width,height});await page.getByRole('button',{name:'ขอทายคำตอบ',exact:true}).click();await page.getByLabel('คำตอบของคุณ',{exact:true}).fill('draft survives resize');await page.setViewportSize({width:height,height:width});assert.equal(await page.getByLabel('คำตอบของคุณ',{exact:true}).inputValue(),'draft survives resize');await page.keyboard.press('Escape');}
   }
  }
 }
 await context.close();
 const contexts=await Promise.all([[1366,768],[375,667],[568,320]].map(async([width,height])=>browser.newContext({viewport:{width,height}})));
 const pages=await Promise.all(contexts.map(c=>c.newPage())),[a,b,c]=pages;for(const p of pages)p.on('pageerror',error=>errors.push(error.message));
 await a.goto(url+'/whoami/rooms/create');await a.getByLabel('ชื่อของคุณ').fill('Alpha');await a.getByRole('button',{name:'สร้างห้อง Who am I →',exact:true}).click();await a.locator('.who-room-code').waitFor();const code=await a.locator('.who-room-code').textContent();
 for(const[p,name]of [[b,'Beta'],[c,'Gamma']]){await p.goto(url+'/whoami/rooms/join?code='+code);await p.getByLabel('ชื่อของคุณ').fill(name);await p.getByRole('button',{name:'เข้าห้อง Who am I →',exact:true}).click();await p.locator('.who-dashboard').waitFor();await p.getByRole('button',{name:'พร้อมเล่น',exact:true}).click();}
 await until(()=>a.getByRole('button',{name:'เริ่มเกม',exact:true}).isEnabled());await a.getByRole('button',{name:'เริ่มเกม',exact:true}).click();await a.locator('.who-turn-title').waitFor();
 for(let game=1;game<=3;game++){
  const words=[];for(let i=0;i<3;i++){const other=pages[(i+1)%3];words.push(await other.locator('.who-roster .who-player').filter({hasText:['Alpha','Beta','Gamma'][i]}).locator('.who-player-word').textContent());}
  for(let i=0;i<3;i++){assert.equal((await pages[i].locator('.who-mystery').textContent()).includes(words[i]),false);assert.equal((await pages[i].locator('body').textContent()).includes(words[i]),false);}
  if(game===1){
   await a.getByLabel('คำถามของคุณ',{exact:true}).fill('ฉันเป็นสิ่งมีชีวิตใช่ไหม?');await a.getByRole('button',{name:'ส่งคำถาม',exact:true}).click();await b.getByRole('button',{name:'ใช่',exact:true}).click();await b.reload();await until(()=>b.getByRole('button',{name:'ใช่',exact:true}).isDisabled());await c.getByRole('button',{name:'ใช่',exact:true}).click();await until(()=>a.locator('.who-question .who-answer-badge.yes').isVisible());assert.equal(await a.getByRole('button',{name:'ขอทายคำตอบ',exact:true}).isDisabled(),true);await a.getByRole('button',{name:'จบตา',exact:true}).click();
   await until(()=>b.getByRole('button',{name:'ขอทายคำตอบ',exact:true}).isEnabled());await guess(b,words[1]);await until(()=>c.getByRole('button',{name:'ขอทายคำตอบ',exact:true}).isEnabled());await guess(c,words[2]);await until(()=>a.getByRole('button',{name:'ขอทายคำตอบ',exact:true}).isEnabled());await guess(a,words[0]);
  }else for(let i=0;i<3;i++){await until(()=>pages[i].getByRole('button',{name:'ขอทายคำตอบ',exact:true}).isEnabled());await guess(pages[i],words[i]);}
  await a.locator('.who-results').waitFor();assert.equal(await a.locator('.who-reveals article').count(),3);if(game<3){await a.getByRole('button',{name:'เริ่มเกมถัดไป →',exact:true}).click();await a.locator('.who-turn-title').waitFor();}else assert.match(await a.locator('.who-results').textContent(),/ผู้ชนะ: Alpha, Beta, Gamma/);
 }
 await a.getByRole('button',{name:'เตรียมเล่นชุดใหม่',exact:true}).click();await a.getByRole('button',{name:'เริ่มเกม',exact:true}).waitFor();await a.getByRole('button',{name:'กติกา',exact:true}).click();assert.equal(await a.getByRole('dialog').locator('details').getAttribute('open')!==null,true);await a.keyboard.press('Escape');
 for(const p of [c,b,a]){await p.getByRole('button',{name:'ออกจากห้อง',exact:true}).click();await p.locator('.who-entry').waitFor();}
 for(const c of contexts)await c.close();assert.deepEqual(errors,[]);
 console.log(process.env.GAME_URL ? 'PASS: Who am I production settings at 11 create viewports, three real players, private words, answer lock/reconnect, next-turn guesses, 3-game scores and exit' : 'PASS: Who am I settings, 11 viewport layouts in all phases, modal/resize, three real players, private words, answer lock/reconnect, next-turn guesses, 3-game scores and exit');
}catch(error){if(!page.isClosed())await page.screenshot({path:previewPath('preview-whoami-debug.png'),fullPage:true});throw error;}finally{await browser.close()}
