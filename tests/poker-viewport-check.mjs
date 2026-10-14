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
    const potElement = document.querySelector('.pot-display'), pot = potElement.getBoundingClientRect();
    const board = document.querySelector('.community').getBoundingClientRect();
    const potAboveBoard = potElement.parentElement.classList.contains('poker-center') && pot.bottom <= board.top + 1;
    const desktopCards = innerWidth >= 1000 && innerHeight >= 760 ? {
      hole: Math.min(...[...document.querySelectorAll('.poker-seat .card')].map(e=>e.getBoundingClientRect().width)),
      board: document.querySelector('.community .card,.card-slot').getBoundingClientRect().width,
    } : null;
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
    const obscuredRanks = [];
    if (!document.querySelector('.poker-table.dealing')) for (const card of document.querySelectorAll('.poker-seat .card:not(.back)')) {
      const label = card.querySelector('span:not(.bottom)');
      const range = document.createRange(); range.selectNodeContents(label.firstChild);
      const r = range.getBoundingClientRect(), c = card.getBoundingClientRect();
      const hit = document.elementFromPoint((r.left+r.right)/2, (r.top+r.bottom)/2);
      if (!r.width || !r.height || r.left<c.left || r.right>c.right || r.top<c.top || r.bottom>c.bottom || !label.contains(hit)) obscuredRanks.push(card.getAttribute('aria-label'));
    }
    const shell = document.querySelector('.poker-shell');
    return { clipped, outside, overlaps, cutAmounts, obscuredRanks, potAboveBoard, desktopCards, tableDockOverlap: table.bottom > dock.top, width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      shellOverflow: shell.scrollHeight > shell.clientHeight + 1, shellWidth: shell.clientWidth, scrollY, shellScroll: shell.scrollTop };
  });
  assert.deepEqual(report.clipped, [], label + ': viewport clipping ' + JSON.stringify(report));
  assert.deepEqual(report.outside, [], label + ': content outside table ' + JSON.stringify(report));
  assert.deepEqual(report.overlaps, [], label + ': overlapping content ' + JSON.stringify(report));
  assert.deepEqual(report.cutAmounts, [], label + ': pot amounts must fit');
  assert.deepEqual(report.obscuredRanks, [], label + ': card ranks must fit and remain unobscured');
  assert.equal(report.potAboveBoard, true, label + ': total POT must be immediately above the board');
  if(report.desktopCards) {
    assert.ok(report.desktopCards.hole >= 60, label + ': desktop hole cards must be enlarged');
    assert.ok(report.desktopCards.board >= 76, label + ': desktop board cards must be enlarged');
  }
  assert.equal(report.tableDockOverlap, false, label + ': table/actions overlap');
  assert.equal(report.shellOverflow, false, label + ': hidden overflow is not fitting');
  assert.ok(report.shellWidth <= 1280, label + ': desktop width cap');
  assert.ok(report.scrollWidth <= report.width && report.scrollHeight <= report.height, label + ': page scroll');
  assert.equal(report.scrollY + report.shellScroll, 0, label + ': scrolled to reach controls');
}
