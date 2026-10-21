import {useState} from 'react';
import type {ReactNode} from 'react';
import type {SessionState} from '../../session';
import {SpyfallSelect} from '../../SpyfallSelect';
import {RoadIcon} from '../../roadfighter/RoadIcon';
import {navigate} from '../../router';

const botOptions = new Map([6, 8, 10].map(limit => [limit, Array.from({length: limit}, (_, value) => ({
  value, label: value ? `บอท ${value} ตัว${limit === 10 ? ` (รวม ${value + 1} คน)` : ''}` : 'ไม่เพิ่มบอท (เล่นกับเพื่อน)',
}))]));
function savedName() { try { return localStorage.getItem('pok.name') ?? ''; } catch { return ''; } }
export function RoomEntryTabs({basePath, join}: {basePath: string; join: boolean}) {
  return <nav className="tabs" aria-label="เลือกการเข้าห้อง">
    <button type="button" className={!join ? 'selected' : ''} aria-pressed={!join} onClick={() => navigate(basePath + '/create')}>สร้างห้อง</button>
    <button type="button" className={join ? 'selected' : ''} aria-pressed={join} onClick={() => navigate(basePath + '/join')}>เข้าห้องเพื่อน</button>
  </nav>;
}
export function CurrentRoomNotice({code, playPath, leave, prefix = 'ห้อง '}: {code?: string; playPath: string; leave(): void; prefix?: string}) {
  return code ? <div className="notice"><span>{prefix}{code}</span><button type="button" onClick={() => navigate(playPath + '/' + code)}>กลับไปเล่น</button><button type="button" onClick={leave}>ออกจากห้อง</button></div> : null;
}
export interface RoomEntryFormProps {
  join: boolean;
  status: SessionState['status'];
  gameName: string;
  connect(name: string, code: string | undefined, botCount: number): void | Promise<void>;
  defaultBots?: number;
  botLimit?: 6 | 8 | 10;
  createSettings?: ReactNode;
  namePlaceholder?: string;
  codePlaceholder?: string;
}
export function RoomEntryForm({join, status, gameName, connect, defaultBots = 0, botLimit, createSettings, namePlaceholder, codePlaceholder}: RoomEntryFormProps) {
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('code') ?? '');
  const [botCount, setBotCount] = useState(defaultBots);
  const disabled = status !== 'idle' || !name.trim() || (join && !code.trim());
  const connecting = status === 'connecting';
  return <form onSubmit={event => {
    event.preventDefault(); if (disabled) return;
    try { localStorage.setItem('pok.name', name.trim()); } catch { /* Storage can be unavailable. */ }
    void connect(name, join ? code : undefined, botCount);
  }}>
    <label>ชื่อของคุณ<input required maxLength={20} value={name} onChange={event => setName(event.target.value)}
      placeholder={namePlaceholder} autoComplete="nickname"/></label>
    {join ? <>
      <label>รหัสห้อง<input required maxLength={10} value={code} onChange={event => setCode(event.target.value.toUpperCase())}
        placeholder={codePlaceholder} autoCapitalize="characters"/></label>
      <p className="room-entry-join-hint">ขอรหัสห้องจากเพื่อน แล้วเข้ามาเล่นด้วยกัน</p>
    </> : <>
      {botLimit && <SpyfallSelect<number> label="จำนวนบอท" value={botCount} disabled={status !== 'idle'}
        onChange={setBotCount} options={botOptions.get(botLimit)!}/>}
      {createSettings}
    </>}
    <button className="primary full" disabled={disabled} aria-label={connecting ? 'กำลังเข้าห้อง…' : (join ? 'เข้าร่วมห้อง ' : 'สร้างห้อง ') + gameName}>
      <RoadIcon name={join ? 'right' : 'user'}/>{connecting ? 'กำลังเข้าห้อง…' : join ? 'เข้าร่วมห้อง' : 'สร้างห้อง'}
    </button>
  </form>;
}
