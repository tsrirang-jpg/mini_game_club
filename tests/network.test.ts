import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client, Room } from '@colyseus/sdk';
import { PokRoom } from '../apps/server/src/room';
import { PokerRoom } from '../apps/server/src/poker-room';
import { PokerGame } from '../apps/server/src/poker-game';
import type { PokerSnapshot } from '../packages/shared/src/poker';
import { Game } from '../apps/server/src/game';
import type { GameHooks } from '../apps/server/src/game';
import { DEFAULT_RULES } from '../packages/shared/src/index';
import type { Snapshot, Card } from '../packages/shared/src/index';
import { dealRandom } from './pok-test-deck';

class TestRoom extends PokRoom {
  protected makeGame(code: string, hooks: GameHooks) {
    return new Game(code, hooks, { ...DEFAULT_RULES, dealMs: 50, revealMs: 50, settlementMs: 50, actionMs: 5000, reconnectSeconds: 2 }, () => 0);
  }
}
class TestPokerRoom extends PokerRoom {
  protected makeGame(code: string, hooks: GameHooks) {
    return new PokerGame(code, hooks, () => 0, { deal: 50, turn: 2000, reveal: 20, bot: 40 });
  }
}
class TestCatchRoom extends PokRoom {
  protected makeGame(code: string, hooks: GameHooks) {
    return new Game(code, hooks, { ...DEFAULT_RULES, dealMs: 50, revealMs: 50, settlementMs: 50, actionMs: 5000, reconnectSeconds: 2 },
      dealRandom([{ rank:2,suit:'clubs' },{ rank:1,suit:'clubs' },{ rank:2,suit:'hearts' },{ rank:3,suit:'clubs' },{ rank:3,suit:'hearts' },{ rank:4,suit:'spades' },{ rank:12,suit:'diamonds' },{ rank:9,suit:'diamonds' }]));
  }
}
class TestAllCatchRoom extends PokRoom {
  protected makeGame(code:string,hooks:GameHooks) {
    const c=(rank:number,suit:Card['suit']):Card=>({rank,suit});
    return new Game(code,hooks,{...DEFAULT_RULES,dealMs:50,revealMs:50,settlementMs:50,actionMs:5000,reconnectSeconds:2},dealRandom([
      c(8,'hearts'),c(10,'clubs'),c(2,'spades'),c(2,'clubs'),c(1,'spades'),c(5,'spades'),
      c(5,'clubs'),c(4,'diamonds'),c(3,'hearts'),c(2,'diamonds'),c(2,'hearts'),c(10,'diamonds'),
      c(13,'clubs'),c(12,'hearts'),c(10,'spades'),c(13,'diamonds'),c(12,'clubs'),c(4,'hearts'),
    ]));
  }
}
class TestPokRevealRoom extends PokRoom {
  protected makeGame(code: string, hooks: GameHooks) {
    return new Game(code, hooks, { ...DEFAULT_RULES, dealMs:300,revealMs:50,settlementMs:50,actionMs:5000,reconnectSeconds:2 },
      dealRandom([{rank:6,suit:'clubs'},{rank:9,suit:'clubs'},{rank:2,suit:'spades'},{rank:8,suit:'diamonds'},{rank:1,suit:'hearts'},
        {rank:1,suit:'diamonds'},{rank:5,suit:'hearts'},{rank:7,suit:'spades'},{rank:12,suit:'diamonds'},{rank:5,suit:'spades'},
        {rank:4,suit:'hearts'},{rank:1,suit:'spades'}]));
  }
}
let server: Server; let endpoint: string;
const rooms: Room[] = [];
interface Observer { room: Room; snapshots: Snapshot[]; hands: { roundId: number; cards: Card[] }[]; errors: { code: string }[] }
function observe(room: Room): Observer {
  room.reconnection.enabled = false;
  rooms.push(room);
  const observer: Observer = { room, snapshots: [], hands: [], errors: [] };
  room.onMessage('snapshot', (s: Snapshot) => observer.snapshots.push(s));
  room.onMessage('hand', (h: { roundId: number; cards: Card[] }) => observer.hands.push(h));
  room.onMessage('error', (e: { code: string }) => observer.errors.push(e));
  room.send('sync'); return observer;
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean, timeout = 4000) {
  const end = Date.now() + timeout;
  while (!predicate()) { if (Date.now() > end) throw new Error('Network test timed out'); await sleep(15); }
}
function latest(o: Observer) { return o.snapshots[o.snapshots.length - 1]; }
let actionId = 0;
function send(o: Observer, type: string, value?: unknown, roundId?: number, id?: string) {
  o.room.send('action', { type, value, roundId: roundId ?? latest(o).roundId, actionId: id ?? `test-${++actionId}` });
}
beforeAll(async () => {
  const http = createServer();
  server = new Server({ gracefullyShutdown: false, transport: new WebSocketTransport({ server: http, maxPayload: 4096 }) });
  server.define('test', TestRoom);
  server.define('poker', TestPokerRoom);
  server.define('test-catch', TestCatchRoom);
  server.define('test-all-catch', TestAllCatchRoom);
  server.define('test-pok-reveal', TestPokRevealRoom);
  await server.listen(0, '127.0.0.1');
  const address = http.address();
  if (!address || typeof address === 'string') throw new Error('No server address');
  endpoint = `ws://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await Promise.all(rooms.map(room => Promise.race([room.leave().catch(() => {}), sleep(200)])));
  await server.gracefullyShutdown(false);
});
describe('real WebSocket clients', () => {
  it('accepts ten humans and rejects an eleventh connection',async()=>{
    const host=observe(await new Client(endpoint).create('test',{name:'Host ten'})),joined=[host];
    for(let i=1;i<10;i++)joined.push(observe(await new Client(endpoint).joinById(host.room.roomId,{name:'Human '+i})));
    await until(()=>joined.every(o=>latest(o)?.players.length===10));
    expect(latest(host).rules.maxPlayers).toBe(10);
    expect(new Set(latest(host).players.map(p=>p.seat)).size).toBe(10);
    await expect(new Client(endpoint).joinById(host.room.roomId,{name:'Eleventh'})).rejects.toThrow();
    for(const o of joined)await o.room.leave();
  });
  it('creates nine bots, reopens a human slot after bot removal and restores a full mixed table',async()=>{
    const host=observe(await new Client(endpoint).create('test',{name:'Nine bots',botCount:9}));
    await until(()=>latest(host)?.players.length===10);
    expect(latest(host).players.filter(p=>p.isBot)).toHaveLength(9);
    expect(new Set(latest(host).players.map(p=>p.name)).size).toBe(10);
    await expect(new Client(endpoint).joinById(host.room.roomId,{name:'Full'})).rejects.toThrow();
    const bot=latest(host).players.find(p=>p.isBot)!;
    send(host,'removeBot',bot.id);await until(()=>latest(host).players.length===9);
    const guest=observe(await new Client(endpoint).joinById(host.room.roomId,{name:'Guest ten'}));
    await until(()=>latest(guest)?.players.length===10&&latest(host).players.length===10);
    expect(latest(host).players.filter(p=>!p.isBot)).toHaveLength(2);
    send(host,'addBot');await until(()=>host.errors.some(e=>e.code==='ROOM_FULL'));
    await guest.room.leave();await host.room.leave();
  });

  it('opens Pok8/9 immediately to everyone and recompares catches when dealer draws to eight', async () => {
    const a = observe(await new Client(endpoint).create('test-pok-reveal', {name:'Dealer'}));
    const others: Observer[] = [];
    for (const name of ['Caught','Pok9','Pok8','Six']) others.push(observe(await new Client(endpoint).joinById(a.room.roomId,{name})));
    const [caught,pok9,pok8,six] = others;
    await until(() => [a,...others].every(o => latest(o)?.players.length === 5));
    for (const o of others) send(o,'setReady',true);
    await until(() => latest(a).players.filter(p => p.ready).length === 4);
    send(a,'startRound');
    await until(() => [a,...others].every(o => latest(o).phase === 'DEALING'));
    for (const o of [a,...others]) {
      expect(latest(o).results).toEqual([]);
      expect(latest(o).revealedHands.map(r => r.id)).toEqual([pok9.room.sessionId,pok8.room.sessionId]);
      expect(latest(o).revealedHands.every(r => r.pok && r.cards.length === 2)).toBe(true);
      expect(latest(o).players.every(p => !('cards' in p))).toBe(true);
    }
    await until(() => latest(caught).phase === 'PLAYER_ACTIONS');
    send(pok8,'draw'); await until(() => pok8.errors.some(e => e.code === 'ALREADY_ACTED'));
    send(caught,'draw'); send(six,'stand'); await until(() => latest(a).phase === 'DEALER_ACTION');
    send(a,'catch',caught.room.sessionId); await until(() => latest(six).catches.length === 1);
    expect(latest(six).catches[0]).toMatchObject({delta:10,outcome:'WIN'});
    const token = a.room.reconnectionToken;
    a.room.connection.close(4010);
    await until(() => latest(six).players.find(p => p.id === a.room.sessionId)?.connected === false);
    const restored = observe(await new Client(endpoint).reconnect(token));
    await until(() => latest(restored)?.catches.length === 1);
    expect(latest(restored).revealedHands).toEqual(latest(six).revealedHands);
    send(restored,'draw');
    await until(() => [restored,...others].every(o => latest(o).phase === 'ROUND_END'));
    for (const o of [restored,...others]) {
      expect(latest(o).catches[0]).toMatchObject({delta:0,outcome:'TIE',catchRecompared:true,dealerCards:[{rank:6,suit:'clubs'},{rank:1,suit:'diamonds'},{rank:1,suit:'spades'}]});
      expect(latest(o).results.find(r => r.id === pok9.room.sessionId)).toMatchObject({delta:20,outcome:'WIN'});
      expect(latest(o).results.find(r => r.id === pok8.room.sessionId)).toMatchObject({delta:0,outcome:'TIE'});
      expect(latest(o).results.find(r => r.id === six.room.sessionId)).toMatchObject({delta:-10,outcome:'LOSE'});
      expect(latest(o).results.find(r => r.id === restored.room.sessionId)).toMatchObject({delta:-10,outcome:'DEALER'});
      expect(latest(o).players.reduce((sum,p) => sum + p.points,0)).toBe(5000);
    }
    send(restored,'prepareRound'); await until(() => latest(six).phase === 'LOBBY');
    expect(latest(six).revealedHands).toEqual([]); expect(latest(six).catches).toEqual([]);
    for (const o of [...others,restored]) await o.room.leave();
  });
  it('broadcasts a provisional catch, reconnects and recomputes the final payout once', async () => {
    const a = observe(await new Client(endpoint).create('test-catch', { name: 'Dealer' }));
    const b = observe(await new Client(endpoint).joinById(a.room.roomId, { name: 'Draws' }));
    const c = observe(await new Client(endpoint).joinById(a.room.roomId, { name: 'Stands' }));
    await until(() => latest(a)?.players.length === 3 && latest(b)?.players.length === 3 && latest(c)?.players.length === 3);
    send(b,'setReady',true); send(c,'setReady',true);
    await until(() => latest(a).players.filter(p => p.ready).length === 2);
    send(a,'startRound'); await until(() => latest(b).phase === 'PLAYER_ACTIONS');
    send(b,'draw'); send(c,'stand'); await until(() => latest(a).phase === 'DEALER_ACTION');
    send(c,'catch',b.room.sessionId); await until(() => c.errors.some(e => e.code === 'WRONG_PHASE'));
    send(a,'catch',c.room.sessionId); await until(() => a.errors.some(e => e.code === 'INVALID_CATCH'));
    const deadline = latest(a).deadline;
    await sleep(150);
    send(a,'catch',b.room.sessionId,undefined,'catch-once');
    await until(() => latest(a).catches.length === 1 && latest(b).catches.length === 1 && latest(c).catches.length === 1);
    const caught = latest(a).catches[0];
    const resetDeadline = latest(a).deadline;
    expect(resetDeadline).toBeGreaterThan(deadline);
    expect(resetDeadline - Date.now()).toBeGreaterThan(4500);
    expect(caught).toMatchObject({ id: b.room.sessionId, delta: -20, caught: true });
    expect(caught.dealerCards).toHaveLength(2); expect(caught.cards).toHaveLength(3);
    expect(latest(c).results).toEqual([]); expect(latest(c).catches.some(r => r.id === c.room.sessionId)).toBe(false);
    expect(latest(c).players.every(p => !('cards' in p))).toBe(true);
    send(a,'catch',b.room.sessionId,undefined,'catch-once');
    const token = a.room.reconnectionToken;
    a.room.connection.close(4010);
    await until(() => latest(b).players.find(p => p.id === a.room.sessionId)?.connected === false);
    const restored = observe(await new Client(endpoint).reconnect(token));
    await until(() => latest(restored)?.catches.length === 1 && restored.hands.some(h => h.cards.length === 2));
    expect(latest(restored).catches[0]).toEqual(caught); expect(latest(restored).deadline).toBe(resetDeadline);
    send(restored,'draw'); await until(() => latest(b).phase === 'ROUND_END');
    expect(latest(b).results.find(r => r.id === b.room.sessionId)).toMatchObject({ delta:0, outcome:'TIE', caught:true, catchRecompared:true, dealerValue:{score:4,multiplier:1}, dealerCards:latest(b).results.find(r=>r.outcome==='DEALER')!.cards });
    expect(latest(b).results.find(r => r.id === c.room.sessionId)).toMatchObject({ delta: 10 });
    expect(latest(b).players.reduce((sum,p) => sum + p.points,0)).toBe(3000);
    await restored.room.leave(); await b.room.leave(); await c.room.leave();
  });
  it('keeps a six-player dealer turn open after all catches and broadcasts the final seven-point payout', async()=>{
    const dealer=observe(await new Client(endpoint).create('test-all-catch',{name:'Dealer'}));
    const others:Observer[]=[];
    for(let i=1;i<=5;i++)others.push(observe(await new Client(endpoint).joinById(dealer.room.roomId,{name:'Draws '+i})));
    const all=[dealer,...others],dealerId=dealer.room.sessionId;
    await until(()=>all.every(o=>latest(o)?.players.length===6));
    for(const o of others)send(o,'setReady',true);
    await until(()=>latest(dealer).players.filter(p=>p.ready).length===5);
    send(dealer,'startRound');await until(()=>all.every(o=>latest(o).phase==='PLAYER_ACTIONS'));
    for(const o of others)send(o,'draw');
    await until(()=>all.every(o=>latest(o).phase==='DEALER_ACTION'));
    for(let i=0;i<others.length;i++){
      send(dealer,'catch',others[i].room.sessionId);
      await until(()=>all.every(o=>latest(o).catches.length===i+1));
      expect(latest(dealer).phase).toBe('DEALER_ACTION');
      expect(latest(dealer).results).toEqual([]);
      expect(latest(dealer).players.find(p=>p.id===dealerId)).toMatchObject({acted:false,cardCount:2,points:1000});
    }
    const provisional=latest(dealer).catches,token=dealer.room.reconnectionToken;
    dealer.room.connection.close(4010);
    await until(()=>latest(others[0]).players.find(p=>p.id===dealerId)?.connected===false);
    const restored=observe(await new Client(endpoint).reconnect(token));
    await until(()=>latest(restored)?.catches.length===5&&restored.hands.some(h=>h.cards.length===2));
    expect(latest(restored).phase).toBe('DEALER_ACTION');expect(latest(restored).catches).toEqual(provisional);
    send(restored,'draw');
    await until(()=>[restored,...others].every(o=>latest(o).phase==='ROUND_END'));
    for(const o of [restored,...others]){
      const final=latest(o);
      expect(final.catches).toHaveLength(5);
      for(const result of final.catches)expect(result).toMatchObject({outcome:'LOSE',delta:-10,catchRecompared:true,dealerValue:{score:7,multiplier:1}});
      expect(final.catches.every(r=>r.dealerCards?.length===3)).toBe(true);
      expect(final.results.find(r=>r.id===dealerId)).toMatchObject({score:7,delta:50});
      expect(final.players.find(p=>p.id===dealerId)?.points).toBe(1050);
      expect(final.players.reduce((sum,p)=>sum+p.points,0)).toBe(6000);
    }
    for(const o of [restored,...others])await o.room.leave();
  });
  it('broadcasts voluntarily shown winner cards to the other player only after a win', async () => {
    let aState: PokerSnapshot | undefined, bState: PokerSnapshot | undefined;
    let bHand: Card[] = [];
    const a = await new Client(endpoint).create('poker', { name: 'Host' }); rooms.push(a); a.reconnection.enabled=false;
    a.onMessage('snapshot',(s:PokerSnapshot)=>{aState=s;});a.onMessage('hand',()=>{});a.onMessage('error',()=>{});
    const b = await new Client(endpoint).joinById(a.roomId,{name:'Winner',game:'poker'});rooms.push(b);b.reconnection.enabled=false;
    b.onMessage('snapshot',(s:PokerSnapshot)=>{bState=s;});b.onMessage('hand',(h:{cards:Card[]})=>{bHand=h.cards;});b.onMessage('error',()=>{});
    a.send('sync');b.send('sync');await until(()=>aState?.players.length===2&&bState?.players.length===2);
    b.send('action',{type:'setReady',value:true,roundId:0,actionId:'show-ready'});
    await until(()=>aState?.players.find(p=>p.id===b.sessionId)?.ready===true);
    a.send('action',{type:'startRound',roundId:0,actionId:'show-start'});
    await until(()=>aState?.turnId===a.sessionId&&bHand.length===2);
    a.send('action',{type:'fold',roundId:1,actionId:'show-fold'});
    await until(()=>aState?.phase==='ROUND_END'&&bState?.phase==='ROUND_END');
    expect(aState!.results.every(r=>r.cards.length===0)).toBe(true);
    b.send('action',{type:'showCards',roundId:1,actionId:'show-own'});
    await until(()=>aState?.results.find(r=>r.id===b.sessionId)?.cards.length===2);
    expect(aState!.results.find(r=>r.id===b.sessionId)?.cards).toEqual(bHand);
    expect(aState!.results.find(r=>r.id===a.sessionId)?.cards).toEqual([]);
    await b.leave();await a.leave();
  });
  it('Poker room reconnects a human, isolates private hands, rejects wrong game and plays with bots', async () => {
    let room = await new Client(endpoint).create('poker', { name: 'Poker Host', botCount: 2 });
    rooms.push(room); room.reconnection.enabled = false;
    let snapshot: PokerSnapshot | undefined; let hand: Card[] = []; let lastRound = -1; let lastTurn = '';
    const attach = (r: Room) => {
      r.onMessage('snapshot', (s: PokerSnapshot) => { snapshot = s; });
      r.onMessage('hand', (h: { cards: Card[] }) => { hand = h.cards; });
      r.onMessage('error', () => {}); r.send('sync');
    };
    attach(room); await until(() => snapshot?.players.length === 3);
    await expect(new Client(endpoint).joinById(room.roomId, { name: 'Wrong game', game: 'pok' })).rejects.toThrow('Poker');
    room.send('action', { type: 'startRound', roundId: 0, actionId: 'poker-start' });
    await until(() => snapshot?.phase === 'PREFLOP' && hand.length === 2);
    expect(snapshot!.results).toEqual([]); expect(snapshot!.players.every(p => !('cards' in p))).toBe(true);
    const original = [...hand]; const oldId = room.sessionId; const token = room.reconnectionToken;
    room.connection.close(4010); await sleep(60); // No second human connection exists to observe the disconnected snapshot.
    room = await new Client(endpoint).reconnect(token); room.reconnection.enabled = false; rooms.push(room); attach(room);
    await until(() => snapshot?.players.find(p => p.id === oldId)?.connected === true);
    expect(room.sessionId).toBe(oldId); expect(hand).toEqual(original);
    const end = Date.now() + 5000;
    while (snapshot?.phase !== 'ROUND_END' && Date.now() < end) {
      if (snapshot?.turnId === room.sessionId && (lastRound !== snapshot.roundId || lastTurn !== snapshot.phase)) {
        const me = snapshot.players.find(p => p.id === room.sessionId)!;
        room.send('action', { type: me.streetBet < snapshot.currentBet ? 'call' : 'check', roundId: snapshot.roundId, actionId: `poker-${++actionId}` });
        lastRound = snapshot.roundId; lastTurn = snapshot.phase;
      }
      await sleep(10);
    }
    expect(snapshot!.phase).toBe('ROUND_END'); expect(snapshot!.board).toHaveLength(5);
    expect(snapshot!.players.reduce((sum, p) => sum + p.points, 0)).toBe(3000);
    await room.leave();
  });
  it('creates a solo bot room, automatically plays dealer and keeps private bot cards hidden', async () => {
    const a = observe(await new Client(endpoint).create('test', { name: 'Solo', botCount: 1 }));
    await until(() => latest(a)?.players.length === 2);
    const bot = latest(a).players.find(p => p.isBot)!;
    expect(latest(a).dealerId).toBe(bot.id); expect(bot.ready).toBe(true);
    send(a, 'startRound'); await until(() => latest(a).phase === 'PLAYER_ACTIONS');
    expect(latest(a).results).toEqual([]); expect(a.hands.at(-1)?.cards).toHaveLength(2);
    expect(latest(a).players.every(p => !('cards' in p))).toBe(true);
    send(a, 'stand'); await until(() => latest(a).phase === 'ROUND_END');
    expect(latest(a).players.reduce((sum, p) => sum + p.points, 0)).toBe(2000);
    expect(latest(a).results.find(r => r.id === bot.id)?.cards).toHaveLength(3);
    send(a, 'prepareRound'); await until(() => latest(a).phase === 'LOBBY');
    send(a, 'removeBot', bot.id); await until(() => latest(a).players.length === 1);
    send(a, 'addBot'); await until(() => latest(a).players.length === 2);
    await a.room.leave();
  });
  it('rejects invalid bot counts before creating a room', async () => {
    for (const botCount of [-1, 10, 1.5, '2']) {
      await expect(new Client(endpoint).create('test', { name: 'Invalid', botCount })).rejects.toThrow();
    }
  });
  it('joins, hides opponents cards, rejects invalid actions, reconnects and settles once', async () => {
    const a = observe(await new Client(endpoint).create('test', { name: 'Dealer' }));
    const b = observe(await new Client(endpoint).joinById(a.room.roomId, { name: 'Player' }));
    await until(() => latest(a)?.players.length === 2 && latest(b)?.players.length === 2);
    send(b, 'startRound'); await until(() => b.errors.some(e => e.code === 'NOT_HOST'));
    send(b, 'setReady', true); await until(() => latest(a).players.find(p => p.id === b.room.sessionId)?.ready === true);
    send(a, 'startRound'); await until(() => latest(a).phase === 'PLAYER_ACTIONS' && b.hands.some(h => h.cards.length === 2));
    expect(latest(a).results).toEqual([]); expect(latest(b).results).toEqual([]);
    const dealerHand = a.hands.at(-1)!.cards;
    const playerHand = b.hands.at(-1)!.cards;
    expect(dealerHand).not.toEqual(playerHand);
    expect(new Set([...dealerHand, ...playerHand].map(c => `${c.suit}:${c.rank}`)).size).toBe(4);
    expect(latest(b).players.every(p => !('cards' in p))).toBe(true);
    send(a, 'draw'); await until(() => a.errors.some(e => e.code === 'WRONG_PHASE'));
    send(b, 'draw', undefined, 0); await until(() => b.errors.some(e => e.code === 'STALE_ROUND'));
    const token = b.room.reconnectionToken;
    b.room.connection.close(4010);
    await until(() => latest(a).players.find(p => p.id === b.room.sessionId)?.connected === false);
    const reconnected = observe(await new Client(endpoint).reconnect(token));
    await until(() => reconnected.hands.some(h => h.cards.length === 2));
    expect(reconnected.room.sessionId).toBe(b.room.sessionId);
    expect(reconnected.hands.at(-1)!.cards).toEqual(playerHand);
    send(reconnected, 'draw', undefined, 1, 'duplicate');
    send(reconnected, 'draw', undefined, 1, 'duplicate');
    await until(() => latest(a).phase === 'DEALER_ACTION');
    expect(reconnected.hands.at(-1)!.cards).toHaveLength(3);
    send(a, 'stand'); await until(() => latest(a).phase === 'ROUND_END');
    expect(latest(a).settled).toBe(true);
    expect(latest(a).players.reduce((sum, p) => sum + p.points, 0)).toBe(2000);
    const balances = latest(a).players.map(p => p.points);
    send(a, 'stand'); await until(() => a.errors.filter(e => e.code === 'WRONG_PHASE').length >= 2);
    expect(latest(a).players.map(p => p.points)).toEqual(balances);
    send(a, 'prepareRound'); await until(() => latest(reconnected).phase === 'LOBBY');
    expect(latest(a).results).toEqual([]);
    await reconnected.room.leave(); await a.room.leave();
  });
});
