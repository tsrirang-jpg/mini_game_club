import {useEffect,useRef} from 'react';
import type {UnderPlayer,UnderSnapshot,UnderSecret} from '../../../packages/shared/src/undercover';
import {UNDER_MAX_PLAYERS} from '../../../packages/shared/src/undercover';
import {LobbyIcon} from './components/ui/LobbyIcon';
export const isUnderPlayerReady=(p:UnderPlayer,hostId:string)=>p.connected&&(p.ready||p.id===hostId);
export function UnderRoster({players,playerId,turnId='',hostId='',lobby=false}:{players:UnderPlayer[];playerId:string;turnId?:string;hostId?:string;lobby?:boolean}){
 if(lobby)return <div className="under-roster-list under-lobby-roster" role="list" aria-label="รายชื่อผู้เล่นและสถานะพร้อม">{players.map(p=>{
  const host=p.id===hostId,own=p.id===playerId,ready=isUnderPlayerReady(p,hostId);
  return <article key={p.id} role="listitem" className={`under-lobby-player${host?' host':''}${own?' own':''}`} data-color={p.seat%6}>
   <span className="under-lobby-avatar" aria-hidden="true">{Array.from(p.name)[0]?.toLocaleUpperCase()}<i className={p.connected?'online':''}/></span>
   <div className="under-lobby-player-identity"><strong title={p.name}>{host&&<LobbyIcon name="crown"/>}{p.name}</strong>{(host||own)&&<small>{own?host?'คุณ (เจ้าของห้อง)':'คุณ':'เจ้าของห้อง'}</small>}</div>
   <span className={`under-lobby-player-status${ready?' ready':''}`}><LobbyIcon name={ready?'check':'clock'}/>{!p.connected?'เชื่อมต่อใหม่':ready?'พร้อมแล้ว':'รออยู่'}</span>
  </article>;
 })}{Array.from({length:Math.max(0,UNDER_MAX_PLAYERS-players.length)},(_,i)=><div key={`empty-${i}`} className="under-lobby-empty" role="listitem"><span aria-hidden="true">＋</span><p>รอเพื่อนเข้าร่วม</p></div>)}</div>;
 return <div className="under-roster-list">{players.map(p=><article key={p.id} className={`under-player${p.id===playerId?' own':''}${p.id===turnId?' current':''}${!p.alive?' eliminated':''}`}><span className="club-avatar" aria-hidden="true">{p.name.slice(0,1)}</span><strong title={p.name}>{p.name}{p.id===playerId&&<small>คุณ</small>}</strong><span>{!p.connected?'เชื่อมต่อใหม่':!p.alive?'ออกจากรอบ':'อยู่ในรอบ'}</span></article>)}</div>;
}
export function UnderWord({secret,revealed,onToggle}:{secret:UnderSecret|null;revealed:boolean;onToggle():void}){
 return <section className={`under-word${revealed?' revealed':''}`} aria-label="คำลับของคุณ"><span>คำลับของคุณ</span><strong>{revealed?(secret?secret.word??'ไม่ได้รับคำลับ':'กำลังรับคำลับ…'):'••••••'}</strong><button className="small ghost" aria-pressed={revealed} onClick={onToggle}>{revealed?'ซ่อนคำลับ':'เปิดคำลับ'}</button>{revealed&&<small>อย่าพูดคำนี้ตรง ๆ</small>}</section>;
}
export function UnderHistory({hints,cycle}:{hints:UnderSnapshot['hints'];cycle:number}){
 const log=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[hints.length,hints.at(-1)?.id]);
 return <div ref={log} className="under-history" role="log" aria-label="คำใบ้ที่ผ่านมา">{!hints.length&&<p className="fine">คำใบ้ของทุกคนจะปรากฏที่นี่</p>}{hints.map(h=><article key={h.id}><small>{h.name} · รอบ {h.cycle}{h.cycle===cycle?' · รอบนี้':''}</small><p>{h.text}</p></article>)}</div>;
}
