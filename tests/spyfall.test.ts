import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { SpyfallGame } from '../apps/server/src/spyfall-game';
import { SPY_LOCATIONS, normalizeLocation } from '../apps/server/src/spyfall-locations';
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
  it('supports 5, 7 or 10 minutes, and automatically starts a 60-second vote',()=>{
    expect(()=>act('a','setQuestionMinutes',3)).toThrow();expect(()=>act('b','setQuestionMinutes',10)).toThrow('เฉพาะ');
    act('a','setQuestionMinutes',10);start();expect(game.deadline-Date.now()).toBe(600000);
    vi.advanceTimersByTime(600000);expect(game.phase).toBe('VOTING');expect(game.deadline-Date.now()).toBe(60000);
    vi.advanceTimersByTime(60000);expect(game.phase).toBe('RESULTS');expect(game.snapshot().result?.reason).toBe('no_majority');
  });
  it('requires everybody ready before voting early and allows readiness cancellation',()=>{
    start();act('a','readyVote',true);act('b','readyVote',true);act('b','readyVote',false);act('c','readyVote',true);
    expect(game.phase).toBe('QUESTION');act('b','readyVote',true);expect(game.phase).toBe('VOTING');
    expect(game.snapshot().phaseDurationMs).toBe(60000);
  });
  it('keeps ballots private and preserves the voter choice on reconnect',()=>{
    start();ready();act('b','vote','a');expect(secrets.b.role?.ownVote).toBe('a');
    expect(game.snapshot().players.find(p=>p.id==='b')?.hasVoted).toBe(true);
    expect(game.snapshot().result).toBeNull();expect('votes'in game.snapshot()).toBe(false);
    game.disconnect('b');game.reconnect('b');expect(secrets.b.role?.ownVote).toBe('a');
    expect(secrets.b.role?.location).toBe('โรงพยาบาล');
  });
  it('locks a confirmed vote, including after reconnect, without extending the voting deadline',()=>{
    start();ready();const deadline=game.deadline;
    act('b','vote','a',game.roundId,'confirmed-vote');
    act('b','vote','c',game.roundId,'confirmed-vote');
    expect(()=>act('b','vote','c')).toThrow('เปลี่ยนเสียงไม่ได้');
    vi.advanceTimersByTime(5000);game.disconnect('b');game.reconnect('b');
    expect(game.deadline).toBe(deadline);expect(game.deadline-Date.now()).toBe(55000);
    expect(secrets.b.role?.ownVote).toBe('a');
    expect(()=>act('b','vote','c')).toThrow('เปลี่ยนเสียงไม่ได้');
    expect(game.snapshot().players.filter(p=>p.hasVoted)).toHaveLength(1);
  });
  it('waits for every confirmation even with a majority, then immediately gives the spy 60 seconds',()=>{
    start();ready();act('b','vote','a');act('c','vote','a');
    expect(game.phase).toBe('VOTING');expect(game.snapshot().result).toBeNull();
    vi.advanceTimersByTime(2000);act('a','vote','b');
    expect(game.phase).toBe('GUESS');expect(game.deadline-Date.now()).toBe(60000);
    expect(game.snapshot().result).toBeNull();
    act('a','guess','โรงเรียน');expect(game.snapshot().result?.winner).toBe('citizens');
    vi.advanceTimersByTime(60000);expect(game.players.get('b')?.score).toBe(1);
  });
  it.each([false,true])('closes after exactly 60 seconds with missing confirmations (majority: %s)',majority=>{
    start();ready();act('b','vote','a');if(majority)act('c','vote','a');
    vi.advanceTimersByTime(59999);expect(game.phase).toBe('VOTING');
    vi.advanceTimersByTime(1);expect(game.phase).toBe(majority?'GUESS':'RESULTS');
    if(majority){act('a','guess','โรงพยาบาล');expect(game.snapshot().result?.winner).toBe('spy');}
    else expect(game.snapshot().result).toMatchObject({winner:'spy',reason:'no_majority',votes:{a:null,b:'a',c:null}});
  });
  it('rejects self votes, invalid choices and confirmations at or after the deadline',()=>{
    start();ready();expect(()=>act('b','vote','b')).toThrow();expect(()=>act('b','vote','unknown')).toThrow();
    expect(game.players.get('b')?.hasVoted).toBe(false);
    vi.setSystemTime(game.deadline);expect(()=>act('b','vote','a')).toThrow();
    expect(game.players.get('b')?.hasVoted).toBe(false);
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
  it('lets only the spy win with a correct answer during questioning, without a public accusation',()=>{
    start();expect(()=>act('b','guess','โรงพยาบาล')).toThrow('เฉพาะสายลับ');
    expect(game.snapshot().caughtSpyId).toBeNull();expect(game.snapshot().result).toBeNull();
    act('a','guess',' HOSPITAL ');
    expect(game.snapshot().result).toMatchObject({winner:'spy',reason:'correct_guess',accusedId:null,location:'โรงพยาบาล'});
    expect(game.snapshot().result?.votes).toEqual({a:null,b:null,c:null});
    expect(game.players.get('a')?.score).toBe(1);
    vi.advanceTimersByTime(600000);expect(game.phase).toBe('RESULTS');expect(game.players.get('a')?.score).toBe(1);
  });
  it('awards citizens once when the spy answers incorrectly during questioning',()=>{
    start();expect(()=>act('a','guess','')).toThrow();expect(()=>act('a','guess','โรงพยาบาล',0)).toThrow();
    expect(game.phase).toBe('QUESTION');
    act('a','guess','โรงเรียน',1,'early-answer');act('a','guess','โรงพยาบาล',1,'early-answer');
    expect(()=>act('a','guess','โรงพยาบาล')).toThrow();
    expect(game.snapshot().result).toMatchObject({winner:'citizens',reason:'wrong_guess',accusedId:null});
    expect([...game.players.values()].map(p=>p.score)).toEqual([0,1,1]);
    vi.advanceTimersByTime(600000);expect([...game.players.values()].map(p=>p.score)).toEqual([0,1,1]);
  });
  it('rejects a question-stage answer that arrives after the question deadline',()=>{
    start();vi.setSystemTime(game.deadline+1);
    expect(()=>act('a','guess','โรงพยาบาล')).toThrow();expect(game.snapshot().result).toBeNull();
  });
  it('citizens win if the caught spy answer timer expires',()=>{
    start();caught();vi.advanceTimersByTime(59999);expect(game.phase).toBe('GUESS');vi.advanceTimersByTime(1);
    expect(game.snapshot().result?.reason).toBe('guess_timeout');expect(game.snapshot().result?.winner).toBe('citizens');
  });
  it('lets a caught spy surrender immediately and awards citizens only once',()=>{
    start();caught();act('a','surrender',undefined,game.roundId,'give-up');
    expect(game.phase).toBe('RESULTS');expect(game.deadline).toBe(0);
    expect(game.snapshot().result).toMatchObject({winner:'citizens',reason:'spy_surrendered',accusedId:'a',guess:'',location:'โรงพยาบาล'});
    expect([...game.players.values()].map(p=>p.score)).toEqual([0,1,1]);
    act('a','surrender',undefined,game.roundId,'give-up');
    expect(()=>act('a','surrender')).toThrow();expect(()=>act('a','guess','โรงพยาบาล')).toThrow();
    vi.advanceTimersByTime(120000);expect(game.snapshot().result?.reason).toBe('spy_surrendered');
    expect([...game.players.values()].map(p=>p.score)).toEqual([0,1,1]);
    act('a','prepareRound');start();expect(()=>act('a','surrender',undefined,1)).toThrow();
    expect(game.phase).toBe('QUESTION');expect(game.snapshot().result).toBeNull();
  });
  it('rejects surrender outside the captured-spy phase, from citizens, or after the deadline',()=>{
    expect(()=>act('a','surrender')).toThrow();start();expect(()=>act('a','surrender')).toThrow();
    ready();expect(()=>act('a','surrender')).toThrow();act('a','vote','b');act('b','vote','a');act('c','vote','a');
    expect(()=>act('b','surrender')).toThrow();expect(game.phase).toBe('GUESS');expect(game.snapshot().result).toBeNull();
    vi.setSystemTime(game.deadline);expect(()=>act('a','surrender')).toThrow();expect(game.snapshot().result).toBeNull();
  });
  it('keeps the caught-spy deadline on reconnect and still allows surrender before it expires',()=>{
    start();caught();const deadline=game.deadline;
    vi.advanceTimersByTime(17000);game.disconnect('a');game.reconnect('a');
    expect(game.deadline).toBe(deadline);expect(game.deadline-Date.now()).toBe(43000);
    expect(game.snapshot().caughtSpyId).toBe('a');expect(secrets.a.role?.kind).toBe('spy');
    expect(JSON.stringify(game.snapshot())).not.toContain('โรงพยาบาล');
    act('a','surrender');expect(game.snapshot().result?.winner).toBe('citizens');
  });
  it('wrong accusation or tied votes lets the spy win without a guess',()=>{
    start();ready();act('a','vote','b');act('b','vote','c');act('c','vote','b');
    expect(game.snapshot().result?.winner).toBe('spy');expect(game.snapshot().result?.reason).toBe('wrong_accusation');
    act('a','prepareRound');start();ready();act('a','vote','b');act('b','vote','c');act('c','vote','a');
    expect(game.snapshot().result?.reason).toBe('no_majority');
  });
  it('rejects guesses in lobby and voting and protects caught-spy answers from invalid/stale/duplicate commands',()=>{
    expect(()=>act('a','guess','โรงพยาบาล')).toThrow();start();expect(()=>act('a','vote','b')).toThrow();
    ready();expect(()=>act('a','guess','โรงพยาบาล')).toThrow();
    act('a','vote','b');act('b','vote','a');act('c','vote','a');
    expect(()=>act('b','guess','โรงพยาบาล')).toThrow();expect(()=>act('a','guess','')).toThrow();
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
  it('enforces minimum players, readiness, maximum capacity and queued active-round joins',()=>{
    game.expire('c');expect(()=>act('a','startRound')).toThrow('3–8');game.add('C','c');expect(()=>act('a','startRound')).toThrow('พร้อม');
    start();game.add('D','d');expect(game.snapshot().players.find(p=>p.id==='d')?.waiting).toBe(true);game.sync('d');expect(secrets.d.role).toBeNull();
  });
  it('preserves disconnected participants until result and transfers host',()=>{
    start();game.disconnect('a');game.expire('a');expect(game.hostId).toBe('b');expect(game.players.has('a')).toBe(true);
    vi.advanceTimersByTime(300000+60000);expect(game.phase).toBe('RESULTS');expect(game.players.has('a')).toBe(false);
    expect(game.snapshot().result?.spyId).toBe('a');
  });
  it('normalizes Thai combining marks and case without accepting arbitrary substring guesses',()=>{
    expect(normalizeLocation(' ร.พ. ')).toBe(normalizeLocation('รพ'));
    expect(normalizeLocation('Hospital')).toBe(normalizeLocation('hospital'));
    start();caught();act('a','guess','โรงพยาบาลหรือโรงเรียน');expect(game.snapshot().result?.winner).toBe('citizens');
  });
});
describe('Spyfall room settings',()=>{
  it('defaults to five minutes, one-minute voting/answers and an eight-player capacity',()=>{
    expect(game.snapshot()).toMatchObject({questionMinutes:5,votingMinutes:1,guessMinutes:1,playerCount:8,votingDurationMs:60000,guessDurationMs:60000});
    for(const id of ['d','e','f','g','h'])game.add(id,id);
    expect(()=>game.add('Extra','extra')).toThrow('ห้องเต็ม');
  });
  it.each([3,4,5,6,7,8])('enforces a maximum of %s players and gives every participant a private role',count=>{
    act('a','setPlayerCount',count);
    for(let i=3;i<count;i++)game.add(`Player ${i}`,`p${i}`);
    expect(()=>game.add('Extra','extra')).toThrow('ห้องเต็ม');
    for(const id of game.players.keys())if(id!=='a')act(id,'setReady',true);
    act('a','startRound');expect(game.snapshot().players).toHaveLength(count);
    expect(Object.values(secrets).filter(secret=>secret.role?.kind==='spy')).toHaveLength(1);
    expect(Object.values(secrets).filter(secret=>secret.role?.kind==='citizen')).toHaveLength(count-1);
  });
  it.each([1,2,3])('runs %s-minute voting and answer deadlines without changing them on reconnect',minutes=>{
    act('a','setQuestionMinutes',7);act('a','setVotingMinutes',minutes);act('a','setGuessMinutes',minutes);start();
    expect(game.deadline-Date.now()).toBe(420000);ready();expect(game.deadline-Date.now()).toBe(minutes*60000);
    expect(game.snapshot().votingDurationMs).toBe(minutes*60000);act('a','vote','b');act('b','vote','a');act('c','vote','a');
    expect(game.phase).toBe('GUESS');expect(game.deadline-Date.now()).toBe(minutes*60000);expect(game.snapshot().guessDurationMs).toBe(minutes*60000);
    const deadline=game.deadline;vi.advanceTimersByTime(1000);game.disconnect('a');game.reconnect('a');expect(game.deadline).toBe(deadline);
    vi.advanceTimersByTime(minutes*60000-1001);expect(game.phase).toBe('GUESS');vi.advanceTimersByTime(1);expect(game.snapshot().result?.reason).toBe('guess_timeout');
  });
  it('uses the selected voting timeout even when nobody confirms',()=>{
    act('a','setVotingMinutes',3);start();ready();vi.advanceTimersByTime(179999);expect(game.phase).toBe('VOTING');
    vi.advanceTimersByTime(1);expect(game.snapshot().result?.reason).toBe('no_majority');
  });
  it('treats capacity as a maximum, starts with three people, and keeps settings for the next round',()=>{
    act('a','setPlayerCount',8);act('a','setVotingMinutes',2);act('a','setGuessMinutes',3);start();
    expect(game.phase).toBe('QUESTION');expect(game.snapshot().players).toHaveLength(3);
    act('a','guess','โรงพยาบาล');act('a','prepareRound');
    expect(game.snapshot()).toMatchObject({playerCount:8,votingMinutes:2,guessMinutes:3});
    act('a','setPlayerCount',4);game.add('D','d');expect(()=>game.add('E','e')).toThrow('ห้องเต็ม');
    expect(()=>act('a','setPlayerCount',3)).toThrow('ไม่น้อยกว่า');expect(game.snapshot().playerCount).toBe(4);
  });
  it('restricts settings to the host, validates values, clears readiness and rejects in-round edits',()=>{
    for(const [type,value] of [['setVotingMinutes',2],['setGuessMinutes',3],['setPlayerCount',8]] as const){
      expect(()=>act('b',type,value)).toThrow('เฉพาะ');act('b','setReady',true);act('a',type,value);expect(game.players.get('b')?.ready).toBe(false);
    }
    for(const type of ['setVotingMinutes','setGuessMinutes'])for(const value of [0,4,1.5,'2',null,Infinity])expect(()=>act('a',type,value)).toThrow();
    for(const value of [2,9,3.5,'8'])expect(()=>act('a','setPlayerCount',value)).toThrow();
    start();for(const type of ['setQuestionMinutes','setVotingMinutes','setGuessMinutes','setPlayerCount'])expect(()=>act('a',type,3)).toThrow('ก่อนเริ่มรอบ');
  });
});
describe('Spyfall location catalogue',()=>{
  it('keeps the original twelve plus the requested twenty-three locations, aliases and seven citizen roles',()=>{
    expect(SPY_LOCATIONS).toHaveLength(35);
    expect(new Set(SPY_LOCATIONS.map(l=>normalizeLocation(l.name))).size).toBe(35);
    expect(SPY_LOCATIONS.slice(12).map(l=>l.name)).toEqual(['บางแสน','สวนสยาม','ดรีมเวิล','สวนสนุก','วัด','สถานีขนส่งหมอชิต','เขาใหญ่','น้ำตก','ภูทับเบิก','เกาะกูด','ดอยสุเทพ','ภูกระดึง','ผาแต้ม','หอไอเฟล','เทพีเสรีภาพ','กำแพงเมืองจีน','คาสิโน','สะพานแม่น้ำแคว','เขื่อน','เรือนจำ','บ้านผีสิง','ห้างสรรพสินค้า','แอสการ์ด']);
    const owners=new Map<string,string>();
    for(const location of SPY_LOCATIONS){
      expect(location.aliases.some(a=>normalizeLocation(a)===normalizeLocation(location.name))).toBe(true);
      expect(location.roles.length).toBeGreaterThanOrEqual(7);expect(new Set(location.roles).size).toBe(location.roles.length);
      for(const alias of location.aliases){
        expect(alias.trim().length).toBeGreaterThan(0);expect(alias.length).toBeLessThanOrEqual(80);
        const normalized=normalizeLocation(alias);expect(owners.get(normalized)??location.name).toBe(location.name);owners.set(normalized,location.name);
      }
    }
  });
  it.each(SPY_LOCATIONS.map(location=>[location.name,location.aliases.at(-1)!]))('deals %s privately to seven citizens and accepts an alias', (name,answer)=>{
    game.dispose();let randomCall=0;
    game=new SpyfallGame('CLASSIC',{changed(){},secret(id,data){secrets[id]=data;}},()=>randomCall++===0?0:SPY_LOCATIONS.findIndex(l=>l.name===name));
    game.playerCount=8;
    for(const id of ['a','b','c','d','e','f','g','h'])game.add(id,id);
    for(const id of ['b','c','d','e','f','g','h'])act(id,'setReady',true);
    act('a','startRound');
    expect(secrets.a.role).toEqual({kind:'spy',ownVote:null});
    const citizens=Object.values(secrets).filter(s=>s.role?.kind==='citizen');
    expect(citizens).toHaveLength(7);expect(citizens.every(s=>s.role?.location===name)).toBe(true);
    expect(new Set(citizens.map(s=>s.role?.occupation)).size).toBe(7);
    expect(JSON.stringify(game.snapshot())).not.toContain(name);
    act('a','guess',answer);expect(game.snapshot().result).toMatchObject({winner:'spy',reason:'correct_guess',location:name});
  });
  it('accepts the alternate Dream World spelling',()=>{
    game.dispose();let randomCall=0;game=new SpyfallGame('DREAM',{changed(){},secret(){}},()=>randomCall++===0?0:14);
    for(const id of ['a','b','c'])game.add(id,id);start();act('a','guess','ดรีมเวิลด์');expect(game.snapshot().result?.winner).toBe('spy');
  });
});
