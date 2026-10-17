import type { LiarPlayer, LiarSnapshot } from '../../../packages/shared/src/liar';
import { liarCardKey } from '../../../packages/shared/src/liar';
import { liarSession } from './session';
import { Card } from './components/ui/Card';

function PlayerBadge({player,own,host,turn,lobby}:{player:LiarPlayer;own:boolean;host:boolean;turn:boolean;lobby:boolean}) {
  return <article className={`liar-player${own?' own':''}${turn?' current':''}${player.finished?' finished':''}`}>
    <span className="club-avatar" aria-hidden="true">{player.isBot?'🤖':player.name.slice(0,1)}</span>
    <strong title={player.name}>{player.name}</strong><small>{own?'คุณ · ':''}{host?'เจ้าของห้อง · ':''}{player.isBot?'บอท':''}</small>
    <span>{!player.connected?'กำลังเชื่อมต่อ':lobby?(player.ready||host?'✓ พร้อมแล้ว':'รอพร้อม'):player.finished?'✓ ไพ่หมดแล้ว':`${player.cardCount} ใบ`}</span>
  </article>;
}
export function LiarRoster({s,playerId,lobby=false}:{s:LiarSnapshot;playerId:string;lobby?:boolean}) {
  return s.players.map(p=><PlayerBadge key={p.id} player={p} own={p.id===playerId} host={p.id===s.hostId} turn={!lobby&&p.id===s.turnId} lobby={lobby}/>);
}

export function LiarLobby({s,playerId,connected}:{s:LiarSnapshot;playerId:string;connected:boolean}) {
  const host=s.hostId===playerId, me=s.players.find(p=>p.id===playerId);
  const canStart=s.players.length>=2&&s.players.every(p=>p.connected&&(p.ready||p.isBot||p.id===s.hostId));
  return <section className="liar-lobby"><h1>ห้องพร้อมจับโกหก</h1><p>ส่งรหัสให้เพื่อน · เริ่มได้เมื่อมีอย่างน้อย 2 คน</p><div className="liar-lobby-roster">{<LiarRoster s={s} playerId={playerId} lobby/>}</div><p className="liar-entry-hint">ลงทีละใบตามเลข ใครไพ่หมดก่อนชนะ · ข้ามได้ เลขไม่เปลี่ยน</p><div className="liar-lobby-actions">{host?<><button disabled={!connected||s.players.length>=6} onClick={()=>liarSession.send('addBot')}>＋ เพิ่มบอท</button><button className="primary" disabled={!connected||!canStart} onClick={()=>liarSession.send('startRound')}>▶ เริ่มเกม</button></>:<button className="primary" disabled={!connected} onClick={()=>liarSession.send('setReady',!me?.ready)}>{me?.ready?'ยกเลิกพร้อม':'พร้อมเล่น'}</button>}</div></section>;
}
export function LiarResults({s,playerId,connected}:{s:LiarSnapshot;playerId:string;connected:boolean}) {
  const host=s.hostId===playerId;
  const name=(id:string)=>s.players.find(p=>p.id===id)?.name??'ผู้เล่น';
  if(!s.result)return null;
  return <section className="liar-results"><span className="eyebrow">ROUND COMPLETE</span><h1>{s.result.reason==='all_skipped'?'ข้ามครบทุกคน · จบรอบ':'เหลือผู้แพ้คนสุดท้าย'}</h1><p>ผู้แพ้: {s.result.loserIds.map(name).join(', ')}</p><div className="liar-result-list">{s.result.hands.map(h=><article key={h.playerId} className={s.result!.loserIds.includes(h.playerId)?'loser':''}><strong>{name(h.playerId)}{h.playerId===playerId?' · คุณ':''}</strong><div className="liar-result-hand">{h.cards.map(c=><Card key={liarCardKey(c)} card={c}/>)}</div><b>{h.finished?'✓ ไพ่หมดแล้ว · ชนะ':`${h.points} แต้ม${s.result!.loserIds.includes(h.playerId)?' · ผู้แพ้':''}`}</b></article>)}</div><p>A = 1 · 2–9 ตามหน้าไพ่ · 10, J, Q, K = 10</p>{host?<button className="primary" disabled={!connected} onClick={()=>liarSession.send('prepareRound')}>กลับห้องรอ / เตรียมรอบใหม่</button>:<p>รอผู้สร้างห้องเตรียมรอบใหม่</p>}</section>;
}
