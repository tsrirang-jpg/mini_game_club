import { useEffect, useState } from 'react';
import type { SessionState } from './session';
import { liarSession } from './session';
import { liarCardKey, liarRank } from '../../../packages/shared/src/liar';
import type { LiarAction, LiarSnapshot } from '../../../packages/shared/src/liar';
import { RoomIdentity } from './components/ui/RoomIdentity';
import { Card } from './components/ui/Card';
import { GameDialog } from './components/ui/GameDialog';
import { LiarRules } from './components/entry/LiarRules';
import { useDeadlineNow } from './hooks/useDeadlineNow';
import { LiarRoster, LiarLobby, LiarResults } from './LiarRoomPanels';
import './liar.css';

export function LiarPlayPage({state,code}:{state:SessionState<LiarSnapshot>;code:string}) {
  const s=state.snapshot;
  const [selected,setSelected]=useState('');
  const [dialog,setDialog]=useState<'rules'|'players'|'history'|null>(null);
  const [challengeId,setChallengeId]=useState<number|null>(null);
  const [pending,setPending]=useState(false);
  const now=useDeadlineNow(s?.deadline);
  useEffect(()=>{setSelected('');setPending(false);setChallengeId(null);},[s?.roundId,s?.turnNumber,s?.phase]);
  useEffect(()=>{if(state.error)setPending(false);},[state.error]);
  if(!s||s.code!==code)return <main className="page-message"><h1>กำลังเชื่อมต่อห้อง</h1><p>หากยังไม่ได้เข้าห้อง กรุณาใส่ชื่อและรหัสก่อน</p><button onClick={()=>liarSession.leave('/liar/rooms/join?code='+code)}>เข้าห้อง Liar’s Card</button></main>;
  const me=s.players.find(p=>p.id===state.playerId), host=s.hostId===state.playerId;
  const connected=state.status==='connected', ownTurn=s.turnId===state.playerId&&s.phase==='PLAYING';
  const hand=state.handRound===s.roundId?state.hand:[];
  const latest=s.latest, name=(id:string)=>s.players.find(p=>p.id===id)?.name??'ผู้เล่น';
  const canChallenge=connected&&!pending&&s.phase==='RESPONSE'&&!!latest&&latest.playerId!==state.playerId&&!!me&&!me.finished;
  const seconds=Math.max(0,Math.ceil((s.deadline-now)/1000));
  const send=(type:LiarAction,value?:string|number|boolean)=>{if(!connected||pending)return;liarSession.clearError();setPending(true);liarSession.send(type,value);};
  const play=()=>send('play',`${s.turnNumber}|${s.opening?'1:clubs':selected}`);
  return <main className="liar-dashboard">
    <div className="room-bar liar-room-bar"><RoomIdentity code={s.code} codeClassName="liar-room-code"/><div className="club-room-tools"><button className="small" onClick={()=>setDialog('rules')}>กติกา</button><button className="small" onClick={()=>setDialog('players')}>ผู้เล่น</button><button className="small ghost" onClick={()=>liarSession.leave()}>ออกจากห้อง</button></div></div>
    {s.phase==='LOBBY'?<LiarLobby s={s} playerId={state.playerId} connected={connected}/>
    :s.phase==='RESULTS'&&s.result?<LiarResults s={s} playerId={state.playerId} connected={connected}/>
    :<section className="liar-board" aria-label="โต๊ะไพ่ตอแหล">
      <div className="liar-opponents">{<LiarRoster s={s} playerId={state.playerId}/>}</div>
      <section className="liar-center"><div className="liar-required"><span>{s.opening?'เปิดใบแรก':'ต้องลงเลข'}</span><strong>{s.opening?'A♣':liarRank(s.requiredRank)}</strong><small>ลงครั้งละ 1 ใบ</small></div><div className="liar-latest"><small>{latest?`${name(latest.playerId)} ${latest.opening?'เปิด A♣':`อ้างว่าเป็น ${liarRank(latest.rank)}`}`:'รอผู้เล่นลงไพ่'}</small><Card card={latest?.card??undefined}/></div><div className="liar-turn-status" role="status"><strong>{s.phase==='RESPONSE'?'จับโกหกใบล่าสุดได้เลย':s.phase==='REVEAL'?'กำลังแสดงผลการจับโกหก':ownTurn?'ถึงตาคุณ':`ตาของ ${name(s.turnId??'')}`}</strong><span role="timer">{seconds} วินาที</span><small>ข้ามต่อเนื่อง {s.skipCount}/{s.activeCount} คน · ข้ามแล้ว เลขไม่เปลี่ยน</small></div></section>
      <aside className="liar-recent"><h2>ประวัติการเล่น</h2>{s.history.slice(-6).map(h=><p key={h.id}>{h.text}</p>)}</aside>
      <section className="liar-self" aria-label="ไพ่ของคุณ"><div className="liar-self-title"><strong>{me?.name} <span className="club-own-pill">ไพ่ของคุณ · {hand.length} ใบ</span></strong><button className="small ghost" onClick={()=>setDialog('history')}>ประวัติ</button></div><div className="liar-hand">{hand.map(c=><button key={liarCardKey(c)} className={`liar-hand-choice${selected===liarCardKey(c)?' chosen':''}`} aria-label={`เลือกไพ่ ${liarRank(c.rank)} ${c.suit}`} aria-pressed={selected===liarCardKey(c)} disabled={!connected||!ownTurn||pending||s.opening} onClick={()=>setSelected(liarCardKey(c))}><Card card={c}/></button>)}{!hand.length&&<p>{me?.finished?'✓ ไพ่หมดแล้ว คุณชนะ · รอเพื่อนเล่นต่อ':'รอตรวจสอบไพ่ใบสุดท้าย…'}</p>}</div></section>
      <div className="liar-actions"><button className="primary" disabled={!connected||!ownTurn||pending||(!s.opening&&!selected)} onClick={play}>{s.opening?'เปิด A♣':'ส่งไพ่'}</button><button disabled={!connected||!ownTurn||pending||s.opening} onClick={()=>send('skip',String(s.turnNumber))}>ข้าม (Skip)</button><button className="liar-emergency" disabled={!canChallenge} onClick={()=>setChallengeId(latest!.id)}>⚠ Emergency</button></div>
    </section>}
    {dialog&&<GameDialog title={dialog==='rules'?'กติกาไพ่ตอแหล':dialog==='players'?'ผู้เล่นในวง':'ประวัติการเล่น'} onClose={()=>setDialog(null)} className="liar-dialog">{dialog==='rules'?<LiarRules open/>:dialog==='history'?<div className="liar-history">{s.history.map(h=><p key={h.id}>{h.text}</p>)}{!s.history.length&&<p>ยังไม่มีการลงไพ่</p>}</div>:<><div className="liar-manage-list">{s.players.map(p=><div key={p.id}><span>{p.name} {p.isBot?'· บอท':''}</span>{host&&p.isBot&&s.phase==='LOBBY'&&<button className="small" disabled={!connected} onClick={()=>liarSession.send('removeBot',p.id)}>นำออก</button>}</div>)}</div>{host&&s.phase==='LOBBY'&&<button disabled={!connected||s.players.length>=6} onClick={()=>liarSession.send('addBot')}>เพิ่มบอท</button>}</>}</GameDialog>}
    {challengeId!==null&&canChallenge&&latest?.id===challengeId&&<GameDialog title="Emergency · จับโกหก" className="liar-dialog" onClose={()=>setChallengeId(null)}><p>{name(latest.playerId)} อ้างว่าเป็น {liarRank(latest.rank)} · 1 ใบ</p><div className="liar-modal-card"><Card/></div><p>เปิดตรวจเฉพาะไพ่ใบล่าสุด หากไพ่ตรง ผู้จับไม่มีบทลงโทษ</p><div className="liar-modal-actions"><button onClick={()=>setChallengeId(null)}>ยกเลิก</button><button className="liar-emergency" disabled={!canChallenge} onClick={()=>{send('challenge',challengeId);setChallengeId(null);}}>ยืนยันจับโกหก</button></div></GameDialog>}
    {s.phase==='REVEAL'&&latest?.card&&<GameDialog title="ผลการจับโกหก" className="liar-dialog" dismissible={false} onClose={()=>{}}><p>{name(latest.playerId)} อ้างว่าเป็น {liarRank(latest.rank)}</p><div className="liar-modal-card"><Card card={latest.card}/></div><h3>{latest.truthful?'✓ ไพ่ตรงกับคำกล่าว':'✕ ไพ่ไม่ตรงกับคำกล่าว'}</h3><p>{latest.truthful?'ผู้จับไม่มีบทลงโทษ':`${name(latest.playerId)} รับไพ่ใบล่าสุดกลับเข้ามือ`}</p><small>เล่นต่ออัตโนมัติใน {seconds} วินาที</small></GameDialog>}
  </main>;
}
