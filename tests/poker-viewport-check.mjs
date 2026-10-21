import assert from 'node:assert/strict';
export async function checkPokerViewport(page, label) {
  // Very short screens intentionally scroll, keeping controls at usable sizes.
  await page.evaluate(() => window.scrollTo(0, 0));
  // A viewport switch can reparent the local hand; inspect its settled geometry.
  await page.locator('.poker-table,.poker-self').evaluateAll(nodes => Promise.all(nodes.flatMap(node => [...node.querySelectorAll('.card')].flatMap(card => card.getAnimations().map(animation => animation.finished.catch(() => {}))))));
  const report = await page.evaluate(() => {
    const cleanRow = !!document.querySelector('.clean-row-desktop');
    const consoleBox = document.querySelector('.poker-console').getBoundingClientRect();
    const scrollLayout = !cleanRow && matchMedia('(orientation: portrait) and (max-width: 999px), (orientation: landscape) and (max-height: 380px)').matches;
    const clipped = [];
    for (const element of document.querySelectorAll('.room-bar,.poker-seat,.community,.pot-display,.poker-self,.poker-action-dock,.poker-actions button,.raise-controls input,.raise-summary,.show-cards-button,.pot-breakdown,.pot-entry,.pot-rail-details')) {
      const r = element.getBoundingClientRect();
      if (r.width && r.height && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || (!scrollLayout && r.bottom > innerHeight + 1))) clipped.push(element.className);
    }
    const table = document.querySelector('.poker-table').getBoundingClientRect();
    const dock = document.querySelector('.poker-action-dock').getBoundingClientRect();
    const dockClipped = [...document.querySelectorAll('.poker-action-dock .raise-summary,.poker-action-dock .turn-banner,.poker-action-dock .show-cards-button')].filter(element=>{const r=element.getBoundingClientRect();return r.width&&r.height&&(r.top<dock.top-1||r.bottom>dock.bottom+1||r.left<dock.left-1||r.right>dock.right+1);}).map(element=>element.className);
    let dockSpacing = null;
    if (document.querySelector('.poker-actions')) {
      const style = getComputedStyle(document.querySelector('.poker-action-dock'));
      const blocks = ['.poker-console-status', '.quick-actions', '.raise-panel']
        .map(selector => document.querySelector('.poker-action-dock ' + selector))
        .filter(Boolean).map(node => node.getBoundingClientRect()).filter(box => box.width && box.height);
      const buttons = [...document.querySelectorAll('.quick-actions button')].map(button => button.getBoundingClientRect());
      dockSpacing = {
        pads: ['Top', 'Right', 'Bottom', 'Left'].map(side => parseFloat(style['padding' + side])),
        top: Math.min(...blocks.map(box => box.top)) - dock.top,
        bottom: dock.bottom - Math.max(...blocks.map(box => box.bottom)),
        left: Math.min(...blocks.map(box => box.left)) - dock.left,
        right: dock.right - Math.max(...blocks.map(box => box.right)),
        buttonWidths: buttons.map(box => box.width), buttonHeights: buttons.map(box => box.height),
      };
    }
    const potElement = document.querySelector('.pot-display'), pot = potElement.getBoundingClientRect();
    const board = document.querySelector('.community').getBoundingClientRect();
    const track = document.querySelector('.street-track').getBoundingClientRect();
    const centerSpacing = { above: board.top - pot.bottom, below: track.top - board.bottom };
    const rail = document.querySelector('.pot-rail').getBoundingClientRect();
    const potAboveBoard = potElement.parentElement.classList.contains('poker-center') && pot.bottom <= board.top + 1;
    const desktopCards = document.querySelector('.card-size-high') && innerWidth >= 1000 && innerHeight >= 760 ? {
      hole: Math.min(...[...document.querySelectorAll('.poker-seat .card')].map(e=>e.getBoundingClientRect().width)),
      board: document.querySelector('.community .card,.card-slot').getBoundingClientRect().width,
    } : null;
    const mobileLandscape = !cleanRow && matchMedia('(orientation: landscape) and (max-height: 650px), (orientation: landscape) and (max-width: 999px) and (max-height: 740px)').matches;
    const desktopLayout = !mobileLandscape && matchMedia('(min-width: 1000px) and (min-height: 600px), (any-hover: hover) and (any-pointer: fine) and (min-width: 800px) and (min-height: 400px)').matches;
    const center = document.querySelector('.poker-center').getBoundingClientRect();
    const centerContentOutside = [pot, board, track].some(box => box.top < center.top - 1 || box.bottom > center.bottom + 1);
    const own = document.querySelector('.poker-self')?.getBoundingClientRect();
    const opponents = [...document.querySelectorAll('.poker-opponents > .poker-seat')].map(e => e.getBoundingClientRect());
    const opponentCenterOffset = opponents.length ? Math.abs((Math.min(...opponents.map(r=>r.left)) + Math.max(...opponents.map(r=>r.right)) - table.left - table.right)/2) : 0;
    const smallPortrait = matchMedia('(orientation: portrait) and (max-width: 375px) and (max-height: 720px) and (hover: none) and (pointer: coarse)').matches;
    const portraitLayout = smallPortrait ? {
      columns: getComputedStyle(document.querySelector('.poker-opponents')).gridTemplateColumns.split(' ').length,
      opponentsAboveBoard: opponents.every(r => r.bottom <= center.top + 1),
      ownBelowBoard: !own || (own.top >= center.bottom-1),
      boardBottomGap: table.bottom - center.bottom,
    } : null;
    const landscapeLayout = mobileLandscape ? {
      opponentRow: opponents.every(r => Math.abs(r.top - opponents[0].top) <= 1),
      opponentsAboveBoard: opponents.every(r => r.bottom <= center.top + 1),
      ownBesideBoard: !own || own.left >= center.right - 1,
      boardCardWidth: document.querySelector('.community .card,.card-slot').getBoundingClientRect().width,
    } : null;
    const centerOffset = desktopLayout ? { x: Math.abs((center.left+center.right-table.left-table.right)/2), y: Math.abs((center.top+center.bottom-table.top-table.bottom)/2) } : null;
    const ownBottom = desktopLayout && own && !cleanRow ? { x: Math.abs((own.left+own.right-table.left-table.right)/2), gap: table.bottom-own.bottom } : null;
    const items = [...document.querySelectorAll('.poker-seat,.poker-center,.pot-breakdown')].map(e => {
      const r = e.getBoundingClientRect();
      return { element: e.className, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });
    const outside = items.filter(r => {
      const box = cleanRow && r.element.split(/\s+/).includes('own') ? consoleBox : table;
      return r.top < box.top - 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1 || r.right > box.right + 1;
    });
    const overlaps = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1 && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1) overlaps.push([a, b]);
    }
    const cutAmounts = [...document.querySelectorAll('.pot-entry strong')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent);
    const obscuredResults = [];
    for (const seat of document.querySelectorAll('.poker-seat')) {
      const result = seat.querySelector('.result,.player-status');
      if (!result) continue;
      const line = result.getBoundingClientRect();
      const intersectsCard = [...seat.querySelectorAll('.hand .card')].some(card => {
        const box = card.getBoundingClientRect();
        return Math.min(line.bottom, box.bottom) - Math.max(line.top, box.top) > 1
          && Math.min(line.right, box.right) - Math.max(line.left, box.left) > 1;
      });
      if (intersectsCard) obscuredResults.push(seat.getAttribute('aria-label'));
    }
    const obscuredRanks = [];
    if (!document.querySelector('.poker-table.dealing')) for (const card of document.querySelectorAll('.poker-seat .card:not(.back)')) {
      const label = card.querySelector('span:not(.bottom)');
      const range = document.createRange(); range.selectNodeContents(label.firstChild);
      const r = range.getBoundingClientRect(), c = card.getBoundingClientRect();
      if (scrollLayout && (r.top < 0 || r.bottom > innerHeight)) continue;
      const hit = document.elementFromPoint((r.left+r.right)/2, (r.top+r.bottom)/2);
      if (!r.width || !r.height || r.left<c.left || r.right>c.right || r.top<c.top || r.bottom>c.bottom || !label.contains(hit)) obscuredRanks.push(card.getAttribute('aria-label'));
    }
    const shell = document.querySelector('.poker-shell');
    return { dockSpacing, centerSpacing, centerContentOutside, obscuredResults, railBelowBoard: rail.top >= center.bottom - 1, boardCenterOffset: Math.abs((board.left + board.right - table.left - table.right) / 2), cleanRow, dockClipped, opponentCenterOffset, consoleBox: {left:consoleBox.left,top:consoleBox.top}, ownBox: own ? {left:own.left,right:own.right,top:own.top,bottom:own.bottom}:null, dockBox:{left:dock.left,top:dock.top,bottom:dock.bottom}, opponentRow:opponents.every(r=>Math.abs(r.top-opponents[0].top)<=1), scrollLayout, clipped, outside, overlaps, cutAmounts, obscuredRanks, potAboveBoard, desktopCards, centerOffset, ownBottom, landscapeLayout, portraitLayout, tableDockOverlap: table.bottom > dock.top, width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      shellOverflow: shell.scrollHeight > shell.clientHeight + 1, shellWidth: shell.clientWidth, scrollY, shellScroll: shell.scrollTop };
  });
  if (report.dockSpacing) {
    const spacing = report.dockSpacing;
    assert.ok(Math.max(...spacing.pads) - Math.min(...spacing.pads) <= 1, label + ': equal padding on all four dock edges ' + JSON.stringify(spacing));
    assert.ok(Math.abs(spacing.top - spacing.bottom) <= 1 && Math.abs(spacing.left - spacing.right) <= 1, label + ': betting controls centered with symmetric free space ' + JSON.stringify(spacing));
    assert.ok(Math.max(...spacing.buttonWidths) - Math.min(...spacing.buttonWidths) <= 1 && Math.max(...spacing.buttonHeights) - Math.min(...spacing.buttonHeights) <= 1, label + ': Fold/Call/All-in buttons stay equal');
  }
  assert.ok(!report.centerContentOutside, label + ': POT, cards and progress stay inside their reserved stage');
  if (report.cleanRow) assert.ok(report.centerSpacing.above >= (report.height > 850 ? 14 : report.height > 650 ? 8 : 4) - .1, label + ': center spacing must remain spacious for this viewport');
  assert.ok(report.centerSpacing.above >= 0 && Math.abs(report.centerSpacing.above - report.centerSpacing.below) <= 1, label + ': symmetric center spacing ' + JSON.stringify(report.centerSpacing));
  assert.deepEqual(report.clipped, [], label + ': viewport clipping ' + JSON.stringify(report));
  assert.deepEqual(report.dockClipped, [], label + ': dock text must remain inside its panel');
  assert.deepEqual(report.outside, [], label + ': content outside table ' + JSON.stringify(report));
  assert.deepEqual(report.overlaps, [], label + ': overlapping content ' + JSON.stringify(report));
  assert.deepEqual(report.cutAmounts, [], label + ': pot amounts must fit');
  assert.deepEqual(report.obscuredResults, [], label + ': hole cards must not cover player status or result');
  assert.deepEqual(report.obscuredRanks, [], label + ': card ranks must fit and remain unobscured');
  assert.equal(report.railBelowBoard, true, label + ': pot rail must remain below the board');
  if (report.cleanRow) assert.ok(report.boardCenterOffset <= 1, label + ': community cards stay centered on the table');
  assert.equal(report.potAboveBoard, true, label + ': total POT must be immediately above the board');
  if(report.centerOffset) assert.ok(report.centerOffset.x<=1,label+': board/POT must be horizontally centered below opponents');
  if(report.ownBottom) assert.ok(report.ownBottom.x<=1&&report.ownBottom.gap<=24,label+': own hand must be at bottom center');
  if(report.landscapeLayout) {
    assert.equal(report.landscapeLayout.opponentRow, true, label + ': landscape opponents share the top row');
    assert.equal(report.landscapeLayout.opponentsAboveBoard, true, label + ': landscape board sits below opponents');
    assert.equal(report.landscapeLayout.ownBesideBoard, true, label + ': landscape own hand sits beside the board');
    if(report.width >= 740 && report.height >= 390) assert.ok(report.landscapeLayout.boardCardWidth >= 40, label + ': landscape board cards remain readable');
  }
  if(report.portraitLayout) {
    assert.equal(report.portraitLayout.columns, 3, label + ': small portrait opponents use three columns');
    assert.equal(report.portraitLayout.opponentsAboveBoard, true, label + ': small portrait board sits below opponents');
    assert.equal(report.portraitLayout.ownBelowBoard, true, label + ': portrait own hand sits below the board');
  }
  if(report.desktopCards) {
    assert.ok(report.desktopCards.hole >= (report.cleanRow ? 36 : 60), label + ': desktop hole cards must be enlarged');
    assert.ok(report.desktopCards.board >= (report.cleanRow ? 62 : 76), label + ': desktop board cards must be enlarged');
    if (report.cleanRow && report.width >= 1800 && report.height > 850) assert.ok(report.desktopCards.board >= 128, label + ': roomy desktop board cards must be visibly larger');
  }
  if (report.cleanRow || report.landscapeLayout) assert.ok(report.opponentCenterOffset <= 1, label + ': opponent row centered with balanced empty seats ' + report.opponentCenterOffset);
  if (report.cleanRow) {
    assert.equal(report.opponentRow, true, label + ': clean-row opponents share the top row');
    assert.ok(report.ownBox.left < report.width / 3 && report.ownBox.right <= report.dockBox.left, label + ': own hand left of betting controls');
    assert.ok(Math.abs(report.ownBox.top - report.dockBox.top) <= 1 && Math.abs(report.ownBox.bottom - report.dockBox.bottom) <= 1, label + ': hero and action panel align');
  }
  assert.equal(report.tableDockOverlap, false, label + ': table/actions overlap');
  if (!report.scrollLayout) assert.equal(report.shellOverflow, false, label + ': hidden overflow is not fitting');
  assert.ok(report.shellWidth <= (report.cleanRow ? report.width : 1680), label + ': responsive desktop width cap');
  assert.ok(report.scrollWidth <= report.width, label + ': horizontal scroll');
  if (!report.scrollLayout) assert.ok(report.scrollHeight <= report.height, label + ': unexpected vertical scroll');
  assert.equal(report.scrollY + report.shellScroll, 0, label + ': scrolled to reach controls');
}
