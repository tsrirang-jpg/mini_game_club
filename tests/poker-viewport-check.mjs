import assert from 'node:assert/strict';
export async function checkPokerViewport(page, label) {
  const report = await page.evaluate(() => {
    const clipped = [];
    for (const element of document.querySelectorAll('.room-bar,.poker-seat,.community,.pot-display,.poker-self,.poker-action-dock,.poker-actions button,.raise-controls input,.pot-breakdown,.pot-entry')) {
      const r = element.getBoundingClientRect();
      if (r.width && r.height && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)) clipped.push(element.className);
    }
    const table = document.querySelector('.poker-table').getBoundingClientRect();
    const dock = document.querySelector('.poker-action-dock').getBoundingClientRect();
    const items = [...document.querySelectorAll('.poker-seat,.poker-center,.pot-breakdown')].map(e => {
      const r = e.getBoundingClientRect();
      return { element: e.className, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });
    const outside = items.filter(r => r.top < table.top - 1 || r.bottom > table.bottom + 1 || r.left < table.left - 1 || r.right > table.right + 1);
    const overlaps = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1 && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1) overlaps.push([a, b]);
    }
    const cutAmounts = [...document.querySelectorAll('.pot-entry strong')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent);
    const shell = document.querySelector('.poker-shell');
    return { clipped, outside, overlaps, cutAmounts, tableDockOverlap: table.bottom > dock.top, width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      shellOverflow: shell.scrollHeight > shell.clientHeight + 1, shellWidth: shell.clientWidth, scrollY, shellScroll: shell.scrollTop };
  });
  assert.deepEqual(report.clipped, [], label + ': viewport clipping ' + JSON.stringify(report));
  assert.deepEqual(report.outside, [], label + ': content outside table ' + JSON.stringify(report));
  assert.deepEqual(report.overlaps, [], label + ': overlapping content ' + JSON.stringify(report));
  assert.deepEqual(report.cutAmounts, [], label + ': pot amounts must fit');
  assert.equal(report.tableDockOverlap, false, label + ': table/actions overlap');
  assert.equal(report.shellOverflow, false, label + ': hidden overflow is not fitting');
  assert.ok(report.shellWidth <= 1280, label + ': desktop width cap');
  assert.ok(report.scrollWidth <= report.width && report.scrollHeight <= report.height, label + ': page scroll');
  assert.equal(report.scrollY + report.shellScroll, 0, label + ': scrolled to reach controls');
}
