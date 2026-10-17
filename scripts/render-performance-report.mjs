import {readFile, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const directory = 'reports/performance';
const before = JSON.parse(await readFile(`${directory}/before.json`, 'utf8'));
const after = JSON.parse(await readFile(`${directory}/after.json`, 'utf8'));
const names = {menu:'Game menu', pok:'Pok Deng', poker:'Poker', spyfall:'Spyfall', oldmaid:'Old Maid'};
const gameKeys = Object.keys(names);
const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];
const fmt = (value, digits=1) => value.toLocaleString('en-US', {maximumFractionDigits:digits});
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const metrics = [
  {id:'js', title:'Cold JavaScript', unit:'kB', note:'Decoded response body; fresh context, before creating a room.', keys:gameKeys, value:(data,key)=>data.cold[key].medianJsBytes/1000},
  {id:'timers', title:'Idle timer callbacks', unit:'callbacks / 3 seconds', note:'Created lobby, no user input. Lower means fewer idle wakeups.', keys:gameKeys.slice(1), value:(data,key)=>data.idle[key].medianTimerCallbacks},
  {id:'sync', title:'Unnecessary peer snapshots', unit:'snapshots / 5 sync requests', note:'Second client requests sync; count snapshots sent to the first client.', keys:gameKeys.slice(1), value:(data,key)=>data.sync[key].medianPeerSnapshots},
  {id:'cache', title:'Warm hero image requests', unit:'network requests / reload', note:'Versioned hero image after a warm reload; cache hits transfer zero bytes.', keys:['poker','spyfall','oldmaid'], value:(data,key)=>median(data.warmImages[key].map(run=>run.networkRequests))},
  {id:'heap', title:'JavaScript heap after GC', unit:'MiB', note:'Single settled page after forced GC; this is not a long-term memory leak test.', keys:gameKeys, value:(data,key)=>data.cold[key].medianHeapBytes/1048576},
  {id:'cpu', title:'Idle script execution', unit:'ms / 3 seconds', note:'CDP ScriptDuration delta. Small local CPU samples are sensitive to noise.', keys:gameKeys.slice(1), value:(data,key)=>data.idle[key].medianScriptMs},
  {id:'requests', title:'Cold JavaScript requests', unit:'requests', note:'Code splitting reduces initial bytes but increases the number of smaller JS requests.', keys:gameKeys, value:(data,key)=>data.cold[key].medianJsRequests},
  {id:'cleanup', title:'Pending clipboard callbacks after exit', unit:'callbacks', note:'Pending 1,800 ms timeout 50 ms after exit. Temporary retention, not an unbounded leak.', keys:['pok'], value:data=>data.cleanup.medianPendingClipboardTimeouts}
].map(metric=>({...metric, rows:metric.keys.map(key=>({key,label:names[key],before:metric.value(before,key),after:metric.value(after,key)}))}));

function chart(metric, width=620, height=340) {
  const margin = {left:112, right:80, top:76, bottom:28};
  const plotWidth = width-margin.left-margin.right;
  const rowHeight = (height-margin.top-margin.bottom)/metric.rows.length;
  const max = Math.max(1,...metric.rows.flatMap(row=>[row.before,row.after]))*1.08;
  const x = value => margin.left+value/max*plotWidth;
  const bars = metric.rows.map((row,index)=>{
    const y=margin.top+index*rowHeight, bar=Math.min(16,(rowHeight-12)/2);
    return `<text x="${margin.left-12}" y="${y+bar+9}" text-anchor="end" font-size="13" fill="#334155">${escape(row.label)}</text>`+['before','after'].map((phase,p)=>{
      const value=row[phase], py=y+p*(bar+5), color=p?'#0b8b79':'#64748b';
      return `<g><title>${escape(row.label)} · ${phase}: ${fmt(value,3)} ${escape(metric.unit)}</title><rect x="${margin.left}" y="${py}" width="${Math.max(1,x(value)-margin.left)}" height="${bar}" rx="3" fill="${color}"/><text x="${x(value)+7}" y="${py+bar-2}" font-size="12" fill="${color}">${fmt(value,2)}</text></g>`;
    }).join('');
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escape(metric.title)}" viewBox="0 0 ${width} ${height}" style="font-family:Arial,sans-serif"><rect width="${width}" height="${height}" rx="16" fill="#fff"/><text x="24" y="30" font-size="19" font-weight="700" fill="#13283a">${escape(metric.title)}</text><text x="24" y="52" font-size="12" fill="#64748b">${escape(metric.unit)} · median of ${before.environment.samples} runs</text><path d="M${margin.left} ${margin.top-8}V${height-margin.bottom+3}" stroke="#e2e8f0"/>${bars}</svg>`;
}
const overviewPanels = metrics.slice(0,4).map((metric,index)=>`<g transform="translate(${24+(index%2)*636} ${148+Math.floor(index/2)*362})">${chart(metric)}</g>`).join('');
const overview = `<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="940" viewBox="0 0 1320 940"><rect width="1320" height="940" fill="#edf3f8"/><g font-family="Arial,sans-serif"><text x="36" y="48" font-size="28" font-weight="700" fill="#13283a">Wong Pai · measured performance comparison</text><text x="36" y="78" font-size="15" fill="#475569">Local production builds · Edge ${escape(after.environment.browser)} · ${after.environment.viewport} · ${after.environment.samples} samples per scenario</text><rect x="36" y="103" width="18" height="12" rx="3" fill="#64748b"/><text x="62" y="114" font-size="14" fill="#334155">Before</text><rect x="152" y="103" width="18" height="12" rx="3" fill="#0b8b79"/><text x="178" y="114" font-size="14" fill="#334155">After</text><text x="36" y="911" font-size="13" fill="#475569">Measured on ${escape(after.measuredAt.slice(0,10))}. Lower is better here. These are targeted scenarios, not a production capacity test.</text></g>${overviewPanels}</svg>`;
await writeFile(`${directory}/comparison.svg`, overview);

const tables = metrics.map(metric=>`<section id="${metric.id}"><h2>${escape(metric.title)}</h2><p>${escape(metric.note)}</p>${chart(metric)}<table><thead><tr><th>Screen / game</th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody>${metric.rows.map(row=>`<tr><td>${escape(row.label)}</td><td>${fmt(row.before,3)}</td><td>${fmt(row.after,3)}</td><td>${row.before ? fmt((row.after/row.before-1)*100,1)+'%' : '—'}</td></tr>`).join('')}</tbody></table><small>Unit: ${escape(metric.unit)}</small></section>`).join('');
const html=`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>วงไพ่ — Before / after performance</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf3f8;color:#13283a;font:16px/1.65 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:32px 24px}h1{line-height:1.3}h2{font-size:21px}a{color:#076c93}section,.intro,.interactive{background:white;padding:24px;border:1px solid #dae4ec;border-radius:16px;margin:22px 0}svg,img{width:100%;height:auto}section svg{max-height:360px}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{padding:9px;border-bottom:1px solid #e2e8f0;text-align:right}th:first-child,td:first-child{text-align:left}small,.muted{color:#526475}label{display:inline-block;margin:0 20px 12px 0}select{display:block;font:inherit;padding:8px 12px;border:1px solid #a5bac9;border-radius:8px;max-width:100%}.legend{display:flex;gap:20px}.legend span:before{content:'';display:inline-block;width:18px;height:12px;border-radius:3px;margin-right:8px;background:#64748b}.legend span+span:before{background:#0b8b79}#dynamic-table{overflow:auto}code{overflow-wrap:anywhere}details pre{white-space:pre-wrap;font-size:12px}nav{display:flex;gap:18px;flex-wrap:wrap}@media(max-width:600px){main{padding:18px 12px}section,.intro,.interactive{padding:16px}h1{font-size:26px}table{font-size:13px}}
</style><main><h1>วงไพ่ — ประสิทธิภาพก่อนและหลังปรับ</h1><p>ผลจาก production build บนเครื่องเดียวกัน วัด ${after.environment.samples} ครั้งต่อกรณีและใช้ค่ามัธยฐาน ข้อมูลดิบเก็บครบทุกครั้ง</p><nav><a href="comparison.png">ดาวน์โหลดกราฟ PNG</a><a href="comparison.svg">กราฟ SVG</a><a href="before.json">ข้อมูลก่อนปรับ</a><a href="after.json">ข้อมูลหลังปรับ</a></nav><div class="intro"><p>ปรับการโหลดเกมตามหน้าที่เปิด ใช้ component และวงจรจัดการทรัพยากรร่วมกัน หยุด clock เมื่อไม่มี deadline หรือซ่อนแท็บ และให้ sync ส่งข้อมูลกลับเฉพาะผู้ร้องขอ</p><p><strong>ขอบเขต:</strong> ไม่ได้วัด FPS, เวลาเปิดเว็บจริงบนเครือข่ายมือถือ หรือจำนวนผู้เล่นสูงสุดของ production ค่า heap หลัง GC เพียงครั้งเดียวไม่ยืนยันว่าไม่มี memory leak การแยก chunk ทำให้จำนวน request ของ JavaScript เพิ่มขึ้น แม้ขนาดที่ต้องโหลดเริ่มต้นลดลง</p><p class="muted">Before: <code>${escape(before.commit)}</code><br>After: <code>${escape(after.commit)}</code><br>Edge ${escape(after.environment.browser)} · Node ${escape(after.environment.node)} · ${escape(after.environment.platform)} · ${escape(after.environment.viewport)} · ${escape(after.measuredAt)}</p></div><img src="comparison.svg" alt="Before and after: JavaScript bytes, idle timers, peer snapshots and warm image requests"><div class="interactive"><h2>เลือกดูรายละเอียด</h2><div class="legend"><span>Before</span><span>After</span></div><p><label>ตัวชี้วัด<select id="metric">${metrics.map(metric=>`<option value="${metric.id}">${escape(metric.title)}</option>`).join('')}</select></label><label>หน้าจอ<select id="game"><option value="all">ทุกหน้าจอที่มีข้อมูล</option>${gameKeys.map(key=>`<option value="${key}">${names[key]}</option>`).join('')}</select></label></p><p id="description"></p><div id="dynamic-chart"></div><div id="dynamic-table"></div><p id="no-data" hidden>ไม่มีข้อมูลของหน้าจอนี้ในกรณีที่เลือก</p></div><details><summary>รายละเอียดตัวเลขทั้งหมด</summary>${tables}</details><section><h2>วิธีวัดและอ่านผล</h2><ul><li>Cold: browser context ใหม่ เปิดเมนูหรือฟอร์มก่อนสร้างห้อง วัด decoded JavaScript bytes และ heap หลัง forced GC</li><li>Idle: สร้างห้องจริง รอให้พร้อม แล้วนับ callback และ CDP ScriptDuration เป็นเวลา 3 วินาที</li><li>Sync: เชื่อมต่อ 2 คน ส่ง sync 5 ครั้ง ห่างกัน 100 ms และนับ snapshot ที่ผู้ร้องขอและเพื่อนร่วมห้องได้รับ</li><li>Warm image: โหลดภาพ hero สำเร็จแล้ว reload ใน context เดิม นับภาพที่ยังต้องติดต่อ network รวมการตรวจ 304</li><li>Cleanup: คัดลอกรหัสแล้วออกจากห้อง ตรวจ timeout 1,800 ms ที่ค้างหลังออก 50 ms ค่านี้หมายถึง callback ที่เก็บชั่วคราว ไม่ใช่หลักฐานของ heap ที่โตไม่สิ้นสุด</li><li>ไม่เปลี่ยน CSS และกติกาเกม ชุดทดสอบตรวจการ reconnect, private data, ผลแพ้ชนะ และหน้าจอครบทั้ง 4 เกม</li></ul><details><summary>ข้อมูลดิบทุก sample</summary><pre>${escape(JSON.stringify({before,after},null,2))}</pre></details></section></main><script>
const metrics=${JSON.stringify(metrics.map(({value,...metric})=>metric)).replace(/</g,'\\u003c')};
const charts=${JSON.stringify(Object.fromEntries(metrics.map(metric=>[metric.id,metric.rows.map(row=>({key:row.key,svg:chart({...metric,rows:[row]})}))]))).replace(/</g,'\\u003c')};
const allCharts=${JSON.stringify(Object.fromEntries(metrics.map(metric=>[metric.id,chart(metric)]))).replace(/</g,'\\u003c')};
function update(){const metric=metrics.find(item=>item.id===document.getElementById('metric').value),key=document.getElementById('game').value,rows=metric.rows.filter(row=>key==='all'||row.key===key);document.getElementById('description').textContent=metric.note+' Unit: '+metric.unit;document.getElementById('no-data').hidden=rows.length>0;document.getElementById('dynamic-chart').innerHTML=key==='all'?allCharts[metric.id]:(charts[metric.id].find(item=>item.key===key)?.svg||'');document.getElementById('dynamic-table').innerHTML=rows.length?'<table><thead><tr><th>Screen</th><th>Before</th><th>After</th></tr></thead><tbody>'+rows.map(row=>'<tr><td>'+row.label+'</td><td>'+row.before.toLocaleString('en-US',{maximumFractionDigits:3})+'</td><td>'+row.after.toLocaleString('en-US',{maximumFractionDigits:3})+'</td></tr>').join('')+'</tbody></table>':'';}
document.getElementById('metric').addEventListener('change',update);document.getElementById('game').addEventListener('change',update);update();
</script></html>`;
await writeFile(`${directory}/index.html`, html);
await writeFile(`${directory}/summary.json`, JSON.stringify(metrics.map(({value,...metric})=>metric),null,2)+'\n');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1320,height:940},deviceScaleFactor:1});
  await page.goto(pathToFileURL(resolve(`${directory}/comparison.svg`)).href);
  await page.screenshot({path:`${directory}/comparison.png`});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(resolve(`${directory}/index.html`)).href);
  await page.locator('#metric').selectOption('timers');
  await page.locator('#game').selectOption('poker');
  if(await page.locator('#dynamic-table tbody tr').count()!==1)throw new Error('Report game filter failed');
  await page.locator('#metric').selectOption('cache');await page.locator('#game').selectOption('menu');
  if(!await page.locator('#no-data').isVisible())throw new Error('Report missing-data filter failed');
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Generated comparison.svg/png, index.html, summary.json; interactive filters verified.');
} finally {await browser.close();}
