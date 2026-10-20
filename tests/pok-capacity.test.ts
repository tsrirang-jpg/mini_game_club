import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {Game} from '../apps/server/src/game';
import {DEFAULT_RULES,deck,evaluate} from '../packages/shared/src/index';
import type {ActionType,Card} from '../packages/shared/src/index';
import {dealRandom} from './pok-test-deck';
let game:Game, serial=0;
const act=(id:string,type:ActionType,value?:string|boolean)=>game.action(id,{type,value,roundId:game.roundId,actionId:'capacity-'+ ++serial});
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{game?.dispose();vi.useRealTimers();});
// Every initial pair has fewer than eight points, so all ten seats can draw a third card.
function fullDeal(count:number){
  const available=deck(),pairs:Card[][]=[];
  for(let i=0;i<count;i++){
    const first=available.shift()!;
    const partner=available.findIndex(card=>!evaluate([first,card],DEFAULT_RULES).pok);
    pairs.push([first,available.splice(partner,1)[0]]);
  }
  return [...pairs.map(h=>h[0]),...pairs.map(h=>h[1]),...available.slice(0,count)];
}
describe('Pok Deng capacity',()=>{
  it.each([2,3,4,5,6,7,8,9,10])('deals and settles %i players after every opponent is caught and the dealer draws',count=>{
    const hands:Record<string,Card[]>={};
    game=new Game('CAPACITY',{changed(){},privateHand(id,cards){hands[id]=cards;}},
      {...DEFAULT_RULES,dealMs:10,actionMs:1000,revealMs:10,settlementMs:10},dealRandom(fullDeal(count)));
    for(let i=0;i<count;i++)game.add('Player '+i,'p'+i);
    for(let i=1;i<count;i++)act('p'+i,'setReady',true);
    act('p0','startRound');vi.advanceTimersByTime(10);
    expect(game.phase).toBe('PLAYER_ACTIONS');
    expect(Object.values(hands).flat()).toHaveLength(count*2);
    for(let i=1;i<count;i++)act('p'+i,'draw');
    expect(game.phase).toBe('DEALER_ACTION');
    for(let i=1;i<count;i++)act('p0','catch','p'+i);
    expect(game.phase).toBe('DEALER_ACTION');
    expect(game.snapshot().catches).toHaveLength(count-1);
    expect(game.snapshot().results).toEqual([]);
    act('p0','draw');
    const cards=Object.values(hands).flat();
    expect(cards).toHaveLength(count*3);
    expect(new Set(cards.map(c=>c.suit+':'+c.rank)).size).toBe(count*3);
    expect(game.snapshot().results).toHaveLength(count);
    expect(game.snapshot().catches.every(r=>r.catchRecompared&&r.dealerCards?.length===3)).toBe(true);
    vi.advanceTimersByTime(20);
    expect(game.phase).toBe('ROUND_END');
    expect([...game.players.values()].reduce((sum,p)=>sum+p.points,0)).toBe(count*1000);
    const balances=game.snapshot().players.map(p=>p.points);
    vi.advanceTimersByTime(5000);expect(game.snapshot().players.map(p=>p.points)).toEqual(balances);
  });
  it('allows nine uniquely named bots, rejects the eleventh seat and reuses a removed seat',()=>{
    game=new Game('BOTS',{changed(){},privateHand(){}});game.add('Host','host');
    for(let i=0;i<9;i++)game.addBot();
    const bots=game.snapshot().players.filter(p=>p.isBot);
    expect(bots).toHaveLength(9);expect(new Set(bots.map(p=>p.name)).size).toBe(9);
    expect(game.snapshot().players.map(p=>p.seat)).toEqual([0,1,2,3,4,5,6,7,8,9]);
    expect(()=>game.addBot()).toThrow('ห้องเต็ม');expect(()=>game.add('Extra','extra')).toThrow('ห้องเต็ม');
    act('host','removeBot',bots[4].id);const replacement=game.addBot();
    expect(game.players.get(replacement)?.seat).toBe(bots[4].seat);
    expect(game.players.get(replacement)?.name).toBe(bots[4].name);
  });
});
