import { GameArtwork } from './GameArtwork';
import { useState } from 'react';
import { session } from './session';
import type { SessionState } from './session';
import { navigate } from './router';
import { Card, Rules } from './components';
export function CreateRoomPage({ state, join }: { state: SessionState; join: boolean }) {
  const [name, setName] = useState(() => localStorage.getItem('pok.name') ?? '');
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('code') ?? '');
  const [botCount, setBotCount] = useState(0);
  const connect = () => { localStorage.setItem('pok.name', name.trim()); void session.connect(name, join ? code : undefined, botCount); };
  return (<main className="welcome">
      <button className="ghost pok-home" onClick={() => session.leave('/games')}>← กลับหน้าแรก</button>
      <div className="intro"><span className="eyebrow">ชวนเพื่อนมาเข้าวง</span><h1>ไพ่หนึ่งสำรับ<br/>ความสนุกทั้งวง<span>ป๊อกเด้งออนไลน์</span></h1><p>สร้างโต๊ะ ส่งรหัสให้เพื่อน แล้วเริ่มเล่น<br/>เปิดผ่าน browser ได้เลย เล่นกับเพื่อนหรือบอท รวม 2–6 คน</p><div className="hero-cards"><Card card={{ rank: 9, suit: 'spades' }}/><Card card={{ rank: 13, suit: 'hearts' }} index={1}/></div></div>
      <section className="entry"><GameArtwork game="pok"/><span className="eyebrow">POK DENG</span><h2>{join ? 'เข้าห้องป๊อกเด้ง' : 'ป๊อกเด้ง'}</h2><div className="tabs"><button className={!join ? 'selected' : ''} onClick={() => navigate('/rooms/create')}>สร้างห้อง</button><button className={join ? 'selected' : ''} onClick={() => navigate('/rooms/join')}>เข้าห้องเพื่อน</button></div>
        {state.snapshot && <div className="notice"><span>คุณยังอยู่ในห้อง {state.snapshot.code}</span><button onClick={() => navigate('/play/' + state.snapshot!.code)}>กลับไปเล่น</button><button onClick={() => session.leave()}>ออกจากห้อง</button></div>}
        <form onSubmit={e => { e.preventDefault(); connect(); }}>
          <label>ชื่อของคุณ<input maxLength={20} required value={name} onChange={e => setName(e.target.value)} placeholder="เพื่อนจะเห็นชื่อนี้" autoComplete="nickname"/></label>
          {!join && <label>จำนวนบอท<select value={botCount} disabled={state.status !== 'idle'} onChange={e => setBotCount(Number(e.target.value))}>{Array.from({ length: 6 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'ไม่เพิ่มบอท (เล่นกับเพื่อน)' : 'บอท ' + n + ' ตัว'}</option>)}</select></label>}
          {join && <label>รหัสห้อง<input required maxLength={10} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="เช่น A1B2C3D4E5" autoCapitalize="characters"/></label>}
          <div className="entry-facts"><span>ผู้เล่น<strong>2–6 คน</strong></span><span>เริ่มต้น<strong>1,000 แต้ม</strong></span></div><button className="primary full" disabled={state.status !== 'idle' || !name.trim() || (join && !code.trim())}>{state.status === 'connecting' ? 'กำลังเข้าห้อง…' : join ? 'เข้าร่วมโต๊ะ →' : 'สร้างโต๊ะใหม่ →'}</button>
        </form><p className="muted">เริ่มต้นคนละ 1,000 แต้ม ไม่มีเงินจริง</p><Rules/>
      </section>
    </main>);
}
