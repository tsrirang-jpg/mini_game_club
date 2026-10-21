import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {previewPath} from './helpers/preview-path.mjs';

const url=process.env.GAME_URL||'http://127.0.0.1:5188';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const sizes=[[1920,1080],[1366,768],[1024,768],[768,1024],[390,844],[375,667],[320,568],[320,480],[932,430],[844,390],[568,320]];
const paths=['/games',...['','/poker','/spyfall','/oldmaid','/whoami','/liar','/undercover'].flatMap(base=>[base+'/rooms/create',base+'/rooms/join'])];
try{
 const icon=await page.request.get(url+'/images/brand/wong-sian-yinyang-04-v1.png');assert.equal(icon.status(),200);assert.match(icon.headers()['content-type'],/image\/png/);
 for(const [action,path]of [
  ['เลือก Road Fighter','/road-fighter'],['เลือกป๊อกเด้ง','/rooms/create'],
  ['เลือก Poker','/poker/rooms/create'],['เลือก Spyfall','/spyfall/rooms/create'],
  ['เลือก Old Maid','/oldmaid/rooms/create'],['เลือก Who am I','/whoami/rooms/create'],
  ['เลือก Liar’s Card','/liar/rooms/create'],['เลือก Undercover','/undercover/rooms/create'],
 ]){
  await page.goto(url+'/games');await page.getByRole('button',{name:action,exact:true}).click();
  await page.waitForURL(url+path);
 }
 for(const path of paths){
  await page.goto(url+path);await page.locator('.top .brand-logo').waitFor();await page.locator('.game-options,.entry').waitFor();assert.equal(await page.title(),'วงเซียน · Mini Game Club');assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'),'/images/brand/wong-sian-yinyang-04-v1.png');
  await page.waitForFunction(()=>document.querySelector('.brand-mark')?.naturalWidth>0);
  if(path==='/games'){
   const images=page.locator('.menu-game-artwork');
   assert.equal(await images.count(),8,'all catalogue games use the matching pixel-art family');
   await images.evaluateAll(es=>Promise.all(es.map(async e=>{e.loading='eager';await e.decode();})));
   for(const game of ['roadfighter','pok','poker','spyfall','oldmaid','whoami','liar','undercover']){
    const art=page.locator('[data-game="'+game+'"] .menu-game-artwork');
    const file={poker:'poker-navy-v2.webp',liar:'liar-purple-gold-v3.webp',undercover:'undercover-charcoal-v2.webp'}[game]||game+'.webp';
    assert.equal(await art.getAttribute('src'),'/images/menu/pixel-scene-v1/'+file);
    assert.ok(await art.evaluate(e=>e.naturalWidth>0&&e.naturalHeight>0));
   }
   assert.equal(await page.locator('.brand-mark').evaluate(e=>getComputedStyle(e).filter),'none','original gold emblem is not grayscale');
   assert.equal(await page.locator('.brand-name').evaluate(e=>getComputedStyle(e).color),'rgb(239, 199, 88)');
  }
  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});const logo=page.locator('.top .brand-logo');assert.equal(await logo.locator('.brand-name').textContent(),'วงเซียน');assert.equal(await logo.locator('.brand-descriptor').textContent(),'MINI GAME CLUB');assert.equal(await logo.locator('.brand-descriptor').isVisible(),true,'descriptor remains visible '+path+' '+width+'x'+height);
   const report=await page.locator('.top').evaluate(header=>{const box=e=>e.getBoundingClientRect(),mark=box(header.querySelector('.brand-mark')),name=box(header.querySelector('.brand-name')),copy=box(header.querySelector('.brand-copy')),tag=box(header.querySelector('.tag'));return{bad:[...header.querySelectorAll('.brand-logo,.brand-mark,.brand-name,.brand-descriptor,.tag')].filter(e=>{const r=box(e);return r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1;}).map(e=>e.className),overlap:copy.right>tag.left+1,nameRight:name.left>=mark.right,overflow:document.documentElement.scrollWidth>innerWidth+1};});assert.deepEqual(report,{bad:[],overlap:false,nameRight:true,overflow:false},path+' '+width+'x'+height);
   if(path==='/games'&&[1366,390,320,844].includes(width))await page.screenshot({path:previewPath(`preview-wong-sian-menu-${width}x${height}.png`),fullPage:true});
  }
 }
 await page.getByRole('link',{name:'วงเซียน · Mini Game Club',exact:true}).click();await page.locator('.game-options').waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: Wong Sian yin-yang 04 logo/name/descriptor/favicon, menu plus fourteen create/join routes at 11 viewports, unclipped right-side wordmark, no header overlap or horizontal overflow, home navigation');
}catch(error){await page.screenshot({path:previewPath('preview-wong-sian-brand-debug.png'),fullPage:true});throw error;}finally{await browser.close();}
