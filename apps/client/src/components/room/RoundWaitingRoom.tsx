import { createContext, useContext, useState } from 'react';
import type { RoomMember } from '../../../../../packages/shared/src/room';
import { isBetweenRounds } from '../../../../../packages/shared/src/room';
import type { GameKind } from '../../games';
import { games } from '../../games';
import { RoomIdentity } from '../ui/RoomIdentity';
import { GameDialog } from '../ui/GameDialog';
import './round-waiting.css';

export const RoundWaitingContext = createContext<RoomMember[]>([]);
export function WaitingQueueButton() {
  const players = useContext(RoundWaitingContext);
  const [open, setOpen] = useState(false);
  if (!players.length) return null;
  return <><button type="button" className="small round-queue-button" aria-label={'ผู้รอรอบถัดไป ' + players.length + ' คน'} title="ผู้รอรอบถัดไป" onClick={() => setOpen(true)}><span aria-hidden="true">◷</span><b>{players.length}</b></button>
    {open && <GameDialog title="ผู้รอรอบถัดไป" onClose={() => setOpen(false)}><p>เพื่อนเหล่านี้จะเข้าร่วมเมื่อเริ่มรอบใหม่</p><ul className="round-queue-list">{players.map(player => <li key={player.id}><span>{player.name}</span><small>{player.connected ? 'รอรอบถัดไป' : 'รอเชื่อมต่อกลับ'}</small></li>)}</ul></GameDialog>}
  </>;
}
export function RoundWaitingRoom({ kind, snapshot, playerId, leave }: {
  kind: GameKind; snapshot: { code: string; roundId: number; phase: string; players: RoomMember[] }; playerId: string; leave(): void;
}) {
  const metadata = games[kind];
  const playing = snapshot.players.filter(player => !player.waiting);
  const waiting = snapshot.players.filter(player => player.waiting);
  const ended = isBetweenRounds(snapshot.phase);
  return <main className="round-waiting-page">
    <header className="round-waiting-header"><RoomIdentity code={snapshot.code}/><div className="round-waiting-tools"><span>{metadata.name}</span><button type="button" className="small ghost" onClick={leave}>ออกจากห้อง</button></div></header>
    <div className="round-waiting-layout">
      <section className="round-waiting-hero" aria-labelledby="round-waiting-title"><span className="eyebrow">เข้าห้องเรียบร้อยแล้ว</span>
        <svg className="round-waiting-clock" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="26"/><path d="M32 16v17l11 7"/></svg>
        <h1 id="round-waiting-title">รอเข้าร่วมรอบถัดไป</h1><p role="status">{ended ? 'รอบนี้จบแล้ว · รอ Host เตรียมรอบใหม่' : 'เพื่อนกำลังเล่นรอบที่ ' + snapshot.roundId}</p>
        <p className="round-waiting-copy">คุณอยู่ในห้องแล้ว ไม่ต้องใส่รหัสซ้ำ<br/>{kind === 'whoami' ? 'เมื่อ Host เตรียมรอบใหม่หรือเริ่มเกมถัดไป คุณจะกลับไปหน้าโต๊ะอัตโนมัติ' : 'เมื่อ Host เตรียมรอบใหม่ คุณจะกลับไปกดพร้อมที่โต๊ะอัตโนมัติ'}</p>
        <div className="round-waiting-summary"><div><strong>{playing.length}</strong><span>{ended ? 'ผู้เล่นรอบก่อน' : 'กำลังเล่น'}</span></div><div><strong>{waiting.length}</strong><span>รอรอบถัดไป</span></div></div>
        <p className="fine">ระหว่างรอ คุณยังไม่ได้รับไพ่หรือบทบาทลับ และยังไม่เสียชิปของรอบนี้</p>
      </section>
      <aside className="round-waiting-roster"><h2>เพื่อนในห้อง <small>{snapshot.players.length} คน</small></h2><ul>{snapshot.players.map(player => <li key={player.id}><div><strong>{player.name}</strong>{player.id === playerId && <span className="round-waiting-own">คุณ</span>}</div><small className={player.waiting ? 'is-waiting' : ''}>{!player.connected ? 'กำลังเชื่อมต่อกลับ' : player.waiting ? 'รอรอบถัดไป' : ended ? 'รอเริ่มรอบใหม่' : 'กำลังเล่น'}</small></li>)}</ul></aside>
    </div>
  </main>;
}
