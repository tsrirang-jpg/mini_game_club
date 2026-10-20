import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../apps/server/src/game';
import { DEFAULT_RULES, makeLedger } from '../packages/shared/src/index';
import type { ActionType, Card, Suit } from '../packages/shared/src/index';
import { dealRandom } from './pok-test-deck';

const c=(rank:number,suit:Suit):Card=>({rank,suit});
let game:Game|undefined;
let serial=0;
let privateHands:Record<string,Card[]>;
const act=(id:string,type:ActionType,value?:string|boolean,actionId='final-catch-'+ ++serial)=>
  game!.action(id,{type,value,roundId:game!.roundId,actionId});

beforeEach(()=>{vi.useFakeTimers();privateHands={};});
afterEach(()=>{game?.dispose();vi.useRealTimers();});

function catchAllSixPlayers() {
  const ids=['d','p1','p2','p3','p4','p5'];
  const hands=[
    [c(8,'hearts'),c(5,'clubs'),c(4,'hearts')],
    [c(10,'clubs'),c(4,'diamonds'),c(13,'clubs')],
    [c(2,'spades'),c(3,'hearts'),c(12,'hearts')],
    [c(2,'clubs'),c(2,'diamonds'),c(10,'spades')],
    [c(1,'spades'),c(2,'hearts'),c(13,'diamonds')],
    [c(5,'spades'),c(10,'diamonds'),c(12,'clubs')],
  ];
  const sequence=[...hands.map(h=>h[0]),...hands.map(h=>h[1]),...hands.slice(1).map(h=>h[2]),hands[0][2]];
  game=new Game('ALL-SIX',{changed(){},privateHand(id,cards){privateHands[id]=cards.map(card=>({...card}));}},
    {...DEFAULT_RULES,dealMs:100,actionMs:1000,revealMs:100,settlementMs:100},dealRandom(sequence));
  for(const id of ids)game.add(id,id);
  for(const id of ids.slice(1))act(id,'setReady',true);
  act('d','startRound');vi.advanceTimersByTime(100);
  for(const id of ids.slice(1))act(id,'draw');
  expect(game.phase).toBe('DEALER_ACTION');
  for(const id of ids.slice(1)){vi.advanceTimersByTime(100);act('d','catch',id,'catch-'+id);}
  expect(game.phase).toBe('DEALER_ACTION');
  expect(game.players.get('d')!.acted).toBe(false);
  expect(privateHands.d).toHaveLength(2);
  expect(game.snapshot().catches).toHaveLength(5);
  expect(game.snapshot().results).toEqual([]);
  expect(game.snapshot().settled).toBe(false);
  expect([...game.players.values()].every(p=>p.points===1000)).toBe(true);
  expect(game.deadline-Date.now()).toBe(1000);
  return {ids,hands};
}

describe('final dealer hand after catching every player',()=>{
  it('keeps draw available after five catches, survives reconnect and settles all matches from seven points once',()=>{
    const {ids,hands}=catchAllSixPlayers();
    const provisional=game!.snapshot().catches;
    expect(provisional.find(r=>r.id==='p1')).toMatchObject({outcome:'WIN',delta:10,dealerValue:{score:3}});
    const deadline=game!.deadline;
    act('d','catch','p5','catch-p5');
    expect(game!.deadline).toBe(deadline);
    expect(()=>act('d','catch','p5')).toThrow('ถูกจับแล้ว');
    game!.disconnect('d');game!.reconnect('d');
    expect(game!.snapshot().catches).toEqual(provisional);
    expect(privateHands.d).toEqual(hands[0].slice(0,2));
    act('d','draw',undefined,'draw-final');
    expect(game!.phase).toBe('REVEAL');
    const snapshot=game!.snapshot();
    expect(privateHands.d).toEqual(hands[0]);
    for(const caught of snapshot.catches){
      expect(caught).toMatchObject({outcome:'LOSE',delta:-10,caught:true,catchRecompared:true,dealerValue:{score:7,multiplier:1},dealerCards:hands[0]});
      expect(snapshot.results.find(r=>r.id===caught.id)).toEqual(caught);
    }
    expect(snapshot.results.find(r=>r.id==='d')).toMatchObject({score:7,delta:50});
    act('d','draw',undefined,'draw-final');
    expect(game!.snapshot().results).toEqual(snapshot.results);
    expect(()=>act('d','draw')).toThrow('ยังไม่ถึง');
    vi.advanceTimersByTime(200);
    expect(game!.phase).toBe('ROUND_END');
    expect(game!.players.get('d')!.points).toBe(1050);
    for(const id of ids.slice(1))expect(game!.players.get(id)!.points).toBe(990);
    expect([...game!.players.values()].reduce((sum,p)=>sum+p.points,0)).toBe(6000);
    vi.advanceTimersByTime(5000);
    expect(game!.players.get('d')!.points).toBe(1050);
    act('d','prepareRound');
    expect(game!.snapshot().catches).toEqual([]);
  });

  it('allows standing after all catches and then settles against the final two cards',()=>{
    catchAllSixPlayers();
    act('d','stand');
    expect(game!.phase).toBe('REVEAL');
    for(const caught of game!.snapshot().catches){
      expect(caught.dealerCards).toHaveLength(2);
      expect(caught.dealerValue?.score).toBe(3);
      expect(caught.catchRecompared).toBeUndefined();
    }
    expect(game!.snapshot().results.find(r=>r.id==='d')).toMatchObject({score:3,delta:-40});
    vi.advanceTimersByTime(200);
    expect(game!.players.get('d')!.points).toBe(960);
    expect(privateHands.d).toHaveLength(2);
    expect([...game!.players.values()].reduce((sum,p)=>sum+p.points,0)).toBe(6000);
  });

  it('auto-stands only at the reset deadline after the final catch and pays once',()=>{
    catchAllSixPlayers();
    vi.advanceTimersByTime(999);
    expect(game!.phase).toBe('DEALER_ACTION');
    expect(game!.snapshot().results).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(game!.phase).toBe('REVEAL');
    expect(game!.snapshot().results.find(r=>r.id==='d')).toMatchObject({score:3,delta:-40});
    vi.advanceTimersByTime(200);
    expect(game!.players.get('d')!.points).toBe(960);
    vi.advanceTimersByTime(5000);
    expect(game!.players.get('d')!.points).toBe(960);
  });
});

describe('recompare catches with every final dealer score',()=>{
  it.each(Array.from({length:10},(_,score)=>score))('uses final score %i rather than the original three points',(score)=>{
    const rank=(score+7)%10||10;
    const dealer=[c(8,'hearts'),c(5,'clubs'),c(rank,rank===4?'hearts':'diamonds')];
    const player=[c(10,'clubs'),c(4,'diamonds'),c(13,'clubs')];
    const caught=makeLedger(1,'d',{d:dealer,p:player},{p:10},DEFAULT_RULES,{p:dealer.slice(0,2)});
    const delta=score===4?0:score>4?-10:10;
    expect(caught.results.find(r=>r.id==='p')).toMatchObject({delta,caught:true,catchRecompared:true,dealerCards:dealer,dealerValue:{score}});
    expect(caught.ledger).toEqual(makeLedger(1,'d',{d:dealer,p:player},{p:10}).ledger);
  });

  it('uses the final winning three-card suited multiplier below eight points',()=>{
    const dealer=[c(1,'spades'),c(2,'spades'),c(4,'spades')];
    const player=[c(10,'clubs'),c(4,'diamonds'),c(13,'clubs')];
    const initial=makeLedger(1,'d',{d:dealer.slice(0,2),p:player},{p:10});
    expect(initial.results.find(r=>r.id==='p')).toMatchObject({delta:10,outcome:'WIN'});
    const final=makeLedger(1,'d',{d:dealer,p:player},{p:10},DEFAULT_RULES,{p:dealer.slice(0,2)});
    expect(final.results.find(r=>r.id==='p')).toMatchObject({delta:-30,outcome:'LOSE',catchRecompared:true,dealerValue:{score:7,multiplier:3}});
  });

  it('recompares final dealer specials and pays their final multiplier',()=>{
    const dealer=[c(3,'hearts'),c(3,'diamonds'),c(3,'clubs')];
    const player=[c(4,'hearts'),c(5,'spades'),c(6,'diamonds')];
    const initial=makeLedger(1,'d',{d:dealer.slice(0,2),p:player},{p:10});
    expect(initial.results.find(r=>r.id==='p')).toMatchObject({special:'straight',delta:30,outcome:'WIN'});
    const final=makeLedger(1,'d',{d:dealer,p:player},{p:10},DEFAULT_RULES,{p:dealer.slice(0,2)});
    expect(final.results.find(r=>r.id==='p')).toMatchObject({delta:-50,outcome:'LOSE',catchRecompared:true,dealerValue:{special:'triple',multiplier:5}});
    expect(final.ledger.entries).toEqual({d:50,p:-50});
  });
});
