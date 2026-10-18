import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {previewPath} from './helpers/preview-path.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const sizes=[[1920,1080],[1366,768],[1024,768],[768,1024],[390,844],[375,667],[320,568],[320,480],[844,390],[667,375],[568,320]];
const outcomes={citizens:['คนธรรมดาชนะ','citizen'],undercover:['Undercover ชนะ','undercover'],white_guess:['Mr. White ชนะ','white'],last_white:['Mr. White ชนะ','white'],not_enough_players:['จบรอบ',null]};
let round=0;
async function fixture(reason,count=3,{viewer='p0',host='p0',connected=true,long=false}={}){
 await page.evaluate(async({reason,count,viewer,host,connected,long,round})=>{
  const {underSession}=await import('/src/session.ts'),{navigate}=await import('/src/router.ts');
  const names=['Test2','GameNa','Meme'];
  const players=Array.from({length:count},(_,seat)=>({id:'p'+seat,name:long?'ชื่อผู้เล่นยาวทดสอบ'+seat:names[seat]??'เพื่อน '+seat,seat,connected:true,ready:false,alive:true,isBot:false}));
  const winnerIds=reason==='citizens'?players.filter(p=>p.id!=='p1').map(p=>p.id):reason==='not_enough_players'?[]:['p1'];
  const result={reason,winnerIds,words:players.map(p=>({playerId:p.id,name:p.name,word:p.id==='p1'?reason.includes('white')?null:'ห้างสรรพสินค้า':'ตลาด'})),answer:'ตลาด',guess:reason==='white_guess'?'ตลาด':null};
  const s={game:'undercover',code:'73270AACC5',roundId:round,phase:'RESULTS',hostId:host,players,turnMinutes:1,voteMinutes:1,undercoverCount:1,whiteCount:1,cycle:1,turnId:'',turnNumber:10,deadline:0,acknowledgedIds:[],describedIds:[],submittedIds:[],eligibleIds:[],runoff:false,hints:players.map((p,i)=>({id:i+1,playerId:p.id,name:p.name,cycle:1,text:'คำใบ้ของ '+p.name})),lastVote:{targetId:'p1',counts:{p1:count-1,p0:1},tied:false,role:reason.includes('white')?'white':'undercover'},guesserId:'',result};
  window.resultActions=[];underSession.send=(type,value)=>window.resultActions.push({type,value});
  underSession.update({status:connected?'connected':'reconnecting',playerId:viewer,error:'',snapshot:s,undercover:{roundId:round,word:viewer==='p1'?null:'ตลาด',canGuess:false,vote:null}});navigate('/undercover/play/73270AACC5');
 },{reason,count,viewer,host,connected,long,round:++round});
 await page.locator('.under-results h1').waitFor();
}
async function fits(label){
 const report=await page.evaluate(()=>{
  const selectors=['.under-results','.under-victory','.under-result-facts','.under-result-table-wrap','.under-result-actions','.under-result-buttons>button'];
  const clipped=[...document.querySelectorAll(selectors.join(','))].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left< -1||r.top< -1||r.right>innerWidth+1||r.bottom>innerHeight+1);}).map(e=>e.className);
  const overflow=[...document.querySelectorAll('.under-results,.under-result-facts,.under-result-table-wrap,.under-result-table')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className);
  const table=document.querySelector('.under-result-table-wrap').getBoundingClientRect(),actions=document.querySelector('.under-result-actions').getBoundingClientRect();
  return {clipped,overflow,pageScroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,overlap:table.bottom>actions.top+1,tableHeight:table.height,buttonSizes:[...document.querySelectorAll('.under-result-buttons button')].map(e=>e.getBoundingClientRect().height)};
 });
 assert.deepEqual(report.clipped,[],label+' clipped');assert.deepEqual(report.overflow,[],label+' overflow');assert.equal(report.pageScroll,false,label+' page scroll');assert.equal(report.overlap,false,label+' table/action overlap');assert.ok(report.tableHeight>=70,label+' table stays readable '+JSON.stringify(report));assert.ok(report.buttonSizes.every(h=>h>=44),label+' touch targets');
}
try{
 await page.goto('http://127.0.0.1:5188/undercover/rooms/create');
 for(const reason of ['citizens','undercover','white_guess'])for(const count of [3,8]){
  await fixture(reason,count);
  assert.equal(await page.locator('.under-results h1').textContent(),outcomes[reason][0]);
  assert.equal(await page.locator('.under-victory .under-role-portrait').getAttribute('class'),'under-role-portrait role-'+outcomes[reason][1]);
  assert.equal(await page.locator('.under-result-table tbody tr').count(),count);
  assert.equal(await page.locator('.under-result-status.won').count(),reason==='citizens'?count-1:1);
  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await fits(`${reason}/${count} ${width}x${height}`);
   if(count===3&&(width>=1000||height>=667)){assert.equal(await page.locator('.under-result-table-wrap').evaluate(e=>e.scrollHeight<=e.clientHeight+1),true,`${reason} all three rows fit ${width}x${height}`);}
   if(count===3&&[1366,390,568].includes(width))await page.screenshot({path:previewPath(`preview-undercover-results-01-${reason}-${width}x${height}.png`)});
  }
 }
 for(const reason of ['last_white','not_enough_players']){await fixture(reason);assert.equal(await page.locator('.under-results h1').textContent(),outcomes[reason][0]);assert.equal(await page.locator('.under-victory .under-role-portrait').count(),reason==='last_white'?1:0);await fits(reason);}
 await page.setViewportSize({width:320,height:480});await fixture('citizens',8,{long:true});await fits('eight long names narrow portrait');
 await page.locator('.under-result-table-wrap').evaluate(e=>e.scrollTop=e.scrollHeight);assert.equal(await page.locator('.under-result-table tbody tr').last().isVisible(),true);
 await page.getByRole('button',{name:'ดูสรุปรอบนี้',exact:true}).click();await page.getByRole('dialog',{name:'สรุปรอบนี้',exact:true}).waitFor();assert.equal(await page.locator('.under-summary-winner').textContent(),'คนธรรมดาชนะ');assert.equal(await page.locator('.under-round-summary .under-history article').count(),8);await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByRole('button',{name:'ดูสรุปรอบนี้',exact:true}).evaluate(e=>e===document.activeElement),true);
 await fixture('white_guess',3,{viewer:'p2'});assert.equal(await page.locator('.under-results h1').textContent(),'Mr. White ชนะ');assert.equal(await page.getByRole('button',{name:'กลับห้องรอ / เล่นอีกครั้ง',exact:true}).isDisabled(),true);await fits('non-host loser same faction result');
 await fixture('citizens',3,{connected:false});assert.equal(await page.getByRole('button',{name:'กลับห้องรอ / เล่นอีกครั้ง',exact:true}).isDisabled(),true);
 await fixture('citizens');await page.getByRole('button',{name:'กลับห้องรอ / เล่นอีกครั้ง',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.resultActions),[{type:'prepareRound',value:undefined}]);assert.deepEqual(errors,[]);
 console.log('PASS results concept 01: all factions and no-winner outcome; 3/8 players across 11 sizes; long names, scrolling, summary/focus, host/reconnect controls and correct replay action');
}catch(error){await page.screenshot({path:previewPath('preview-undercover-results-01-debug.png')});throw error;}finally{await browser.close();}
