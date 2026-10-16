import { useState } from 'react';
import { spySession } from './session';
import type { SessionState } from './session';
import type { SpySnapshot, SpySettings } from '../../../packages/shared/src/spyfall';
import { SPY_DEFAULT_SETTINGS } from '../../../packages/shared/src/spyfall';
import { navigate } from './router';
import { SpyfallRules } from './SpyfallRules';
import { SpyfallSettingsFields } from './SpyfallSettingsFields';
export function SpyfallCreatePage({ state, join }: { state: SessionState<SpySnapshot>; join: boolean }) {
  const [name,setName] = useState(() => localStorage.getItem('pok.name') ?? '');
  const [code,setCode] = useState(() => new URLSearchParams(location.search).get('code') ?? '');
  const [settings,setSettings] = useState<SpySettings>(() => ({ ...SPY_DEFAULT_SETTINGS }));
  return <main className="welcome spy-welcome"><section className="intro"><span className="eyebrow">SPYFALL · SOCIAL DEDUCTION</span><div className="spy-emblem" aria-hidden="true">◉</div><h1>หนึ่งคนมีความลับ<br/>ทั้งห้องมีคำถาม<span>ใครคือสายลับ?</span></h1><p>ถามให้ฉลาด ตอบให้เนียน แล้วจับพิรุธ<br/>ผู้เล่นจริง 3–8 คน · บทบาทลับ · แชตในเกม</p><button className="ghost" onClick={() => navigate('/games')}>← เลือกเกมอื่น</button></section>
    <section className="entry"><span className="eyebrow">MISSION BRIEFING</span><h2>{join ? 'เข้าห้อง Spyfall' : 'สร้างห้อง Spyfall'}</h2><div className="tabs"><button className={!join ? 'selected' : ''} onClick={() => navigate('/spyfall/rooms/create')}>สร้างห้อง</button><button className={join ? 'selected' : ''} onClick={() => navigate('/spyfall/rooms/join')}>เข้าห้องเพื่อน</button></div>
      {state.snapshot && <div className="notice"><span>ห้อง {state.snapshot.code}</span><button onClick={() => navigate('/spyfall/play/' + state.snapshot!.code)}>กลับไปเล่น</button><button onClick={() => spySession.leave()}>ออกจากห้อง</button></div>}
      <form onSubmit={e => { e.preventDefault(); localStorage.setItem('pok.name', name.trim()); void spySession.connect(name,join ? code : undefined,0,{...settings}); }}>
        <label>ชื่อของคุณ<input required maxLength={20} value={name} onChange={e => setName(e.target.value)} autoComplete="nickname"/></label>
        {join ? <><label>รหัสห้อง<input required maxLength={10} value={code} onChange={e => setCode(e.target.value.toUpperCase())}/></label><p className="fine">ผู้เล่น 3–8 คน · เวลาใช้ตามที่ผู้สร้างห้องกำหนด</p></> : <SpyfallSettingsFields value={settings} disabled={state.status !== 'idle'} onChange={(key,value) => setSettings(previous => ({ ...previous, [key]: value }))}/>}
        <button className="primary full" disabled={state.status !== 'idle' || !name.trim() || (join && !code.trim())}>{state.status === 'connecting' ? 'กำลังเข้าห้อง…' : join ? 'เข้าร่วมภารกิจ →' : 'สร้างห้อง Spyfall →'}</button>
      </form><SpyfallRules/></section></main>;
}
