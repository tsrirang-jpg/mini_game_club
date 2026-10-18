import './player-voting.css';

interface Candidate { id:string; name:string; seat:number; connected:boolean; confirmed:boolean; eligible?:boolean }
interface Props {
  title:string; eyebrow:string; description:string; players:Candidate[]; playerId:string;
  selected:string|null; canVote:boolean; confirmed:boolean; submitting:boolean; active:boolean;
  seconds:number; progress:number; note:string; error?:string;
  select(id:string):void; confirm():void;
}
// Shared list, confirmation state and countdown presentation for social games.
// Callers retain their own voting rules and private ballots.
export function PlayerVotingContent(p:Props) {
  const voted=p.players.filter(player=>player.confirmed).length;
  const selectedName=p.players.find(player=>player.id===p.selected)?.name;
  return <>
    <header className="spy-voting-heading">
      <span className="spy-voting-emblem" aria-hidden="true">⌖</span>
      <div><span className="spy-voting-eyebrow">{p.eyebrow}</span><h2 id="spy-voting-title">{p.title}</h2><p id="spy-voting-description">{p.description}</p></div>
      <span className="spy-voting-round" aria-hidden="true">?</span>
    </header>
    <ul className="spy-voting-list" aria-label="รายชื่อผู้ต้องสงสัย">
      {[...p.players].sort((a,b)=>a.seat-b.seat).map(player=>{
        const own=player.id===p.playerId,chosen=player.id===p.selected;
        return <li key={player.id}><button type="button" className={`spy-vote-option ${chosen?'chosen':''} ${own?'own':''}`} aria-label={`สงสัย ${player.name}`} aria-pressed={chosen} disabled={!p.canVote||own||player.eligible===false} onClick={()=>p.select(player.id)}>
          <span className={`agent-avatar avatar-${player.seat%4}`} aria-hidden="true">{Array.from(player.name).slice(0,2).join('')}</span>
          <span className="spy-vote-identity"><strong title={player.name}>{player.name}</strong><span>{own?'คุณ · เลือกตัวเองไม่ได้':player.eligible===false?'ไม่ได้อยู่ในรอบโหวตซ้ำ':!player.connected?'กำลังเชื่อมต่อใหม่':'ผู้ต้องสงสัย'}</span></span>
          <span className={`spy-vote-stamp ${player.confirmed?'done':''}`}>{player.confirmed?'✓ ยืนยันแล้ว':'รอโหวต'}</span>
          <span className="spy-vote-check" aria-hidden="true">{chosen?'✓':''}</span>
        </button></li>;
      })}
    </ul>
    <div className="spy-voting-footer">
      <div className="spy-voting-progress"><span role="status">ยืนยันแล้ว <strong>{voted}/{p.players.length}</strong> คน</span><span className={`spy-voting-clock ${p.seconds<=10?'urgent':''}`} role="timer" aria-label="เวลาโหวตที่เหลือ"><strong>{p.seconds}</strong> วินาที</span></div>
      <div className="spy-voting-time-track" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,p.progress))}%`}}/></div>
      <div className="spy-voting-confirmation">
        <div className="spy-voting-choice" aria-live="polite"><span>{p.confirmed?'ยืนยันเสียงของคุณแล้ว':'ผู้ที่คุณเลือก'}</span><strong>{selectedName??'ยังไม่ได้เลือก'}</strong><small>{!p.active?'กำลังเชื่อมต่อใหม่…':p.confirmed?'รอคนอื่นยืนยัน หรือรอหมดเวลา':p.submitting?'กำลังส่งคะแนน…':p.seconds===0?'หมดเวลา กำลังสรุปผล…':'เปลี่ยนตัวเลือกได้ก่อนกดยืนยัน'}</small></div>
        <button type="button" className="spy-voting-confirm" disabled={!p.canVote||!p.selected} onClick={p.confirm}>{p.confirmed?'✓ ยืนยันแล้ว':p.submitting?'กำลังส่ง…':'ยืนยันโหวต'}</button>
      </div>
      <p className="spy-voting-note">{p.note}</p>
      {p.error&&<p className="spy-voting-error" role="alert">{p.error}</p>}
    </div>
  </>;
}
