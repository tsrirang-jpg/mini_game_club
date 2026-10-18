import {memo,useEffect,useMemo,useState} from 'react';
import type {UnderSnapshot,UnderSecret} from '../../../packages/shared/src/undercover';
import {UnderWord} from './UndercoverPanels';
import {UndercoverChat} from './UndercoverChat';
import {SpyfallSelect} from './SpyfallSelect';
import {LobbyIcon} from './components/ui/LobbyIcon';
import './undercover-discussion.css';

const ClueBoard=memo(function ClueBoard({s,playerId}:{s:UnderSnapshot;playerId:string}) {
 const [cycle,setCycle]=useState(s.cycle);
 const cycles=useMemo(()=>[...new Set([...s.hints.map(h=>h.cycle),s.cycle])].sort((a,b)=>a-b).map(value=>({value,label:`รอบ ${value}`})),[s.hints,s.cycle]);
 // Keep one clue per player in seat order; older cycles remain accessible.
 const hints=new Map(s.hints.filter(h=>h.cycle===cycle).map(h=>[h.playerId,h]));
 const current=cycle===s.cycle,active=s.players.filter(p=>p.alive||hints.has(p.id));
 const submitted=active.filter(p=>hints.has(p.id)).length;
 return <section className="under-clue-board" aria-label="กระดานคำใบ้">
  <header className="under-board-heading"><LobbyIcon name="grid"/><div><h2>กระดานคำใบ้ · รอบที่ {cycle}</h2><p>ผู้เล่นแต่ละคนจะส่งคำใบ้ตามลำดับที่นั่งหมายเลข</p></div>
   <div className="under-board-progress"><span>{submitted} / {active.length}</span><progress aria-label="จำนวนผู้ส่งคำใบ้" value={submitted} max={Math.max(1,active.length)}/></div>
   {cycles.length>1&&<SpyfallSelect<number> compact label="ดูคำใบ้รอบอื่น" value={cycle} options={cycles} onChange={setCycle}/>}
  </header>
  <div className="under-clue-grid" tabIndex={0} role="region" aria-label={`คำใบ้ของผู้เล่น รอบ ${cycle}`}>
   {s.players.map(p=>{
    const hint=hints.get(p.id),turn=current&&s.phase==='DESCRIBE'&&p.id===s.turnId;
    const status=hint?'ส่งแล้ว':!p.alive?'ออกจากรอบ':!p.connected?'เชื่อมต่อใหม่':turn?'กำลังเขียนคำใบ้…':current?'รอถึงตา':'ไม่ได้ส่งคำใบ้';
    return <article key={p.id} className={`under-clue-card${turn?' current':''}${hint?' submitted':''}${!p.alive?' eliminated':''}`} data-player-id={p.id}>
     <header><span className="under-seat-number">{p.seat+1}</span><span className="under-clue-avatar" aria-hidden="true">{Array.from(p.name)[0]?.toLocaleUpperCase()}</span><strong title={p.name}>{p.name}{p.id===playerId&&<small> (คุณ)</small>}</strong>{hint&&<span className="under-clue-done" aria-label="ส่งแล้ว"><LobbyIcon name="check"/></span>}</header>
     {hint?<p className="under-clue-text">{hint.text}</p>:<p className="under-clue-placeholder"><LobbyIcon name={turn?'pencil':'clock'}/>{status}</p>}
     <small>{!p.alive?'ออกจากรอบ':!p.connected?'เชื่อมต่อใหม่':hint?'ส่งแล้ว':turn?p.id===playerId?'ถึงตาคุณแล้ว':`ถึงตา ${p.name}`:status}</small>
    </article>;
   })}
  </div>
  <p className="under-board-note"><LobbyIcon name="people"/>{current?'ส่งครบทุกคนแล้วกดพร้อมโหวต':'กำลังดูคำใบ้รอบก่อนหน้า'}</p>
 </section>;
});

function ReadyVoteDock({s,playerId,connected,error,onReady}:{s:UnderSnapshot;playerId:string;connected:boolean;error:string;onReady():void}) {
 const [pending,setPending]=useState(false),participants=s.players.filter(p=>p.alive);
 const ready=new Set(s.voteReadyIds??[]),confirmed=ready.has(playerId),complete=s.phase==='DISCUSS';
 const count=participants.filter(p=>p.connected&&ready.has(p.id)).length;
 const alive=participants.some(p=>p.id===playerId);
 useEffect(()=>{if(confirmed||!connected||error||!complete)setPending(false);},[confirmed,connected,error,complete,s.cycle]);
 return <section className="under-ready-dock" aria-label="เตรียมโหวต">
  <div className="under-ready-progress"><LobbyIcon name="people"/><strong>พร้อมโหวต</strong><progress aria-label="จำนวนผู้พร้อมโหวต" value={count} max={Math.max(1,participants.length)}/><span>{count}/{participants.length}</span></div>
  <p role="status">{!complete?'รอทุกคนส่งคำใบ้ให้ครบ':!alive?'คุณออกจากรอบแล้ว · รอติดตามผล':!connected?'กำลังเชื่อมต่อใหม่…':confirmed?'คุณพร้อมแล้ว · รอเพื่อน':'ทุกคนพร้อมแล้วจะเปิดโหวตพร้อมกัน'}</p>
  <button type="button" className="primary" disabled={!complete||!connected||!alive||confirmed||pending} onClick={()=>{if(complete&&connected&&alive&&!confirmed&&!pending){setPending(true);onReady();}}}><LobbyIcon name={confirmed?'check':'people'}/>{!complete?'รอคำใบ้ครบทุกคน':confirmed?'พร้อมแล้ว':pending?'กำลังส่ง…':'พร้อมโหวต'}</button>
 </section>;
}

const emptyChat:UnderSnapshot['chat']=[];
export function UndercoverDiscussion({s,playerId,secret,connected,seconds,revealed,onToggle,hint,onHint,pending,onSubmit,error,onChat,onReadyVote}:{s:UnderSnapshot;playerId:string;secret:UnderSecret|null;connected:boolean;seconds:number;revealed:boolean;onToggle():void;hint:string;onHint(value:string):void;pending:boolean;onSubmit():void;error:string;onChat(text:string):void;onReadyVote():void}) {
 const me=s.players.find(p=>p.id===playerId),own=s.phase==='DESCRIBE'&&s.turnId===playerId;
 const turnName=s.players.find(p=>p.id===s.turnId)?.name??'ผู้เล่น';
 const title=s.phase!=='DESCRIBE'?s.phase==='VOTING'?'กำลังโหวต':s.phase==='REVEAL'?'ผลโหวต':'รอคำตอบก่อนสรุปผล':own?'ถึงตาคุณ · เขียนคำใบ้':s.describedIds.includes(playerId)?`ส่งคำใบ้แล้ว · รอ ${turnName}`:`ถึงตา ${turnName}`;
 const locked=!own||!connected||pending||seconds<=0;
 const discussion=s.phase==='DISCUSS',chatActive=s.phase==='DESCRIBE'||discussion;
 const canShowWord=s.phase==='DESCRIBE';
 const progress=Math.max(0,Math.min(100,seconds/(s.turnMinutes*60)*100));
 return <div className={`under-discussion${discussion?' awaiting-vote':''}`}>
  <div className="under-discussion-main">
   {discussion?<section className="under-discussion-complete" aria-label="ส่งคำใบ้ครบแล้ว"><LobbyIcon name="check"/><div><h1>ส่งคำใบ้ครบแล้ว</h1><p>ทุกคนส่งคำใบ้เรียบร้อย พูดคุยก่อนกดพร้อมโหวต</p></div><strong>{s.players.filter(p=>p.alive&&s.describedIds.includes(p.id)).length}/{s.players.filter(p=>p.alive).length}</strong><div className="under-complete-clue"><small>คำใบ้ของคุณ</small><p>{s.hints.find(h=>h.playerId===playerId&&h.cycle===s.cycle)?.text??'คุณออกจากรอบแล้ว · รอติดตามผล'}</p></div><div className="under-complete-word"><UnderWord secret={secret} revealed={revealed} onToggle={onToggle}/></div></section>:<section className={`under-writing${own?' own-turn':''}`} aria-label="พื้นที่เขียนคำใบ้">
    <header><LobbyIcon name={own?'pencil':s.describedIds.includes(playerId)?'check':'clock'}/><div><h1>{title}</h1><p>{me?.alive?'เขียนคำอธิบายให้เพื่อน ๆ เดา ห้ามเขียนคำตอบโดยตรง':'คุณออกจากรอบแล้ว · รอติดตามผล'}</p></div><div className="under-writing-clock"><LobbyIcon name="clock"/><span role="timer">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</span><i aria-hidden="true" style={{background:`conic-gradient(var(--club-accent) ${progress}%,#42464c 0)`}}/></div></header>
    {own?<form className="under-compose" onSubmit={e=>{e.preventDefault();if(!locked&&hint.trim())onSubmit();}}>
     <label><span className="sr-only">คำใบ้ของคุณ</span><textarea aria-label="คำใบ้ของคุณ" maxLength={120} rows={2} value={hint} disabled={locked} onChange={e=>onHint(e.target.value)} placeholder="อธิบายคำโดยไม่พูดคำตรง ๆ"/><small>{hint.length}/120</small></label>
     <button className="primary" disabled={locked||!hint.trim()}><LobbyIcon name="send"/>{pending?'กำลังส่ง…':'ส่งคำใบ้'}</button>
    </form>:<p className="under-writing-status" role="status">{!connected?'กำลังเชื่อมต่อใหม่…':s.phase==='DESCRIBE'?'คำใบ้ที่ส่งแล้วจะแสดงในกระดานด้านล่าง':'รอผลพร้อมกันทุกคน'}</p>}
    {canShowWord&&<div className="under-writing-private"><UnderWord secret={secret} revealed={revealed} onToggle={onToggle}/><small>เห็นเฉพาะคุณเท่านั้น</small></div>}
   </section>}
   <ClueBoard key={s.cycle} s={s} playerId={playerId}/>
  </div>
  <UndercoverChat key={s.roundId} messages={s.chat??emptyChat} playerId={playerId} enabled={connected&&chatActive&&!!me?.alive} active={chatActive} connected={connected} error={error} onSend={onChat}/>
 {(s.phase==='DESCRIBE'||discussion)&&<ReadyVoteDock key={`${s.roundId}-${s.cycle}`} s={s} playerId={playerId} connected={connected} error={error} onReady={onReadyVote}/>}
 </div>;
}
