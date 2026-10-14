import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { bestPokerHand, comparePoker, pokerPayout, pokerPotSummaries } from '../packages/shared/src/poker';
import { PokerGame } from '../apps/server/src/poker-game';
import type { Card, Suit } from '../packages/shared/src/index';
const c = (rank: number, suit: Suit = 'clubs'): Card => ({ rank, suit });
describe('Holdem hand evaluation and pots', () => {
  it('recognizes all nine categories, ace-low straights and royal flush', () => {
    const ranks = [
      [c(1),c(13,'hearts'),c(9),c(6),c(3)], [c(1),c(1,'hearts'),c(9),c(6),c(3)],
      [c(1),c(1,'hearts'),c(9),c(9,'hearts'),c(3)], [c(1),c(1,'hearts'),c(1,'spades'),c(6),c(3)],
      [c(1),c(2,'hearts'),c(3),c(4),c(5)], [c(1),c(13),c(9),c(6),c(3)],
      [c(1),c(1,'hearts'),c(1,'spades'),c(6),c(6,'hearts')], [c(1),c(1,'hearts'),c(1,'spades'),c(1,'diamonds'),c(3)],
      [c(1),c(13),c(12),c(11),c(10)],
    ];
    ranks.forEach((hand,index)=>expect(bestPokerHand(hand).rank).toBe(index));
    expect(bestPokerHand(ranks[4]).kickers).toEqual([5]); expect(bestPokerHand(ranks[8]).name).toBe('Royal flush');
  });
  it('finds the best 5 of 7, including board-only ties and double trips', () => {
    const board = [c(10),c(11),c(12),c(13),c(1)];
    expect(comparePoker(bestPokerHand([...board,c(2,'hearts'),c(3,'hearts')]),bestPokerHand([...board,c(9,'spades'),c(8,'spades')]))).toBe(0);
    expect(bestPokerHand([c(13),c(13,'hearts'),c(13,'spades'),c(12),c(12,'hearts'),c(12,'spades'),c(1)]).kickers).toEqual([13,12]);
    expect(comparePoker(bestPokerHand([c(5),c(5,'hearts'),c(1),c(13),c(7)]),bestPokerHand([c(5),c(5,'hearts'),c(1),c(12),c(7)]))).toBe(1);
  });
  it('awards independent side pots and returns unmatched chips', () => {
    const high = bestPokerHand([c(1),c(13),c(12),c(11),c(10)]);
    const middle = bestPokerHand([c(9),c(8),c(7),c(6),c(5)]);
    const low = bestPokerHand([c(2),c(2,'hearts'),c(3),c(7),c(9)]);
    const {payouts,pots}=pokerPayout({a:20,b:60,c:100},new Set(),{a:high,b:middle,c:low},['a','b','c']);
    expect(payouts).toEqual({a:60,b:80,c:40}); expect(pots.map(p=>p.amount)).toEqual([60,80,40]); expect(pots[2].refund).toBe(true);
  });
  it('folded chips count toward pots and odd chips follow button order', () => {
    const hand=bestPokerHand([c(1),c(13),c(12),c(11),c(10)]);
    expect(pokerPayout({a:5,b:5,c:5},new Set(['c']),{a:hand,b:hand},['b','c','a']).payouts).toEqual({a:7,b:8,c:0});
  });
  it('splits the 1420-chip example into 640 for the short-stack trips and 780 for the deeper two pair', () => {
    const pair=bestPokerHand([c(13),c(13,'hearts'),c(11,'spades'),c(5,'diamonds'),c(4)]);
    const twoPair=bestPokerHand([c(11),c(11,'hearts'),c(8),c(8,'diamonds'),c(1,'spades')]);
    const trips=bestPokerHand([c(13),c(13,'hearts'),c(13,'spades'),c(10),c(7,'hearts')]);
    const {payouts,pots}=pokerPayout({a:420,b:420,c:160,d:420},new Set(),{a:pair,b:pair,c:trips,d:twoPair},['a','b','c','d']);
    const summaries=pokerPotSummaries(pots);
    expect(summaries.map(p=>p.amount)).toEqual([640,780]);
    expect(summaries[0].awards).toEqual({c:640});expect(summaries[1].awards).toEqual({d:780});
    expect(summaries[1].eligible).not.toContain('c');
    expect(payouts.c-160).toBe(480);expect(payouts.d-420).toBe(360);
  });
  it('groups identical eligibility without losing each layer odd-chip allocation or mixing refunds', () => {
    const summaries = pokerPotSummaries([
      { amount: 3, eligible: ['a','b'], winners: ['a','b'], refund: false },
      { amount: 5, eligible: ['b','a'], winners: ['a','b'], refund: false },
      { amount: 4, eligible: ['a'], winners: ['a'], refund: true },
    ]);
    expect(summaries.map(p => p.amount)).toEqual([8,4]);
    expect(summaries[0].awards).toEqual({a:5,b:3});
    expect(summaries[1].awards).toEqual({a:4});
  });
});
let g: PokerGame; let privateHands: Record<string,Card[]>; let serial=0;
function act(id:string,type:string,value?:unknown,roundId=g.roundId,actionId=`t-${++serial}`){g.action(id,{type,value,roundId,actionId});}
function start(){for(const p of g.players.values())if(p.id!==g.hostId)act(p.id,'setReady',true);act(g.hostId,'startRound');vi.advanceTimersByTime(10);}
function finish(){for(let n=0;n<100&&g.phase!=='ROUND_END';n++){const s=g.snapshot();if(s.turnId){const p=g.players.get(s.turnId)!;act(p.id,p.streetBet<s.currentBet?'call':'check');}else vi.advanceTimersByTime(10);}expect(g.phase).toBe('ROUND_END');}
beforeEach(()=>{vi.useFakeTimers();privateHands={};g=new PokerGame('TEST',{changed(){},privateHand(id,cards){privateHands[id]=[...cards];}},()=>0,{deal:10,turn:1000,reveal:10,bot:50});g.add('A','a');g.add('B','b');});
afterEach(()=>{g.dispose();vi.useRealTimers();});
describe('No-limit betting state machine',()=>{
  it('allows 30 seconds on the production timer and only folds at the deadline',()=>{
    g.dispose();g=new PokerGame('THIRTY',{changed(){},privateHand(){}},()=>0);g.add('A','a');g.add('B','b');
    act('b','setReady',true);act('a','startRound');vi.advanceTimersByTime(1200);
    expect(g.snapshot().turnDurationMs).toBe(30000);expect(g.deadline-Date.now()).toBe(30000);
    vi.advanceTimersByTime(29999);expect(g.phase).toBe('PREFLOP');expect(g.turnId).toBe('a');
    vi.advanceTimersByTime(1);expect(g.phase).toBe('SHOWDOWN');expect(g.snapshot().results.find(r=>r.id==='a')?.handName).toBe('Fold');
  });
  it('heads-up button posts SB, acts first preflop, BB retains option and acts first postflop',()=>{
    start();expect(g.buttonId).toBe('a');expect(g.smallBlindId).toBe('a');expect(g.bigBlindId).toBe('b');expect(g.turnId).toBe('a');
    act('a','call');expect(g.turnId).toBe('b');act('b','check');vi.advanceTimersByTime(10);
    expect(g.phase).toBe('FLOP');expect(g.turnId).toBe('b');finish();
    expect(g.snapshot().board).toHaveLength(5);expect(g.snapshot().players.reduce((sum,p)=>sum+p.points,0)).toBe(2000);
    act('a','prepareRound');start();expect(g.buttonId).toBe('b');expect(g.turnId).toBe('b');
  });
  it('does not expose private hands before showdown; no duplicate cards including board',()=>{
    start();expect(g.snapshot().results).toEqual([]);expect(g.snapshot().players.every(p=>!('cards'in p))).toBe(true);
    finish();const all=[...Object.values(privateHands).flat(),...g.snapshot().board];expect(new Set(all.map(c=>`${c.suit}:${c.rank}`)).size).toBe(9);
  });
  it('rejects out-of-turn, invalid checks/minimum raises, stale and duplicate actions',()=>{
    start();expect(()=>act('b','call')).toThrow();expect(()=>act('a','check')).toThrow();expect(()=>act('a','raise',25)).toThrow();
    act('a','raise',40,g.roundId,'same');act('a','raise',40,g.roundId,'same');expect(g.currentBet).toBe(40);
    expect(()=>act('b','call',undefined,0)).toThrow();expect(()=>act('b','raise',-1)).toThrow();
  });
  it('fold winner is settled once without revealing hole cards',()=>{
    start();act('a','fold');vi.advanceTimersByTime(10);expect(g.phase).toBe('ROUND_END');
    expect(g.players.get('a')!.points).toBe(990);expect(g.players.get('b')!.points).toBe(1010);
    expect(g.snapshot().results.every(r=>r.cards.length===0)).toBe(true);
    expect(()=>act('b','call')).toThrow();expect(g.players.get('b')!.points).toBe(1010);
  });
  it('lets an uncalled winner reveal only their own cards after the round',()=>{
    start();
    expect(()=>act('a','showCards')).toThrow('หลังจบรอบ');
    act('a','fold');
    expect(()=>act('b','showCards')).toThrow('หลังจบรอบ');
    vi.advanceTimersByTime(10);
    const before=g.snapshot(); const balance=g.players.get('b')!.points;
    expect(()=>act('a','showCards')).toThrow('ผู้ชนะ');
    expect(()=>act('b','showCards','a')).toThrow('ตัวเอง');
    act('b','showCards',undefined,g.roundId,'reveal');
    expect(g.snapshot().results.find(r=>r.id==='b')?.cards).toEqual(privateHands.b);
    expect(g.snapshot().results.find(r=>r.id==='a')?.cards).toEqual([]);
    act('b','showCards',undefined,g.roundId,'reveal');
    act('b','showCards');
    expect(g.players.get('b')!.points).toBe(balance); expect(g.snapshot().pots).toEqual(before.pots);
    g.reconnect('b'); expect(g.snapshot().results.find(r=>r.id==='b')?.cards).toEqual(privateHands.b);
    act('a','prepareRound');
    expect(g.snapshot().results).toEqual([]);
    expect(()=>act('b','showCards')).toThrow('หลังจบรอบ');
    start();expect(()=>act('b','showCards',undefined,g.roundId-1)).toThrow('รอบเก่า');
  });
  it('keeps folded losers private when the winner also receives an unmatched refund',()=>{
    g.add('C','c'); g.players.get('a')!.points=100;
    start();act('a','raise',40);act('b','fold');act('c','fold');vi.advanceTimersByTime(10);
    expect(g.snapshot().results.find(r=>r.id==='a')?.cards).toEqual([]);
    expect(g.snapshot().pots.some(pot=>pot.refund)).toBe(true);
    act('a','showCards');expect(g.snapshot().results.find(r=>r.id==='a')?.cards).toEqual(privateHands.a);
    expect(()=>act('b','showCards')).toThrow('ผู้ชนะ');
  });
  it('unequal all-in stacks run out the board, produce side pots and conserve chips',()=>{
    g.add('C','c');g.players.get('a')!.points=100;g.players.get('b')!.points=60;g.players.get('c')!.points=20;
    start();act('a','allIn');act('b','allIn');finish();
    expect(g.snapshot().board).toHaveLength(5);expect(g.snapshot().pots.map(p=>p.amount)).toEqual([60,80,40]);
    expect(g.snapshot().players.reduce((sum,p)=>sum+p.points,0)).toBe(180);
  });
  it('publishes live all-in pots, excludes a short stack from higher pots, and never reveals winners early',()=>{
    g.add('C','c');g.players.get('a')!.points=100;g.players.get('b')!.points=60;g.players.get('c')!.points=20;
    start();act('a','allIn');
    const s=g.snapshot();expect(s.pots.map(p=>p.amount)).toEqual([50,80]);
    expect(s.pots[0].eligible).toEqual(['a','b','c']);expect(s.pots[1].eligible).toEqual(['a']);
    expect(s.pots.every(p=>!p.refund&&!p.winners.length)).toBe(true);
    expect(s.pots.reduce((sum,p)=>sum+p.amount,0)).toBe(s.pot);
    act('b','allIn');
    expect(g.snapshot().pots.map(p=>p.amount)).toEqual([60,80,40]);
    expect(g.snapshot().pots[1].eligible).toEqual(['a','b']);finish();
    const ended=g.snapshot();expect(ended.pots[2].refund).toBe(true);
    const awards=pokerPotSummaries(ended.pots).reduce((totals,p)=>{
      for(const[id,amount]of Object.entries(p.awards))totals[id]=(totals[id]??0)+amount;return totals;
    },{} as Record<string,number>);
    for(const r of ended.results)expect(awards[r.id]??0).toBe(r.payout);
  });
  it('does not split normal pending bets into side pots and keeps folded dead money in the main pot',()=>{
    start();act('a','raise',100);
    expect(g.snapshot().pots).toHaveLength(1);expect(g.snapshot().pots[0].amount).toBe(120);
    act('b','fold');vi.advanceTimersByTime(10);
    const total=g.snapshot().pot;g.expire('b');
    expect(g.snapshot().pot).toBe(total);expect(g.snapshot().results.find(r=>r.id==='b')?.name).toBe('B');
    act('a','prepareRound');expect(g.snapshot().pot).toBe(0);expect(g.snapshot().pots).toEqual([]);
  });
  it('short all-in requires another call but does not reopen a previous caller raise',()=>{
    g.add('C','c');g.players.get('c')!.points=25;start();act('a','call');act('b','call');act('c','allIn');
    expect(g.currentBet).toBe(25);expect(g.turnId).toBe('a');expect(g.snapshot().raiseAllowedIds).not.toContain('a');
    expect(()=>act('a','raise',50)).toThrow('Short all-in');act('a','call');act('b','call');vi.advanceTimersByTime(10);expect(g.phase).toBe('FLOP');
  });
  it('cumulative short all-ins reopen raising once the full raise threshold is met',()=>{
    g.add('C','c');g.add('D','d');g.players.get('b')!.points=30;g.players.get('c')!.points=40;
    start();act('d','call');act('a','call');act('b','allIn');act('c','allIn');
    expect(g.turnId).toBe('d');expect(g.snapshot().raiseAllowedIds).toContain('d');act('d','raise',60);expect(g.currentBet).toBe(60);
  });
  it('times out to fold when facing a call and check otherwise',()=>{
    start();vi.advanceTimersByTime(1010);expect(g.phase).toBe('ROUND_END');expect(g.snapshot().results.find(r=>r.id==='a')?.handName).toBe('Fold');
  });
  it('short heads-up BB all-in only requires matching actual blind',()=>{
    g.players.get('b')!.points=15;start();expect(g.currentBet).toBe(15);act('a','call');finish();
    expect(g.snapshot().players.reduce((sum,p)=>sum+p.points,0)).toBe(1015);
  });
  it('reconnect restores the exact hand and bot can complete the hand',()=>{
    g.expire('b');const bot=g.addBot();start();const before=[...privateHands.a];g.disconnect('a');g.reconnect('a');expect(privateHands.a).toEqual(before);
    for(let n=0;n<100&&g.phase!=='ROUND_END';n++){if(g.turnId==='a'){const p=g.players.get('a')!;act('a',p.streetBet<g.currentBet?'call':'check');}else vi.advanceTimersByTime(100);}
    expect(g.phase).toBe('ROUND_END');expect(g.snapshot().results.some(r=>r.id===bot)).toBe(true);
  });
  it('removing bots after a hand does not expose stale seats in public state',()=>{
    const bot=g.addBot();start();finish();act('a','prepareRound');act('a','removeBot',bot);
    expect(g.snapshot().players).toHaveLength(2);expect(g.snapshot().raiseAllowedIds).toEqual([]);
    expect(g.snapshot().players.every(p=>!p.folded&&!p.allIn&&!p.inHand)).toBe(true);
  });
  it('button advances from the departed button seat, not from the first seat',()=>{
    g.add('C','c');start();finish();act('a','prepareRound');g.expire('a');start();expect(g.buttonId).toBe('b');
  });
  it('transfers host immediately during a hand and does not reclaim it on reconnect',()=>{
    start(); const deadline=g.deadline, hand=[...privateHands.a], balance=g.players.get('a')!.points;
    g.disconnect('a');expect(g.hostId).toBe('b');expect(g.deadline).toBe(deadline);
    expect(g.players.get('a')!.reconnectUntil).toBe(Date.now()+60000);
    g.reconnect('a');expect(g.hostId).toBe('b');expect(privateHands.a).toEqual(hand);
    expect(g.players.get('a')!.points).toBe(balance);expect(g.players.get('a')!.reconnectUntil).toBe(0);
  });
  it('never assigns host to a bot and restores host when the only human reconnects',()=>{
    g.expire('b');g.addBot();start();g.disconnect('a');expect(g.hostId).toBe('');
    g.reconnect('a');expect(g.hostId).toBe('a');
  });
  it('permanent exit folds immediately but retains committed chips through settlement',()=>{
    start();g.expire('a');expect(g.hostId).toBe('b');expect(g.players.get('a')!.folded).toBe(true);
    expect(g.players.get('a')!.contribution).toBe(10);expect(g.players.get('a')!.reconnectUntil).toBe(0);
    expect(()=>g.reconnect('a')).toThrow('reconnect');vi.advanceTimersByTime(10);
    expect(g.players.has('a')).toBe(false);expect(g.players.get('b')!.points).toBe(1010);
    expect(g.snapshot().results.find(r=>r.id==='a')?.delta).toBe(-10);
  });
  it('a non-turn exit does not reset the current player deadline',()=>{
    g.add('C','c');start();vi.advanceTimersByTime(100);const deadline=g.deadline;
    g.expire('b');expect(g.turnId).toBe('a');expect(g.deadline).toBe(deadline);
    expect(g.players.get('b')!.folded).toBe(true);finish();
  });
  it('permanent all-in departure remains eligible for pots and is paid exactly once',()=>{
    g.add('C','c');g.players.get('a')!.points=100;g.players.get('b')!.points=60;g.players.get('c')!.points=20;
    start();act('a','allIn');g.expire('a');expect(g.players.get('a')!.folded).toBe(false);
    expect(g.hostId).toBe('b');act('b','allIn');finish();
    expect(g.snapshot().pots[0].eligible).toContain('a');expect(g.snapshot().pots[1].eligible).toContain('a');
    expect(g.snapshot().results.reduce((sum,r)=>sum+r.payout,0)).toBe(180);
    expect(g.players.has('a')).toBe(false);const results=g.snapshot().results;vi.advanceTimersByTime(10000);
    expect(g.snapshot().results).toEqual(results);
  });
  it('intentional exit during dealing settles safely without orphaning the pot',()=>{
    act('b','setReady',true);act('a','startRound');expect(g.phase).toBe('DEALING');g.expire('a');
    vi.advanceTimersByTime(20);expect(g.phase).toBe('ROUND_END');expect(g.players.get('b')!.points).toBe(1010);
  });
  it('connection loss uses the original deadline to auto-fold or check',()=>{
    start();g.disconnect('a');vi.advanceTimersByTime(1010);expect(g.phase).toBe('ROUND_END');
    expect(g.snapshot().results.find(r=>r.id==='a')?.handName).toBe('Fold');g.reconnect('a');
    act('b','prepareRound');act('a','setReady',true);act('b','startRound');vi.advanceTimersByTime(10);
    act('b','call');g.disconnect('a');vi.advanceTimersByTime(1000);
    expect(g.players.get('a')!.folded).toBe(false);expect(g.players.get('a')!.lastAction).toBe('Check');
  });
  it('host can schedule closure, betting finishes, and the next round is blocked',()=>{
    start();expect(()=>act('b','closeRoom')).toThrow('host');
    act('a','closeRoom');expect(g.snapshot().roomClosing).toBe(true);expect(g.snapshot().closeAt).toBe(0);
    act('a','call');finish();expect(g.snapshot().closeAt).toBe(Date.now()+8000);
    expect(g.snapshot().players.reduce((sum,p)=>sum+p.points,0)).toBe(2000);
    expect(()=>act('a','prepareRound')).toThrow('กำลังปิด');
    expect(()=>act('b','setReady',true)).toThrow('กำลังปิด');expect(()=>g.add('C','c')).toThrow('กำลังปิด');
  });
  it('closure in the lobby is host-only and repeated requests do not extend its deadline',()=>{
    expect(()=>act('b','closeRoom')).toThrow('host');act('a','closeRoom');const closeAt=g.closeAt;
    vi.advanceTimersByTime(100);act('a','closeRoom');expect(g.closeAt).toBe(closeAt);
    expect(()=>act('a','startRound')).toThrow('กำลังปิด');
  });
  it('preserves an uncontested side pot when both deep stacks leave against a short all-in',()=>{
    g.add('C','c');g.players.get('a')!.points=20;start();act('a','allIn');act('b','raise',100);act('c','call');
    vi.advanceTimersByTime(10);expect(g.phase).toBe('FLOP');
    g.expire('c');g.expire('b');vi.advanceTimersByTime(10);
    expect(g.phase).toBe('ROUND_END');const s=g.snapshot();
    expect(s.results.find(r=>r.id==='a')!.payout).toBe(60);
    expect(s.results.find(r=>r.id==='b')!.payout).toBe(160);
    expect(s.results.reduce((sum,r)=>sum+r.delta,0)).toBe(0);
    expect(s.pots[1].winners).toEqual(['b']);
  });
});
