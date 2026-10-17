import { useEffect, useRef, useState } from 'react';
import { oldMaidSession } from './session';
import type { SessionState } from './session';
import type { OldMaidSnapshot } from '../../../packages/shared/src/oldmaid';
import { navigate } from './router';
import { Card } from './components';
import { OldMaidRules } from './OldMaidCreatePage';
import { OldMaidFeedback, OldMaidHistory, PairName } from './OldMaidFeedback';

export function OldMaidPlayPage({state,code}: {state:SessionState<OldMaidSnapshot>;code:string}) {
  const [now,setNow] = useState(Date.now()); const [selected,setSelected] = useState<number|null>(null);
  const [sorted,setSorted] = useState(false); const [rules,setRules] = useState(false); const [manage,setManage] = useState(false); const [copied,setCopied] = useState(false);
  const [pending,setPending] = useState(false); const dialog = useRef<HTMLDialogElement>(null);
  const [historyOpen,setHistoryOpen] = useState(false);
  const s = state.snapshot;
  useEffect(() => {const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[]);
  useEffect(() => {setSelected(null);setPending(false);},[s?.turnNumber,s?.roundId]);
  useEffect(() => {if(state.error||state.status!=='connected')setPending(false);},[state.error,state.status]);
  useEffect(() => {if(rules||manage||historyOpen)dialog.current?.showModal();return()=>dialog.current?.close();},[rules,manage,historyOpen]);
  useEffect(() => {setHistoryOpen(false);},[s?.code,s?.roundId,s?.phase==='LOBBY']);
  if(!s||s.code!==code)return <main className="page-message"><h1>{state.status==='reconnecting'?'กำลังกลับเข้าวง…':'ยังไม่ได้เข้าห้อง Old Maid นี้'}</h1><p>{code}</p><button onClick={()=>navigate('/oldmaid/rooms/join?code='+code)}>เข้าห้องนี้</button></main>;
  const me=s.players.find(p=>p.id===state.playerId),host=s.hostId===state.playerId,active=state.status==='connected';
  const ownTurn=s.phase==='PLAYING'&&s.turnId===state.playerId;
  const target=s.players.find(p=>p.id===s.targetId),turn=s.players.find(p=>p.id===s.turnId);
  const seconds=Math.max(0,Math.ceil((s.deadline-now)/1000));
  const hand=state.handRound===s.roundId?[...state.hand]:[];
  if(sorted)hand.sort((a,b)=>a.rank-b.rank||a.suit.localeCompare(b.suit));
  const canStart=active&&s.players.length>=3&&s.players.every(p=>p.connected&&(p.isBot||p.id===s.hostId||p.ready));
  const canDraw=ownTurn&&active&&!pending&&now<s.deadline;
  const loser=s.players.find(p=>p.id===s.result?.loserId);
  const draws=state.oldMaid?.roundId===s.roundId?state.oldMaid.draws:[];
  const latest=draws.at(-1);
  const lastActivity=s.history?.at(-1);
  const closeDialog=()=>{setRules(false);setManage(false);setHistoryOpen(false);};
  return <main className={'oldmaid-game phase-'+s.phase+(latest&&s.phase==='PLAYING'?' has-draw-feedback':'')}>
    <div className="room-bar"><div className="club-room-id"><span className="club-wordmark">♠ <b>อีแก่กินน้ำ</b></span><strong>{s.code}</strong><button className="small" aria-label="คัดลอกรหัสห้อง" onClick={async()=>{try{await navigator.clipboard.writeText(s.code);setCopied(true);}catch{setCopied(false);}}}>{copied?'✓':'คัดลอก'}</button></div><div className="club-room-tools"><button className="small" aria-label="จัดการโต๊ะ Old Maid" onClick={()=>setManage(true)}>โต๊ะ</button><button className="small" onClick={()=>setRules(true)}>กติกา</button><button className="small ghost" onClick={()=>oldMaidSession.leave()}>ออกจากห้อง</button></div></div>
    <div className="oldmaid-meta">รอบ {s.roundId||'–'} · {s.players.length}/8 คน<span>{s.phase==='LOBBY'?'รอทุกคนพร้อม':s.phase==='RESULTS'?'จบรอบ':'จับคู่แล้วทิ้งอัตโนมัติ'}</span></div>
    <section className="oldmaid-table">
      <div className="oldmaid-opponents">{s.players.filter(p=>p.id!==state.playerId).map(p=><article key={p.id} className={'oldmaid-seat'+(s.phase==='PLAYING'&&p.id===s.targetId?' target':'')+(p.finished?' finished':'')} aria-label={'ผู้เล่น '+p.name}><span className="club-avatar">{p.isBot?'🤖':p.name.slice(0,1)}</span><strong title={p.name}>{p.name}</strong><div className="mini-card-stack" aria-hidden="true">{!p.finished&&Array.from({length:Math.min(p.cardCount,3)},(_,i)=><i key={i}/>)}</div><small>{p.isBot&&'บอท · '}{!p.connected?'เชื่อมต่อใหม่':s.phase==='LOBBY'?p.ready||p.id===s.hostId?'พร้อม':'รอพร้อม':p.finished?'✓ ไพ่หมดแล้ว':`เหลือ ${p.cardCount} ใบ`}</small>{s.phase==='RESULTS'&&<em>{s.result?.loserId===p.id?'เหลือไพ่ใบสุดท้าย':'รอดแล้ว'}</em>}</article>)}</div>
      <section className="oldmaid-draw-area" aria-label="พื้นที่จั่วไพ่">
        {s.phase==='LOBBY'?<div className="oldmaid-wait"><span>♠</span><h1>รอเพื่อนเข้าวง</h1><p>ส่งรหัสให้เพื่อน · เริ่มได้ตั้งแต่ 3 คน</p><strong>{s.players.length}/8 คน</strong></div>:s.phase==='RESULTS'&&s.result?<div className="oldmaid-result" role="status"><span className="eyebrow">ROUND COMPLETE</span><h1>{s.result.loserId===state.playerId?'คุณเหลือไพ่ใบสุดท้าย':`${loser?.name??'ผู้เล่น'} เหลือไพ่ใบสุดท้าย`}</h1><p>{s.result.loserId===state.playerId?'รอบหน้าลองใหม่!':'คุณรอดแล้ว! ไพ่หมดมือเรียบร้อย'}</p><div className="oldmaid-final-cards"><div><small>ไพ่ใบสุดท้าย</small><Card card={s.result.lastCard}/></div><div><small>ไพ่ที่สุ่มนำออก</small><Card card={s.result.removedCard}/></div></div></div>:<><div className="oldmaid-turn"><h1>{ownTurn?'ตาของคุณ':`ตาของ ${turn?.name??'ผู้เล่น'}`}</h1><p>{target?`เลือกไพ่ 1 ใบจาก${ownTurn?'มือของ ': ' '}${target.name}`:'กำลังเตรียมไพ่…'}</p><span className="oldmaid-clock" role="timer">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</span></div><div className="oldmaid-draw-cards">{Array.from({length:target?.cardCount??0},(_,i)=><button key={`${s.turnNumber}-${i}`} className={'oldmaid-draw-card'+(selected===i?' chosen':'')} aria-label={`เลือกไพ่ใบที่ ${i+1}`} aria-pressed={selected===i} disabled={!canDraw} onClick={()=>setSelected(i)}><Card/></button>)}</div><button className="primary oldmaid-confirm" disabled={!canDraw||selected===null} onClick={()=>{if(canDraw&&selected!==null){setPending(true);oldMaidSession.clearError();oldMaidSession.send('draw',`${s.turnNumber}:${selected}`);}}}>{pending?'กำลังจั่ว…':ownTurn?'ยืนยันการจั่ว':'รอผู้เล่นจั่วไพ่'}</button></>}
      </section>
      {latest&&s.phase==='PLAYING'&&<OldMaidFeedback draw={latest}/>}
      <div className="oldmaid-discard"><span>ทิ้งคู่แล้ว <strong>{s.discardedPairs} คู่</strong></span>{lastActivity&&<small>{lastActivity.playerId===state.playerId?'คุณ':lastActivity.playerName}{lastActivity.pair.length?<> ทิ้งคู่ <PairName cards={lastActivity.pair}/></>:' จั่วแล้ว · ยังไม่มีคู่'}</small>}{s.phase!=='LOBBY'&&<button className="small ghost oldmaid-history-button" onClick={()=>setHistoryOpen(true)}>ดูประวัติ ›</button>}</div>
      {me&&<section className="oldmaid-self" aria-label="ไพ่ของคุณ"><div className="oldmaid-self-name"><span className="club-avatar">{me.name.slice(0,1)}</span><strong>{me.name}</strong><span className="club-own-pill">คุณ</span><small>รอดแล้ว {me.wins} รอบ</small></div><div className="oldmaid-hand"><span>ไพ่ของคุณ · {me.cardCount} ใบ</span><div className="hand">{hand.map(card=>{const isNew=s.phase==='PLAYING'&&latest&&!latest.pair.length&&card.rank===latest.drawnCard.rank&&card.suit===latest.drawnCard.suit;return <div key={`${card.rank}-${card.suit}`} className={'oldmaid-hand-card'+(isNew?' is-new':'')}><Card card={card}/>{isNew&&<span className="oldmaid-new-badge">ใหม่</span>}</div>;})}{!hand.length&&<p>{s.phase==='LOBBY'?'ไพ่จะถูกแจกเมื่อเริ่มรอบ':'✓ ไพ่หมดแล้ว'}</p>}</div></div>{hand.length>1&&<button className="small ghost oldmaid-sort" aria-pressed={sorted} onClick={()=>setSorted(!sorted)}>{sorted?'ลำดับเดิม':'เรียงไพ่'}</button>}</section>}
    </section>
    {s.phase!=='PLAYING'&&<section className="oldmaid-action-dock">{s.phase==='RESULTS'?host?<button className="primary" disabled={!active} onClick={()=>oldMaidSession.send('prepareRound')}>เตรียมรอบใหม่</button>:<p>รอผู้สร้างห้องเตรียมรอบใหม่</p>:host?<><span>พร้อมแล้ว {s.players.filter(p=>p.isBot||p.id===s.hostId||p.ready).length}/{s.players.length} คน</span><button className="primary" disabled={!canStart} onClick={()=>oldMaidSession.send('startRound')}>เริ่มเกม Old Maid</button></>:<button className="primary" disabled={!active} onClick={()=>oldMaidSession.send('setReady',!me?.ready)}>{me?.ready?'ยกเลิกพร้อม':'พร้อมเล่น'}</button>}</section>}
    {(rules||manage||historyOpen)&&<dialog ref={dialog} className="club-dialog" aria-label={historyOpen?'ประวัติ Old Maid':manage?'จัดการบอท Old Maid':'กติกา Old Maid'} onCancel={closeDialog}><button className="dialog-close" aria-label="ปิดหน้าต่าง" onClick={closeDialog}>✕</button>{historyOpen?<OldMaidHistory history={s.history??[]} draws={draws} playerId={state.playerId}/>:manage?<section><h2>บอทในวง Old Maid</h2><p className="fine">เพื่อนและบอทรวม {s.players.length}/8 คน</p>{s.players.filter(p=>p.isBot).map(p=><div className="bot-row" key={p.id}><span>🤖 {p.name}</span>{host&&<button className="small" aria-label={'นำ '+p.name+' ออก'} disabled={!active||s.phase!=='LOBBY'} onClick={()=>oldMaidSession.send('removeBot',p.id)}>นำออก</button>}</div>)}{host?<button className="primary full" disabled={!active||s.phase!=='LOBBY'||s.players.length>=8} onClick={()=>oldMaidSession.send('addBot')}>เพิ่มบอท</button>:<p>ผู้สร้างห้องเป็นคนจัดการบอท</p>}<p className="fine">เพิ่มหรือนำบอทออกได้ก่อนเริ่มรอบ · บอทพร้อมอัตโนมัติและสุ่มจั่วโดยไม่เห็นหน้าไพ่</p></section>:<OldMaidRules/>}</dialog>}
  </main>;
}
