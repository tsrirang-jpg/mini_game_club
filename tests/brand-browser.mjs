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
 for(const path of paths){
  await page.goto(url+path);await page.locator('.top .brand-logo').waitFor();await page.locator('.game-options,.entry').waitFor();assert.equal(await page.title(),'วงเซียน · Mini Game Club');assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'),'/images/brand/wong-sian-yinyang-04-v1.png');
  await page.waitForFunction(()=>document.querySelector('.brand-mark')?.naturalWidth>0);
  if(path==='/games'){assert.deepEqual(await page.locator('.artwork-oldmaid .card:not(.back)').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),['Q spades','Q hearts']);assert.deepEqual(await page.locator('.artwork-liar .card:not(.back)').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),['A clubs']);assert.equal(await page.locator('.artwork-liar .card.back').count(),2);assert.equal(await page.locator('.artwork-liar img').count(),0,'floating native cards have no rectangular photo');}
  for(const[width,height]of sizes){
   await page.setViewportSize({width,height});const logo=page.locator('.top .brand-logo');assert.equal(await logo.locator('.brand-name').textContent(),'วงเซียน');assert.equal(await logo.locator('.brand-descriptor').textContent(),'MINI GAME CLUB');assert.equal(await logo.locator('.brand-descriptor').isVisible(),true,'descriptor remains visible '+path+' '+width+'x'+height);
   const report=await page.locator('.top').evaluate(header=>{const box=e=>e.getBoundingClientRect(),mark=box(header.querySelector('.brand-mark')),name=box(header.querySelector('.brand-name')),copy=box(header.querySelector('.brand-copy')),tag=box(header.querySelector('.tag'));return{bad:[...header.querySelectorAll('.brand-logo,.brand-mark,.brand-name,.brand-descriptor,.tag')].filter(e=>{const r=box(e);return r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1;}).map(e=>e.className),overlap:copy.right>tag.left+1,nameRight:name.left>=mark.right,overflow:document.documentElement.scrollWidth>innerWidth+1};});assert.deepEqual(report,{bad:[],overlap:false,nameRight:true,overflow:false},path+' '+width+'x'+height);
   if(path==='/games'&&[1366,390,320,844].includes(width))await page.screenshot({path:previewPath(`preview-wong-sian-menu-${width}x${height}.png`),fullPage:true});
  }
 }
 await page.getByRole('link',{name:'วงเซียน · Mini Game Club',exact:true}).click();await page.locator('.game-options').waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: Wong Sian yin-yang 04 logo/name/descriptor/favicon, menu plus fourteen create/join routes at 11 viewports, unclipped right-side wordmark, no header overlap or horizontal overflow, home navigation');
}catch(error){await page.screenshot({path:previewPath('preview-wong-sian-brand-debug.png'),fullPage:true});throw error;}finally{await browser.close();}
