import {useEffect,useRef} from 'react';
import type {UnderPlayer,UnderSnapshot,UnderSecret} from '../../../packages/shared/src/undercover';
export function UnderRoster({players,playerId,turnId='',hostId='',lobby=false}:{players:UnderPlayer[];playerId:string;turnId?:string;hostId?:string;lobby?:boolean}){
 return <div className="under-roster-list">{players.map(p=><article key={p.id} className={`under-player${p.id===playerId?' own':''}${p.id===turnId?' current':''}${!p.alive?' eliminated':''}`}><span className="club-avatar" aria-hidden="true">{p.name.slice(0,1)}</span><strong title={p.name}>{p.name}{p.id===playerId&&<small>คุณ</small>}</strong><span>{!p.connected?'เชื่อมต่อใหม่':lobby?(p.ready||p.id===hostId?'✓ พร้อม':'รอพร้อม'):!p.alive?'ออกจากรอบ':'อยู่ในรอบ'}</span></article>)}</div>;
}
export function UnderWord({secret,revealed,onToggle}:{secret:UnderSecret|null;revealed:boolean;onToggle():void}){
 return <section className={`under-word${revealed?' revealed':''}`} aria-label="คำลับของคุณ"><span>คำลับของคุณ</span><strong>{revealed?(secret?secret.word??'ไม่ได้รับคำลับ':'กำลังรับคำลับ…'):'••••••'}</strong><button className="small ghost" aria-pressed={revealed} onClick={onToggle}>{revealed?'ซ่อนคำลับ':'เปิดคำลับ'}</button>{revealed&&<small>อย่าพูดคำนี้ตรง ๆ</small>}</section>;
}
export function UnderHistory({hints,cycle}:{hints:UnderSnapshot['hints'];cycle:number}){
 const log=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[hints.length,hints.at(-1)?.id]);
 return <div ref={log} className="under-history" role="log" aria-label="คำใบ้ที่ผ่านมา">{!hints.length&&<p className="fine">คำใบ้ของทุกคนจะปรากฏที่นี่</p>}{hints.map(h=><article key={h.id}><small>{h.name} · รอบ {h.cycle}{h.cycle===cycle?' · รอบนี้':''}</small><p>{h.text}</p></article>)}</div>;
}
