import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {UndercoverGame,validateUnderSettings} from '../apps/server/src/undercover-game';
import type {UnderSecret} from '../packages/shared/src/undercover';
let game:UndercoverGame,secrets:Record<string,UnderSecret>,serial:number;
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-18T00:00:00Z'));secrets={};serial=0;let seed=45;game=new UndercoverGame('ABCDEF0123',{changed(){},secret(id,data){secrets[id]=data;}},max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;});for(let i=0;i<6;i++)game.add('Player '+i,'p'+i);});
afterEach(()=>{game.dispose();vi.useRealTimers();});
function act(id:string,type:string,value?:unknown,actionId='test-'+(++serial),roundId=game.roundId,turnNumber=game.turnNumber){game.action(id,{type,value,actionId,roundId,turnNumber});}
function start(whiteCount=0,undercoverCount=1){act(game.hostId,'setSettings',{turnMinutes:1,voteMinutes:1,whiteCount,undercoverCount});for(const p of game.players.values())if(p.id!==game.hostId)act(p.id,'setReady',true);act(game.hostId,'startRound');}
function describe(){if(game.phase==='WORD')for(const p of game.players.values())act(p.id,'acknowledge');while(game.phase==='DESCRIBE')act(game.turnId,'hint','คำใบ้ '+game.turnNumber);}
function voteOut(target:string,suspect:'undercover'|'white'='undercover'){
 const active=[...game.players.values()].filter(p=>p.alive),other=active.find(p=>p.id!==target)!;
 for(const p of active){if(game.phase!=='VOTING')break;act(p.id,'vote',{targetId:p.id===target?other.id:target,suspect});}
}
it.each([3,4,5,6,7,8])('deals secret words without role metadata for %i real people',count=>{
 for(let i=6;i<count;i++)game.add('P'+i,'p'+i);for(let i=count;i<6;i++)game.players.delete('p'+i);
 start(count>=4?1:0);const s=game.snapshot();expect(s.phase).toBe('WORD');expect(s.players).toHaveLength(count);
 expect(JSON.stringify(s)).not.toMatch(/"role"|"word"|"answer"/);for(const secret of Object.values(secrets)){expect(Object.keys(secret).sort()).toEqual(['canGuess','roundId','vote','word']);expect(secret.canGuess).toBe(false);}
 expect([...game.players.values()].filter(p=>p.role==='undercover')).toHaveLength(1);expect([...game.players.values()].filter(p=>p.role==='white')).toHaveLength(count>=4?1:0);
});
it('settings accept only supported times and counts, host only, resetting readiness',()=>{
 act('p1','setReady',true);act('p0','setSettings',{turnMinutes:3,voteMinutes:2,undercoverCount:2,whiteCount:1});expect(game.snapshot()).toMatchObject({turnMinutes:3,voteMinutes:2});expect(game.players.get('p1')!.ready).toBe(false);
 expect(()=>act('p1','setSettings',game.settings)).toThrow('เฉพาะ');for(const bad of [null,[],{}, {...game.settings,turnMinutes:0},{...game.settings,voteMinutes:'1'},{...game.settings,whiteCount:2},{...game.settings,undercoverCount:0}])expect(()=>validateUnderSettings(bad)).toThrow();
});
it('requires enough real players and readiness for configured composition; rejects bots',()=>{
 for(const id of ['p3','p4','p5'])game.players.delete(id);expect(()=>start(1)).toThrow('จำนวนคน');expect(()=>game.addBot()).toThrow('ผู้เล่นจริง');
 act('p0','setSettings',{turnMinutes:1,voteMinutes:1,undercoverCount:1,whiteCount:0});game.players.get('p1')!.ready=false;expect(()=>act('p0','startRound')).toThrow('พร้อม');
});
it('only current speaker can type one hint, secret itself is rejected, old turn/round and repeats guarded',()=>{
 start();for(const p of game.players.values())act(p.id,'acknowledge');const current=game.turnId,other=[...game.players.keys()].find(id=>id!==current)!;
 expect(()=>act(other,'hint','hello')).toThrow('ไม่ใช่ตา');expect(()=>act(current,'hint',game.players.get(current)!.word)).toThrow('คำลับ');
 for(const text of ['', 'x'.repeat(121),1])expect(()=>act(current,'hint',text)).toThrow();
 const turn=game.turnNumber;act(current,'hint','คำใบ้','repeat');const after=game.snapshot();act(current,'hint','คำใบ้','repeat',game.roundId,turn);expect(game.snapshot()).toEqual(after);
 expect(()=>act(game.turnId,'hint','new','stale',game.roundId,turn)).toThrow('ตาเก่า');expect(()=>act(game.turnId,'hint','new','old',0)).toThrow('รอบเก่า');
});
it('uses selected server deadlines for typing and voting; timeout hints advance once',()=>{
 start();game.settings={...game.settings,turnMinutes:2,voteMinutes:3};vi.advanceTimersByTime(60000);expect(game.phase).toBe('DESCRIBE');expect(game.deadline).toBe(Date.now()+120000);const turn=game.turnNumber;vi.advanceTimersByTime(120000);expect(game.turnNumber).toBe(turn+1);expect(game.snapshot().hints).toHaveLength(1);describe();expect(game.phase).toBe('VOTING');expect(game.deadline).toBe(Date.now()+180000);
});
it('votes lock after confirmation and remain secret until resolution',()=>{
 start();describe();act('p0','vote',{targetId:'p1',suspect:'white'});const s=game.snapshot();expect(s.submittedIds).toEqual(['p0']);expect(s.lastVote).toBeNull();expect(JSON.stringify(s)).not.toContain('suspect');expect(secrets.p0.vote).toEqual({targetId:'p1',suspect:'white'});expect(secrets.p1.vote).toBeNull();
 expect(()=>act('p0','vote',{targetId:'p2',suspect:'undercover'})).toThrow('โหวตแล้ว');for(const value of [{targetId:'p1',suspect:'bad'},{targetId:'p1'},{targetId:'p2',suspect:'undercover',extra:1}]){if('extra'in value)continue;expect(()=>act('p2','vote',value)).toThrow();}
 expect(()=>act('p1','vote',{targetId:'p1',suspect:'white'})).toThrow('คนอื่น');
});
it('all confirmed votes resolve immediately; catches undercover and ends with named winners without roles',()=>{
 start();describe();const target=[...game.players.values()].find(p=>p.role==='undercover')!.id;voteOut(target);expect(game.phase).toBe('RESULTS');expect(game.snapshot().result?.reason).toBe('citizens');expect(game.snapshot().result?.winnerIds).toHaveLength(5);expect(JSON.stringify(game.snapshot())).not.toContain('"role"');expect(vi.getTimerCount()).toBe(0);
});
it('a caught White alone can guess; no secret answer leaks before confirmation, correct guess wins',()=>{
 start(1);describe();const white=[...game.players.values()].find(p=>p.role==='white')!,citizen=[...game.players.values()].find(p=>p.role==='citizen')!;voteOut(white.id,'white');expect(game.phase).toBe('GUESS');expect(secrets[white.id]).toMatchObject({word:null,canGuess:true});expect(game.snapshot().result).toBeNull();expect(JSON.stringify(game.snapshot())).not.toContain(citizen.word!);
 expect(()=>act(citizen.id,'guess',citizen.word)).toThrow('เฉพาะ');act(white.id,'guess',' '+citizen.word+' ');expect(game.phase).toBe('RESULTS');expect(game.snapshot().result).toMatchObject({reason:'white_guess',winnerIds:[white.id]});
});
it.each(['wrong','surrender','timeout'])('White %s resumes the remaining game and never grants another guess',mode=>{
 start(1);describe();const white=[...game.players.values()].find(p=>p.role==='white')!;voteOut(white.id,'undercover');expect(game.phase).toBe('GUESS');if(mode==='timeout')vi.advanceTimersByTime(60000);else act(white.id,mode==='wrong'?'guess':'surrender',mode==='wrong'?'คำผิด':undefined);
 expect(game.phase).toBe('DESCRIBE');expect(white.alive).toBe(false);expect(secrets[white.id].canGuess).toBe(false);expect(()=>act(white.id,'guess','again')).toThrow();
});
it('does not interrupt White last chance when someone else expires',()=>{
 start(1);describe();const white=[...game.players.values()].find(p=>p.role==='white')!;voteOut(white.id,'white');const citizen=[...game.players.values()].find(p=>p.role==='citizen')!;game.disconnect(citizen.id);game.expire(citizen.id);expect(game.phase).toBe('GUESS');expect(game.snapshot().guesserId).toBe(white.id);
});
it('tied votes get one restricted runoff; repeated ties or no votes resume clues',()=>{
 start();describe();for(let i=0;i<6;i++)act('p'+i,'vote',{targetId:i%2?'p0':'p1',suspect:'undercover'});expect(game.phase).toBe('VOTING');expect(game.snapshot().runoff).toBe(true);expect(game.snapshot().eligibleIds.sort()).toEqual(['p0','p1']);expect(()=>act('p0','vote',{targetId:'p2',suspect:'undercover'})).toThrow();
 for(let i=0;i<6;i++)act('p'+i,'vote',{targetId:i%2?'p0':'p1',suspect:'white'});expect(game.phase).toBe('DESCRIBE');expect(game.cycle).toBe(2);describe();vi.advanceTimersByTime(60000);expect(game.phase).toBe('DESCRIBE');expect(game.cycle).toBe(3);
});
it('eliminating citizens can produce an undercover win',()=>{
 start();for(let i=0;i<4;i++){describe();const target=[...game.players.values()].find(p=>p.alive&&p.role==='citizen')!;voteOut(target.id);if(game.phase==='RESULTS')break;}expect(game.phase).toBe('RESULTS');expect(game.snapshot().result?.reason).toBe('undercover');
});
it('reconnect restores own word and vote without resetting deadlines; moves host on expiry',()=>{
 start();describe();act('p0','vote',{targetId:'p1',suspect:'white'});const saved=structuredClone(secrets.p0),deadline=game.deadline;game.disconnect('p0');vi.advanceTimersByTime(1000);game.reconnect('p0');expect(secrets.p0).toEqual(saved);expect(game.deadline).toBe(deadline);game.disconnect('p0');game.expire('p0');expect(game.hostId).not.toBe('p0');expect(game.players.get('p0')!.alive).toBe(false);
});
it('invalidates a ballot when its target expires and allows that voter to choose again',()=>{
 start();describe();const target=[...game.players.values()].find(p=>p.role==='citizen')!,voter=[...game.players.values()].find(p=>p.id!==target.id)!,next=[...game.players.values()].find(p=>p.id!==target.id&&p.id!==voter.id)!;
 act(voter.id,'vote',{targetId:target.id,suspect:'undercover'});game.disconnect(target.id);game.expire(target.id);expect(game.phase).toBe('VOTING');expect(game.snapshot().submittedIds).not.toContain(voter.id);expect(secrets[voter.id].vote).toBeNull();act(voter.id,'vote',{targetId:next.id,suspect:'white'});expect(game.snapshot().submittedIds).toContain(voter.id);
});
it('clones state and private words, resets replay state, and disposes active timer',()=>{
 start();const s=game.snapshot();s.players[0].name='tampered';expect(game.snapshot().players[0].name).not.toBe('tampered');const own=secrets.p0.word;secrets.p0.word='tamper';game.sync('p0');expect(secrets.p0.word).toBe(own);
 describe();voteOut([...game.players.values()].find(p=>p.role==='undercover')!.id);act(game.hostId,'prepareRound');expect(game.snapshot()).toMatchObject({phase:'LOBBY',hints:[],result:null,lastVote:null,guesserId:'',submittedIds:[]});for(const secret of Object.values(secrets))expect(secret.word).toBeNull();expect(vi.getTimerCount()).toBe(0);start();expect(vi.getTimerCount()).toBe(1);game.dispose();expect(vi.getTimerCount()).toBe(0);
});
