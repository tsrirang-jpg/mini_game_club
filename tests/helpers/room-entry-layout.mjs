import assert from 'node:assert/strict';

// Entry pages deliberately scroll vertically. Check real panels and controls,
// then hit-test each target after scrolling so missing selectors cannot pass.
export async function checkRoomEntryLayout(page, label) {
  await page.locator('.room-entry-grid').waitFor();
  for (const selector of ['.room-entry-art','.room-entry-art img','.room-entry-form','.room-entry-form form','.room-entry-facts','.room-entry-guide'])
    assert.equal(await page.locator(selector).count(),1,label+' has '+selector);
  const report=await page.evaluate(() => {
    const rect=node=>node.getBoundingClientRect();
    const inside=(a,b)=>a.left>=b.left-2&&a.right<=b.right+2&&a.top>=b.top-2&&a.bottom<=b.bottom+2;
    const panels=[...document.querySelectorAll('.room-entry-grid > section')],bad=[];
    for(const panel of panels){
      const r=rect(panel);
      if(r.width<80||r.height<40||r.left< -1||r.right>innerWidth+1)bad.push('panel clips/collapses '+panel.className);
    }
    for(let i=0;i<panels.length;i++)for(let j=i+1;j<panels.length;j++){
      const a=rect(panels[i]),b=rect(panels[j]);
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)
        bad.push('panels overlap '+panels[i].className+'/'+panels[j].className);
    }
    const form=rect(document.querySelector('.room-entry-form'));
    for(const control of document.querySelectorAll('.room-entry-form input,.room-entry-form button')){
      const r=rect(control);
      if(r.width&&r.height&&(!inside(r,form)||control.scrollWidth>control.clientWidth+2))
        bad.push('control clips '+(control.getAttribute('aria-label')||control.textContent));
    }
    return {panels:panels.length,horizontal:document.documentElement.scrollWidth>innerWidth+1,bad};
  });
  assert.deepEqual(report,{panels:4,horizontal:false,bad:[]},label+' '+JSON.stringify(report));
  const controls=page.locator('.room-entry-header button,.room-entry-form input,.room-entry-form button');
  assert.ok(await controls.count()>3,label+' includes actual controls');
  for(const control of await controls.all()){
    if(!await control.isVisible())continue;
    await control.scrollIntoViewIfNeeded();
    assert.equal(await control.evaluate(node=>{
      const r=node.getBoundingClientRect();
      return r.width>0&&r.height>0&&node.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
    }),true,label+' reachable '+(await control.getAttribute('aria-label')||await control.textContent()));
  }
}
