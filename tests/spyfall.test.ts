import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { SpyfallGame } from '../apps/server/src/spyfall-game';
import { normalizeLocation } from '../apps/server/src/spyfall-locations';
import type { SpySecret } from '../packages/shared/src/spyfall';
let game:SpyfallGame;let secrets:Record<string,SpySecret>;let sequence=0;
function act(id:string,type:string,value?:unknown,roundId=game.roundId,actionId=`spy-${++sequence}`){game.action(id,{type,value,roundId,actionId});}
function start(){act('b','setReady',true);act('c','setReady',true);act('a','startRound');}
function ready(){for(const id of ['a','b','c'])act(id,'readyVote',true);}
function caught(){ready();act('a','vote','b');act('b','vote','a');act('c','vote','a');expect(game.phase).toBe('GUESS');}
beforeEach(()=>{vi.useFakeTimers();secrets={};game=new SpyfallGame('TEST',{changed(){},secret(id,data){secrets[id]=data;}},()=>0);game.add('A','a');game.add('B','b');game.add('C','c');});
afterEach(()=>{game.dispose();vi.useRealTimers();});
describe('Spyfall custom rules',()=>{
  it('distributes exactly one spy and keeps the location out of public state',()=>{
    start();expect(secrets.a.role?.kind).toBe('spy');expect(secrets.a.role?.location).toBeUndefined();
    expect(secrets.b.role?.location).toBe('โรงพยาบาล');expect(secrets.c.role?.location).toBe('โรงพยาบาล');
    expect(secrets.b.role?.occupation).not.toBe(secrets.c.role?.occupation);
    const snapshot=game.snapshot();expect(snapshot.result).toBeNull();expect(snapshot.caughtSpyId).toBeNull();
    expect(snapshot.players.every(p=>!('role'in p)&&!('location'in p))).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('โรงพยาบาล');
  });
  it('supports only 5 or 10 minutes, and automatically starts a three-minute vote',()=>{
    expect(()=>act('a','setQuestionMinutes',3)).toThrow();expect(()=>act('b','setQuestionMinutes',10)).toThrow('เฉพาะ');
    act('a','setQuestionMinutes',10);start();expect(game.deadline-Date.now()).toBe(600000);
    vi.advanceTimersByTime(600000);expect(game.phase).toBe('VOTING');expect(game.deadline-Date.now()).toBe(180000);
    vi.advanceTimersByTime(180000);expect(game.phase).toBe('RESULTS');expect(game.snapshot().result?.reason).toBe('no_majority');
  });
  it('requires everybody ready before voting early and allows readiness cancellation',()=>{
    start();act('a','readyVote',true);act('b','readyVote',true);act('b','readyVote',false);act('c','readyVote',true);
    expect(game.phase).toBe('QUESTION');act('b','readyVote',true);expect(game.phase).toBe('VOTING');
    expect(game.snapshot().phaseDurationMs).toBe(180000);
  });
  it('keeps ballots private and preserves the voter choice on reconnect',()=>{
    start();ready();act('b','vote','a');expect(secrets.b.role?.ownVote).toBe('a');
    expect(game.snapshot().players.find(p=>p.id==='b')?.hasVoted).toBe(true);
    expect(game.snapshot().result).toBeNull();expect('votes'in game.snapshot()).toBe(false);
    game.disconnect('b');game.reconnect('b');expect(secrets.b.role?.ownVote).toBe('a');
    expect(secrets.b.role?.location).toBe('โรงพยาบาล');
  });
  it('correctly caught spy wins only when the single typed guess is correct',()=>{
    start();caught();expect(game.deadline-Date.now()).toBe(60000);expect(game.snapshot().caughtSpyId).toBe('a');
    expect(JSON.stringify(game.snapshot())).not.toContain('โรงพยาบาล');
    act('a','guess',' ร.พ. ');expect(game.snapshot().result?.winner).toBe('spy');expect(game.snapshot().result?.reason).toBe('correct_guess');
    expect(game.players.get('a')?.score).toBe(1);expect(()=>act('a','guess','โรงเรียน')).toThrow();expect(game.players.get('a')?.score).toBe(1);
  });
  it('citizens win after catching the spy and receiving a wrong answer',()=>{
    start();caught();act('a','guess','โรงเรียน');expect(game.snapshot().result?.winner).toBe('citizens');
    expect(game.snapshot().result?.reason).toBe('wrong_guess');expect(game.players.get('b')?.score).toBe(1);expect(game.players.get('c')?.score).toBe(1);
  });
  it('citizens win if the caught spy answer timer expires',()=>{
    start();caught();vi.advanceTimersByTime(59999);expect(game.phase).toBe('GUESS');vi.advanceTimersByTime(1);
    expect(game.snapshot().result?.reason).toBe('guess_timeout');expect(game.snapshot().result?.winner).toBe('citizens');
  });
  it('wrong accusation or tied votes lets the spy win without a guess',()=>{
    start();ready();act('a','vote','b');act('b','vote','c');act('c','vote','b');
    expect(game.snapshot().result?.winner).toBe('spy');expect(game.snapshot().result?.reason).toBe('wrong_accusation');
    act('a','prepareRound');start();ready();act('a','vote','b');act('b','vote','c');act('c','vote','a');
    expect(game.snapshot().result?.reason).toBe('no_majority');
  });
  it('locks guesses to the caught spy and rejects invalid/stale/duplicate commands',()=>{
    start();expect(()=>act('a','guess','โรงพยาบาล')).toThrow();expect(()=>act('a','vote','b')).toThrow();
    caught();expect(()=>act('b','guess','โรงพยาบาล')).toThrow();expect(()=>act('a','guess','')).toThrow();
    expect(()=>act('a','guess','โรงพยาบาล',0)).toThrow();act('a','guess','โรงเรียน',1,'same');
    act('a','guess','โรงพยาบาล',1,'same');expect(game.snapshot().result?.winner).toBe('citizens');expect(game.players.get('b')?.score).toBe(1);
  });
  it('supports public chat safely as plain text, limits spam and pauses chat during the guess',()=>{
    act('a','chat','<script>alert(1)</script>');expect(game.snapshot().chat[0].text).toBe('<script>alert(1)</script>');
    act('a','chat','สอง');act('a','chat','สาม');expect(()=>act('a','chat','สี่')).toThrow('เร็ว');
    vi.advanceTimersByTime(5000);act('a','chat','สี่');expect(()=>act('a','chat','x'.repeat(501))).toThrow();
    start();act('b','chat','ที่นี่มีคนเยอะไหม?');expect(game.snapshot().chat).toHaveLength(1);
    caught();expect(()=>act('b','chat','โรงพยาบาล')).toThrow('พักแชต');act('a','guess','ผิด');act('b','chat','จบแล้ว');
    expect(game.snapshot().chat.at(-1)?.text).toBe('จบแล้ว');
  });
  it('resets roles, ballots and chat for the next round without automatic redealing',()=>{
    start();caught();act('a','guess','ผิด');act('a','prepareRound');expect(game.phase).toBe('LOBBY');
    expect(secrets.b.role).toBeNull();expect(game.snapshot().result).toBeNull();expect(game.snapshot().chat).toEqual([]);
    vi.advanceTimersByTime(600000);expect(game.phase).toBe('LOBBY');start();expect(game.roundId).toBe(2);
  });
  it('enforces minimum players, readiness, maximum capacity and no active-round joins',()=>{
    game.expire('c');expect(()=>act('a','startRound')).toThrow('3–8');game.add('C','c');expect(()=>act('a','startRound')).toThrow('พร้อม');
    start();expect(()=>game.add('D','d')).toThrow('รอรอบ');
  });
  it('preserves disconnected participants until result and transfers host',()=>{
    start();game.disconnect('a');game.expire('a');expect(game.hostId).toBe('b');expect(game.players.has('a')).toBe(true);
    vi.advanceTimersByTime(300000+180000);expect(game.phase).toBe('RESULTS');expect(game.players.has('a')).toBe(false);
    expect(game.snapshot().result?.spyId).toBe('a');
  });
  it('normalizes Thai combining marks and case without accepting arbitrary substring guesses',()=>{
    expect(normalizeLocation(' ร.พ. ')).toBe(normalizeLocation('รพ'));
    expect(normalizeLocation('Hospital')).toBe(normalizeLocation('hospital'));
    start();caught();act('a','guess','โรงพยาบาลหรือโรงเรียน');expect(game.snapshot().result?.winner).toBe('citizens');
  });
});
