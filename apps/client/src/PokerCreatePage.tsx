import { EntryGameSwitch } from './EntryGameSwitch';
import { SpyfallSelect as ClubSelect } from './SpyfallSelect';
import { GameArtwork } from './GameArtwork';
import { useState } from 'react';
import { pokerSession } from './session';
import type { SessionState } from './session';
import type { PokerSnapshot } from '../../../packages/shared/src/poker';
import { navigate } from './router';
import { PokerRules } from './PokerRules';
export function PokerCreatePage({ state, join }: { state: SessionState<PokerSnapshot>; join: boolean }) {
  const [name, setName] = useState(() => localStorage.getItem('pok.name') ?? '');
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('code') ?? '');
  const [botCount, setBotCount] = useState(1);
  return <main className="welcome poker-welcome"><div className="intro"><span className="eyebrow">TEXAS HOLD’EM · NO-LIMIT</span><h1>อ่านเกมให้ขาด<br/>แล้วเลือกตาของคุณ<span>Poker ในวงไพ่</span></h1><p>Blinds 10/20 · ชิปเริ่มต้น 1,000<br/>เพื่อนและบอทรวม 2–6 คน · แต้มจำลอง</p><button className="ghost" onClick={() => navigate('/games')}>← เลือกเกมอื่น</button></div>
    <section className="entry"><EntryGameSwitch/><GameArtwork game="poker"/><h2>{join ? 'เข้าห้อง Poker' : 'สร้างห้อง Poker'}</h2><div className="tabs"><button className={!join ? 'selected' : ''} onClick={() => navigate('/poker/rooms/create')}>สร้างห้อง</button><button className={join ? 'selected' : ''} onClick={() => navigate('/poker/rooms/join')}>เข้าห้องเพื่อน</button></div>
      {state.snapshot && <div className="notice"><span>ห้อง {state.snapshot.code}</span><button onClick={() => navigate('/poker/play/' + state.snapshot!.code)}>กลับไปเล่น</button><button onClick={() => pokerSession.leave()}>ออกจากห้อง</button></div>}
      <form onSubmit={e => { e.preventDefault(); localStorage.setItem('pok.name', name.trim()); void pokerSession.connect(name, join ? code : undefined, botCount); }}>
        <label>ชื่อของคุณ<input required maxLength={20} value={name} onChange={e => setName(e.target.value)} autoComplete="nickname"/></label>
        {join ? <label>รหัสห้อง<input required maxLength={10} value={code} onChange={e => setCode(e.target.value.toUpperCase())}/></label>
          : <ClubSelect<number> label="จำนวนบอท" value={botCount} disabled={state.status !== 'idle'} onChange={setBotCount} options={Array.from({length:6},(_,value)=>({value,label:value ? `บอท ${value} ตัว` : 'ไม่เพิ่มบอท (เล่นกับเพื่อน)'}))}/>}
        <div className="entry-facts"><span>ผู้เล่น<strong>2–6 คน</strong></span><span>Blinds<strong>10/20</strong></span><span>เริ่มต้น<strong>1,000 ชิป</strong></span></div><button className="primary full" disabled={state.status !== 'idle' || !name.trim()}>{state.status === 'connecting' ? 'กำลังเข้าห้อง…' : join ? 'เข้าร่วมโต๊ะ Poker →' : 'สร้างโต๊ะ Poker →'}</button>
      </form><p className="fine">ไพ่ส่วนตัว 2 ใบ + ไพ่กลาง 5 ใบ เลือกมือดีที่สุด 5 ใบ<br/>Fold · Check · Call · Raise · All-in<br/>รองรับ side pot และแบ่งชิปเมื่อเสมอ</p><PokerRules/></section></main>;
}
