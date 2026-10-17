import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { WhoAmIGame,validateWhoSettings } from '../apps/server/src/whoami-game';
import { WHO_WORDS,normalizeWhoWord } from '../apps/server/src/whoami-words';
import { WHO_DEFAULT_SETTINGS } from '../packages/shared/src/whoami';
import type { WhoPrivate } from '../packages/shared/src/whoami';
let game:WhoAmIGame,secrets:Record<string,WhoPrivate>,serial=0;
const act=(id:string,type:string,value?:unknown,extra:Record<string,unknown>={})=>game.action(id,{type,value,roundId:game.roundId,turnNumber:game.snapshot().turnNumber,actionId:`who-${++serial}`,...extra});
const word=(id:string)=>Object.values(secrets).flatMap(p=>p.identities).find(p=>p.playerId===id)!.word;
function start(){act('b','setReady',true);act('c','setReady',true);act('a','startRound');}
function solve(){while(game.phase==='PLAYING'){const s=game.snapshot();act(s.turnId,'guess',word(s.turnId));}}
beforeEach(()=>{vi.useFakeTimers();secrets={};game=new WhoAmIGame('TEST',{changed(){},identities(id,data){secrets[id]=data;}},()=>0);for(const id of ['a','b','c'])game.add(id.toUpperCase(),id);});
afterEach(()=>{game.dispose();vi.useRealTimers();});
describe('Who am I rules and data boundaries',()=>{
 it('validates exact categories/times/round choices and defaults',()=>{
  expect(validateWhoSettings(WHO_DEFAULT_SETTINGS)).toEqual(WHO_DEFAULT_SETTINGS);
  for(const settings of [{category:'bad'},{turnMinutes:4},{questionRounds:3},{gameRounds:4},{gameRounds:'3'},{questionRounds:NaN}])expect(()=>validateWhoSettings({...WHO_DEFAULT_SETTINGS,...settings})).toThrow();
  for(const questionRounds of [4,6,8,10])for(const gameRounds of [3,5,7,10])expect(validateWhoSettings({...WHO_DEFAULT_SETTINGS,questionRounds,gameRounds})).toMatchObject({questionRounds,gameRounds});
 });
 it('requires 3–8 connected players, everyone ready and host-only settings/start',()=>{
  expect(()=>act('b','startRound')).toThrow('เฉพาะ');expect(()=>act('a','startRound')).toThrow('พร้อม');
  expect(()=>act('b','setSettings',WHO_DEFAULT_SETTINGS)).toThrow('เฉพาะ');
  act('b','setReady',true);act('a','setSettings',{...WHO_DEFAULT_SETTINGS,questionRounds:8});expect(game.players.get('b')!.ready).toBe(false);
  game.expire('c');expect(()=>act('a','startRound')).toThrow('3–8');
 });
 it('supports eight seats without duplicate identities and rejects a ninth seat',()=>{
  for(const id of ['d','e','f','g','h'])game.add(id,id);expect(()=>game.add('I','i')).toThrow('เต็ม');
  for(const id of ['b','c','d','e','f','g','h'])act(id,'setReady',true);act('a','startRound');
  expect(new Set(secrets.a.identities.map(w=>w.word).concat(word('a'))).size).toBe(8);
 });
 it('sends other identities privately, never own identity or full word pool in public state',()=>{
  start();for(const id of ['a','b','c']){expect(secrets[id].identities).toHaveLength(2);expect(secrets[id].identities.some(p=>p.playerId===id)).toBe(false);}
  for(const id of ['a','b','c'])expect(JSON.stringify(game.snapshot())).not.toContain(word(id));
  const copy=secrets.a.identities[0];copy.word='tampered';game.sync('a');expect(secrets.a.identities[0].word).not.toBe('tampered');
 });
 it('assigns words from the selected category and has at least eight distinct words per category',()=>{
  for(const category of ['animals','jobs','objects'])expect(WHO_WORDS.filter(w=>w.category===category).length).toBeGreaterThanOrEqual(8);
  act('a','setSettings',{...WHO_DEFAULT_SETTINGS,category:'jobs'});start();
  for(const id of ['a','b','c'])expect(WHO_WORDS.find(w=>w.word===word(id))!.category).toBe('jobs');
 });
 it('asks once and locks one answer per peer, including after reconnect',()=>{
  start();act('a','ask','ฉันเป็นคนใช่ไหม?');expect(()=>act('a','ask','ถามซ้ำ')).toThrow('ถามแล้ว');
  expect(()=>act('a','answer','yes')).toThrow('เพื่อน');act('b','answer','yes');expect(()=>act('b','answer','no')).toThrow('เปลี่ยนไม่ได้');
  game.disconnect('b');game.reconnect('b');expect(secrets.b.ownAnswer).toBe('yes');expect(()=>act('b','answer','unknown')).toThrow();
  expect(game.snapshot().question?.answer).toBeNull();act('c','answer','yes');expect(game.snapshot().question).toMatchObject({answer:'yes',counts:{yes:2,no:0,unknown:0}});
 });
 it('resolves ties/unknown votes without inventing a yes/no majority',()=>{
  start();act('a','ask','เป็นสัตว์ไหม?');act('b','answer','yes');act('c','answer','no');expect(game.snapshot().question?.answer).toBe('unknown');
  act('a','endTurn');act('b','ask','ทำงานไหม?');act('a','answer','unknown');act('c','answer','yes');expect(game.snapshot().question?.answer).toBe('unknown');
 });
 it('forbids guessing after asking until the same player gets their next turn',()=>{
  start();act('a','ask','มีชีวิตไหม?');expect(()=>act('a','guess',word('a'))).toThrow('ครั้งถัดไป');
  act('b','answer','yes');act('c','answer','yes');expect(()=>act('a','guess',word('a'))).toThrow('ครั้งถัดไป');
  for(const id of ['a','b','c'])act(id,'endTurn');expect(game.snapshot().turnId).toBe('a');act('a','guess',word('a'));expect(game.players.get('a')).toMatchObject({score:1,solved:true});
 });
 it('allows guessing at the start of own turn and advances on wrong guesses',()=>{
  start();expect(()=>act('b','guess',word('b'))).toThrow('ตาของ');act('a','guess','ผิดแน่นอน');expect(game.snapshot().turnId).toBe('b');expect(game.players.get('a')!.score).toBe(0);
  act('b','guess',word('b'));expect(game.players.get('b')).toMatchObject({score:1,solved:true});act('c','endTurn');act('a','endTurn');expect(game.snapshot().turnId).toBe('c');
 });
 it('counts cycles per player, closes exactly at the configured question-round limit',()=>{
  start();for(let i=0;i<12;i++){expect(game.snapshot().questionRound).toBe(Math.floor(i/3)+1);act(game.snapshot().turnId,'endTurn');}
  expect(game.phase).toBe('GAME_END');expect(game.snapshot().result?.reason).toBe('round_limit');expect(game.deadline).toBe(0);
 });
 it('continues until every player has had a chance to score and reveals only at game end',()=>{
  start();const ownWord=word('a');act('a','guess',ownWord);expect(game.phase).toBe('PLAYING');expect(game.snapshot().result).toBeNull();
  solve();expect(game.phase).toBe('GAME_END');expect(game.snapshot().result?.reason).toBe('all_solved');expect(game.snapshot().result?.identities).toHaveLength(3);
  expect(game.snapshot().players.map(p=>p.score)).toEqual([1,1,1]);
 });
 it('runs the selected number of games, changes identities and accumulates scores once',()=>{
  start();let previous=word('a');for(let n=1;n<=3;n++){
    expect(game.snapshot().gameNumber).toBe(n);solve();expect(game.players.get('a')!.score).toBe(n);
    if(n<3){const oldRound=game.roundId;act('a','nextGame');expect(game.roundId).toBe(oldRound+1);expect(word('a')).not.toBe(previous);previous=word('a');}
  }
  expect(game.phase).toBe('RESULTS');expect(()=>act('a','nextGame')).toThrow();act('a','prepareRound');expect(game.phase).toBe('LOBBY');expect(secrets.a.identities).toEqual([]);start();expect(game.players.get('a')!.score).toBe(0);
 });
 it('normalizes explicit Thai/English aliases but never accepts partial words',()=>{
  expect(normalizeWhoWord('  C-A-T ')).toBe('cat');start();act('a','guess',' C-A-T ');expect(game.players.get('a')!.solved).toBe(true);
  act('b','guess','สุ');expect(game.players.get('b')!.solved).toBe(false);
 });
 it('rejects stale turn/round/replay, invalid payloads and late actions without state change',()=>{
  start();const old=game.snapshot(),actionId='same-command';act('a','endTurn',undefined,{actionId});const after=game.snapshot().turnNumber;
  act('a','endTurn',undefined,{actionId,turnNumber:old.turnNumber});expect(game.snapshot().turnNumber).toBe(after);
  expect(()=>act('b','ask','bad',{turnNumber:old.turnNumber})).toThrow('ตาเก่า');expect(()=>act('b','ask','bad',{roundId:0})).toThrow('เกมเก่า');
  for(const value of ['',{},'x'.repeat(201)])expect(()=>act('b','ask',value)).toThrow();
  vi.setSystemTime(game.deadline);expect(()=>act('b','guess',word('b'))).toThrow('หมดเวลา');
 });
 it('keeps one bounded authoritative timer, without resets after answer/reconnect; dispose cancels it',()=>{
  start();const deadline=game.deadline;act('a','ask','test');act('b','answer','yes');game.disconnect('b');game.reconnect('b');expect(game.deadline).toBe(deadline);expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(60000);expect(game.snapshot().turnId).toBe('b');expect(game.snapshot().history[0].answer).toBe('unknown');expect(vi.getTimerCount()).toBe(1);
  game.dispose();expect(vi.getTimerCount()).toBe(0);
 });
 it('skips expired players, transfers host and cannot get stuck when peers leave',()=>{
  start();game.disconnect('a');game.expire('a');expect(game.hostId).toBe('b');expect(game.snapshot().turnId).toBe('b');game.disconnect('c');game.expire('c');act('b','endTurn');expect(game.phase).toBe('GAME_END');expect(game.snapshot().result?.reason).toBe('not_enough_players');expect(()=>act('b','nextGame')).toThrow('อย่างน้อย');act('b','prepareRound');expect(game.players.size).toBe(1);
 });
 it('returns deep copies of snapshots and only resends private state on read-only sync',()=>{
  start();act('a','ask','test');act('b','answer','yes');const before=game.snapshot();before.question!.respondedIds.length=0;before.players[0].score=999;before.history[0].text='changed';game.sync('b');
  expect(game.snapshot().question!.respondedIds).toEqual(['b']);expect(game.snapshot().players[0].score).toBe(0);expect(game.snapshot().history[0].text).toBe('test');
 });
});
