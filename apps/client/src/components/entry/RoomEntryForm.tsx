import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SessionState } from '../../session';
import { SpyfallSelect } from '../../SpyfallSelect';
import { navigate } from '../../router';

const botOptions = new Map([6, 8].map(limit => [limit, Array.from({ length: limit }, (_, value) => ({ value, label: value ? `บอท ${value} ตัว` : 'ไม่เพิ่มบอท (เล่นกับเพื่อน)' }))]));
function savedName() { try { return localStorage.getItem('pok.name') ?? ''; } catch { return ''; } }
export function RoomEntryTabs({ basePath, join }: { basePath: string; join: boolean }) {
  return <div className="tabs"><button className={!join ? 'selected' : ''} onClick={() => navigate(basePath + '/create')}>สร้างห้อง</button><button className={join ? 'selected' : ''} onClick={() => navigate(basePath + '/join')}>เข้าห้องเพื่อน</button></div>;
}
export function CurrentRoomNotice({ code, playPath, leave, prefix = 'ห้อง ' }: { code?: string; playPath: string; leave(): void; prefix?: string }) {
  return code ? <div className="notice"><span>{prefix}{code}</span><button onClick={() => navigate(playPath + '/' + code)}>กลับไปเล่น</button><button onClick={leave}>ออกจากห้อง</button></div> : null;
}
export function EntryFacts({ items }: { items: readonly (readonly [string, string])[] }) {
  return <div className="entry-facts">{items.map(([label, value]) => <span key={label}>{label}<strong>{value}</strong></span>)}</div>;
}
interface Props {
  join: boolean; status: SessionState['status']; createText: string; joinText: string;
  connect(name: string, code: string | undefined, botCount: number): void | Promise<void>;
  defaultBots?: number; botLimit?: 6 | 8; createSettings?: ReactNode; facts?: ReactNode; factsOnJoin?: boolean; joinHint?: ReactNode;
  namePlaceholder?: string; codePlaceholder?: string;
}
export function RoomEntryForm({ join, status, createText, joinText, connect, defaultBots = 0, botLimit, createSettings, facts, factsOnJoin = true, joinHint, namePlaceholder, codePlaceholder }: Props) {
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('code') ?? '');
  const [botCount, setBotCount] = useState(defaultBots);
  const disabled = status !== 'idle' || !name.trim() || (join && !code.trim());
  return <form onSubmit={event => {
    event.preventDefault(); if (disabled) return;
    try { localStorage.setItem('pok.name', name.trim()); } catch { /* Storage may be disabled; joining still works. */ }
    void connect(name, join ? code : undefined, botCount);
  }}>
    <label>ชื่อของคุณ<input required maxLength={20} value={name} onChange={event => setName(event.target.value)} placeholder={namePlaceholder} autoComplete="nickname"/></label>
    {join ? <><label>รหัสห้อง<input required maxLength={10} value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder={codePlaceholder} autoCapitalize="characters"/></label>{joinHint}</>
      : botLimit ? <SpyfallSelect<number> label="จำนวนบอท" value={botCount} disabled={status !== 'idle'} onChange={setBotCount} options={botOptions.get(botLimit)!}/> : createSettings}
    {(!join || factsOnJoin) && facts}
    <button className="primary full" disabled={disabled}>{status === 'connecting' ? 'กำลังเข้าห้อง…' : join ? joinText : createText}</button>
  </form>;
}
